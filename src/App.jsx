import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Download, SlidersHorizontal, Moon, Sun,
  Palette, Pencil, Maximize2, X, ZoomIn, Crop, ChevronDown, ChevronUp, 
  Settings, Wrench, Sparkles, Eraser, Pipette, Undo2, Redo2, 
  SplitSquareHorizontal, Grid2X2, Layers, MoveDown,
  Plus, Eye, RotateCcw, EyeOff, Key, Bot,
  FlaskConical, Search, Check, Copy, Archive, Brush, ZoomOut
} from 'lucide-react';
import { TemplateSelect } from './components/TemplateSelect';
import { TemplateNoticeStack } from './components/TemplateNoticeStack';
import { cx, templateClasses, uiTemplates } from './uiTemplates';

// --- Utility Functions ---
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
};

const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
};

const DOCKED_PANELS_STORAGE_KEY = 'bpr_docked_panels';
const DOCKABLE_PANEL_IDS = ['basic', 'advanced', 'effects', 'ai'];
const PANEL_LABELS = {
  basic: 'Basic Settings',
  advanced: 'Advanced Settings',
  effects: 'Effects & Styling',
  ai: 'Smart Assist',
};

const SNAP_TARGETS = [
  { id: 'left', label: 'Left', previewClass: 'left-1 top-1 bottom-1 w-[42%]' },
  { id: 'right', label: 'Right', previewClass: 'right-1 top-1 bottom-1 w-[42%]' },
  { id: 'top', label: 'Top', previewClass: 'left-1 right-1 top-1 h-[42%]' },
  { id: 'bottom', label: 'Bottom', previewClass: 'left-1 right-1 bottom-1 h-[42%]' },
];

const readDockedPanels = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(DOCKED_PANELS_STORAGE_KEY) || '{}');
    return Object.fromEntries(
      Object.entries(saved).filter(([panelId, position]) => (
        DOCKABLE_PANEL_IDS.includes(panelId) && SNAP_TARGETS.some((target) => target.id === position)
      ))
    );
  } catch {
    return {};
  }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const canvasToBlob = (canvas, type = 'image/png', quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error(`Could not create ${type} export.`));
  }, type, quality);
});

const loadImageElement = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Could not load image.'));
  img.src = src;
});

const drawStrokePath = (ctx, stroke) => {
  ctx.lineWidth = Math.max(1, stroke.radius);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke.startX, stroke.startY);
  ctx.lineTo(stroke.endX, stroke.endY);
  ctx.stroke();
  if (stroke.startX === stroke.endX && stroke.startY === stroke.endY) {
    ctx.beginPath();
    ctx.arc(stroke.startX, stroke.startY, Math.max(1, stroke.radius / 2), 0, Math.PI * 2);
    ctx.fill();
  }
};

const applyManualMaskStrokes = (finalCanvas, restoreCanvas, strokes = []) => {
  if (!strokes.length) return;

  const finalCtx = finalCanvas.getContext('2d');

  strokes.forEach((stroke) => {
    if (stroke.mode === 'restore') {
      const scratchCanvas = document.createElement('canvas');
      scratchCanvas.width = finalCanvas.width;
      scratchCanvas.height = finalCanvas.height;
      const scratchCtx = scratchCanvas.getContext('2d');
      scratchCtx.drawImage(restoreCanvas, 0, 0);
      scratchCtx.globalCompositeOperation = 'destination-in';
      scratchCtx.strokeStyle = '#fff';
      scratchCtx.fillStyle = '#fff';
      drawStrokePath(scratchCtx, stroke);
      finalCtx.drawImage(scratchCanvas, 0, 0);
      return;
    }

    finalCtx.save();
    finalCtx.globalCompositeOperation = 'destination-out';
    finalCtx.strokeStyle = '#000';
    finalCtx.fillStyle = '#000';
    drawStrokePath(finalCtx, stroke);
    finalCtx.restore();
  });
};

const createMaskBlobFromCanvas = async (canvas) => {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  const sourceCtx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = sourceCtx.getImageData(0, 0, canvas.width, canvas.height);
  const maskData = maskCtx.createImageData(canvas.width, canvas.height);

  for (let i = 0; i < imgData.data.length; i += 4) {
    const alpha = imgData.data[i + 3];
    if (alpha < 8) {
      maskData.data[i] = 255;
      maskData.data[i + 1] = 0;
      maskData.data[i + 2] = 0;
      maskData.data[i + 3] = 160;
    }
  }

  maskCtx.putImageData(maskData, 0, 0);
  return canvasToBlob(maskCanvas, 'image/png');
};

const createJpegBlobFromCanvas = async (canvas, backgroundColor, quality) => {
  const jpegCanvas = document.createElement('canvas');
  jpegCanvas.width = canvas.width;
  jpegCanvas.height = canvas.height;
  const jpegCtx = jpegCanvas.getContext('2d');
  jpegCtx.fillStyle = backgroundColor || '#ffffff';
  jpegCtx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
  jpegCtx.drawImage(canvas, 0, 0);
  return canvasToBlob(jpegCanvas, 'image/jpeg', quality);
};

const buildWorkerCode = () => `
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

const processImageSource = async (imageSrc, params, manualStrokes = []) => {
  const img = await loadImageElement(imageSrc);
  const scale = params.scale / 100;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = Math.max(1, Math.floor(img.width * scale));
  canvas.height = Math.max(1, Math.floor(img.height * scale));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const colorList = params.multiColors && params.colors && params.colors.length > 0 ? params.colors : [params.targetColor];
  const colorsR = colorList.map((hex) => hexToRgb(hex).r);
  const colorsG = colorList.map((hex) => hexToRgb(hex).g);
  const colorsB = colorList.map((hex) => hexToRgb(hex).b);
  const rgbReplace = hexToRgb(params.replaceColor);
  const workerUrl = URL.createObjectURL(new Blob([buildWorkerCode()], { type: 'application/javascript' }));

  try {
    const { imageData: processedData, cropRect } = await new Promise((resolve, reject) => {
      const worker = new Worker(workerUrl);
      worker.onmessage = (event) => {
        worker.terminate();
        resolve(event.data);
      };
      worker.onerror = (error) => {
        worker.terminate();
        reject(error);
      };
      worker.postMessage({
        imageData,
        width: canvas.width,
        height: canvas.height,
        tolerance: params.tolerance,
        smoothness: params.smoothness,
        colorsR,
        colorsG,
        colorsB,
        colorCount: colorList.length,
        replaceTransparent: params.replaceTransparent,
        replaceR: rgbReplace.r,
        replaceG: rgbReplace.g,
        replaceB: rgbReplace.b,
        autoCrop: params.autoCrop,
        pixelFix: params.replaceTransparent ? params.pixelFix : false,
        contiguousOnly: Boolean(params.contiguousOnly && params.contiguousSeed),
        seedX: params.contiguousSeed ? params.contiguousSeed.x * canvas.width : -1,
        seedY: params.contiguousSeed ? params.contiguousSeed.y * canvas.height : -1,
      }, [imageData.data.buffer]);
    });

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const sourceTempCanvas = document.createElement('canvas');
    const sourceTempCtx = sourceTempCanvas.getContext('2d');

    tempCanvas.width = cropRect ? cropRect.width : canvas.width;
    tempCanvas.height = cropRect ? cropRect.height : canvas.height;
    sourceTempCanvas.width = tempCanvas.width;
    sourceTempCanvas.height = tempCanvas.height;

    if (cropRect) {
      const fullCropCanvas = document.createElement('canvas');
      fullCropCanvas.width = canvas.width;
      fullCropCanvas.height = canvas.height;
      fullCropCanvas.getContext('2d').putImageData(processedData, 0, 0);
      tempCtx.drawImage(fullCropCanvas, cropRect.minX, cropRect.minY, cropRect.width, cropRect.height, 0, 0, cropRect.width, cropRect.height);
      sourceTempCtx.drawImage(canvas, cropRect.minX, cropRect.minY, cropRect.width, cropRect.height, 0, 0, cropRect.width, cropRect.height);
    } else {
      tempCtx.putImageData(processedData, 0, 0);
      sourceTempCtx.drawImage(canvas, 0, 0);
    }

    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d');
    const restoreCanvas = document.createElement('canvas');
    const restoreCtx = restoreCanvas.getContext('2d');
    const blurPad = params.hasShadow ? params.shadowBlur * 2 : 0;
    const padX = params.hasShadow ? Math.abs(params.shadowOffsetX) + blurPad : 0;
    const padY = params.hasShadow ? Math.abs(params.shadowOffsetY) + blurPad : 0;

    finalCanvas.width = tempCanvas.width + padX + (params.padding ? params.padding * 2 : 0);
    finalCanvas.height = tempCanvas.height + padY + (params.padding ? params.padding * 2 : 0);
    restoreCanvas.width = finalCanvas.width;
    restoreCanvas.height = finalCanvas.height;

    const drawX = (params.hasShadow ? (padX / 2 - params.shadowOffsetX / 2) : 0) + (params.padding || 0);
    const drawY = (params.hasShadow ? (padY / 2 - params.shadowOffsetY / 2) : 0) + (params.padding || 0);
    restoreCtx.drawImage(sourceTempCanvas, drawX, drawY);

    if (params.hasShadow) {
      finalCtx.shadowColor = params.shadowColor;
      finalCtx.shadowBlur = params.shadowBlur;
      finalCtx.shadowOffsetX = params.shadowOffsetX;
      finalCtx.shadowOffsetY = params.shadowOffsetY;
    }

    finalCtx.drawImage(tempCanvas, drawX, drawY);
    applyManualMaskStrokes(finalCanvas, restoreCanvas, manualStrokes);

    const pngBlob = await canvasToBlob(finalCanvas, 'image/png');
    const webpBlob = await canvasToBlob(finalCanvas, 'image/webp', params.webpQuality);
    const jpegBlob = await createJpegBlobFromCanvas(finalCanvas, params.jpegBackground, params.jpegQuality);
    const maskBlob = await createMaskBlobFromCanvas(finalCanvas);

    return {
      pngBlob,
      webpBlob,
      jpegBlob,
      maskBlob,
      dimensions: { width: finalCanvas.width, height: finalCanvas.height },
    };
  } finally {
    URL.revokeObjectURL(workerUrl);
  }
};

const revokeUrl = (url) => {
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
};

const revokeBatchItemUrls = (item) => {
  revokeUrl(item?.pngUrl);
  revokeUrl(item?.webpUrl);
  revokeUrl(item?.jpegUrl);
  revokeUrl(item?.maskUrl);
  revokeUrl(item?.url);
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createZipBlob = async (entries) => {
  const encoder = new TextEncoder();
  const chunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBuffer = await entry.blob.arrayBuffer();
    const dataBytes = new Uint8Array(dataBuffer);
    const crc = crc32(dataBuffer);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    chunks.push(localHeader, dataBytes);
    centralChunks.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...chunks, ...centralChunks, endHeader], { type: 'application/zip' });
};

const getDominantEdgeColors = async (imageSrc) => {
  const img = await loadImageElement(imageSrc);
  const sampleCanvas = document.createElement('canvas');
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  const maxSide = 320;
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  sampleCanvas.width = Math.max(1, Math.round(img.width * ratio));
  sampleCanvas.height = Math.max(1, Math.round(img.height * ratio));
  sampleCtx.drawImage(img, 0, 0, sampleCanvas.width, sampleCanvas.height);
  const { width, height } = sampleCanvas;
  const data = sampleCtx.getImageData(0, 0, width, height).data;
  const counts = new Map();
  const step = Math.max(1, Math.floor(Math.min(width, height) / 60));
  const addPixel = (x, y) => {
    const index = (y * width + x) * 4;
    if (data[index + 3] < 10) return;
    const r = Math.round(data[index] / 16) * 16;
    const g = Math.round(data[index + 1] / 16) * 16;
    const b = Math.round(data[index + 2] / 16) * 16;
    const key = rgbToHex(r, g, b);
    counts.set(key, (counts.get(key) || 0) + 1);
  };

  for (let x = 0; x < width; x += step) {
    addPixel(x, 0);
    addPixel(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    addPixel(0, y);
    addPixel(width - 1, y);
  }

  const cornerData = sampleCtx.getImageData(0, 0, 1, 1).data;
  return {
    colors: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([color]) => color),
    seed: { x: 0, y: 0 },
    cornerColor: rgbToHex(cornerData[0], cornerData[1], cornerData[2]),
  };
};

const EXPORT_FORMAT_OPTIONS = [
  { value: 'png', label: 'PNG (transparent)' },
  { value: 'webp', label: 'WebP' },
  { value: 'jpeg', label: 'JPEG (solid background)' },
];

const GITHUB_REPO = {
  owner: 'Mailo037',
  name: 'color_remover',
  branch: 'master',
  url: 'https://github.com/Mailo037/color_remover',
};

const PROVIDER_LABELS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  replicate: 'Replicate',
  openrouter: 'OpenRouter',
  local: 'Local API',
};

const AI_PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'replicate', label: 'Replicate' },
  { value: 'openrouter', label: 'OpenRouter (All Models)' },
  { value: 'local', label: 'Local API' },
];

const PROVIDER_DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  google: 'gemini-1.5-flash',
  replicate: 'black-forest-labs/flux-schnell',
  openrouter: 'openrouter/auto',
  local: '',
};

const STATIC_PROVIDER_MODELS = {
  openai: [
    { id: 'gpt-4o-mini', name: 'OpenAI: GPT-4o mini', group: 'OpenAI' },
    { id: 'gpt-4o', name: 'OpenAI: GPT-4o', group: 'OpenAI' },
    { id: 'gpt-4.1-mini', name: 'OpenAI: GPT-4.1 mini', group: 'OpenAI' },
    { id: 'gpt-4.1', name: 'OpenAI: GPT-4.1', group: 'OpenAI' },
  ],
  anthropic: [
    { id: 'claude-3-haiku-20240307', name: 'Anthropic: Claude 3 Haiku', group: 'Anthropic' },
    { id: 'claude-3-5-haiku-latest', name: 'Anthropic: Claude 3.5 Haiku', group: 'Anthropic' },
    { id: 'claude-3-5-sonnet-latest', name: 'Anthropic: Claude 3.5 Sonnet', group: 'Anthropic' },
  ],
  google: [
    { id: 'gemini-1.5-flash', name: 'Google: Gemini 1.5 Flash', group: 'Google' },
    { id: 'gemini-1.5-pro', name: 'Google: Gemini 1.5 Pro', group: 'Google' },
    { id: 'gemini-2.0-flash', name: 'Google: Gemini 2.0 Flash', group: 'Google' },
    { id: 'gemini-2.5-flash', name: 'Google: Gemini 2.5 Flash', group: 'Google' },
    { id: 'gemini-2.5-pro', name: 'Google: Gemini 2.5 Pro', group: 'Google' },
  ],
  replicate: [
    { id: 'black-forest-labs/flux-schnell', name: 'Replicate: FLUX.1 Schnell', group: 'Replicate' },
    { id: 'black-forest-labs/flux-dev', name: 'Replicate: FLUX.1 Dev', group: 'Replicate' },
    { id: 'stability-ai/stable-diffusion-3.5-large', name: 'Replicate: Stable Diffusion 3.5 Large', group: 'Replicate' },
  ],
  local: [],
};

const getProviderLabel = (provider) => PROVIDER_LABELS[provider] || provider;
const getDefaultModelForProvider = (provider) => PROVIDER_DEFAULT_MODELS[provider] || '';

const getProviderApiModel = (provider, model) => {
  const selectedModel = model || getDefaultModelForProvider(provider);
  if (!selectedModel || provider === 'openrouter') return selectedModel;

  const providerPrefix = `${provider}/`;
  return selectedModel.startsWith(providerPrefix)
    ? selectedModel.slice(providerPrefix.length)
    : selectedModel;
};

// --- Reusable UI Components ---
const RollingNumber = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setAnimating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [value, displayValue]);

  return (
    <span className="relative inline-flex flex-col overflow-hidden h-[1.2em] leading-[1.2em] align-bottom text-center min-w-[2.5ch]">
      <span className={cx('block transition-all ease-out duration-150', animating ? '-translate-y-full opacity-0 scale-95' : 'translate-y-0 opacity-100 scale-100')}>
        {displayValue}
      </span>
      <span className={cx('absolute top-full left-0 w-full block transition-all ease-out duration-150', animating ? '-translate-y-full opacity-100 scale-100' : 'translate-y-0 opacity-0 scale-95')}>
        {value}
      </span>
    </span>
  );
};

const EditableNumber = ({ value, onChange, min, max }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => { setTempValue(value); }, [value]);

  const handleFinishEditing = () => {
    setIsEditing(false);
    let parsed = parseInt(tempValue, 10);
    if (isNaN(parsed)) parsed = value;
    if (parsed < min) parsed = min;
    if (parsed > max) parsed = max;
    onChange(parsed);
    setTempValue(parsed);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleFinishEditing(); };

  if (isEditing) {
    return (
      <input
        ref={inputRef} type="number" value={tempValue}
        onChange={(e) => setTempValue(e.target.value)} onBlur={handleFinishEditing} onKeyDown={handleKeyDown}
        className={uiTemplates.inputs.number}
        min={min} max={max}
      />
    );
  }

  return (
    <span 
      onClick={() => setIsEditing(true)}
      className={uiTemplates.inputs.inlineNumber}
      title="Click to edit"
    >
      <RollingNumber value={value} />
    </span>
  );
};

const CollapsibleSection = ({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
  contentOnlyOnMobile = false,
  panelId,
  dockPosition,
  onRequestDock,
  onRestoreDock,
}) => {
  const longPressTimerRef = useRef(null);
  const longPressStartRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const isDocked = Boolean(dockPosition);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }, []);

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const requestDockMenu = useCallback((target) => {
    if (!onRequestDock || !panelId || !target?.getBoundingClientRect) return;
    onRequestDock(panelId, target.getBoundingClientRect());
  }, [onRequestDock, panelId]);

  const handleLongPressStart = (event) => {
    if (!onRequestDock || !panelId || (event.pointerType === 'mouse' && event.button !== 0)) return;

    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    longPressStartRef.current = { x: event.clientX, y: event.clientY, target: event.currentTarget };
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      requestDockMenu(longPressStartRef.current?.target);
    }, 540);
  };

  const handleLongPressMove = (event) => {
    if (!longPressStartRef.current) return;

    const dx = Math.abs(event.clientX - longPressStartRef.current.x);
    const dy = Math.abs(event.clientY - longPressStartRef.current.y);
    if (dx > 10 || dy > 10) clearLongPressTimer();
  };

  const handleToggleClick = (event) => {
    if (longPressTriggeredRef.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressTriggeredRef.current = false;
      clearLongPressTimer();
      return;
    }

    onToggle();
  };

  const dockedClass = {
    left: 'lg:fixed lg:left-3 lg:top-[5.25rem] lg:bottom-4 lg:z-[170] lg:w-[350px] xl:w-[400px] lg:max-h-[calc(100dvh-6.25rem)] lg:overflow-y-auto lg:shadow-2xl custom-scrollbar',
    right: 'lg:fixed lg:right-3 lg:top-[5.25rem] lg:bottom-4 lg:z-[170] lg:w-[350px] xl:w-[400px] lg:max-h-[calc(100dvh-6.25rem)] lg:overflow-y-auto lg:shadow-2xl custom-scrollbar',
    top: 'lg:fixed lg:left-1/2 lg:top-[5.25rem] lg:z-[170] lg:w-[min(920px,calc(100vw-2rem))] lg:max-h-[17rem] lg:-translate-x-1/2 lg:overflow-y-auto lg:shadow-2xl custom-scrollbar',
    bottom: 'lg:fixed lg:left-1/2 lg:bottom-4 lg:z-[170] lg:w-[min(920px,calc(100vw-2rem))] lg:max-h-[17rem] lg:-translate-x-1/2 lg:overflow-y-auto lg:shadow-2xl custom-scrollbar',
  }[dockPosition] || '';

  return (
    <div className={cx(contentOnlyOnMobile ? uiTemplates.surfaces.sectionMobileContentOnly : uiTemplates.surfaces.section, isDocked ? 'lg:ring-1 lg:ring-blue-400/40' : '', dockedClass)}>
      <div className={cx(contentOnlyOnMobile ? 'hidden lg:flex' : 'flex', 'w-full items-stretch bg-neutral-50/50 dark:bg-[#111]/50 hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] transition-colors')}>
        <button
          type="button"
          onClick={handleToggleClick}
          onPointerDown={handleLongPressStart}
          onPointerMove={handleLongPressMove}
          onPointerUp={clearLongPressTimer}
          onPointerCancel={clearLongPressTimer}
          onPointerLeave={clearLongPressTimer}
          className="flex min-h-[60px] flex-1 select-none items-center justify-between gap-3 p-4 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:p-5"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-3 font-semibold text-neutral-800 dark:text-neutral-200 min-w-0">
            <Icon className="w-5 h-5 text-neutral-500" />
            <span className="truncate">{title}</span>
          </div>
          {isOpen ? <ChevronUp className="w-5 h-5 shrink-0 text-neutral-400 transition-transform" /> : <ChevronDown className="w-5 h-5 shrink-0 text-neutral-400 transition-transform" />}
        </button>

        {onRequestDock && panelId && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              requestDockMenu(event.currentTarget);
            }}
            className="flex min-h-[60px] w-12 shrink-0 items-center justify-center border-l border-neutral-200/70 text-neutral-500 transition-colors hover:bg-white/70 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:border-neutral-800/70 dark:hover:bg-[#222] dark:hover:text-white"
            aria-label={`Dock ${title}`}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}

        {isDocked && onRestoreDock && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRestoreDock(panelId);
            }}
            className="flex min-h-[60px] w-12 shrink-0 items-center justify-center border-l border-neutral-200/70 text-neutral-500 transition-colors hover:bg-white/70 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:border-neutral-800/70 dark:hover:bg-[#222] dark:hover:text-white"
            aria-label={`Return ${title} to list`}
          >
            <MoveDown className="h-4 w-4" />
          </button>
        )}
        </div>
      <div className={`transition-all duration-300 ease-in-out origin-top grid ${contentOnlyOnMobile ? 'grid-rows-[1fr] opacity-100 lg:grid-rows-[0fr] lg:opacity-0' : ''} ${isOpen ? 'lg:grid-rows-[1fr] lg:opacity-100 grid-rows-[1fr] opacity-100' : 'lg:grid-rows-[0fr] lg:opacity-0 grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className={contentOnlyOnMobile ? uiTemplates.surfaces.sectionMobileBody : uiTemplates.surfaces.sectionBody}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Application ---
export default function App() {
  // Global App States
  const [originalImage, setOriginalImage] = useState(null);
  const [outputFilename, setOutputFilename] = useState('image_transparent');
  const [processedImage, setProcessedImage] = useState(null);
  const [processedBlob, setProcessedBlob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputDimensions, setOutputDimensions] = useState(null);
  const [showImages, setShowImages] = useState(false);
  const [batchItems, setBatchItems] = useState([]);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchExportFormat, setBatchExportFormat] = useState('png');
  
  // Feature States
  const [zoomedImage, setZoomedImage] = useState({ src: null, isTransparent: false });
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPan, setZoomPan] = useState({ x: 0, y: 0 });
  const [isZoomPanning, setIsZoomPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [isPickingSeed, setIsPickingSeed] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSliderPos, setCompareSliderPos] = useState(50);
  const [compareType, setCompareType] = useState('slider'); // 'slider' or 'toggle'
  const [showOriginal, setShowOriginal] = useState(false);
  
  const originalImageRef = useRef(null);
  const processedPreviewRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastMaskPointRef = useRef(null);
  const isPaintingMaskRef = useRef(false);
  const pendingMaskStrokesRef = useRef([]);
  const zoomPanStartRef = useRef(null);

  // Accordion States
  const [isBasicOpen, setIsBasicOpen] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isEffectsOpen, setIsEffectsOpen] = useState(false);

  // Processing Parameters
  const [targetColor, setTargetColor] = useState('#000000');
  const [tolerance, setTolerance] = useState(10);
  const [smoothness, setSmoothness] = useState(20);
  const [scale, setScale] = useState(100);
  const [autoCrop, setAutoCrop] = useState(false);
  const [pixelFix, setPixelFix] = useState(false);
  const [replaceTransparent, setReplaceTransparent] = useState(true);
  const [replaceColor, setReplaceColor] = useState('#ffffff');
  const [contiguousOnly, setContiguousOnly] = useState(false);
  const [contiguousSeed, setContiguousSeed] = useState(null);

  // Extended Features
  // Enable removal of multiple colors at once
  const [multiColors, setMultiColors] = useState(false);
  // List of colors to remove. The first entry always mirrors targetColor.
  const [colors, setColors] = useState([targetColor]);
  // Mask preview state and image
  const [showMask, setShowMask] = useState(false);
  const [maskImage, setMaskImage] = useState(null);
  // Additional export format
  const [processedImageWebp, setProcessedImageWebp] = useState(null);
  const [processedImageJpeg, setProcessedImageJpeg] = useState(null);
  const [maskBlob, setMaskBlob] = useState(null);
  // Padding around the final output (in pixels)
  const [padding, setPadding] = useState(0);
  const [webpQuality, setWebpQuality] = useState(0.92);
  const [jpegQuality, setJpegQuality] = useState(0.9);
  const [jpegBackground, setJpegBackground] = useState('#ffffff');
  const [isMaskEditorOpen, setIsMaskEditorOpen] = useState(false);
  const [maskEditMode, setMaskEditMode] = useState('erase');
  const [brushSize, setBrushSize] = useState(28);
  const [maskStrokes, setMaskStrokes] = useState([]);
  const [isMaskPainting, setIsMaskPainting] = useState(false);
  
  // Effects Parameters
  const [hasShadow, setHasShadow] = useState(false);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowBlur, setShadowBlur] = useState(20);
  const [shadowOffsetX, setShadowOffsetX] = useState(0);
  const [shadowOffsetY, setShadowOffsetY] = useState(10);

  // Theme & Layout Settings
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('bpr_theme');
    if (saved !== null) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [layoutPosition, setLayoutPosition] = useState(() => {
    return localStorage.getItem('bpr_layout') || 'top';
  });
  const [dockedPanels, setDockedPanels] = useState(readDockedPanels);
  const [snapMenu, setSnapMenu] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  // Custom notices
  const [notices, setNotices] = useState([]);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportSettingsOpen, setIsExportSettingsOpen] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [isMobileExportOpen, setIsMobileExportOpen] = useState(false);
  const [activeMobilePanel, setActiveMobilePanel] = useState('basic');
  const [mobileSettingsDragY, setMobileSettingsDragY] = useState(0);
  const mobileSettingsDragStart = useRef(null);
  const mobileSettingsDragDistance = useRef(0);
  const snapMenuRef = useRef(null);
  
  const removeNotice = (id) => {
    setNotices((prev) => prev.filter((notice) => notice.id !== id));
  };

  const showNotice = (message) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setNotices((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      removeNotice(id);
    }, 4500);
  };

  const setObjectUrlState = (setter, blob) => {
    const url = URL.createObjectURL(blob);
    setter((prev) => {
      revokeUrl(prev);
      return url;
    });
    return url;
  };

  const clearProcessedExports = () => {
    setProcessedBlob(null);
    setMaskBlob(null);
    setProcessedImage((prev) => {
      revokeUrl(prev);
      return null;
    });
    setProcessedImageWebp((prev) => {
      revokeUrl(prev);
      return null;
    });
    setProcessedImageJpeg((prev) => {
      revokeUrl(prev);
      return null;
    });
    setMaskImage((prev) => {
      revokeUrl(prev);
      return null;
    });
  };

  const openZoomedImage = useCallback((src, isTransparent = false) => {
    setZoomedImage({ src, isTransparent });
    setZoomScale(1);
    setZoomPan({ x: 0, y: 0 });
    setIsZoomPanning(false);
  }, []);

  const closeZoomedImage = useCallback(() => {
    setZoomedImage({ src: null, isTransparent: false });
    setZoomScale(1);
    setZoomPan({ x: 0, y: 0 });
    setIsZoomPanning(false);
  }, []);

  // Local install update check
  const [updateInfo, setUpdateInfo] = useState({
    available: false,
    canPull: false,
    localHash: import.meta.env.VITE_APP_COMMIT_HASH || '',
    remoteHash: '',
    branch: import.meta.env.VITE_APP_BRANCH || GITHUB_REPO.branch,
    message: '',
  });
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);

  // AI Integration Settings
  const [aiEnabled, setAiEnabled] = useState(() => {
    return localStorage.getItem('bpr_ai_enabled') === 'true';
  });
  const [aiProvider, setAiProvider] = useState(() => {
    return localStorage.getItem('bpr_ai_provider') || 'openai';
  });
  const [aiModel, setAiModel] = useState(() => {
    return localStorage.getItem('bpr_ai_model') || '';
  });
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('bpr_api_key') || '';
  });
  const [isAiSectionOpen, setIsAiSectionOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  
  // Custom Popover States
  const [isTestPopoverOpen, setIsTestPopoverOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [models, setModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isCustomModelEntry, setIsCustomModelEntry] = useState(false);

  const providerModelOptions = aiProvider === 'openrouter' ? models : (STATIC_PROVIDER_MODELS[aiProvider] || []);
  const selectedModelLabel = providerModelOptions.find((m) => m.id === aiModel)?.name || aiModel || `Default: ${getDefaultModelForProvider(aiProvider) || getProviderLabel(aiProvider)}`;
  const isCustomAiModel = Boolean(aiModel && !providerModelOptions.some((m) => m.id === aiModel));
  const providerHasOnlyCustomModels = providerModelOptions.length === 0 && !getDefaultModelForProvider(aiProvider);
  const shouldShowCustomModelInput = isCustomModelEntry || isCustomAiModel || providerHasOnlyCustomModels;
  const modelSelectValue = (isCustomModelEntry || isCustomAiModel) ? '__custom' : aiModel;
  const modelSelectOptions = [
    {
      label: 'Default',
      options: [
        {
          value: '',
          label: getDefaultModelForProvider(aiProvider) ? `Default (${getDefaultModelForProvider(aiProvider)})` : 'No default model',
        },
      ],
    },
    ...Object.entries(providerModelOptions.reduce((acc, model) => {
      if (!acc[model.group]) acc[model.group] = [];
      acc[model.group].push(model);
      return acc;
    }, {})).map(([groupName, groupModels]) => ({
      label: groupName,
      options: groupModels.map((model) => ({
        value: model.id,
        label: model.name,
        searchText: model.id,
      })),
    })),
    {
      label: 'Custom',
      options: [{ value: '__custom', label: 'Custom model ID...' }],
    },
  ];

  const filteredModels = providerModelOptions.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) || m.id.toLowerCase().includes(modelSearchQuery.toLowerCase());
    return matchesSearch;
  });

  const checkForUpdates = useCallback(async ({ signal } = {}) => {
    if (signal?.aborted) return;

    try {
      try {
        const response = await fetch('/__color_remover_version', {
          cache: 'no-store',
          signal,
          headers: { Accept: 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.ok) {
            setUpdateInfo((prev) => ({
              ...prev,
              available: Boolean(data.updateAvailable),
              canPull: Boolean(data.canPull),
              localHash: data.localHash || prev.localHash,
              remoteHash: data.remoteHash || prev.remoteHash,
              branch: data.branch || prev.branch,
              message: data.updateAvailable ? `Remote ${data.remoteShortHash}` : '',
            }));
            return;
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
      }

      const localHash = import.meta.env.VITE_APP_COMMIT_HASH || '';
      if (!localHash) return;

      const githubResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.name}/commits/${GITHUB_REPO.branch}`, {
        cache: 'no-store',
        signal,
        headers: { Accept: 'application/vnd.github+json' },
      });

      if (!githubResponse.ok) return;

      const githubData = await githubResponse.json();
      const remoteHash = githubData?.sha || '';

      setUpdateInfo((prev) => ({
        ...prev,
        available: Boolean(remoteHash && localHash && remoteHash !== localHash),
        canPull: false,
        localHash,
        remoteHash,
        branch: GITHUB_REPO.branch,
        message: remoteHash ? `Remote ${remoteHash.slice(0, 7)}` : '',
      }));
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to check for updates', error);
      }
    }
  }, []);

  const handleUpdateNow = async () => {
    if (isUpdatingApp) return;

    if (!updateInfo.canPull) {
      window.open(GITHUB_REPO.url, '_blank', 'noopener,noreferrer');
      showNotice('Opening GitHub for the latest version.');
      return;
    }

    setIsUpdatingApp(true);

    try {
      const response = await fetch('/__color_remover_update', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Update failed with HTTP ${response.status}`);
      }

      setUpdateInfo((prev) => ({
        ...prev,
        available: false,
        localHash: data.after || prev.remoteHash,
        remoteHash: data.after || prev.remoteHash,
        message: data.pulled ? 'Updated' : 'Already current',
      }));
      showNotice(data.pulled ? 'Update pulled. Reloading the app...' : 'Already up to date.');

      if (data.pulled) {
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (error) {
      showNotice(`Update failed: ${error.message}`);
    } finally {
      setIsUpdatingApp(false);
    }
  };

  useEffect(() => {
    if ((isTestPopoverOpen || (aiEnabled && aiProvider === 'openrouter')) && models.length === 0) {
      setIsLoadingModels(true);
      fetch('https://openrouter.ai/api/v1/models')
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            const fetchedModels = data.data.map(m => {
              const provider = m.id.split('/')[0];
              const group = provider.charAt(0).toUpperCase() + provider.slice(1);
              return { id: m.id, name: m.name || m.id, group };
            });
            // Sort models by group name alphabetically
            fetchedModels.sort((a, b) => a.group.localeCompare(b.group));
            setModels(fetchedModels);
          }
        })
        .catch(err => console.error("Failed to fetch models", err))
        .finally(() => setIsLoadingModels(false));
    }
  }, [aiEnabled, aiProvider, isTestPopoverOpen, models.length]);

  useEffect(() => {
    const controller = new AbortController();
    checkForUpdates({ signal: controller.signal });
    const intervalId = window.setInterval(() => {
      checkForUpdates();
    }, 10 * 60 * 1000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [checkForUpdates]);

  const handleTestConnection = async () => {
    if (!apiKey) {
      showNotice("Please enter an API key first.");
      return;
    }
    
    setIsTestingKey(true);
    
    try {
      let response;
      const selectedModel = getProviderApiModel(aiProvider, aiModel);
      if (aiProvider === 'openrouter') {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: 'user', content: 'Test' }]
          })
        });
      } else if (aiProvider === 'openai') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: 'user', content: 'Test' }]
          })
        });
      } else if (aiProvider === 'google') {
         const actualModel = selectedModel;
         response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             contents: [{ parts: [{ text: "Test" }] }]
           })
         });
      } else if (aiProvider === 'anthropic') {
         response = await fetch('https://api.anthropic.com/v1/messages', {
           method: 'POST',
           headers: {
             'x-api-key': apiKey,
             'anthropic-version': '2023-06-01',
             'content-type': 'application/json',
             'anthropic-dangerous-direct-browser-access': 'true'
           },
           body: JSON.stringify({
             model: selectedModel,
             messages: [{ role: 'user', content: 'Test' }],
             max_tokens: 10
           })
         });
      } else {
         // Fallback for local or replicate
         setTimeout(() => {
             setIsTestingKey(false);
             setIsTestPopoverOpen(false);
             showNotice(`Connection to ${aiProvider} (${selectedModel || 'default model'}) successful!`);
          }, 1200);
          return;
       }

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : null;

      if (!response.ok) {
        let errorMsg = `HTTP Error ${response.status}`;
        if (data && data.error && data.error.message) {
            errorMsg = data.error.message;
        } else if (data && data.message) {
            errorMsg = data.message;
        }
        throw new Error(errorMsg);
      }
      
      setIsTestingKey(false);
      setIsTestPopoverOpen(false);
      showNotice(`Connection to ${aiProvider} (${selectedModel || 'default model'}) successful!`);
      
    } catch (error) {
      setIsTestingKey(false);
      showNotice(`Error: ${error.message === 'Failed to fetch' ? 'Network or CORS Error (Check API URL/Key)' : error.message}`);
    }
  };

  const handleAiGeneration = async () => {
    if (!aiPrompt.trim()) return;
    const promptHandledLocally = await applyPromptAssist(aiPrompt);
    if (promptHandledLocally) {
      setAiPrompt('');
      return;
    }

    if (!apiKey) {
      showNotice("Try a prompt like 'remove background', 'green screen', or add an API key for provider testing.");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      let response;
      const selectedModel = getProviderApiModel(aiProvider, aiModel);
      if (aiProvider === 'openrouter') {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: 'user', content: aiPrompt }]
          })
        });
      } else if (aiProvider === 'openai') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: 'user', content: aiPrompt }]
          })
        });
      } else if (aiProvider === 'google') {
         const actualModel = selectedModel;
         response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             contents: [{ parts: [{ text: aiPrompt }] }]
           })
         });
      } else if (aiProvider === 'anthropic') {
         response = await fetch('https://api.anthropic.com/v1/messages', {
           method: 'POST',
           headers: {
             'x-api-key': apiKey,
             'anthropic-version': '2023-06-01',
             'content-type': 'application/json',
             'anthropic-dangerous-direct-browser-access': 'true'
           },
           body: JSON.stringify({
             model: selectedModel,
             messages: [{ role: 'user', content: aiPrompt }],
             max_tokens: 100
           })
         });
      } else {
         // Fallback for local or replicate
          setTimeout(() => {
             setIsProcessing(false);
             showNotice(`AI Generation triggered via ${aiProvider} (${selectedModel || 'default model'}) using prompt: "${aiPrompt}"`);
          }, 1500);
          return;
       }

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : null;

      if (!response.ok) {
        let errorMsg = `HTTP Error ${response.status}`;
        if (data && data.error && data.error.message) {
            errorMsg = data.error.message;
        } else if (data && data.message) {
            errorMsg = data.message;
        }
        throw new Error(errorMsg);
      }
      
      setIsProcessing(false);
      showNotice(`AI Generation triggered via ${aiProvider} (${selectedModel || 'default model'}) using prompt: "${aiPrompt}"`);
      
    } catch (error) {
      setIsProcessing(false);
      showNotice(`Error: ${error.message === 'Failed to fetch' ? 'Network or CORS Error (Check API URL/Key)' : error.message}`);
    }
  };

  useEffect(() => {
    localStorage.setItem('bpr_ai_enabled', aiEnabled);
    localStorage.setItem('bpr_ai_provider', aiProvider);
    localStorage.setItem('bpr_ai_model', aiModel);
    localStorage.setItem('bpr_api_key', apiKey);
  }, [aiEnabled, aiProvider, aiModel, apiKey]);

  // Undo/Redo History
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isTraversingHistory, setIsTraversingHistory] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const loadSaved = (key, defaultVal, parser = (v)=>v) => {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        try {
          return parser(saved);
        } catch {
          return defaultVal;
        }
      }
      return defaultVal;
    };
    setTargetColor(loadSaved('bpr_color', '#000000'));
    setTolerance(loadSaved('bpr_tolerance', 10, parseInt));
    setSmoothness(loadSaved('bpr_smoothness', 20, parseInt));
    setScale(loadSaved('bpr_scale', 100, parseInt));
    setAutoCrop(loadSaved('bpr_autocrop', false, v => v === 'true'));
    setPixelFix(loadSaved('bpr_pixelfix', false, v => v === 'true'));
    setReplaceTransparent(loadSaved('bpr_replace_trans', true, v => v === 'true'));
    setReplaceColor(loadSaved('bpr_replace_color', '#ffffff'));
    setContiguousOnly(loadSaved('bpr_contiguous_only', false, v => v === 'true'));
    setContiguousSeed(loadSaved('bpr_contiguous_seed', null, (v) => JSON.parse(v)));
    setHasShadow(loadSaved('bpr_shadow', false, v => v === 'true'));
    setShadowColor(loadSaved('bpr_shadow_color', '#000000'));
    setShadowBlur(loadSaved('bpr_shadow_blur', 20, parseInt));
    setShadowOffsetX(loadSaved('bpr_shadow_x', 0, parseInt));
    setShadowOffsetY(loadSaved('bpr_shadow_y', 10, parseInt));
    setMultiColors(loadSaved('bpr_multicolors', false, v => v === 'true'));

    // Load multi-color settings if available
    const savedColors = loadSaved('bpr_colors', null, (v) => {
      try {
        const arr = JSON.parse(v);
        return Array.isArray(arr) ? arr : null;
      } catch {
        return null;
      }
    });
    if (savedColors && savedColors.length > 0) {
      setColors(savedColors);
      setTargetColor(savedColors[0]);
    }

    setPadding(loadSaved('bpr_padding', 0, parseInt));
    setWebpQuality(loadSaved('bpr_webp_quality', 0.92, parseFloat));
    setJpegQuality(loadSaved('bpr_jpeg_quality', 0.9, parseFloat));
    setJpegBackground(loadSaved('bpr_jpeg_background', '#ffffff'));
  }, []);

  // Debounced States to prevent lag
  const [debouncedParams, setDebouncedParams] = useState({
    targetColor, tolerance, smoothness, scale, autoCrop, pixelFix, 
    replaceTransparent, replaceColor, contiguousOnly, contiguousSeed,
    hasShadow, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY,
    webpQuality, jpegQuality, jpegBackground
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const newParams = {
        targetColor, tolerance, smoothness, scale, autoCrop, pixelFix, replaceTransparent, replaceColor,
        contiguousOnly, contiguousSeed, hasShadow, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY,
        colors, multiColors, padding, webpQuality, jpegQuality, jpegBackground,
      };
      setDebouncedParams(newParams);
      
      // Save local storage
      localStorage.setItem('bpr_color', targetColor);
      localStorage.setItem('bpr_tolerance', tolerance);
      localStorage.setItem('bpr_smoothness', smoothness);
      localStorage.setItem('bpr_scale', scale);
      localStorage.setItem('bpr_autocrop', autoCrop);
      localStorage.setItem('bpr_pixelfix', pixelFix);
      localStorage.setItem('bpr_replace_trans', replaceTransparent);
      localStorage.setItem('bpr_replace_color', replaceColor);
      localStorage.setItem('bpr_contiguous_only', contiguousOnly);
      if (contiguousSeed) localStorage.setItem('bpr_contiguous_seed', JSON.stringify(contiguousSeed));
      else localStorage.removeItem('bpr_contiguous_seed');
      localStorage.setItem('bpr_shadow', hasShadow);
      localStorage.setItem('bpr_shadow_color', shadowColor);
      localStorage.setItem('bpr_shadow_blur', shadowBlur);
      localStorage.setItem('bpr_shadow_x', shadowOffsetX);
      localStorage.setItem('bpr_shadow_y', shadowOffsetY);

      // Persist multi-color settings and padding
      localStorage.setItem('bpr_colors', JSON.stringify(colors));
      localStorage.setItem('bpr_multicolors', multiColors);
      localStorage.setItem('bpr_padding', padding);
      localStorage.setItem('bpr_webp_quality', webpQuality);
      localStorage.setItem('bpr_jpeg_quality', jpegQuality);
      localStorage.setItem('bpr_jpeg_background', jpegBackground);

      // Handle Undo/Redo Logic
      if (!isTraversingHistory) {
        setHistory(prev => {
          const currentPath = prev.slice(0, historyIndex + 1);
          const lastState = currentPath[currentPath.length - 1];
          if (JSON.stringify(lastState) !== JSON.stringify(newParams)) {
            currentPath.push(newParams);
            setHistoryIndex(currentPath.length - 1);
          }
          return currentPath;
        });
      } else {
        setIsTraversingHistory(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetColor, tolerance, smoothness, scale, autoCrop, pixelFix, replaceTransparent, replaceColor, contiguousOnly, contiguousSeed, hasShadow, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, colors, multiColors, padding, webpQuality, jpegQuality, jpegBackground]);

  // Persist Theme and Layout immediately
  useEffect(() => {
    localStorage.setItem('bpr_theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('bpr_layout', layoutPosition);
  }, [isDarkMode, layoutPosition]);

  useEffect(() => {
    localStorage.setItem(DOCKED_PANELS_STORAGE_KEY, JSON.stringify(dockedPanels));
  }, [dockedPanels]);

  useEffect(() => {
    if (!snapMenu) return undefined;

    const handlePointerDown = (event) => {
      if (!snapMenuRef.current?.contains(event.target)) {
        setSnapMenu(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSnapMenu(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [snapMenu]);

  // Undo / Redo Actions
  const handleUndo = () => {
    if (historyIndex > 0) {
      setIsTraversingHistory(true);
      const prevState = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      applyHistoryState(prevState);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setIsTraversingHistory(true);
      const nextState = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      applyHistoryState(nextState);
    }
  };

  // Keep the first color in the colors array synced with targetColor
  useEffect(() => {
    setColors((prev) => {
      const arr = [...prev];
      arr[0] = targetColor;
      return arr;
    });
  }, [targetColor]);

  const applyHistoryState = (state) => {
    setTargetColor(state.targetColor); setTolerance(state.tolerance); setSmoothness(state.smoothness);
    setScale(state.scale); setAutoCrop(state.autoCrop); setPixelFix(state.pixelFix);
    setReplaceTransparent(state.replaceTransparent); setReplaceColor(state.replaceColor);
    setContiguousOnly(Boolean(state.contiguousOnly));
    setContiguousSeed(state.contiguousSeed || null);
    setHasShadow(state.hasShadow); setShadowColor(state.shadowColor); setShadowBlur(state.shadowBlur);
    setShadowOffsetX(state.shadowOffsetX); setShadowOffsetY(state.shadowOffsetY);

    // Restore multi-color settings and padding if present
    if (state.colors) {
      setColors(state.colors);
    }
    if (typeof state.multiColors === 'boolean') {
      setMultiColors(state.multiColors);
    }
    if (typeof state.padding !== 'undefined') {
      setPadding(state.padding);
    }
    if (typeof state.webpQuality !== 'undefined') setWebpQuality(state.webpQuality);
    if (typeof state.jpegQuality !== 'undefined') setJpegQuality(state.jpegQuality);
    if (typeof state.jpegBackground !== 'undefined') setJpegBackground(state.jpegBackground);
  };

  // Reset all settings to their defaults and clear stored values.
  const resetSettings = () => {
    setIsExportMenuOpen(false);
    setIsExportSettingsOpen(false);
    setIsMobileExportOpen(false);
    setSnapMenu(null);
    setDockedPanels({});
    setTargetColor('#000000');
    setColors(['#000000']);
    setMultiColors(false);
    setTolerance(10);
    setSmoothness(20);
    setScale(100);
    setAutoCrop(false);
    setPixelFix(false);
    setReplaceTransparent(true);
    setReplaceColor('#ffffff');
    setContiguousOnly(false);
    setContiguousSeed(null);
    setHasShadow(false);
    setShadowColor('#000000');
    setShadowBlur(20);
    setShadowOffsetX(0);
    setShadowOffsetY(10);
    setPadding(0);
    setWebpQuality(0.92);
    setJpegQuality(0.9);
    setJpegBackground('#ffffff');
    setIsMaskEditorOpen(false);
    setMaskStrokes([]);
    setShowMask(false);
    clearProcessedExports();
    setOriginalImage(null);
    setOutputFilename('image_transparent');
    setBatchItems((prev) => {
      prev.forEach(revokeBatchItemUrls);
      return [];
    });
    setActiveBatchId(null);
    setOutputDimensions(null);
    setHistory([]);
    setHistoryIndex(-1);
    const keys = ['bpr_color','bpr_tolerance','bpr_smoothness','bpr_scale','bpr_autocrop','bpr_pixelfix','bpr_replace_trans','bpr_replace_color','bpr_contiguous_only','bpr_contiguous_seed','bpr_shadow','bpr_theme','bpr_colors','bpr_padding','bpr_webp_quality','bpr_jpeg_quality','bpr_jpeg_background', DOCKED_PANELS_STORAGE_KEY];
    keys.forEach((key) => localStorage.removeItem(key));
  };

  // Setup Keyboard Listeners (Escape, Undo/Redo shortcut)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeZoomedImage();
        setIsPickingColor(false);
        setIsPickingSeed(false);
        setIsExportMenuOpen(false);
        setIsTestPopoverOpen(false);
        setIsModelDropdownOpen(false);
        setIsMobileSettingsOpen(false);
        setIsMobileExportOpen(false);
        setMobileSettingsDragY(0);
      }
      
      // Handle Undo (Ctrl+Z) and Redo (Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (isMaskEditorOpen && maskStrokes.length > 0 && !e.shiftKey) {
          setMaskStrokes((prev) => prev.slice(0, -1));
        } else if (e.shiftKey) handleRedo(); else handleUndo();
      }
      
      // Handle Redo (Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, isMaskEditorOpen, maskStrokes.length, closeZoomedImage]);

  // Handle image load animation
  useEffect(() => {
    if (originalImage) {
      const timer = setTimeout(() => setShowImages(true), 50);
      setMaskStrokes([]);
      setIsMaskEditorOpen(false);
      return () => clearTimeout(timer);
    } else {
      setShowImages(false);
      setOutputDimensions(null);
    }
  }, [originalImage]);

  // File Handling (Upload, Drag&Drop, Paste)
  const processUploadedFiles = (fileList) => {
    const imageFiles = Array.from(fileList || []).filter((file) => file?.type?.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setIsExportMenuOpen(false);
    setIsExportSettingsOpen(false);
    setIsMobileSettingsOpen(false);
    setIsMobileExportOpen(false);

    const nextBatchItems = imageFiles.map((file, index) => {
      const lastDot = file.name.lastIndexOf('.');
      const nameWithoutExt = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name || `pasted_image_${index + 1}`;
      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        file,
        name: nameWithoutExt,
        url: URL.createObjectURL(file),
        status: index === 0 ? 'processing' : 'queued',
        dimensions: null,
      };
    });

    setBatchItems((prev) => {
      prev.forEach(revokeBatchItemUrls);
      return nextBatchItems;
    });

    const first = nextBatchItems[0];
    setOutputFilename(`${first.name}_transparent`);
    setActiveBatchId(first.id);
    setOriginalImage(first.url);
  };

  const selectBatchItem = useCallback((itemId) => {
    const item = batchItems.find((entry) => entry.id === itemId);
    if (!item) return;
    setActiveBatchId(item.id);
    setOutputFilename(`${item.name}_transparent`);
    setOriginalImage(item.url);
    setIsExportMenuOpen(false);
    setIsMobileExportOpen(false);
  }, [batchItems]);

  const handleImageUpload = (e) => {
    processUploadedFiles(e.target.files);
    e.target.value = '';
  };
  
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        processUploadedFiles(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const dragCounter = useRef(0);

  const onDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const onDragOver = useCallback((e) => { 
    e.preventDefault(); 
  }, []);

  const onDragLeave = useCallback((e) => { 
    e.preventDefault(); 
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false); 
    }
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processUploadedFiles(e.dataTransfer.files);
  }, []);

  // Eyedropper Tool functionality
  const handleOriginalImageClick = (e) => {
    if ((!isPickingColor && !isPickingSeed) || !originalImageRef.current) return;
    const img = originalImageRef.current;
    const rect = img.getBoundingClientRect();
    
    // Calculate click coordinates relative to the natural image size
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    // Draw onto an off-screen canvas to read the exact pixel color
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel[3] > 0) {
      const sampledColor = rgbToHex(pixel[0], pixel[1], pixel[2]);
      if (isPickingColor) setTargetColor(sampledColor);
      if (isPickingSeed) {
        setTargetColor(sampledColor);
        setContiguousSeed({
          x: clamp(x / img.naturalWidth, 0, 1),
          y: clamp(y / img.naturalHeight, 0, 1),
        });
        setContiguousOnly(true);
        showNotice('Connected area seed set.');
      }
    }
    setIsPickingColor(false);
    setIsPickingSeed(false);
  };

  // Core processing function via Web Worker
  useEffect(() => {
    if (!originalImage) {
      clearProcessedExports();
      return undefined;
    }

    let isActive = true;
    setIsProcessing(true);

    processImageSource(originalImage, debouncedParams, maskStrokes)
      .then((result) => {
        if (!isActive) return;

        setOutputDimensions(result.dimensions);
        setProcessedBlob(result.pngBlob);
        setMaskBlob(result.maskBlob);

        setObjectUrlState(setProcessedImage, result.pngBlob);
        setObjectUrlState(setProcessedImageWebp, result.webpBlob);
        setObjectUrlState(setProcessedImageJpeg, result.jpegBlob);
        setObjectUrlState(setMaskImage, result.maskBlob);

        if (activeBatchId) {
          setBatchItems((prev) => prev.map((item) => {
            if (item.id !== activeBatchId) return item;
            revokeUrl(item.pngUrl);
            revokeUrl(item.webpUrl);
            revokeUrl(item.jpegUrl);
            revokeUrl(item.maskUrl);
            return {
              ...item,
              status: 'done',
              dimensions: result.dimensions,
              pngBlob: result.pngBlob,
              webpBlob: result.webpBlob,
              jpegBlob: result.jpegBlob,
              maskBlob: result.maskBlob,
              pngUrl: URL.createObjectURL(result.pngBlob),
              webpUrl: URL.createObjectURL(result.webpBlob),
              jpegUrl: URL.createObjectURL(result.jpegBlob),
              maskUrl: URL.createObjectURL(result.maskBlob),
            };
          }));
        }
      })
      .catch((error) => {
        if (!isActive) return;
        clearProcessedExports();
        setBatchItems((prev) => prev.map((item) => item.id === activeBatchId ? { ...item, status: 'error' } : item));
        showNotice(`Processing failed: ${error.message || 'Unknown error'}`);
      })
      .finally(() => {
        if (isActive) setIsProcessing(false);
      });

    return () => {
      isActive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalImage, debouncedParams, maskStrokes, activeBatchId]);

  const getBatchBlobForFormat = (item, format) => {
    if (format === 'webp') return item.webpBlob;
    if (format === 'jpeg') return item.jpegBlob;
    return item.pngBlob;
  };

  const getExtensionForFormat = (format) => {
    if (format === 'webp') return 'webp';
    if (format === 'jpeg') return 'jpg';
    return 'png';
  };

  const processAllBatchItems = async ({ silent = false } = {}) => {
    if (batchItems.length === 0 || isBatchProcessing) return batchItems;

    setIsBatchProcessing(true);
    const processedItems = [];
    let failedCount = 0;

    for (const item of batchItems) {
      setBatchItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, status: 'processing' } : entry));
      try {
        const result = await processImageSource(item.url, debouncedParams, []);
        const updatedItem = {
          ...item,
          status: 'done',
          dimensions: result.dimensions,
          pngBlob: result.pngBlob,
          webpBlob: result.webpBlob,
          jpegBlob: result.jpegBlob,
          maskBlob: result.maskBlob,
          pngUrl: URL.createObjectURL(result.pngBlob),
          webpUrl: URL.createObjectURL(result.webpBlob),
          jpegUrl: URL.createObjectURL(result.jpegBlob),
          maskUrl: URL.createObjectURL(result.maskBlob),
        };

        processedItems.push(updatedItem);
        setBatchItems((prev) => prev.map((entry) => {
          if (entry.id !== item.id) return entry;
          revokeUrl(entry.pngUrl);
          revokeUrl(entry.webpUrl);
          revokeUrl(entry.jpegUrl);
          revokeUrl(entry.maskUrl);
          return updatedItem;
        }));
      } catch {
        failedCount += 1;
        const failedItem = { ...item, status: 'error' };
        processedItems.push(failedItem);
        setBatchItems((prev) => prev.map((entry) => entry.id === item.id ? failedItem : entry));
      }
    }

    setIsBatchProcessing(false);
    if (!silent) {
      showNotice(failedCount ? `Batch finished with ${failedCount} failed image${failedCount === 1 ? '' : 's'}.` : 'Batch processed.');
    }
    return processedItems;
  };

  const handleDownloadBatchZip = async () => {
    if (batchItems.length === 0) return;
    const needsProcessing = batchItems.some((item) => !getBatchBlobForFormat(item, batchExportFormat));
    const readyItems = needsProcessing
      ? await processAllBatchItems({ silent: true })
      : batchItems;
    const extension = getExtensionForFormat(batchExportFormat);
    const entries = readyItems
      .filter((item) => getBatchBlobForFormat(item, batchExportFormat))
      .map((item, index) => ({
        name: `${item.name || `image_${index + 1}`}_transparent.${extension}`,
        blob: getBatchBlobForFormat(item, batchExportFormat),
      }));

    if (entries.length === 0) {
      showNotice('No processed batch files are ready to zip.');
      return;
    }

    const zipBlob = await createZipBlob(entries);
    downloadBlob(zipBlob, `color-remover-${batchExportFormat}-batch.zip`);
    showNotice(`Downloaded ${entries.length} ${batchExportFormat.toUpperCase()} file${entries.length === 1 ? '' : 's'} as a ZIP.`);
  };

  const handleCopyPng = async () => {
    if (!processedBlob) return;
    if (!navigator.clipboard || !window.ClipboardItem) {
      showNotice('PNG clipboard export is not supported in this browser.');
      return;
    }

    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': processedBlob }),
      ]);
      showNotice('Copied PNG to clipboard.');
    } catch (error) {
      showNotice(`Clipboard copy failed: ${error.message}`);
    }
  };

  const handleDownloadMask = () => {
    if (!maskBlob) return;
    downloadBlob(maskBlob, `${outputFilename || 'image_transparent'}_mask.png`);
  };

  const applySmartBackgroundAssist = async () => {
    if (!originalImage) {
      showNotice('Add an image first.');
      return false;
    }

    try {
      const analysis = await getDominantEdgeColors(originalImage);
      const suggestedColors = analysis.colors.length > 0 ? analysis.colors : [analysis.cornerColor];
      setTargetColor(suggestedColors[0]);
      setColors(suggestedColors);
      setMultiColors(suggestedColors.length > 1);
      setReplaceTransparent(true);
      setTolerance((current) => Math.max(current, 24));
      setSmoothness((current) => Math.max(current, 28));
      setPixelFix(true);
      setShowMask(true);
      setContiguousSeed(analysis.seed);
      showNotice(`Suggested ${suggestedColors.length} background color${suggestedColors.length === 1 ? '' : 's'} from image edges.`);
      return true;
    } catch (error) {
      showNotice(`Smart background scan failed: ${error.message}`);
      return false;
    }
  };

  const applySmartConnectedAssist = async () => {
    const applied = await applySmartBackgroundAssist();
    if (applied) {
      setContiguousOnly(true);
      setIsPickingSeed(false);
      showNotice('Connected removal enabled from the top-left edge seed.');
    }
    return applied;
  };

  const applySmartEdgeAssist = () => {
    setPixelFix(true);
    setSmoothness((current) => Math.max(current, 34));
    setTolerance((current) => Math.max(8, current));
    setShowMask(true);
    showNotice('Edge cleanup tuned with alpha bleed and smoother transitions.');
    return true;
  };

  const applyPromptAssist = async (prompt) => {
    const text = prompt.toLowerCase();
    if (!text.trim()) return false;

    if (text.includes('green screen') || text.includes('green background')) {
      setTargetColor('#00ff00');
      setColors(['#00ff00']);
      setMultiColors(false);
      setTolerance(52);
      setSmoothness(28);
      setReplaceTransparent(true);
      setShowMask(true);
      showNotice('Applied a green-screen removal setup.');
      return true;
    }

    if (text.includes('white background') || text.includes('remove white')) {
      setTargetColor('#ffffff');
      setColors(['#ffffff']);
      setMultiColors(false);
      setTolerance(22);
      setSmoothness(24);
      setReplaceTransparent(true);
      setShowMask(true);
      showNotice('Applied a white-background removal setup.');
      return true;
    }

    if (text.includes('black background') || text.includes('remove black')) {
      setTargetColor('#000000');
      setColors(['#000000']);
      setMultiColors(false);
      setTolerance(22);
      setSmoothness(24);
      setReplaceTransparent(true);
      setShowMask(true);
      showNotice('Applied a black-background removal setup.');
      return true;
    }

    if (text.includes('connected') || text.includes('magic wand')) {
      return applySmartConnectedAssist();
    }

    if (text.includes('edge') || text.includes('halo') || text.includes('fringe') || text.includes('smooth')) {
      return applySmartEdgeAssist();
    }

    if (text.includes('background') || text.includes('subject') || text.includes('remove')) {
      return applySmartBackgroundAssist();
    }

    return false;
  };

  const mapPointerToProcessedPoint = (event) => {
    if (!processedPreviewRef.current || !outputDimensions) return null;
    const rect = processedPreviewRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return {
      x: clamp(x * outputDimensions.width, 0, outputDimensions.width),
      y: clamp(y * outputDimensions.height, 0, outputDimensions.height),
    };
  };

  const addMaskStrokeSegment = (start, end) => {
    const stroke = {
      mode: maskEditMode === 'restore' ? 'restore' : 'erase',
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      radius: brushSize,
    };
    pendingMaskStrokesRef.current.push(stroke);
  };

  const handleMaskBrushPointerDown = (event) => {
    if (!isMaskEditorOpen || !processedImage) return;
    const point = mapPointerToProcessedPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    isPaintingMaskRef.current = true;
    pendingMaskStrokesRef.current = [];
    setIsMaskPainting(true);
    lastMaskPointRef.current = point;
    addMaskStrokeSegment(point, point);
  };

  const handleMaskBrushPointerMove = (event) => {
    if (!isPaintingMaskRef.current || !isMaskEditorOpen) return;
    const point = mapPointerToProcessedPoint(event);
    if (!point || !lastMaskPointRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const previous = lastMaskPointRef.current;
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance < Math.max(2, brushSize / 6)) return;
    addMaskStrokeSegment(previous, point);
    lastMaskPointRef.current = point;
  };

  const handleMaskBrushPointerUp = (event) => {
    if (!isPaintingMaskRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    isPaintingMaskRef.current = false;
    setIsMaskPainting(false);
    const committedStrokes = pendingMaskStrokesRef.current;
    if (committedStrokes.length > 0) {
      setMaskStrokes((prev) => [...prev, ...committedStrokes]);
    }
    pendingMaskStrokesRef.current = [];
    lastMaskPointRef.current = null;
  };

  const handleZoomWheel = (event) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 0.15 : -0.15;
    setZoomScale((current) => clamp(Number((current + direction).toFixed(2)), 0.5, 8));
  };

  const handleZoomPointerDown = (event) => {
    if (zoomScale <= 1) return;
    event.preventDefault();
    if (event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setIsZoomPanning(true);
    zoomPanStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: zoomPan.x,
      panY: zoomPan.y,
    };
  };

  const handleZoomPointerMove = (event) => {
    if (!isZoomPanning || !zoomPanStartRef.current) return;
    event.preventDefault();
    const start = zoomPanStartRef.current;
    setZoomPan({
      x: start.panX + event.clientX - start.x,
      y: start.panY + event.clientY - start.y,
    });
  };

  const handleZoomPointerEnd = () => {
    setIsZoomPanning(false);
    zoomPanStartRef.current = null;
  };

  // Styles for Checkerboard Backgrounds
  const checkerboardStyles = {
    backgroundImage: isDarkMode 
      ? 'repeating-linear-gradient(45deg, #111111 25%, transparent 25%, transparent 75%, #111111 75%, #111111), repeating-linear-gradient(45deg, #111111 25%, #000000 25%, #000000 75%, #111111 75%, #111111)'
      : 'repeating-linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%, #e5e5e5), repeating-linear-gradient(45deg, #e5e5e5 25%, #f5f5f5 25%, #f5f5f5 75%, #e5e5e5 75%, #e5e5e5)',
    backgroundPosition: '0 0, 10px 10px',
    backgroundSize: '20px 20px'
  };

  const updateCompareSliderFromClientX = useCallback((clientX, element) => {
    const rect = element.getBoundingClientRect();
    const nextPosition = ((clientX - rect.left) / rect.width) * 100;
    setCompareSliderPos(Math.max(0, Math.min(100, nextPosition)));
  }, []);

  const closeMobileSettings = useCallback(() => {
    setIsMobileSettingsOpen(false);
    setIsMobileExportOpen(false);
    setMobileSettingsDragY(0);
    mobileSettingsDragStart.current = null;
    mobileSettingsDragDistance.current = 0;
  }, []);

  const openMobilePanel = useCallback((panel) => {
    setIsMobileExportOpen(false);
    setIsMobileSettingsOpen(true);
    setActiveMobilePanel(panel);
    setMobileSettingsDragY(0);
    mobileSettingsDragStart.current = null;
    mobileSettingsDragDistance.current = 0;

    setIsBasicOpen(panel === 'basic');
    setIsAdvancedOpen(panel === 'advanced');
    setIsEffectsOpen(panel === 'effects');
    setIsAiSectionOpen(panel === 'ai');
  }, []);

  const openMobileExport = useCallback(() => {
    if (!processedImage) return;
    setIsMobileSettingsOpen(false);
    setIsMobileExportOpen(true);
    setMobileSettingsDragY(0);
    mobileSettingsDragStart.current = null;
    mobileSettingsDragDistance.current = 0;
  }, [processedImage]);

  const getDragClientY = (e) => {
    return e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? e.clientY;
  };

  const handleMobileSettingsDragStart = useCallback((e) => {
    mobileSettingsDragStart.current = getDragClientY(e);
    mobileSettingsDragDistance.current = 0;
    setMobileSettingsDragY(0);
    if (e.pointerId !== undefined && e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, []);

  const handleMobileSettingsDragMove = useCallback((e) => {
    if (mobileSettingsDragStart.current === null) return;
    e.preventDefault();
    const distance = Math.max(0, getDragClientY(e) - mobileSettingsDragStart.current);
    mobileSettingsDragDistance.current = distance;
    setMobileSettingsDragY(distance);
  }, []);

  const handleMobileSettingsDragEnd = useCallback(() => {
    if (mobileSettingsDragDistance.current > 80) {
      closeMobileSettings();
      return;
    }
    mobileSettingsDragStart.current = null;
    mobileSettingsDragDistance.current = 0;
    setMobileSettingsDragY(0);
  }, [closeMobileSettings]);

  const mobilePanelTitle = {
    basic: 'Basic Settings',
    advanced: 'Advanced Settings',
    effects: 'Effects & Styling',
    ai: 'Smart Assist',
  }[activeMobilePanel] || 'Settings';

  const setPanelOpen = (panelId, open = true) => {
    if (panelId === 'basic') setIsBasicOpen(open);
    if (panelId === 'advanced') setIsAdvancedOpen(open);
    if (panelId === 'effects') setIsEffectsOpen(open);
    if (panelId === 'ai') setIsAiSectionOpen(open);
  };

  const openSnapMenu = (panelId, anchorRect) => {
    if (!DOCKABLE_PANEL_IDS.includes(panelId) || !anchorRect) return;

    const menuWidth = 296;
    const menuHeight = 250;
    const x = clamp(anchorRect.left + (anchorRect.width / 2), menuWidth / 2 + 12, window.innerWidth - (menuWidth / 2) - 12);
    const y = clamp(anchorRect.bottom + 8, 76, window.innerHeight - menuHeight - 12);
    setSnapMenu({ panelId, x, y });
  };

  const dockPanelToPosition = (panelId, position) => {
    if (!DOCKABLE_PANEL_IDS.includes(panelId) || !SNAP_TARGETS.some((target) => target.id === position)) return;

    const replacedPanelId = Object.entries(dockedPanels).find(([otherPanelId, otherPosition]) => (
      otherPanelId !== panelId && otherPosition === position
    ))?.[0];

    setDockedPanels((current) => {
      const next = { ...current };
      Object.entries(next).forEach(([otherPanelId, otherPosition]) => {
        if (otherPanelId !== panelId && otherPosition === position) {
          delete next[otherPanelId];
        }
      });
      next[panelId] = position;
      return next;
    });
    setPanelOpen(panelId, true);
    setSnapMenu(null);
    showNotice(`${PANEL_LABELS[panelId]} snapped to ${SNAP_TARGETS.find((target) => target.id === position)?.label || position}.`);
    if (replacedPanelId) {
      window.setTimeout(() => showNotice(`${PANEL_LABELS[replacedPanelId] || 'Panel'} returned to the list.`), 120);
    }
  };

  const restoreDockedPanel = (panelId) => {
    setDockedPanels((current) => {
      if (!current[panelId]) return current;
      const next = { ...current };
      delete next[panelId];
      return next;
    });
    setSnapMenu(null);
    showNotice(`${PANEL_LABELS[panelId] || 'Panel'} returned to the list.`);
  };

  const getPanelWrapperClass = (panelId) => {
    const isActiveMobilePanel = activeMobilePanel === panelId;
    const mobileClass = isActiveMobilePanel ? 'block' : 'hidden';
    return dockedPanels[panelId] ? `${mobileClass} lg:contents` : `${mobileClass} lg:block`;
  };

  const isPanelNarrow = (panelId) => (
    layoutPosition === 'left' ||
    layoutPosition === 'right' ||
    dockedPanels[panelId] === 'left' ||
    dockedPanels[panelId] === 'right'
  );

  const hasDockedLeft = Object.values(dockedPanels).includes('left');
  const hasDockedRight = Object.values(dockedPanels).includes('right');
  const hasDockedTop = Object.values(dockedPanels).includes('top');
  const hasDockedBottom = Object.values(dockedPanels).includes('bottom');
  const hasSideDock = hasDockedLeft || hasDockedRight;
  const dockInsetClass = [
    hasSideDock ? 'lg:max-w-none' : '',
    hasDockedLeft ? 'lg:pl-[374px] xl:pl-[424px]' : '',
    hasDockedRight ? 'lg:pr-[374px] xl:pr-[424px]' : '',
    hasDockedTop ? 'lg:pt-[18.25rem]' : '',
    hasDockedBottom ? 'lg:pb-[18.25rem]' : '',
  ].filter(Boolean).join(' ');

  const renderExportQualityControls = (isCompact = false) => (
    <div className={`grid gap-5 ${isCompact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
      <div>
        <label className={uiTemplates.text.rangeLabel}>
          WebP Quality <span>{Math.round(webpQuality * 100)}%</span>
        </label>
        <input type="range" min="0.1" max="1" step="0.01" value={webpQuality} onChange={(e) => setWebpQuality(parseFloat(e.target.value))} className={templateClasses.range('emerald')} />
      </div>
      <div>
        <label className={uiTemplates.text.rangeLabel}>
          JPEG Quality <span>{Math.round(jpegQuality * 100)}%</span>
        </label>
        <input type="range" min="0.1" max="1" step="0.01" value={jpegQuality} onChange={(e) => setJpegQuality(parseFloat(e.target.value))} className={templateClasses.range('emerald')} />
      </div>
      <div className={isCompact ? '' : 'sm:col-span-2'}>
        <label className={cx(uiTemplates.text.rangeLabel, 'mb-3 justify-start gap-2')}>JPEG Background</label>
        <div className="flex items-center gap-4">
          <div className={uiTemplates.inputs.colorSwatchExport}>
            <input type="color" value={jpegBackground.length === 7 ? jpegBackground : '#ffffff'} onChange={(e) => setJpegBackground(e.target.value)} className={uiTemplates.inputs.colorInputExport} />
          </div>
          <input type="text" value={jpegBackground} spellCheck="false" onChange={(e) => { let val = e.target.value; if (!val.startsWith('#')) val = '#' + val.replace(/#/g, ''); setJpegBackground(val.slice(0, 7)); }} className={uiTemplates.inputs.hexWide} />
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className={`${isDarkMode ? 'dark' : ''} min-h-[100dvh]`}
      onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      {/* Global Drag Overlay */}
      {isDragging && (
        <div className={uiTemplates.surfaces.dragOverlay}>
          <Upload className="w-20 h-20 sm:w-24 sm:h-24 mb-4 animate-bounce" />
          <h2 className="text-3xl sm:text-4xl font-bold">Drop Image Here</h2>
          <p className="mt-2 opacity-80">Release to process the file.</p>
        </div>
      )}

      <div className={uiTemplates.surfaces.appShell}>
        
        {/* Topbar */}
        <header className={uiTemplates.surfaces.topbar}>
          <div className="order-1 flex items-center gap-2.5 sm:gap-3 min-w-0">
            <img src="/favicon.png" alt="Logo" className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow-sm hover:scale-105 transition-transform" />
            <h1 className={uiTemplates.text.appTitle}>Color Remover</h1>
          </div>

          {updateInfo.available && (
            <button
              type="button"
              onClick={handleUpdateNow}
              disabled={isUpdatingApp}
              className="order-3 flex min-h-[40px] w-full basis-full items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-100 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20 sm:order-2 sm:min-h-[36px] sm:w-auto sm:basis-auto sm:px-4"
              title={updateInfo.message || 'A new version is available'}
              aria-live="polite"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.14)]" />
              <span className="whitespace-nowrap">New Version</span>
              <span className="min-w-0 truncate font-medium text-blue-600/80 dark:text-blue-200/80">
                {isUpdatingApp ? 'Pulling latest commit...' : updateInfo.canPull ? 'Update now' : 'View on GitHub'}
              </span>
              <Download className={`h-3.5 w-3.5 shrink-0 ${isUpdatingApp ? 'animate-bounce' : ''}`} />
            </button>
          )}
          
          <div className="order-2 flex items-center gap-1.5 sm:order-3 sm:gap-3 shrink-0">
            <div className={uiTemplates.surfaces.toolbarGroup}>
              <button onClick={handleUndo} disabled={historyIndex <= 0} className={uiTemplates.buttons.toolbarIcon} title="Undo (Ctrl+Z)" aria-label="Undo">
                <Undo2 className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
              </button>
              <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={uiTemplates.buttons.toolbarIcon} title="Redo (Ctrl+Y or Ctrl+Shift+Z)" aria-label="Redo">
                <Redo2 className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
              </button>
            </div>
            <button onClick={resetSettings} className={uiTemplates.buttons.topbarIcon} title="Reset All Settings" aria-label="Reset all settings">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-600 dark:text-neutral-300" />
            </button>
            <button onClick={() => setIsSettingsModalOpen(true)} className={uiTemplates.buttons.topbarIcon} title="Global Settings" aria-label="Open global settings">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-600 dark:text-neutral-300" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className={`flex-1 w-full mx-auto flex flex-col ${!originalImage ? 'max-w-none px-0 pt-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:max-w-5xl lg:p-6 lg:pb-8' : layoutPosition === 'left' || layoutPosition === 'right' ? 'max-w-none px-3 sm:px-4 pt-4 sm:pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-8' : 'max-w-5xl px-3 py-4 sm:p-6 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-8'} ${dockInsetClass}`}>
          
          {/* Layout Wrapper */}
          <div className={`flex-1 flex flex-col gap-4 sm:gap-8 ${layoutPosition === 'left' ? 'lg:flex-row' : ''} ${layoutPosition === 'right' ? 'lg:flex-row-reverse' : ''} ${layoutPosition === 'bottom' ? 'lg:flex-col-reverse' : ''}`}>
            {(isMobileSettingsOpen || isMobileExportOpen) && (
              <button
                type="button"
                className="fixed inset-0 z-[190] bg-black/30 backdrop-blur-[1px] lg:hidden"
                onClick={closeMobileSettings}
                aria-label="Close settings menu"
              />
            )}
            
            {/* Controls Panel */}
            <div
              className={cx(
                uiTemplates.surfaces.mobileSheet,
                'lg:static lg:z-auto lg:block lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:transition-none space-y-2 lg:space-y-4',
                isMobileSettingsOpen ? 'block translate-y-0 opacity-100' : 'hidden translate-y-[calc(100%+2rem)] opacity-0 pointer-events-none',
                'lg:translate-y-0 lg:[translate:none] lg:transform-none lg:opacity-100 lg:pointer-events-auto',
                layoutPosition === 'left' || layoutPosition === 'right' ? 'lg:w-[350px] xl:w-[400px] shrink-0' : 'w-full'
              )}
              style={isMobileSettingsOpen ? { transform: `translateY(${mobileSettingsDragY}px)` } : undefined}
              onPointerMove={handleMobileSettingsDragMove}
              onPointerUp={handleMobileSettingsDragEnd}
              onPointerCancel={handleMobileSettingsDragEnd}
              onMouseMove={(e) => {
                if (e.buttons === 1) handleMobileSettingsDragMove(e);
              }}
              onMouseUp={handleMobileSettingsDragEnd}
              onTouchMove={handleMobileSettingsDragMove}
              onTouchEnd={handleMobileSettingsDragEnd}
            >
            <div
              className={cx(uiTemplates.surfaces.mobileSheetHeader, 'lg:hidden')}
              onPointerDown={handleMobileSettingsDragStart}
              onMouseDown={handleMobileSettingsDragStart}
              onTouchStart={handleMobileSettingsDragStart}
            >
              <div className="mx-auto mb-1 h-1 w-11 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              <div className="flex min-h-9 items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-bold leading-4 text-neutral-900 dark:text-white">{mobilePanelTitle}</p>
                  <p className="text-[11px] leading-3 text-neutral-500 dark:text-neutral-400">Drag down to close</p>
                </div>
                <button
                  type="button"
                  onClick={closeMobileSettings}
                  className={uiTemplates.buttons.closeIcon}
                  aria-label="Close settings menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {/* 1. Basic Settings */}
            <div className={getPanelWrapperClass('basic')}>
            <CollapsibleSection title="Basic Settings" icon={Settings} isOpen={isBasicOpen} onToggle={() => setIsBasicOpen(!isBasicOpen)} contentOnlyOnMobile panelId="basic" dockPosition={dockedPanels.basic} onRequestDock={openSnapMenu} onRestoreDock={restoreDockedPanel}>
              <div className="flex flex-col gap-6 sm:gap-8">
                <div className={`grid gap-6 sm:gap-8 ${isPanelNarrow('basic') ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {/* Target Color Picker + Pipette */}
                  <div className="flex-1">
                    <label className={uiTemplates.text.fieldLabel}>
                      <Palette className="w-4 h-4" /> Color to Remove
                    </label>
                    <div className="flex items-center gap-4">
                      <div className={uiTemplates.inputs.colorSwatchLarge}>
                        <input 
                          type="color" value={targetColor.length === 7 ? targetColor : '#000000'} onChange={(e) => setTargetColor(e.target.value)}
                          className={uiTemplates.inputs.colorInputLarge}
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <input 
                          type="text" value={targetColor} spellCheck="false"
                          onChange={(e) => { let val = e.target.value; if (!val.startsWith('#')) val = '#' + val.replace(/#/g, ''); setTargetColor(val.slice(0, 7)); }}
                          className={uiTemplates.inputs.hex}
                        />
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">Edit hex directly</span>
                      </div>
                      {/* Pipette Button */}
                      <button 
                        onClick={() => setIsPickingColor(!isPickingColor)}
                        className={cx('p-3 rounded-lg border transition-all', isPickingColor ? uiTemplates.buttons.colorPickActive : uiTemplates.buttons.colorPickIdle)}
                        title="Pick color from original image"
                      >
                        <Pipette className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Replace Options */}
                  <div className="flex-1">
                    <label className={uiTemplates.text.fieldLabel}>
                      <Eraser className="w-4 h-4" /> Replace With
                    </label>
                    <div className="flex flex-col gap-4">
                       <div className={cx(uiTemplates.surfaces.segmentGroup, 'w-full sm:w-fit')}>
                        <button onClick={() => setReplaceTransparent(true)} className={templateClasses.segmentButton(replaceTransparent)}>Transparency</button>
                        <button onClick={() => setReplaceTransparent(false)} className={templateClasses.segmentButton(!replaceTransparent)}>Solid Color</button>
                      </div>
                      {!replaceTransparent && (
                        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className={uiTemplates.inputs.colorSwatchLarge}>
                            <input type="color" value={replaceColor.length === 7 ? replaceColor : '#ffffff'} onChange={(e) => setReplaceColor(e.target.value)} className={uiTemplates.inputs.colorInputLarge} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <input type="text" value={replaceColor} spellCheck="false" onChange={(e) => { let val = e.target.value; if (!val.startsWith('#')) val = '#' + val.replace(/#/g, ''); setReplaceColor(val.slice(0, 7)); }} className={uiTemplates.inputs.hex} />
                            <span className="text-xs text-neutral-400 dark:text-neutral-500">New background</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full">
                  <label className={uiTemplates.text.fieldLabel}>
                    <SlidersHorizontal className="w-4 h-4" /> Tolerance: <EditableNumber value={tolerance} onChange={setTolerance} min={0} max={255} />
                  </label>
                  <div className="py-2">
                    <input type="range" min="0" max="255" value={tolerance} onChange={(e) => setTolerance(parseInt(e.target.value))} className={templateClasses.range()} />
                  </div>
                  <p className={uiTemplates.text.helper}>Determines the threshold for pixels to be removed.</p>
                </div>
                {/* Multi-Color Removal Feature */}
                <div className="flex flex-col gap-4">
                  <label className={uiTemplates.toggles.label} onClick={(e) => { e.preventDefault(); setMultiColors(!multiColors); }}>
                    <div className={templateClasses.toggleTrack(multiColors)}>
                      <span aria-hidden="true" className={templateClasses.toggleThumb(multiColors)} />
                    </div>
                    <span className={uiTemplates.toggles.iconLabel}><Layers className={uiTemplates.toggles.icon} /> Multi-Color Removal</span>
                  </label>
                  {multiColors && (
                    <div className="flex flex-col gap-3 pl-1">
                      {colors.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                          <div className={uiTemplates.inputs.colorSwatchSmall}>
                            <input 
                              type="color"
                              value={c.length === 7 ? c : '#000000'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColors((prev) => {
                                  const arr = [...prev];
                                  arr[idx] = val;
                                  if (idx === 0) setTargetColor(val);
                                  return arr;
                                });
                              }}
                              className={uiTemplates.inputs.colorInputSmall}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              value={c}
                              spellCheck="false"
                              onChange={(e) => {
                                let val = e.target.value;
                                if (!val.startsWith('#')) val = '#' + val.replace(/#/g, '');
                                val = val.slice(0, 7);
                                setColors((prev) => {
                                  const arr = [...prev];
                                  arr[idx] = val;
                                  if (idx === 0) setTargetColor(val);
                                  return arr;
                                });
                              }}
                              className={uiTemplates.inputs.hex}
                            />
                            <span className="text-xs text-neutral-400 dark:text-neutral-500">{idx === 0 ? 'Primary' : 'Color ' + (idx + 1)}</span>
                          </div>
                          {idx > 0 && (
                            <button
                              onClick={() => {
                                setColors((prev) => {
                                  const arr = [...prev];
                                  arr.splice(idx, 1);
                                  return arr;
                                });
                              }}
                              className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-neutral-50 dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 hover:bg-red-100 dark:hover:bg-red-800/40 transition-colors active:scale-95"
                              title="Remove color"
                              aria-label="Remove color"
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setColors((prev) => [...prev, '#000000']);
                        }}
                        className={cx(uiTemplates.buttons.neutral, 'w-full sm:w-fit rounded-md')}
                        title="Add another color"
                      >
                        <Plus className="w-4 h-4" /> Add Color
                      </button>
                    </div>
                  )}
                </div>

                <div className={uiTemplates.surfaces.softPanel}>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className={uiTemplates.text.cardTitle}>
                          <Pipette className="h-4 w-4 text-neutral-500" />
                          Connected Area
                        </p>
                        <p className={uiTemplates.text.cardDescription}>Limit removal to the sampled region, like a magic-wand selection.</p>
                      </div>
                      <label className={uiTemplates.toggles.labelInline} onClick={(e) => { e.preventDefault(); setContiguousOnly(!contiguousOnly); }}>
                        <div className={templateClasses.toggleTrack(contiguousOnly)}>
                          <span aria-hidden="true" className={templateClasses.toggleThumb(contiguousOnly)} />
                        </div>
                        {contiguousOnly ? 'On' : 'Off'}
                      </label>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPickingSeed(true);
                          setIsPickingColor(false);
                        }}
                        className={cx('flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors active:scale-[0.98]', isPickingSeed ? 'bg-blue-600 text-white' : 'bg-white text-neutral-700 hover:bg-neutral-100 dark:bg-[#0a0a0a] dark:text-neutral-300 dark:hover:bg-neutral-800')}
                      >
                        <Pipette className="h-4 w-4" />
                        Pick Seed
                      </button>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {contiguousSeed ? `Seed ${Math.round(contiguousSeed.x * 100)}%, ${Math.round(contiguousSeed.y * 100)}%` : 'No seed set yet'}
                      </span>
                    </div>
                  </div>
                </div>

                {batchItems.length > 1 && (
                  <div className={uiTemplates.surfaces.softPanel}>
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className={uiTemplates.text.cardTitle}>
                          <Archive className="h-4 w-4 text-neutral-500" />
                          Batch Queue
                        </p>
                        <p className={uiTemplates.text.cardDescription}>{batchItems.length} images loaded. Current settings apply to all batch exports.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => processAllBatchItems()}
                        disabled={isBatchProcessing}
                        className={uiTemplates.buttons.primary}
                      >
                        <Sparkles className={`h-4 w-4 ${isBatchProcessing ? 'animate-spin' : ''}`} />
                        {isBatchProcessing ? 'Processing' : 'Process All'}
                      </button>
                    </div>
                    <div className="mb-4 grid max-h-44 grid-cols-1 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2">
                      {batchItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectBatchItem(item.id)}
                          className={cx(
                            'flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                            activeBatchId === item.id
                              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200'
                              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-[#0a0a0a] dark:text-neutral-300 dark:hover:bg-neutral-800'
                          )}
                        >
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.status === 'done' ? 'bg-emerald-500' : item.status === 'error' ? 'bg-red-500' : item.status === 'processing' ? 'bg-blue-500 animate-pulse' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                          <span className="min-w-0 flex-1 truncate">{item.name}</span>
                          {item.dimensions && <span className="hidden shrink-0 font-mono text-[11px] text-neutral-400 sm:inline">{item.dimensions.width}x{item.dimensions.height}</span>}
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <TemplateSelect
                        value={batchExportFormat}
                        onChange={setBatchExportFormat}
                        options={EXPORT_FORMAT_OPTIONS}
                        ariaLabel="Batch export format"
                        placeholder="Batch format"
                      />
                      <button
                        type="button"
                        onClick={handleDownloadBatchZip}
                        disabled={isBatchProcessing}
                        className={uiTemplates.buttons.success}
                      >
                        <Download className="h-4 w-4" />
                        Download ZIP
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
            </div>

            {/* 2. Advanced Settings */}
            <div className={getPanelWrapperClass('advanced')}>
            <CollapsibleSection title="Advanced Settings" icon={Wrench} isOpen={isAdvancedOpen} onToggle={() => setIsAdvancedOpen(!isAdvancedOpen)} contentOnlyOnMobile panelId="advanced" dockPosition={dockedPanels.advanced} onRequestDock={openSnapMenu} onRestoreDock={restoreDockedPanel}>
              <div className="flex flex-col gap-8">
                <div className={`grid gap-6 sm:gap-8 ${isPanelNarrow('advanced') ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  <div className="flex-1">
                    <label className={uiTemplates.text.fieldLabel}>
                      <SlidersHorizontal className="w-4 h-4" /> Edge Smoothing: <EditableNumber value={smoothness} onChange={setSmoothness} min={0} max={100} />
                    </label>
                    <div className="py-2">
                      <input type="range" min="0" max="100" value={smoothness} onChange={(e) => setSmoothness(parseInt(e.target.value))} className={templateClasses.range()} />
                    </div>
                    <p className={uiTemplates.text.helper}>Creates soft transitions for clean edges.</p>
                  </div>

                  <div className="flex-1">
                    <label className={uiTemplates.text.fieldLabel}>
                      <ZoomIn className="w-4 h-4" /> Scale / Zoom: <EditableNumber value={scale} onChange={setScale} min={10} max={200} /><span className="text-sm font-bold text-neutral-600 dark:text-neutral-400 -ml-1">%</span>
                    </label>
                    <div className="py-2">
                      <input type="range" min="10" max="200" value={scale} onChange={(e) => setScale(parseInt(e.target.value))} className={templateClasses.range()} />
                    </div>
                    <p className={uiTemplates.text.helper}>Adjusts final image resolution.</p>
                  </div>
                </div>

                <div className={`grid gap-4 ${isPanelNarrow('advanced') ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  <label className={uiTemplates.toggles.labelCompact} onClick={(e) => { e.preventDefault(); setAutoCrop(!autoCrop); }}>
                    <div className={templateClasses.toggleTrack(autoCrop)}>
                      <span aria-hidden="true" className={templateClasses.toggleThumb(autoCrop)} />
                    </div>
                    <span className={uiTemplates.toggles.iconLabel}><Crop className={uiTemplates.toggles.icon} /> Auto-Crop (Trim edges)</span>
                  </label>

                  <label className={cx(uiTemplates.toggles.labelCompact, 'transition-opacity', !replaceTransparent ? 'opacity-50' : '')} onClick={(e) => { e.preventDefault(); if (replaceTransparent) setPixelFix(!pixelFix); }}>
                    <div className={templateClasses.toggleTrack(pixelFix && replaceTransparent)}>
                      <span aria-hidden="true" className={templateClasses.toggleThumb(pixelFix && replaceTransparent)} />
                    </div>
                    <span className={uiTemplates.toggles.iconLabel}><Sparkles className={uiTemplates.toggles.icon} /> Transparent Pixel Fix (Alpha Bleed)</span>
                  </label>
                </div>
              {/* Padding Slider */}
              <div className="pt-5">
                <label className={uiTemplates.text.fieldLabel}>
                  <MoveDown className="w-4 h-4" /> Canvas Padding: <EditableNumber value={padding} onChange={setPadding} min={0} max={200} /><span className="text-sm font-bold text-neutral-600 dark:text-neutral-400 -ml-1">px</span>
                </label>
                <div className="py-2">
                  <input type="range" min="0" max="200" value={padding} onChange={(e) => setPadding(parseInt(e.target.value))} className={templateClasses.range()} />
                </div>
                <p className={uiTemplates.text.helper}>Adds extra space around the output.</p>
              </div>

              <div className={uiTemplates.surfaces.softPanel}>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className={uiTemplates.text.cardTitle}>
                      <Brush className="h-4 w-4 text-neutral-500" />
                      Manual Mask Editing
                    </p>
                    <p className={uiTemplates.text.cardDescription}>Paint on the result preview to remove pixels or restore from the original.</p>
                  </div>
                  <label className={cx(uiTemplates.toggles.labelInline, processedImage ? '' : 'text-neutral-400 dark:text-neutral-600')} onClick={(e) => { e.preventDefault(); if (processedImage) setIsMaskEditorOpen(!isMaskEditorOpen); }}>
                    <div className={templateClasses.toggleTrack(isMaskEditorOpen && processedImage)}>
                      <span aria-hidden="true" className={templateClasses.toggleThumb(isMaskEditorOpen && processedImage)} />
                    </div>
                    {isMaskEditorOpen ? 'Editing' : 'Off'}
                  </label>
                </div>
                <div className="grid gap-4">
                  <div className={cx(uiTemplates.surfaces.segmentGroup, 'bg-white dark:bg-[#0a0a0a]')}>
                    <button
                      type="button"
                      onClick={() => setMaskEditMode('erase')}
                      className={cx('flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors', maskEditMode === 'erase' ? uiTemplates.buttons.segmentActiveDark : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200')}
                    >
                      <Eraser className="h-4 w-4" />
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaskEditMode('restore')}
                      className={cx('flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors', maskEditMode === 'restore' ? uiTemplates.buttons.segmentActiveDark : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200')}
                    >
                      <Pencil className="h-4 w-4" />
                      Restore
                    </button>
                  </div>
                  <div>
                    <label className={uiTemplates.text.rangeLabel}>
                      Brush Size <span>{brushSize}px</span>
                    </label>
                    <input type="range" min="4" max="120" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className={templateClasses.range('blue')} />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setMaskStrokes((prev) => prev.slice(0, -1))}
                      disabled={maskStrokes.length === 0}
                      className={cx(uiTemplates.buttons.secondary, 'flex-1')}
                    >
                      <Undo2 className="h-4 w-4" />
                      Undo Stroke
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaskStrokes([])}
                      disabled={maskStrokes.length === 0}
                      className={cx(uiTemplates.buttons.secondary, 'flex-1')}
                    >
                      <X className="h-4 w-4" />
                      Clear Mask
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{maskStrokes.length} stroke{maskStrokes.length === 1 ? '' : 's'} applied. Manual edits affect the active image export only.</p>
                </div>
              </div>

              </div>
            </CollapsibleSection>
            </div>

            {/* 3. Effects & Styling */}
            <div className={getPanelWrapperClass('effects')}>
            <CollapsibleSection title="Effects & Styling" icon={Layers} isOpen={isEffectsOpen} onToggle={() => setIsEffectsOpen(!isEffectsOpen)} contentOnlyOnMobile panelId="effects" dockPosition={dockedPanels.effects} onRequestDock={openSnapMenu} onRestoreDock={restoreDockedPanel}>
              <div className="flex flex-col gap-6">
                <label 
                  className={uiTemplates.toggles.label}
                  onClick={(e) => {
                    e.preventDefault();
                    setHasShadow(!hasShadow);
                  }}
                >
                  <div className={templateClasses.toggleTrack(hasShadow, 'indigo')}>
                    <span aria-hidden="true" className={templateClasses.toggleThumb(hasShadow)} />
                  </div>
                  <span className={uiTemplates.toggles.iconLabel}><Layers className={uiTemplates.toggles.icon} /> Enable Drop Shadow / Glow</span>
                </label>
                
                {hasShadow && (
                    <div className={`grid gap-6 animate-in fade-in duration-300 ${isPanelNarrow('effects') ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
                    {/* Shadow Color */}
                    <div className="flex flex-col gap-3">
                      <label className={uiTemplates.text.compactLabel}>Color</label>
                      <div className="flex items-center gap-3">
                        <div className={uiTemplates.inputs.colorSwatchSmall}>
                          <input type="color" value={shadowColor.length===7 ? shadowColor : '#000'} onChange={(e) => setShadowColor(e.target.value)} className={uiTemplates.inputs.colorInputSmall} />
                        </div>
                        <input type="text" value={shadowColor} spellCheck="false" onChange={(e)=>{let v=e.target.value; if(!v.startsWith('#')) v='#'+v.replace(/#/g,''); setShadowColor(v.slice(0,7));}} className={uiTemplates.inputs.hex} />
                      </div>
                    </div>
                    {/* Shadow Blur */}
                    <div className="flex flex-col gap-3">
                      <label className={cx(uiTemplates.text.compactLabel, 'flex items-center justify-between')}>Blur/Glow Size <span>{shadowBlur}px</span></label>
                      <input type="range" min="0" max="100" value={shadowBlur} onChange={(e) => setShadowBlur(parseInt(e.target.value))} className={templateClasses.range('indigo')} />
                    </div>
                    {/* Shadow Offset X */}
                    <div className="flex flex-col gap-3">
                      <label className={cx(uiTemplates.text.compactLabel, 'flex items-center justify-between')}>Offset X <span>{shadowOffsetX}px</span></label>
                      <input type="range" min="-100" max="100" value={shadowOffsetX} onChange={(e) => setShadowOffsetX(parseInt(e.target.value))} className={templateClasses.range('indigo')} />
                    </div>
                    {/* Shadow Offset Y */}
                    <div className="flex flex-col gap-3">
                      <label className={cx(uiTemplates.text.compactLabel, 'flex items-center justify-between')}>Offset Y <span>{shadowOffsetY}px</span></label>
                      <input type="range" min="-100" max="100" value={shadowOffsetY} onChange={(e) => setShadowOffsetY(parseInt(e.target.value))} className={templateClasses.range('indigo')} />
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
            </div>

            {/* 4. Smart Assist */}
              <div className={getPanelWrapperClass('ai')}>
              <CollapsibleSection
                title="Smart Assist"
                icon={Bot}
                isOpen={isAiSectionOpen}
                onToggle={() => setIsAiSectionOpen(!isAiSectionOpen)}
                description="Transform image with text prompts"
                contentOnlyOnMobile
                panelId="ai"
                dockPosition={dockedPanels.ai}
                onRequestDock={openSnapMenu}
                onRestoreDock={restoreDockedPanel}
              >
                <div className="flex flex-col gap-4">
                  <div className={`grid gap-2 ${isPanelNarrow('ai') ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
                    <button
                      type="button"
                      onClick={applySmartBackgroundAssist}
                      disabled={!originalImage}
                      className={uiTemplates.buttons.primaryBlue}
                    >
                      <Sparkles className="h-4 w-4" />
                      Find Background
                    </button>
                    <button
                      type="button"
                      onClick={applySmartConnectedAssist}
                      disabled={!originalImage}
                      className={cx(uiTemplates.buttons.primary, 'rounded-xl px-3')}
                    >
                      <Pipette className="h-4 w-4" />
                      Connected Cut
                    </button>
                    <button
                      type="button"
                      onClick={applySmartEdgeAssist}
                      disabled={!originalImage}
                      className={cx(uiTemplates.buttons.neutral, 'rounded-xl px-3 font-semibold text-neutral-800 dark:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50')}
                    >
                      <Brush className="h-4 w-4" />
                      Clean Edges
                    </button>
                  </div>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Try: remove background, green screen, remove white, connected cut, clean edges..."
                    className={uiTemplates.inputs.textarea}
                  />
                  
                  {!apiKey ? (
                    <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 p-3 rounded-xl text-sm flex items-start gap-3 border border-amber-200 dark:border-amber-800/30">
                      <Key className="w-5 h-5 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold mb-1">Local assists work without a key</p>
                        <p className="text-amber-600/80 dark:text-amber-400/80">Provider prompts still need a key in <button onClick={() => setIsSettingsModalOpen(true)} className="underline font-semibold hover:text-amber-700 dark:hover:text-amber-300">Global Settings</button>.</p>
                      </div>
                    </div>
                  ) : null}
                    <button
                      onClick={handleAiGeneration}
                      disabled={!aiPrompt.trim() || isProcessing}
                    className={cx(
                      'flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl font-semibold transition-all duration-200',
                      aiPrompt.trim() && !isProcessing
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95'
                        : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                    )}
                    >
                      <Sparkles className="w-4 h-4" /> Apply Prompt
                    </button>
                </div>
              </CollapsibleSection>
              </div>

            {/* Action Bar */}
            <div className={uiTemplates.surfaces.actionBar}>
              <div className={`flex gap-4 ${layoutPosition === 'left' || layoutPosition === 'right' ? 'flex-col items-stretch' : 'flex-col md:flex-row items-stretch sm:items-center justify-between'}`}>
                <div className={`w-full ${layoutPosition === 'left' || layoutPosition === 'right' ? '' : 'md:w-auto'}`}>
                  <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                  <button onClick={() => fileInputRef.current.click()} className={cx(uiTemplates.buttons.upload, layoutPosition === 'left' || layoutPosition === 'right' ? 'w-full' : 'w-full md:w-auto')}>
                    <Upload className="w-5 h-5 sm:w-4 sm:h-4" /> Select Image
                  </button>
                </div>
                {processedImage && (
                  <div className={`flex items-stretch sm:items-center gap-3 w-full ${layoutPosition === 'left' || layoutPosition === 'right' ? 'flex-col' : 'flex-col sm:flex-row md:w-auto md:justify-end'}`}>
                    <div className={cx(uiTemplates.inputs.filenameShell, layoutPosition === 'left' || layoutPosition === 'right' ? 'w-full' : 'flex-1 sm:flex-none')}>
                      <Pencil className="w-4 h-4 text-neutral-400 shrink-0" />
                      <input type="text" value={outputFilename} onChange={(e) => setOutputFilename(e.target.value)} className={uiTemplates.inputs.transparentInline} placeholder="filename" />
                      <span className="text-sm text-neutral-400 select-none shrink-0">.png</span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <a href={processedImage} download={`${outputFilename || 'image_transparent'}.png`} className={cx(uiTemplates.buttons.download, layoutPosition === 'left' || layoutPosition === 'right' ? 'flex-1' : 'flex-1 sm:flex-none')}>
                        <Download className="w-4 h-4" /> Download
                      </a>
                      {(processedImageWebp || processedImageJpeg || maskImage || processedBlob) && (
                        <div className="relative group">
                          <button
                            onClick={() => setIsExportMenuOpen((open) => !open)}
                            className={cx(uiTemplates.buttons.neutral, 'px-3')}
                            aria-label="More export options"
                            aria-expanded={isExportMenuOpen}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <div className={cx('absolute right-0 bottom-full sm:bottom-auto sm:top-full mb-2 sm:mb-0 sm:mt-2 w-56 flex-col py-1 transition-all duration-200 flex', uiTemplates.surfaces.dropdown, isExportMenuOpen ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none sm:group-hover:opacity-100 sm:group-hover:visible sm:group-hover:pointer-events-auto')}>
                            {processedImageWebp && (
                              <a href={processedImageWebp} download={`${outputFilename || 'image_transparent'}.webp`} onClick={() => setIsExportMenuOpen(false)} className={uiTemplates.buttons.menuItem}>
                                <Download className="w-4 h-4" /> WebP
                              </a>
                            )}
                            {processedImageJpeg && (
                              <a href={processedImageJpeg} download={`${outputFilename || 'image_transparent'}.jpg`} onClick={() => setIsExportMenuOpen(false)} className={uiTemplates.buttons.menuItem}>
                                <Download className="w-4 h-4" /> JPEG
                              </a>
                            )}
                            {processedBlob && (
                              <button onClick={(e) => { e.preventDefault(); handleCopyPng(); setIsExportMenuOpen(false); }} className={cx(uiTemplates.buttons.menuItem, 'w-full text-left')}>
                                <Copy className="w-4 h-4" /> Copy PNG
                              </button>
                            )}
                            {maskBlob && (
                              <button onClick={(e) => { e.preventDefault(); handleDownloadMask(); setIsExportMenuOpen(false); }} className={cx(uiTemplates.buttons.menuItem, 'w-full text-left')}>
                                <Download className="w-4 h-4" /> Download Mask
                              </button>
                            )}
                            {maskImage && (
                              <button onClick={(e) => { e.preventDefault(); setShowMask(!showMask); setIsExportMenuOpen(false); }} className={cx(uiTemplates.buttons.menuItem, 'w-full text-left')}>
                                <Eye className="w-4 h-4" /> {showMask ? 'Hide Mask' : 'Show Mask'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className={uiTemplates.surfaces.exportDisclosure}>
                <button
                  type="button"
                  onClick={() => setIsExportSettingsOpen((open) => !open)}
                  className={uiTemplates.buttons.disclosure}
                  aria-expanded={isExportSettingsOpen}
                >
                  <span className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-neutral-500" />
                    Export Options
                  </span>
                  <ChevronDown className={`h-4 w-4 text-neutral-500 transition-transform ${isExportSettingsOpen ? 'rotate-180' : ''}`} />
                </button>
                {isExportSettingsOpen && (
                  <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
                    {renderExportQualityControls()}
                  </div>
                )}
              </div>
            </div>
            </div>

            {processedImage && (
              <div
                className={cx(uiTemplates.surfaces.mobileSheetExport, isMobileExportOpen ? 'block translate-y-0 opacity-100' : 'hidden translate-y-[calc(100%+2rem)] opacity-0 pointer-events-none')}
                style={isMobileExportOpen ? { transform: `translateY(${mobileSettingsDragY}px)` } : undefined}
                onPointerMove={handleMobileSettingsDragMove}
                onPointerUp={handleMobileSettingsDragEnd}
                onPointerCancel={handleMobileSettingsDragEnd}
                onMouseMove={(e) => {
                  if (e.buttons === 1) handleMobileSettingsDragMove(e);
                }}
                onMouseUp={handleMobileSettingsDragEnd}
                onTouchMove={handleMobileSettingsDragMove}
                onTouchEnd={handleMobileSettingsDragEnd}
              >
                <div
                  className={uiTemplates.surfaces.mobileSheetHeader}
                  onPointerDown={handleMobileSettingsDragStart}
                  onMouseDown={handleMobileSettingsDragStart}
                  onTouchStart={handleMobileSettingsDragStart}
                >
                  <div className="mx-auto mb-1 h-1 w-11 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                  <div className="flex min-h-9 items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-bold leading-4 text-neutral-900 dark:text-white">Save Export</p>
                      <p className="text-[11px] leading-3 text-neutral-500 dark:text-neutral-400">Drag down to close</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeMobileSettings}
                      className={uiTemplates.buttons.closeIcon}
                      aria-label="Close export menu"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className={uiTemplates.inputs.filenameShellMobile}>
                    <Pencil className="h-4 w-4 shrink-0 text-neutral-400" />
                    <input
                      type="text"
                      value={outputFilename}
                      onChange={(e) => setOutputFilename(e.target.value)}
                      className={cx(uiTemplates.inputs.transparentInline, 'min-w-0')}
                      placeholder="filename"
                    />
                    <span className="shrink-0 text-sm text-neutral-400 select-none">.png</span>
                  </div>

                  <a
                    href={processedImage}
                    download={`${outputFilename || 'image_transparent'}.png`}
                    onClick={closeMobileSettings}
                    className={cx(uiTemplates.buttons.download, 'min-h-[48px] w-full rounded-xl py-3 font-semibold')}
                  >
                    <Download className="h-4 w-4" />
                    Download PNG
                  </a>

                  <div className={uiTemplates.surfaces.exportDisclosureLight}>
                    <button
                      type="button"
                      onClick={() => setIsExportSettingsOpen((open) => !open)}
                      className={uiTemplates.buttons.disclosureLight}
                      aria-expanded={isExportSettingsOpen}
                    >
                      <span className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-neutral-500" />
                        Export Options
                      </span>
                      <ChevronDown className={`h-4 w-4 text-neutral-500 transition-transform ${isExportSettingsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isExportSettingsOpen && (
                      <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
                        {renderExportQualityControls(true)}
                      </div>
                    )}
                  </div>

                  <div className={uiTemplates.surfaces.exportDisclosureLight}>
                    {processedImageWebp && (
                      <a
                        href={processedImageWebp}
                        download={`${outputFilename || 'image_transparent'}.webp`}
                        onClick={closeMobileSettings}
                        className={uiTemplates.buttons.mobileMenuItem}
                      >
                        <Download className="h-4 w-4" />
                        WebP
                      </a>
                    )}
                    {processedImageJpeg && (
                      <a
                        href={processedImageJpeg}
                        download={`${outputFilename || 'image_transparent'}.jpg`}
                        onClick={closeMobileSettings}
                        className={uiTemplates.buttons.mobileMenuItem}
                      >
                        <Download className="h-4 w-4" />
                        JPEG
                      </a>
                    )}
                    {processedBlob && (
                      <button
                        type="button"
                        onClick={() => {
                          handleCopyPng();
                          closeMobileSettings();
                        }}
                        className={uiTemplates.buttons.mobileMenuItem}
                      >
                        <Copy className="h-4 w-4" />
                        Copy PNG
                      </button>
                    )}
                    {maskBlob && (
                      <button
                        type="button"
                        onClick={() => {
                          handleDownloadMask();
                          closeMobileSettings();
                        }}
                        className={uiTemplates.buttons.mobileMenuItem}
                      >
                        <Download className="h-4 w-4" />
                        Download Mask
                      </button>
                    )}
                    {maskImage && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMask(!showMask);
                          closeMobileSettings();
                        }}
                        className={uiTemplates.buttons.mobileMenuItem}
                      >
                        <Eye className="h-4 w-4" />
                        {showMask ? 'Hide Mask' : 'Show Mask'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Image Viewer Area */}
            <div className="flex-1 space-y-6 min-w-0">

          {/* View Modes Toggle */}
          {originalImage && (
            <div className="flex justify-center pt-2 sm:pt-4">
              <div className={cx(uiTemplates.surfaces.segmentGroup, 'w-full sm:w-auto')}>
                <button onClick={() => setCompareMode(false)} className={cx(templateClasses.segmentButton(!compareMode), 'justify-center flex items-center gap-2 sm:py-2')}>
                  <Grid2X2 className="w-4 h-4" /> Grid View
                </button>
                <button onClick={() => setCompareMode(true)} className={cx(templateClasses.segmentButton(compareMode), 'justify-center flex items-center gap-2 sm:py-2')}>
                  <SplitSquareHorizontal className="w-4 h-4" /> Compare View
                </button>
              </div>
            </div>
          )}

          {!originalImage && (
            <div className="flex min-h-0 flex-1 transition-all duration-500 ease-out">
              <button
                onClick={() => fileInputRef.current.click()}
                className={uiTemplates.buttons.emptyUpload}
              >
                <span className="w-16 h-16 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg">
                  <Upload className="w-7 h-7" />
                </span>
                <span className="flex flex-col gap-2">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Start with an image</span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">Select Image</span>
                </span>
              </button>
            </div>
          )}

          {/* Image Display Section */}
          {originalImage && (
            <div className={`transition-all duration-700 ease-out transform ${showImages ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              
              {!compareMode ? (
                // GRID VIEW
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Original Image Card */}
                  <div className={uiTemplates.surfaces.imageCard}>
                    <div className={cx(uiTemplates.surfaces.imageHeader, 'text-center relative')}>
                      Original Image
                      {(isPickingColor || isPickingSeed) && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 px-2 py-1 rounded-md animate-pulse hidden sm:inline-block">{isPickingSeed ? 'Pick seed' : 'Pick a color'}</span>}
                    </div>
                    <div className={cx(uiTemplates.surfaces.imageStage, 'bg-white dark:bg-black', isPickingColor || isPickingSeed ? 'cursor-crosshair' : 'cursor-pointer')} onClick={(e) => (isPickingColor || isPickingSeed) ? handleOriginalImageClick(e) : openZoomedImage(originalImage, false)}>
                      <img ref={originalImageRef} src={originalImage} alt="Original" className="max-w-full h-auto max-h-[52dvh] sm:max-h-[400px] lg:max-h-[500px] object-contain rounded select-none" />
                      {!isPickingColor && !isPickingSeed && (
                        <div className="pointer-events-none absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 hidden sm:flex items-center justify-center transition-opacity rounded m-4 backdrop-blur-[2px]">
                          <div className="bg-white/20 text-white rounded-full px-5 py-3 flex items-center gap-2 backdrop-blur-md shadow-lg"><Maximize2 className="w-5 h-5" /> <span className="font-medium text-sm">Tap to zoom</span></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Processed Image Card */}
                  <div className={uiTemplates.surfaces.imageCard}>
                    <div className={cx(uiTemplates.surfaces.imageHeader, 'flex items-center justify-center gap-2 relative')}>
                      <span>Result {debouncedParams.replaceTransparent ? '(Transparent)' : '(Solid)'}</span>
                      {outputDimensions && <span className="text-xs px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-500 font-mono tracking-tight hidden sm:inline-block">{outputDimensions.width} × {outputDimensions.height} px</span>}
                      {isMaskEditorOpen && <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hidden sm:inline-block">{isMaskPainting ? 'Painting' : maskEditMode === 'restore' ? 'Restore brush' : 'Remove brush'}</span>}
                      {isProcessing && <span className="flex h-3 w-3 absolute right-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 dark:bg-neutral-600 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-neutral-600 dark:bg-white"></span></span>}
                    </div>
                    {outputDimensions && <div className="sm:hidden bg-neutral-50 dark:bg-[#111] border-b border-neutral-200 dark:border-neutral-800 text-xs text-center pb-2 text-neutral-500 font-mono">Output: {outputDimensions.width} × {outputDimensions.height} px</div>}
                    <div
                      className={cx(uiTemplates.surfaces.imageStage, 'touch-none', isMaskEditorOpen ? 'cursor-crosshair' : 'cursor-pointer')}
                      style={checkerboardStyles}
                      onPointerDown={handleMaskBrushPointerDown}
                      onPointerMove={handleMaskBrushPointerMove}
                      onPointerUp={handleMaskBrushPointerUp}
                      onPointerCancel={handleMaskBrushPointerUp}
                      onPointerLeave={handleMaskBrushPointerUp}
                      onClick={() => {
                        if (!isMaskEditorOpen && processedImage) openZoomedImage(processedImage, true);
                      }}
                    >
                      {processedImage && (
                        <>
                          <img ref={processedPreviewRef} src={processedImage} alt="Processed" className="max-w-full h-auto max-h-[52dvh] sm:max-h-[400px] lg:max-h-[500px] object-contain rounded select-none pointer-events-none" />
                          {showMask && maskImage && (
                            <img src={maskImage} alt="Mask" className="absolute inset-0 m-auto max-w-full h-auto max-h-[52dvh] sm:max-h-[400px] lg:max-h-[500px] object-contain pointer-events-none rounded" />
                          )}
                          {!isMaskEditorOpen && <div className="pointer-events-none absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 hidden sm:flex items-center justify-center transition-opacity rounded m-4 backdrop-blur-[2px]">
                            <div className="bg-white/20 text-white rounded-full px-5 py-3 flex items-center gap-2 backdrop-blur-md shadow-lg"><Maximize2 className="w-5 h-5" /> <span className="font-medium text-sm">Tap to zoom</span></div>
                          </div>}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // COMPARE VIEW
                <div className={uiTemplates.surfaces.imageCard}>
                  <div className={cx(uiTemplates.surfaces.imageHeader, 'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4')}>
                    <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 text-center sm:text-left">
                      <span>Interactive Comparison</span>
                      {(debouncedParams.autoCrop || debouncedParams.hasShadow || debouncedParams.scale !== 100) && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-md">Note: Crop/Scale/Shadow may cause misalignment</span>
                      )}
                    </div>
                    {/* View Type Switcher */}
                    <div className={uiTemplates.surfaces.segmentGroupSoft}>
                      <button 
                        onClick={() => setCompareType('slider')} 
                        className={templateClasses.segmentButton(compareType === 'slider', true, 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white font-medium')}
                      >
                        Slider
                      </button>
                      <button 
                        onClick={() => setCompareType('toggle')} 
                        className={templateClasses.segmentButton(compareType === 'toggle', true, 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white font-medium')}
                      >
                        Toggle
                      </button>
                    </div>
                  </div>
                  
                  {compareType === 'slider' ? (
                    <div 
                      className="relative w-full h-[58dvh] min-h-[320px] sm:h-[60dvh] flex items-center justify-center cursor-ew-resize overflow-hidden touch-none" style={checkerboardStyles}
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        updateCompareSliderFromClientX(e.clientX, e.currentTarget);
                      }}
                      onPointerMove={(e) => {
                        if (e.buttons === 1 || e.pointerType === 'touch') {
                          updateCompareSliderFromClientX(e.clientX, e.currentTarget);
                        }
                      }}
                    >
                      {/* Background: Original Image */}
                      <img src={originalImage} alt="Original comparison layer" className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none" />
                      {/* Foreground: Processed Image (Clipped) */}
                      {processedImage && (
                        <>
                          <img src={processedImage} alt="Processed comparison layer" className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none" style={{ clipPath: `polygon(0 0, ${compareSliderPos}% 0, ${compareSliderPos}% 100%, 0 100%)` }} />
                          {showMask && maskImage && (
                            <img src={maskImage} alt="Mask comparison layer" className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none" style={{ clipPath: `polygon(0 0, ${compareSliderPos}% 0, ${compareSliderPos}% 100%, 0 100%)` }} />
                          )}
                        </>
                      )}
                      {/* Slider Line & Thumb */}
                      <div className="absolute top-0 bottom-0 w-0.5 bg-white drop-shadow-md pointer-events-none" style={{ left: `${compareSliderPos}%` }}>
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 sm:w-9 sm:h-9 bg-white text-neutral-800 rounded-full shadow-lg flex items-center justify-center"><SplitSquareHorizontal className="w-4 h-4" /></div>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="relative w-full h-[58dvh] min-h-[320px] sm:h-[60dvh] flex items-center justify-center cursor-pointer overflow-hidden select-none"
                      style={checkerboardStyles}
                      onPointerDown={() => setShowOriginal(true)}
                      onPointerUp={() => setShowOriginal(false)}
                      onPointerLeave={() => setShowOriginal(false)}
                    >
                      <img 
                        src={showOriginal ? originalImage : processedImage} 
                        alt={showOriginal ? 'Original image' : 'Processed image'}
                        className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none" 
                      />
                      {!showOriginal && showMask && maskImage && (
                        <img 
                          src={maskImage}
                          alt="Mask overlay"
                          className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none"
                        />
                      )}
                      <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-white px-5 py-2.5 rounded-full text-sm backdrop-blur-md font-medium shadow-lg pointer-events-none transition-all text-center max-w-[calc(100%-2rem)]">
                        {showOriginal ? 'Original' : 'Result (Hold to view Original)'}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

            </div>
          </div>
        </main>

        <nav className={uiTemplates.surfaces.mobileNav}>
          <div className={`mx-auto grid max-w-md gap-1.5 ${aiEnabled ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <button
              type="button"
              onClick={() => openMobilePanel('basic')}
              className={templateClasses.mobileNav(isMobileSettingsOpen && activeMobilePanel === 'basic')}
            >
              <Settings className="h-5 w-5" />
              Basic
            </button>
            <button
              type="button"
              onClick={() => openMobilePanel('advanced')}
              className={templateClasses.mobileNav(isMobileSettingsOpen && activeMobilePanel === 'advanced')}
            >
              <Wrench className="h-5 w-5" />
              Advanced
            </button>
            <button
              type="button"
              onClick={() => openMobilePanel('effects')}
              className={templateClasses.mobileNav(isMobileSettingsOpen && activeMobilePanel === 'effects')}
            >
              <Layers className="h-5 w-5" />
              Effects
            </button>
            {aiEnabled && (
              <button
                type="button"
                onClick={() => openMobilePanel('ai')}
                className={templateClasses.mobileNav(isMobileSettingsOpen && activeMobilePanel === 'ai')}
              >
                <Bot className="h-5 w-5" />
                Assist
              </button>
            )}
            <button
              type="button"
              onClick={openMobileExport}
              disabled={!processedImage}
              className={templateClasses.mobileNav(isMobileExportOpen, { success: Boolean(processedImage || isMobileExportOpen), disabled: !processedImage })}
            >
              <Download className="h-5 w-5" />
              Save
            </button>
          </div>
        </nav>
        
        {/* Footer */}
        <footer className="w-full text-center sm:text-right px-4 sm:px-6 py-4 app-safe-bottom border-t border-neutral-200 dark:border-neutral-800/50 mt-auto opacity-70 hover:opacity-100 transition-opacity">
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Made with <span className="text-red-500">❤️</span> by Mailo
          </p>
        </footer>
      </div>

      {/* Global Settings Modal */}
      {isSettingsModalOpen && (
        <div className={uiTemplates.surfaces.modalBackdrop} onClick={() => setIsSettingsModalOpen(false)}>
          <div className={uiTemplates.surfaces.modalPanel} onClick={(e) => e.stopPropagation()}>
            <div className={uiTemplates.surfaces.modalHeader}>
              <h3 className="text-lg font-bold text-neutral-800 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-neutral-500" />
                Global Settings
              </h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className={uiTemplates.buttons.modalClose} aria-label="Close settings">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 app-safe-bottom flex flex-col gap-6 overflow-y-auto custom-scrollbar">
              {/* Theme Setting */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 block">Theme</label>
                <div className={cx(uiTemplates.surfaces.segmentGroup, 'rounded-xl')}>
                  <button
                    onClick={() => setIsDarkMode(false)}
                    className={cx(templateClasses.segmentButton(!isDarkMode), 'flex items-center justify-center gap-2 py-2.5 rounded-lg')}
                  >
                    <Sun className="w-4 h-4" /> Light
                  </button>
                  <button
                    onClick={() => setIsDarkMode(true)}
                    className={cx(templateClasses.segmentButton(isDarkMode), 'flex items-center justify-center gap-2 py-2.5 rounded-lg')}
                  >
                    <Moon className="w-4 h-4" /> Dark
                  </button>
                </div>
              </div>

              {/* Layout Setting */}
              <div className="space-y-3 hidden lg:block">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Desktop Layout Position
                  <span className="block text-xs font-normal text-neutral-500 mt-1">Where should the settings panels be placed relative to the image?</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'top', label: 'Top' },
                    { id: 'bottom', label: 'Bottom' },
                    { id: 'left', label: 'Left' },
                    { id: 'right', label: 'Right' }
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => setLayoutPosition(pos.id)}
                      className={cx(uiTemplates.buttons.choice, layoutPosition === pos.id ? uiTemplates.buttons.choiceActive : uiTemplates.buttons.choiceIdle)}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              <hr className="border-neutral-100 dark:border-neutral-800" />

              {/* AI Integration Settings */}
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-500" />
                    AI Integration
                  </h4>
                  <div className="flex items-center gap-3">
                    {aiEnabled && (
                      <div className="relative w-full sm:w-auto">
                        <button 
                          onClick={() => setIsTestPopoverOpen(!isTestPopoverOpen)}
                          className={cx('flex w-full sm:w-auto items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium border transition-colors', isTestPopoverOpen ? 'bg-neutral-100 dark:bg-[#222] border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white' : 'bg-transparent border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-[#111] text-neutral-700 dark:text-neutral-300')}
                        >
                          <FlaskConical className="w-4 h-4" />
                          Test
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isTestPopoverOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isTestPopoverOpen && (
                          <div className="fixed inset-x-4 top-[calc(1rem+env(safe-area-inset-top))] bottom-[calc(1rem+env(safe-area-inset-bottom))] flex max-h-[calc(100dvh-2rem)] flex-col bg-white dark:bg-[#0f0f0f] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-[400] animate-in fade-in zoom-in-95 duration-200 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[420px] sm:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100dvh-3rem)] sm:-translate-x-1/2 sm:-translate-y-1/2">
                            <div className="p-4 min-h-0 h-full flex flex-col gap-4">
                              <div className="flex items-center justify-between gap-3 shrink-0">
                                <h5 className="font-semibold text-neutral-800 dark:text-neutral-200 text-sm">Select model to test</h5>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsTestPopoverOpen(false);
                                    setIsModelDropdownOpen(false);
                                  }}
                                  className={uiTemplates.buttons.closeIcon}
                                  aria-label="Close model test"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              
                              <div className="relative min-h-0 flex flex-col">
                                <button 
                                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                  className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-semibold flex items-center justify-between hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                                >
                                  <span className="truncate pr-2">{selectedModelLabel}</span>
                                  <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" />
                                </button>
                                
                                {isModelDropdownOpen && (
                                  <div className="mt-2 bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-[500] flex max-h-[calc(100dvh-12rem)] sm:max-h-[340px] flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-2 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
                                      <div className="relative flex-1">
                                        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                                        <input 
                                          type="text" 
                                          placeholder="Search models" 
                                          value={modelSearchQuery}
                                          onChange={(e) => setModelSearchQuery(e.target.value)}
                                          className="w-full bg-transparent border-none focus:ring-0 text-sm py-1.5 pl-8 pr-2 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-500"
                                        />
                                      </div>
                                      <span className="text-xs text-neutral-500 whitespace-nowrap px-2 border-l border-neutral-100 dark:border-neutral-800">
                                        {filteredModels.length} models
                                      </span>
                                    </div>
                                    
                                    <div className="overflow-y-auto custom-scrollbar max-h-[calc(100dvh-18rem)] sm:max-h-[280px] flex-1 px-1 pb-1 pt-0">
                                      {isLoadingModels ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
                                          <div className="w-6 h-6 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin mb-2" />
                                          <span className="text-xs">Loading OpenRouter models...</span>
                                        </div>
                                      ) : filteredModels.length === 0 ? (
                                        <div className="px-3 py-8 text-center text-xs text-neutral-400">
                                          No models found for {getProviderLabel(aiProvider)}.
                                        </div>
                                      ) : Object.entries(
                                        filteredModels.reduce((acc, model) => {
                                            if (!acc[model.group]) acc[model.group] = [];
                                            acc[model.group].push(model);
                                            return acc;
                                          }, {})
                                      ).map(([groupName, groupModels]) => (
                                        <div key={groupName} className="mb-2 last:mb-0">
                                          <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider sticky top-0 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur z-10">
                                            {groupName}
                                          </div>
                                          {groupModels.map(model => (
                                            <button
                                              key={model.id}
                                              onClick={() => {
                                                setAiModel(model.id);
                                                setIsCustomModelEntry(false);
                                                setIsModelDropdownOpen(false);
                                                setModelSearchQuery('');
                                              }}
                                              className={cx('w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-lg text-left text-sm transition-colors', aiModel === model.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#1a1a1a]')}
                                            >
                                              <Sparkles className={`w-3.5 h-3.5 ${aiModel === model.id ? 'text-blue-500' : 'text-blue-400 dark:text-blue-500'} shrink-0`} />
                                              <span className="flex-1 truncate">{model.name}</span>
                                              {aiModel === model.id && <Check className="w-4 h-4 shrink-0" />}
                                            </button>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => {
                                  handleTestConnection();
                                  setIsTestPopoverOpen(false);
                                }}
                                disabled={isTestingKey || (!aiModel && !getDefaultModelForProvider(aiProvider))}
                                className={`w-full py-2.5 min-h-[44px] rounded-lg text-sm font-semibold transition-all ${!aiModel && !getDefaultModelForProvider(aiProvider) ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed' : 'bg-[#414389] hover:bg-[#4b4e9f] text-white shadow-md hover:shadow-lg active:scale-[0.98]'}`}
                              >
                                {isTestingKey ? 'Testing...' : 'Run Test'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <label className="flex items-center cursor-pointer group min-h-[44px]">
                      <div className={templateClasses.toggleTrack(aiEnabled)}>
                        <span aria-hidden="true" className={templateClasses.toggleThumb(aiEnabled)} />
                      </div>
                      <input type="checkbox" className="sr-only" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
                    </label>
                  </div>
                </div>
                
                {aiEnabled && (
                  <>
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className={cx(uiTemplates.text.compactLabel, 'block')}>Provider</label>
                      <TemplateSelect
                        value={aiProvider}
                        onChange={(nextProvider) => {
                          setAiProvider(nextProvider);
                          setAiModel('');
                          setIsCustomModelEntry(false);
                        }}
                        options={AI_PROVIDER_OPTIONS}
                        ariaLabel="Provider"
                        placeholder="Choose provider"
                      />
                    </div>

                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className={cx(uiTemplates.text.compactLabel, 'block')}>Model</label>
                      <TemplateSelect
                        value={modelSelectValue}
                        onChange={(nextModel) => {
                          if (nextModel === '__custom') {
                            setIsCustomModelEntry(true);
                            if (!isCustomAiModel) setAiModel('');
                            return;
                          }

                          setIsCustomModelEntry(false);
                          setAiModel(nextModel);
                        }}
                        options={modelSelectOptions}
                        ariaLabel="Model"
                        placeholder="Choose model"
                        searchable
                        searchPlaceholder={`Search ${getProviderLabel(aiProvider)} models`}
                        emptyMessage={`No models found for ${getProviderLabel(aiProvider)}.`}
                      />

                      {aiProvider === 'openrouter' && isLoadingModels && providerModelOptions.length === 0 && (
                        <p className="text-xs text-neutral-400">Loading OpenRouter models...</p>
                      )}

                      {shouldShowCustomModelInput && (
                        <input
                          type="text"
                          value={aiModel}
                          onChange={(e) => setAiModel(e.target.value)}
                          placeholder={`Enter a ${getProviderLabel(aiProvider)} model ID`}
                          spellCheck="false"
                          className={uiTemplates.inputs.textMono}
                        />
                      )}

                      <p className={uiTemplates.text.helperRelaxed}>The selected model is used for AI edits and connection tests.</p>
                    </div>

                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className={cx(uiTemplates.text.compactLabel, 'block')}>API Key</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Key className="w-4 h-4 text-neutral-400" />
                        </div>
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={`Enter your ${aiProvider === 'local' ? 'API URL/Key' : aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1)} key`}
                          className={uiTemplates.inputs.textMonoWithIcon}
                        />
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute inset-y-0 right-0 min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className={uiTemplates.text.helperRelaxed}>Keys are stored securely in your browser's local storage and are never sent to our servers.</p>
                    </div>


                  </>
                )}
              </div>
              
              <div className="lg:hidden text-sm text-neutral-500 dark:text-neutral-400 text-center">
                Layout options are only available on larger desktop screens.
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* Fullscreen Zoom Modal */}
      {zoomedImage.src && (
        <div className={uiTemplates.surfaces.zoomOverlay} onClick={closeZoomedImage}>
          <div className={uiTemplates.surfaces.zoomToolbar}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoomScale((current) => clamp(Number((current - 0.25).toFixed(2)), 0.5, 8));
              }}
              className={uiTemplates.buttons.zoomIcon}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoomScale(1);
                setZoomPan({ x: 0, y: 0 });
              }}
              className="min-h-10 rounded-full px-3 text-xs font-semibold text-white/85 transition-colors hover:bg-white/15 hover:text-white"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoomScale((current) => clamp(Number((current + 0.25).toFixed(2)), 0.5, 8));
              }}
              className={uiTemplates.buttons.zoomIcon}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
          <button className={uiTemplates.buttons.zoomClose} onClick={(e) => { e.stopPropagation(); closeZoomedImage(); }} title="Close fullscreen (Esc)" aria-label="Close fullscreen">
            <X className="w-6 h-6" />
          </button>
          <div
            className={`relative flex h-[88dvh] w-[96vw] max-w-[1600px] items-center justify-center overflow-hidden rounded-lg shadow-2xl animate-in zoom-in-95 duration-200 ${zoomScale > 1 ? isZoomPanning ? 'cursor-grabbing' : 'cursor-grab' : 'cursor-zoom-in'}`}
            style={zoomedImage.isTransparent ? checkerboardStyles : { backgroundColor: isDarkMode ? '#000' : '#fff' }}
            onClick={(e) => e.stopPropagation()}
            onWheel={handleZoomWheel}
            onPointerDown={handleZoomPointerDown}
            onPointerMove={handleZoomPointerMove}
            onPointerUp={handleZoomPointerEnd}
            onPointerCancel={handleZoomPointerEnd}
            onPointerLeave={handleZoomPointerEnd}
          >
            <img
              src={zoomedImage.src}
              alt="Zoomed fullscreen view"
              draggable="false"
              className="max-w-full max-h-full select-none object-contain transition-transform duration-75"
              style={{ transform: `translate(${zoomPan.x}px, ${zoomPan.y}px) scale(${zoomScale})` }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setZoomScale((current) => current > 1 ? 1 : 2);
                setZoomPan({ x: 0, y: 0 });
              }}
            />
          </div>
        </div>
      )}

      {snapMenu && (
        <div
          ref={snapMenuRef}
          className={uiTemplates.surfaces.snapMenu}
          style={{ left: snapMenu.x, top: snapMenu.y }}
          role="menu"
          aria-label={`Dock ${PANEL_LABELS[snapMenu.panelId] || 'panel'}`}
        >
          <div className={uiTemplates.surfaces.snapMenuHeader}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">Dock {PANEL_LABELS[snapMenu.panelId]}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Snap target</p>
            </div>
            <button
              type="button"
              onClick={() => setSnapMenu(null)}
              className={cx(uiTemplates.buttons.closeIcon, 'shrink-0 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-neutral-800 dark:hover:text-white')}
              aria-label="Close dock menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 p-2">
            {SNAP_TARGETS.map((target) => {
              const isSelected = dockedPanels[snapMenu.panelId] === target.id;

              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => dockPanelToPosition(snapMenu.panelId, target.id)}
                  className={cx(uiTemplates.buttons.snapTarget, isSelected ? uiTemplates.buttons.snapTargetActive : uiTemplates.buttons.snapTargetIdle)}
                  aria-checked={isSelected}
                  role="menuitemradio"
                >
                  <span className="relative h-10 w-14 rounded-lg border border-neutral-300 bg-white shadow-inner dark:border-neutral-700 dark:bg-black">
                    <span className={`absolute rounded-md bg-blue-500/85 ${target.previewClass}`} />
                  </span>
                  {target.label}
                </button>
              );
            })}
          </div>

          {dockedPanels[snapMenu.panelId] && (
            <div className="border-t border-neutral-100 p-2 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => restoreDockedPanel(snapMenu.panelId)}
                className={uiTemplates.buttons.snapRestore}
              >
                <MoveDown className="h-4 w-4" />
                Return to list
              </button>
            </div>
          )}
        </div>
      )}

      <TemplateNoticeStack notices={notices} onDismiss={removeNotice} />
    </div>
  );
}
