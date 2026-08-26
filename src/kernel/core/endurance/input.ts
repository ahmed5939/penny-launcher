import type { ChildProcessWithoutNullStreams } from 'node:child_process'

import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * The old macro spawned a fresh powershell.exe for every single click
 * (~300ms of process startup each). This keeps ONE PowerShell worker alive
 * for the whole run and streams it one command per line, so a click costs
 * milliseconds instead.
 *
 * Protocol (stdin → stdout, one line each):
 *   ping            → ok
 *   click <x> <y>   → ok            (absolute pixels)
 *   key <name>      → ok
 *   scroll <steps>  → ok
 *   check <process> → ok running | ok absent
 *   focus <process> → ok <title>    (foregrounds the process main window)
 */
const workerScript = `
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class PennyInputWorker {
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    private static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindowAsync(IntPtr hWnd, int command);

    private const uint LEFT_DOWN = 0x0002;
    private const uint LEFT_UP = 0x0004;
    private const uint WHEEL = 0x0800;
    private const uint KEY_UP = 0x0002;

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extraInfo);

    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int index);

    public static void Click(int x, int y) {
        if (!SetCursorPos(x, y)) throw new InvalidOperationException("Could not position the mouse cursor.");
        System.Threading.Thread.Sleep(40);
        mouse_event(LEFT_DOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(40);
        mouse_event(LEFT_UP, 0, 0, 0, UIntPtr.Zero);
    }

    public static bool Focus(IntPtr window) {
        ShowWindowAsync(window, 9);
        return SetForegroundWindow(window);
    }

    public static void Key(string name) {
        byte key;
        switch (name.ToLowerInvariant()) {
            case "tab": key = 0x09; break;
            case "escape": key = 0x1B; break;
            case "c": key = 0x43; break;
            case "i": key = 0x49; break;
            default: throw new ArgumentException("Unsupported key: " + name);
        }
        keybd_event(key, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(45);
        keybd_event(key, 0, KEY_UP, UIntPtr.Zero);
    }

    public static void Scroll(int steps) {
        SetCursorPos(GetSystemMetrics(0) / 2, GetSystemMetrics(1) / 2);
        System.Threading.Thread.Sleep(150);
        mouse_event(WHEEL, 0, 0, unchecked((uint)(steps * 120)), UIntPtr.Zero);
    }
}
"@

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  try {
    $parts = $line.Trim() -split '\\s+'
    switch ($parts[0]) {
      'ping' {
        [Console]::Out.WriteLine('ok')
      }
      'click' {
        [PennyInputWorker]::Click([int]$parts[1], [int]$parts[2])
        [Console]::Out.WriteLine('ok')
      }
      'key' {
        [PennyInputWorker]::Key($parts[1])
        [Console]::Out.WriteLine('ok')
      }
      'scroll' {
        [PennyInputWorker]::Scroll([int]$parts[1])
        [Console]::Out.WriteLine('ok')
      }
      'check' {
        $name = $parts[1] -replace '\\.exe$', ''
        $found = Get-Process -Name $name -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
          [Console]::Out.WriteLine('ok running')
        } else {
          [Console]::Out.WriteLine('ok absent')
        }
      }
      'focus' {
        $name = $parts[1] -replace '\\.exe$', ''
        $target = Get-Process -Name $name -ErrorAction SilentlyContinue |
          Where-Object { $_.MainWindowHandle -ne 0 } |
          Select-Object -First 1
        if (-not $target) { throw "No visible window for $name." }
        if (-not [PennyInputWorker]::Focus($target.MainWindowHandle)) {
          $shell = New-Object -ComObject WScript.Shell
          if (-not $shell.AppActivate($target.Id)) { throw 'Windows refused to foreground the game.' }
        }
        [Console]::Out.WriteLine('ok ' + $target.MainWindowTitle)
      }
      default {
        [Console]::Out.WriteLine('error unknown-command')
      }
    }
  } catch {
    [Console]::Out.WriteLine('error ' + ($_.Exception.Message -replace '\\r|\\n', ' '))
  }
  [Console]::Out.Flush()
}
`

export class InputWorker {
  private process: ChildProcessWithoutNullStreams | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private scriptPath: string

  constructor(storageDirectory: string) {
    this.scriptPath = path.join(storageDirectory, 'input-worker.ps1')
  }

  private async ensureStarted() {
    if (this.process && this.process.exitCode === null) {
      return
    }

    await mkdir(path.dirname(this.scriptPath), { recursive: true })
    await writeFile(this.scriptPath, workerScript, { encoding: 'utf8' })

    this.process = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        this.scriptPath,
      ],
      {
        stdio: 'pipe',
        windowsHide: true,
      },
    )
    this.process.on('exit', () => {
      this.process = null
    })

    // The Add-Type compile makes the very first command slow; a ping up
    // front absorbs that cost before the run needs precise timing.
    await this.send('ping')
  }

  private send(command: string, timeoutMs = 15_000): Promise<string> {
    const run = async () => {
      const worker = this.process

      if (!worker || worker.exitCode !== null) {
        throw new Error('The input worker is not running.')
      }

      return await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup()
          reject(new Error(`Input command timed out: ${command}`))
        }, timeoutMs)
        let buffer = ''

        const onData = (chunk: Buffer) => {
          buffer += chunk.toString('utf8')
          const newline = buffer.indexOf('\n')

          if (newline < 0) {
            return
          }

          const line = buffer.slice(0, newline).trim()

          cleanup()

          if (line.startsWith('ok')) {
            resolve(line)
          } else {
            reject(new Error(line.replace(/^error\s*/, '') || 'Input command failed.'))
          }
        }

        const cleanup = () => {
          clearTimeout(timer)
          worker.stdout.off('data', onData)
        }

        worker.stdout.on('data', onData)
        worker.stdin.write(`${command}\n`)
      })
    }

    const result = this.queue.then(run, run)

    this.queue = result.catch(() => {})

    return result
  }

  async click(x: number, y: number) {
    await this.ensureStarted()
    await this.send(`click ${Math.round(x)} ${Math.round(y)}`)
  }

  async focus(processName: string) {
    await this.ensureStarted()
    await this.send(`focus ${processName}`)
  }

  async key(name: 'Tab' | 'Escape' | 'C' | 'I') {
    await this.ensureStarted()
    await this.send(`key ${name}`)
  }

  async scroll(steps: number) {
    await this.ensureStarted()
    await this.send(`scroll ${Math.trunc(steps)}`)
  }

  /** Authoritative "is the game up" check, independent of watcher latency. */
  async checkProcess(processName: string): Promise<boolean> {
    await this.ensureStarted()

    const result = await this.send(`check ${processName}`)

    return result.includes('running')
  }

  stop() {
    if (this.process && this.process.exitCode === null) {
      this.process.kill()
    }

    this.process = null
  }
}
