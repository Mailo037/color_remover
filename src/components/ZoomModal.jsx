import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { uiTemplates } from '../uiTemplates';
import { clamp } from '../lib/colorUtils';

export const ZoomModal = ({
  zoomedImage,
  checkerboardStyles,
  isDarkMode,
  zoomScale,
  setZoomScale,
  zoomPan,
  setZoomPan,
  isZoomPanning,
  closeZoomedImage,
  handleZoomWheel,
  handleZoomPointerDown,
  handleZoomPointerMove,
  handleZoomPointerEnd,
}) => {
  if (!zoomedImage.src) return null;

  return (
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
  );
};
