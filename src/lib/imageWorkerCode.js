export const buildWorkerCode = () => `
  self.onmessage = function(e) {
    const {
      imageData, width, height, tolerance, smoothness, colorsR, colorsG, colorsB, colorCount,
      autoCrop, pixelFix, replaceTransparent, replaceR, replaceG, replaceB,
      contiguousOnly, seedX, seedY
    } = e.data;
    const data = imageData.data;
    const len = data.length;

    function nearestInfo(pixelIndex) {
      const i = pixelIndex * 4;
      const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
      let bestDist = 1e9;
      let bestR = 0, bestG = 0, bestB = 0;
      for (let c = 0; c < colorCount; c++) {
        const dr = Math.abs(r - colorsR[c]);
        const dg = Math.abs(g - colorsG[c]);
        const db = Math.abs(b - colorsB[c]);
        const d = Math.max(dr, dg, db);
        if (d < bestDist) {
          bestDist = d;
          bestR = colorsR[c];
          bestG = colorsG[c];
          bestB = colorsB[c];
        }
      }
      return { dist: bestDist, bestR, bestG, bestB };
    }

    function isCandidate(pixelIndex) {
      if (data[pixelIndex * 4 + 3] === 0) return false;
      return nearestInfo(pixelIndex).dist <= tolerance + smoothness;
    }

    let removalMap = null;
    if (contiguousOnly && seedX >= 0 && seedY >= 0) {
      const pixelCount = width * height;
      removalMap = new Uint8Array(pixelCount);
      const visited = new Uint8Array(pixelCount);
      const queue = new Int32Array(pixelCount);
      const sx = Math.max(0, Math.min(width - 1, Math.round(seedX)));
      const sy = Math.max(0, Math.min(height - 1, Math.round(seedY)));
      let seedIndex = sy * width + sx;

      if (!isCandidate(seedIndex)) {
        let found = -1;
        const searchRadius = Math.min(18, Math.max(width, height));
        for (let radius = 1; radius <= searchRadius && found === -1; radius++) {
          for (let oy = -radius; oy <= radius && found === -1; oy++) {
            for (let ox = -radius; ox <= radius; ox++) {
              const nx = sx + ox;
              const ny = sy + oy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const candidateIndex = ny * width + nx;
                if (isCandidate(candidateIndex)) {
                  found = candidateIndex;
                  break;
                }
              }
            }
          }
        }
        seedIndex = found;
      }

      if (seedIndex >= 0 && isCandidate(seedIndex)) {
        let head = 0;
        let tail = 0;
        queue[tail++] = seedIndex;
        visited[seedIndex] = 1;
        removalMap[seedIndex] = 1;
        const dx = [-1, 1, 0, 0];
        const dy = [0, 0, -1, 1];

        while (head < tail) {
          const p = queue[head++];
          const px = p % width;
          const py = Math.floor(p / width);
          for (let d = 0; d < 4; d++) {
            const nx = px + dx[d];
            const ny = py + dy[d];
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const n = ny * width + nx;
            if (visited[n] === 1) continue;
            visited[n] = 1;
            if (isCandidate(n)) {
              removalMap[n] = 1;
              queue[tail++] = n;
            }
          }
        }
      }
    }

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasVisiblePixels = false;

    for (let i = 0; i < len; i += 4) {
      const pixelIndex = i / 4;
      const r = data[i]; const g = data[i + 1]; const b = data[i + 2]; const a = data[i + 3];
      const info = nearestInfo(pixelIndex);
      const shouldProcess = !removalMap || removalMap[pixelIndex] === 1;
      const dist = info.dist;

      if (shouldProcess) {
        if (smoothness === 0) {
          if (dist <= tolerance) {
            if (replaceTransparent) {
              data[i + 3] = 0;
            } else {
              data[i] = replaceR; data[i + 1] = replaceG; data[i + 2] = replaceB;
            }
          }
        } else {
          if (dist <= tolerance) {
            if (replaceTransparent) {
              data[i + 3] = 0;
            } else {
              data[i] = replaceR; data[i + 1] = replaceG; data[i + 2] = replaceB;
            }
          } else if (dist < tolerance + smoothness) {
            const blendFactor = (dist - tolerance) / smoothness;
            let fgR = r; let fgG = g; let fgB = b;
            if (blendFactor > 0) {
              fgR = Math.min(255, Math.max(0, (r - info.bestR * (1 - blendFactor)) / blendFactor));
              fgG = Math.min(255, Math.max(0, (g - info.bestG * (1 - blendFactor)) / blendFactor));
              fgB = Math.min(255, Math.max(0, (b - info.bestB * (1 - blendFactor)) / blendFactor));
            }
            if (replaceTransparent) {
              data[i + 3] = Math.round(a * blendFactor);
              if (blendFactor > 0) {
                data[i] = Math.round(fgR);
                data[i + 1] = Math.round(fgG);
                data[i + 2] = Math.round(fgB);
              }
            } else {
              data[i] = Math.round(replaceR * (1 - blendFactor) + fgR * blendFactor);
              data[i + 1] = Math.round(replaceG * (1 - blendFactor) + fgG * blendFactor);
              data[i + 2] = Math.round(replaceB * (1 - blendFactor) + fgB * blendFactor);
            }
          }
        }
      }

      if (autoCrop && data[i + 3] > 0) {
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        hasVisiblePixels = true;
      }
    }

    if (pixelFix && replaceTransparent) {
      const pixelCount = width * height;
      const visited = new Uint8Array(pixelCount);
      const queue = new Int32Array(pixelCount);
      let head = 0, tail = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const a = data[idx * 4 + 3];
          if (a > 0) {
            visited[idx] = 1;
            let isBorder = false;
            if (x > 0 && data[(idx - 1) * 4 + 3] === 0) isBorder = true;
            else if (x < width - 1 && data[(idx + 1) * 4 + 3] === 0) isBorder = true;
            else if (y > 0 && data[(idx - width) * 4 + 3] === 0) isBorder = true;
            else if (y < height - 1 && data[(idx + width) * 4 + 3] === 0) isBorder = true;
            if (isBorder) queue[tail++] = idx;
          }
        }
      }

      const dx = [-1, 1, 0, 0, -1, -1, 1, 1];
      const dy = [0, 0, -1, 1, -1, 1, -1, 1];

      while (head < tail) {
        const p = queue[head++];
        const px = p % width; const py = Math.floor(p / width);
        const pr = data[p * 4]; const pg = data[p * 4 + 1]; const pb = data[p * 4 + 2];

        for (let i = 0; i < 8; i++) {
          const nx = px + dx[i]; const ny = py + dy[i];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const n = ny * width + nx;
            if (visited[n] === 0) {
              visited[n] = 1;
              data[n * 4] = pr; data[n * 4 + 1] = pg; data[n * 4 + 2] = pb;
              queue[tail++] = n;
            }
          }
        }
      }
    }

    const cropRect = autoCrop && hasVisiblePixels ? { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null;
    self.postMessage({ imageData, cropRect }, [imageData.data.buffer]);
  };
`;
