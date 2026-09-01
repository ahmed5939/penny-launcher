/**
 * CityHash64 — Google's CityHash, ported to BigInt arithmetic so the
 * 64-bit multiplies are exact. Used to recompute IoStore chunk hashes in
 * `.utoc` files whose TOC version predates the SHA-1 switch.
 *
 * Ported from the reference implementation
 * (github.com/google/cityhash, via CUE4Parse.Utils.CityHash).
 */

const K0 = 0xc3a5c85c97cb3127n
const K1 = 0xb492b66fbe98f273n
const K2 = 0x9ae16a3b2f90404fn
const K_MUL = 0x9ddfea08eb382d69n
const MASK = (1n << 64n) - 1n

function rotate(value: bigint, shift: number): bigint {
  if (shift === 0) {
    return value
  }

  return ((value >> BigInt(shift)) | (value << BigInt(64 - shift))) & MASK
}

function shiftMix(value: bigint): bigint {
  return (value ^ (value >> 47n)) & MASK
}

function fetch64(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset)
}

function fetch32(buf: Buffer, offset: number): bigint {
  return BigInt(buf.readUInt32LE(offset))
}

function hash128To64(low: bigint, high: bigint): bigint {
  let a = (low ^ high) * K_MUL & MASK
  a ^= a >> 47n
  let b = (high ^ a) * K_MUL & MASK
  b ^= b >> 47n
  b = b * K_MUL & MASK
  return b
}

function hashLen16(u: bigint, v: bigint): bigint {
  return hash128To64(u, v)
}

function hashLen16Mul(u: bigint, v: bigint, mul: bigint): bigint {
  let a = (u ^ v) * mul & MASK
  a ^= a >> 47n
  let b = (v ^ a) * mul & MASK
  b ^= b >> 47n
  b = b * mul & MASK
  return b
}

function bswap64(value: bigint): bigint {
  let v = value & MASK
  v =
    ((v << 8n) & 0xff00ff00ff00ff00n) |
    ((v >> 8n) & 0x00ff00ff00ff00ffn)
  v =
    ((v << 16n) & 0xffff0000ffff0000n) |
    ((v >> 16n) & 0x0000ffff0000ffffn)
  return ((v << 32n) | (v >> 32n)) & MASK
}

function weakHashLen32WithSeeds(
  w: bigint,
  x: bigint,
  y: bigint,
  z: bigint,
  a: bigint,
  b: bigint
): [bigint, bigint] {
  a = (a + w) & MASK
  b = rotate((b + a + z) & MASK, 21)
  const c = a
  a = (a + x) & MASK
  a = (a + y) & MASK
  b = (b + rotate(a, 44)) & MASK
  return [(a + z) & MASK, (b + c) & MASK]
}

function weakHashLen32WithSeedsAt(
  buf: Buffer,
  offset: number,
  a: bigint,
  b: bigint
): [bigint, bigint] {
  return weakHashLen32WithSeeds(
    fetch64(buf, offset),
    fetch64(buf, offset + 8),
    fetch64(buf, offset + 16),
    fetch64(buf, offset + 24),
    a,
    b
  )
}

function hashLen0to16(buf: Buffer, length: bigint): bigint {
  const len = Number(length)

  if (len >= 8) {
    const mul = (K2 + length * 2n) & MASK
    const a = (fetch64(buf, 0) + K2) & MASK
    const b = fetch64(buf, len - 8)
    const c = ((rotate(b, 37) * mul) + a) & MASK
    const d = ((rotate(a, 25) + b) * mul) & MASK
    return hashLen16Mul(c, d, mul)
  }

  if (len >= 4) {
    const mul = (K2 + length * 2n) & MASK
    const a = fetch32(buf, 0)
    return hashLen16Mul(length + (a << 3n), fetch32(buf, len - 4), mul)
  }

  if (len > 0) {
    const a = BigInt(buf[0])
    const b = BigInt(buf[len >> 1])
    const c = BigInt(buf[len - 1])
    const y = a + (b << 8n)
    const z = length + (c << 2n)
    return (
      shiftMix(((y * K2) ^ (z * K0)) & MASK) * K2
    ) & MASK
  }

  return K2
}

function hashLen17to32(buf: Buffer, length: bigint): bigint {
  const len = Number(length)
  const mul = (K2 + length * 2n) & MASK
  const a = (fetch64(buf, 0) * K1) & MASK
  const b = fetch64(buf, 8)
  const c = (fetch64(buf, len - 8) * mul) & MASK
  const d = (fetch64(buf, len - 16) * K2) & MASK
  return hashLen16Mul(
    (rotate((a + b) & MASK, 43) + rotate(c, 30) + d) & MASK,
    (a + rotate((b + K2) & MASK, 18) + c) & MASK,
    mul
  )
}

function hashLen33to64(buf: Buffer, length: bigint): bigint {
  const len = Number(length)
  const mul = (K2 + length * 2n) & MASK
  let a = (fetch64(buf, 0) * K2) & MASK
  let b = fetch64(buf, 8)
  const c = fetch64(buf, len - 24)
  const d = fetch64(buf, len - 32)
  const e = (fetch64(buf, 16) * K2) & MASK
  const f = (fetch64(buf, 24) * 9n) & MASK
  const g = fetch64(buf, len - 8)
  const h = (fetch64(buf, len - 16) * mul) & MASK
  const u =
    (rotate((a + g) & MASK, 43) + (((rotate(b, 30) + c) & MASK) * 9n)) & MASK
  const v = ((((a + g) ^ d) + f + 1n)) & MASK
  const w = (bswap64((u + v) * mul & MASK) + h) & MASK
  const x = (rotate((e + f) & MASK, 42) + c) & MASK
  const y = ((bswap64((v + w) * mul & MASK) + g) * mul) & MASK
  const z = (e + f + c) & MASK
  a = (bswap64(((x + z) * mul + y) & MASK) + b) & MASK
  b = (shiftMix(((z + a) * mul + d + h) & MASK) * mul) & MASK
  return (b + x) & MASK
}

export function cityHash64(buf: Buffer): bigint {
  if (buf.length === 0) {
    // Matches the reference implementation: HashLen0to16 with len 0.
    return K2
  }

  const len = BigInt(buf.length)

  if (len <= 16n) {
    return hashLen0to16(buf, len)
  }

  if (len <= 32n) {
    return hashLen17to32(buf, len)
  }

  if (len <= 64n) {
    return hashLen33to64(buf, len)
  }

  let length = len
  let x = fetch64(buf, Number(len) - 40)
  let y = (fetch64(buf, Number(len) - 16) + fetch64(buf, Number(len) - 56)) & MASK
  let z = hashLen16(
    (fetch64(buf, Number(len) - 48) + len) & MASK,
    fetch64(buf, Number(len) - 24)
  )
  let v = weakHashLen32WithSeedsAt(buf, Number(len) - 64, len, z)
  let w = weakHashLen32WithSeedsAt(buf, Number(len) - 32, (y + K1) & MASK, x)
  x = (x * K1 + fetch64(buf, 0)) & MASK
  length = (length - 1n) & ~63n

  let offset = 0

  do {
    x = rotate((x + y + v[0] + fetch64(buf, offset + 8)) & MASK, 37) * K1 & MASK
    y = rotate((y + v[1] + fetch64(buf, offset + 48)) & MASK, 42) * K1 & MASK
    x ^= w[1]
    y = (y + v[0] + fetch64(buf, offset + 40)) & MASK
    z = rotate((z + w[0]) & MASK, 33) * K1 & MASK
    v = weakHashLen32WithSeedsAt(buf, offset, (v[1] * K1) & MASK, (x + w[0]) & MASK)
    w = weakHashLen32WithSeedsAt(
      buf,
      offset + 32,
      (z + w[1]) & MASK,
      (y + fetch64(buf, offset + 16)) & MASK
    )

    // Swap z and x.
    z ^= x
    x ^= z
    z ^= x

    offset += 64
    length -= 64n
  } while (length !== 0n)

  return hashLen16(
    (hashLen16(v[0], w[0]) + shiftMix(y) * K1 + z) & MASK,
    hashLen16(v[1], w[1]) + x
  )
}

/** The 8-byte little-endian form Zen stores in the chunk meta. */
export function cityHash64Bytes(buf: Buffer): Buffer {
  const hash = cityHash64(buf)
  const out = Buffer.alloc(8)
  out.writeBigUInt64LE(hash & MASK, 0)
  return out
}
