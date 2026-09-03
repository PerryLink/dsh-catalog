// Generate same-origin plugin icons for the catalog: one 128x128 PNG per
// package (deterministic color from the name hash, white initials from the
// displayName) into deploy/icons/, plus deploy/icons-data.mjs (a base64 map
// the Cloudflare Worker imports so /icons/*.png resolves with zero runtime
// I/O). Idempotent; no network. Usage: node scripts/build-icons.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const base = fileURLToPath(new URL('..', import.meta.url))
const stripBom = (value) => value.replace(/^\uFEFF/, '')
const packages = JSON.parse(stripBom(await readFile(`${base}/data/packages.json`, 'utf8')))

// --- PNG encoding (RGBA, 8-bit, filter 0, zlib) ---
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
const encodePng = (size, rgba) => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// --- 5x7 bitmap font (A-Z, 0-9) ---
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
}

const PALETTE = [
  [231, 76, 60], [230, 126, 34], [241, 196, 15], [46, 204, 113], [26, 188, 156],
  [52, 152, 219], [155, 89, 182], [233, 30, 99], [0, 188, 212], [63, 81, 181],
  [76, 175, 80], [255, 152, 0], [96, 125, 139], [121, 85, 72],
]

const hash = (value) => {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return h
}

const slugOf = (id) => id.replace(/^@/, '').replace(/[^A-Za-z0-9._-]/g, '-')

const initialsOf = (displayName) =>
  displayName.split(/\s+/).filter((word) => /^[A-Za-z0-9]/.test(word))
    .slice(0, 2).map((word) => word[0].toUpperCase()).join('')

const drawGlyph = (glyph, scale, rgba, size, x0, y0, color) => {
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (glyph[row][col] !== '1') continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = x0 + col * scale + dx
          const y = y0 + row * scale + dy
          if (x < 0 || x >= size || y < 0 || y >= size) continue
          const i = (y * size + x) * 4
          rgba[i] = color[0]; rgba[i + 1] = color[1]; rgba[i + 2] = color[2]; rgba[i + 3] = 255
        }
      }
    }
  }
}

const renderIcon = (pkg) => {
  const size = 128
  const rgba = Buffer.alloc(size * size * 4) // transparent
  const [cr, cg, cb] = PALETTE[hash(pkg.npm) % PALETTE.length]
  const radius = 26
  const inset = 4
  const inRoundRect = (x, y) => {
    const lo = inset
    const hi = size - 1 - inset
    const cx = x < lo + radius ? lo + radius : x > hi - radius ? hi - radius : x
    const cy = y < lo + radius ? lo + radius : y > hi - radius ? hi - radius : y
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius &&
      x >= lo && x <= hi && y >= lo && y <= hi
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundRect(x, y)) continue
      const i = (y * size + x) * 4
      rgba[i] = cr; rgba[i + 1] = cg; rgba[i + 2] = cb; rgba[i + 3] = 255
    }
  }
  const text = initialsOf(pkg.displayName) || 'P'
  const glyphs = [...text].map((ch) => FONT[ch]).filter(Boolean)
  const scale = glyphs.length > 1 ? 7 : 11
  const glyphW = 5 * scale
  const glyphH = 7 * scale
  const gap = glyphs.length > 1 ? 12 : 0
  const totalW = glyphs.length * glyphW + (glyphs.length - 1) * gap
  const totalH = glyphH
  const x0 = Math.floor((size - totalW) / 2)
  const y0 = Math.floor((size - totalH) / 2)
  const white = [255, 255, 255]
  let cursor = x0
  for (const glyph of glyphs) {
    drawGlyph(glyph, scale, rgba, size, cursor, y0, white)
    cursor += glyphW + gap
  }
  return encodePng(size, rgba)
}

await mkdir(`${base}/deploy/icons`, { recursive: true })
const map = {}
for (const pkg of packages) {
  const slug = slugOf(pkg.npm)
  const png = renderIcon(pkg)
  await writeFile(`${base}/deploy/icons/${slug}.png`, png)
  map[`/icons/${slug}.png`] = png.toString('base64')
}
await writeFile(
  `${base}/deploy/icons-data.mjs`,
  `// Generated by scripts/build-icons.mjs — base64 PNG map for the Workers icon route.\nexport const icons = ${JSON.stringify(map)}\n`,
)
console.log(`built ${packages.length} icons -> deploy/icons/*.png + deploy/icons-data.mjs`)
