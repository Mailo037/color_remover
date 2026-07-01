export const canvasToBlob = (canvas, type = 'image/png', quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error(`Could not create ${type} export.`));
  }, type, quality);
});

export const loadImageElement = (src) => new Promise((resolve, reject) => {
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

export const applyManualMaskStrokes = (finalCanvas, restoreCanvas, strokes = []) => {
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

export const createMaskBlobFromCanvas = async (canvas) => {
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

export const createJpegBlobFromCanvas = async (canvas, backgroundColor, quality) => {
  const jpegCanvas = document.createElement('canvas');
  jpegCanvas.width = canvas.width;
  jpegCanvas.height = canvas.height;
  const jpegCtx = jpegCanvas.getContext('2d');
  jpegCtx.fillStyle = backgroundColor || '#ffffff';
  jpegCtx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
  jpegCtx.drawImage(canvas, 0, 0);
  return canvasToBlob(jpegCanvas, 'image/jpeg', quality);
};
