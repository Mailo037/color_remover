import { ChevronDown, Copy, Download, Eye, Pencil, X } from 'lucide-react';
import { cx, uiTemplates } from '../uiTemplates';
import { ExportQualityControls } from './ExportQualityControls';

export const MobileExportSheet = ({
  processedImage,
  isMobileExportOpen,
  mobileSettingsDragY,
  handleMobileSettingsDragMove,
  handleMobileSettingsDragEnd,
  handleMobileSettingsDragStart,
  closeMobileSettings,
  outputFilename,
  setOutputFilename,
  isExportSettingsOpen,
  setIsExportSettingsOpen,
  processedImageWebp,
  processedImageJpeg,
  processedBlob,
  maskBlob,
  maskImage,
  handleCopyPng,
  handleDownloadMask,
  showMask,
  setShowMask,
  webpQuality,
  setWebpQuality,
  jpegQuality,
  setJpegQuality,
  jpegBackground,
  setJpegBackground,
}) => {
  if (!processedImage) return null;

  return (
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
              <ExportQualityControls
                isCompact
                webpQuality={webpQuality}
                setWebpQuality={setWebpQuality}
                jpegQuality={jpegQuality}
                setJpegQuality={setJpegQuality}
                jpegBackground={jpegBackground}
                setJpegBackground={setJpegBackground}
              />
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
  );
};
