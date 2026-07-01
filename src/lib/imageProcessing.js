import { hexToRgb } from './colorUtils';
import { applyManualMaskStrokes, canvasToBlob, createJpegBlobFromCanvas, createMaskBlobFromCanvas, loadImageElement } from './canvasExportUtils';
import { buildWorkerCode } from './imageWorkerCode';

export const processImageSource = async (imageSrc, params, manualStrokes = []) => {
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

export { getDominantEdgeColors } from './edgeColorAnalysis';
