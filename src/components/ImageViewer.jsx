import { Grid2X2, Maximize2, SplitSquareHorizontal, Upload } from 'lucide-react';
import { cx, templateClasses, uiTemplates } from '../uiTemplates';

export const ImageViewer = ({
  originalImage,
  processedImage,
  maskImage,
  showMask,
  showImages,
  compareMode,
  setCompareMode,
  compareType,
  setCompareType,
  showOriginal,
  setShowOriginal,
  compareSliderPos,
  updateCompareSliderFromClientX,
  outputDimensions,
  debouncedParams,
  isPickingColor,
  isPickingSeed,
  handleOriginalImageClick,
  openZoomedImage,
  originalImageRef,
  processedPreviewRef,
  checkerboardStyles,
  isMaskEditorOpen,
  isMaskPainting,
  maskEditMode,
  isProcessing,
  handleMaskBrushPointerDown,
  handleMaskBrushPointerMove,
  handleMaskBrushPointerUp,
  fileInputRef,
}) => (
  <div className="flex-1 space-y-6 min-w-0">
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

    {originalImage && (
      <div className={`transition-all duration-700 ease-out transform ${showImages ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {!compareMode ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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

            <div className={uiTemplates.surfaces.imageCard}>
              <div className={cx(uiTemplates.surfaces.imageHeader, 'flex items-center justify-center gap-2 relative')}>
                <span>Result {debouncedParams.replaceTransparent ? '(Transparent)' : '(Solid)'}</span>
                {outputDimensions && <span className="text-xs px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-500 font-mono tracking-tight hidden sm:inline-block">{outputDimensions.width} x {outputDimensions.height} px</span>}
                {isMaskEditorOpen && <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hidden sm:inline-block">{isMaskPainting ? 'Painting' : maskEditMode === 'restore' ? 'Restore brush' : 'Remove brush'}</span>}
                {isProcessing && <span className="flex h-3 w-3 absolute right-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 dark:bg-neutral-600 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-neutral-600 dark:bg-white"></span></span>}
              </div>
              {outputDimensions && <div className="sm:hidden bg-neutral-50 dark:bg-[#111] border-b border-neutral-200 dark:border-neutral-800 text-xs text-center pb-2 text-neutral-500 font-mono">Output: {outputDimensions.width} x {outputDimensions.height} px</div>}
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
          <div className={uiTemplates.surfaces.imageCard}>
            <div className={cx(uiTemplates.surfaces.imageHeader, 'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4')}>
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 text-center sm:text-left">
                <span>Interactive Comparison</span>
                {(debouncedParams.autoCrop || debouncedParams.hasShadow || debouncedParams.scale !== 100) && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-md">Note: Crop/Scale/Shadow may cause misalignment</span>
                )}
              </div>
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
                <img src={originalImage} alt="Original comparison layer" className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none" />
                {processedImage && (
                  <>
                    <img src={processedImage} alt="Processed comparison layer" className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none" style={{ clipPath: `polygon(0 0, ${compareSliderPos}% 0, ${compareSliderPos}% 100%, 0 100%)` }} />
                    {showMask && maskImage && (
                      <img src={maskImage} alt="Mask comparison layer" className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none" style={{ clipPath: `polygon(0 0, ${compareSliderPos}% 0, ${compareSliderPos}% 100%, 0 100%)` }} />
                    )}
                  </>
                )}
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
);
