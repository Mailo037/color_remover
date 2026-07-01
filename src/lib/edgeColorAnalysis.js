import { rgbToHex } from './colorUtils';
import { loadImageElement } from './canvasExportUtils';

export const getDominantEdgeColors = async (imageSrc) => {
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
