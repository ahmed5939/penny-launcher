# Penny live performance measurement

Measured 2026-09-06, approximately 01:14–01:15 Asia/Baghdad, using the already running development session. No application changes, builds, restarts, or dev-server launches were performed for this measurement.

## Stable sample

Linux / Wayland, Intel Core i7-12700H, 20 logical CPUs. Electron main PID 54291. Sample duration: 30.58 seconds, 16 observations at approximately two-second intervals. All seven client processes survived this sample.

| Metric | Observed value |
| --- | ---: |
| Client memory, proportional resident share (PSS), average | 492.81 MiB |
| Client PSS range | 491.83–494.41 MiB |
| Client private resident memory, end | 340.20 MiB |
| Client CPU, where 100% means one logical CPU | 1.90% |
| Client CPU, normalized across 20 logical CPUs | 0.095% |
| GPU render-engine activity attributable to client GPU process | 0.05% |
| Client disk reads over sample | 0 bytes |
| Client disk writes over sample | 8 KiB |
| Development tools PSS, average, excluded from client | 683.15 MiB |
| Development tools CPU, one-core scale | 0.06% |
| Client plus development tools PSS, average | 1175.96 MiB |

PSS allocates shared resident pages proportionally instead of counting them in full for every process. It is a better aggregate than simply summing RSS. Private resident memory is also shown; neither metric equals all committed memory. Graphics allocations may overlap shared system memory and must not be blindly added to these totals.

## Client breakdown at sample end

Memory is PSS in MiB. CPU is the interval average on the one-core scale.

| Process | Memory | CPU |
| --- | ---: | ---: |
| main (54291) | 147.5 | 0.36% |
| zygote (54296) | 13.1 | 0.00% |
| zygote (54297) | 11.3 | 0.00% |
| zygote (54299) | 4.4 | 0.00% |
| GPU (54340) | 104.6 | 0.98% |
| network (54343) | 31.7 | 0.00% |
| renderer (54374) | 181.8 | 0.56% |

A separate DRM snapshot reported approximately 296.5 MiB of resident graphics buffers associated with the GPU process on the integrated Intel GPU. This is a point-in-time driver allocation figure, not additional unique memory to add to PSS. GPU engine activity above is measured over the full stable interval.

## Interpretation

CPU and GPU activity were low in the stable observation. Memory is still substantial for a lean launcher: approximately 493 MiB PSS, with 340 MiB privately resident. UI, main-process, and GPU-process memory dominate. The development tools consume another 683 MiB; this separate overhead should not be attributed to the shipped client. The client itself is also running in development mode, so these numbers do not predict a packaged Windows release exactly.

The app window was mapped, not marked hidden, on workspace 3 at 781 × 850 pixels. The exact page, active workspace, account count, and user interaction state were not confirmed, so this is a stable observed session rather than a controlled home-screen or minimized benchmark.

An earlier 30.55-second sample showed 492–544 MiB PSS and substantially more activity. An extra renderer exited during that interval. Development startup automatically opens undocked DevTools, making it a plausible explanation for the extra renderer, but its identity was not verified. CPU totals from that first sample omit the exited process, so it is not used as the baseline.

Memory rose only about 1.9 MiB between the beginning and end of the stable sample. Thirty seconds is insufficient to establish or exclude a memory leak. No before-change sample exists, so this is not a measured percentage improvement from the fixes. Network bytes were not measured; zero disk reads does not mean zero network traffic.

Next meaningful comparisons are the same screen with the window minimized for more than 60 seconds, item-page open/close cycles, a stationary 3D scene, and a packaged Windows release with identical account/settings state. These would separate retained feature data from runtime overhead.

Raw samples remain in `/tmp/penny-perf-1788646472.json` and `/tmp/penny-perf-1788646517.json`. The read-only sampling script is `/tmp/penny-perf-sample.py`.
