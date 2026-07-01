import { ChevronDown, Copy, Download, Eye, Pencil, Upload } from 'lucide-react';
import { cx, uiTemplates } from '../uiTemplates';
import { ExportQualityControls } from './ExportQualityControls';

export const ActionBar = ({
  layoutPosition,
  fileInputRef,
  handleImageUpload,
  processedImage,
  outputFilename,
  setOutputFilename,
  processedImageWebp,
  processedImageJpeg,
  maskImage,
  processedBlob,
  maskBlob,
  isExportMenuOpen,
  setIsExportMenuOpen,
  handleCopyPng,
  handleDownloadMask,
  showMask,
  setShowMask,
  isExportSettingsOpen,
  setIsExportSettingsOpen,
  webpQuality,
  setWebpQuality,
  jpegQuality,
  setJpegQuality,
  jpegBackground,
  setJpegBackground,
}) => {
  const isSideLayout = layoutPosition === 'left' || layoutPosition === 'right';

  return (
    <div className={uiTemplates.surfaces.actionBar}>
      <div className={`flex gap-4 ${isSideLayout ? 'flex-col items-stretch' : 'flex-col md:flex-row items-stretch sm:items-center justify-between'}`}>
        <div className={`w-full ${isSideLayout ? '' : 'md:w-auto'}`}>
          <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
          <button onClick={() => fileInputRef.current.click()} className={cx(uiTemplates.buttons.upload, isSideLayout ? 'w-full' : 'w-full md:w-auto')}>
            <Upload className="w-5 h-5 sm:w-4 sm:h-4" /> Select Image
          </button>
        </div>
        {processedImage && (
          <div className={`flex items-stretch sm:items-center gap-3 w-full ${isSideLayout ? 'flex-col' : 'flex-col sm:flex-row md:w-auto md:justify-end'}`}>
            <div className={cx(uiTemplates.inputs.filenameShell, isSideLayout ? 'w-full' : 'flex-1 sm:flex-none')}>
              <Pencil className="w-4 h-4 text-neutral-400 shrink-0" />
              <input type="text" value={outputFilename} onChange={(e) => setOutputFilename(e.target.value)} className={uiTemplates.inputs.transparentInline} placeholder="filename" />
              <span className="text-sm text-neutral-400 select-none shrink-0">.png</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a href={processedImage} download={`${outputFilename || 'image_transparent'}.png`} className={cx(uiTemplates.buttons.download, isSideLayout ? 'flex-1' : 'flex-1 sm:flex-none')}>
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
            <ExportQualityControls
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
    </div>
  );
};
