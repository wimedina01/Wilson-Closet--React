/**
 * Background replacement utility.
 * Detects the background color by sampling image edges, then replaces
 * similar pixels with a chosen solid color using flood-fill from corners.
 */

/**
 * Replace the background of an image with a solid color.
 * @param {string} imageSrc — data URL or object URL of the source image
 * @param {string} hexColor — target background hex color (e.g. "#E8D5B7")
 * @param {number} tolerance — color distance threshold (0-255), default 42
 * @returns {Promise<{dataUrl: string, b64: string, mime: string}>}
 */
export function replaceBackground(imageSrc, hexColor, tolerance = 42) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const result = processImage(img, hexColor, tolerance)
        resolve(result)
      } catch (e) { reject(e) }
    }
    img.onerror = () => reject(new Error('Failed to load image for background replacement'))
    img.src = imageSrc
  })
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

function processImage(img, hexColor, tolerance) {
  const w = img.width, h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)

  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data

  const fill = hexToRgb(hexColor)

  // Sample edge pixels to find the dominant background color
  const edgeSamples = []
  const step = 3
  for (let x = 0; x < w; x += step) {
    edgeSamples.push(getPixel(data, x, 0, w))       // top
    edgeSamples.push(getPixel(data, x, h - 1, w))   // bottom
  }
  for (let y = 0; y < h; y += step) {
    edgeSamples.push(getPixel(data, 0, y, w))       // left
    edgeSamples.push(getPixel(data, w - 1, y, w))   // right
  }

  // Find the dominant color cluster among edge samples
  const bgColor = dominantColor(edgeSamples)

  // Flood-fill from all four corners + edge pixels to mark background
  const visited = new Uint8Array(w * h)
  const bgMask = new Uint8Array(w * h)
  const queue = []

  // Seed from corners and edges
  const seeds = []
  for (let x = 0; x < w; x++) { seeds.push([x, 0]); seeds.push([x, h - 1]) }
  for (let y = 1; y < h - 1; y++) { seeds.push([0, y]); seeds.push([w - 1, y]) }

  for (const [sx, sy] of seeds) {
    const idx = sy * w + sx
    if (visited[idx]) continue
    const px = getPixel(data, sx, sy, w)
    if (colorDistance(px.r, px.g, px.b, bgColor.r, bgColor.g, bgColor.b) <= tolerance) {
      queue.push(idx)
      visited[idx] = 1
      bgMask[idx] = 1
    }
  }

  // BFS flood fill
  while (queue.length > 0) {
    const idx = queue.pop()
    const x = idx % w, y = (idx - x) / w

    const neighbors = []
    if (x > 0)     neighbors.push(idx - 1)
    if (x < w - 1) neighbors.push(idx + 1)
    if (y > 0)     neighbors.push(idx - w)
    if (y < h - 1) neighbors.push(idx + w)

    for (const nIdx of neighbors) {
      if (visited[nIdx]) continue
      visited[nIdx] = 1
      const px4 = nIdx * 4
      const pr = data[px4], pg = data[px4 + 1], pb = data[px4 + 2]
      if (colorDistance(pr, pg, pb, bgColor.r, bgColor.g, bgColor.b) <= tolerance) {
        bgMask[nIdx] = 1
        queue.push(nIdx)
      }
    }
  }

  // Apply a small erosion to the mask to avoid eating into the item edges
  const eroded = erodeMask(bgMask, w, h, 1)

  // Apply: replace background pixels with the fill color
  for (let i = 0; i < w * h; i++) {
    if (eroded[i]) {
      const px4 = i * 4
      data[px4]     = fill.r
      data[px4 + 1] = fill.g
      data[px4 + 2] = fill.b
      data[px4 + 3] = 255
    }
  }

  // Smooth the boundary between item and new background
  smoothBoundary(data, eroded, w, h, fill)

  ctx.putImageData(imageData, 0, 0)

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return { dataUrl, b64: dataUrl.split(',')[1], mime: 'image/jpeg' }
}

function getPixel(data, x, y, w) {
  const i = (y * w + x) * 4
  return { r: data[i], g: data[i + 1], b: data[i + 2] }
}

function dominantColor(samples) {
  if (!samples.length) return { r: 255, g: 255, b: 255 }
  let sumR = 0, sumG = 0, sumB = 0
  // Use median-like approach: find cluster center
  // Simple: average all edge samples (works for mostly uniform backgrounds)
  for (const s of samples) { sumR += s.r; sumG += s.g; sumB += s.b }
  const n = samples.length
  return { r: Math.round(sumR / n), g: Math.round(sumG / n), b: Math.round(sumB / n) }
}

function erodeMask(mask, w, h, radius) {
  const result = new Uint8Array(mask)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (!mask[idx]) continue
      // Check if any neighbor within radius is NOT background
      let nearItem = false
      for (let dy = -radius; dy <= radius && !nearItem; dy++) {
        for (let dx = -radius; dx <= radius && !nearItem; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
          if (!mask[ny * w + nx]) nearItem = true
        }
      }
      if (nearItem) result[idx] = 0
    }
  }
  return result
}

function smoothBoundary(data, mask, w, h, fill) {
  // For pixels at the boundary, blend slightly to reduce harsh edges
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      if (mask[idx]) continue // skip background pixels
      // Check if this item pixel borders a background pixel
      const neighbors = [idx - 1, idx + 1, idx - w, idx + w]
      let bgCount = 0
      for (const n of neighbors) { if (mask[n]) bgCount++ }
      if (bgCount > 0 && bgCount < 4) {
        // Boundary pixel — light blend towards fill color
        const px4 = idx * 4
        const blend = 0.15 * (bgCount / 4)
        data[px4]     = Math.round(data[px4]     * (1 - blend) + fill.r * blend)
        data[px4 + 1] = Math.round(data[px4 + 1] * (1 - blend) + fill.g * blend)
        data[px4 + 2] = Math.round(data[px4 + 2] * (1 - blend) + fill.b * blend)
      }
    }
  }
}
