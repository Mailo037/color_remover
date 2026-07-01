import { cx, templateClasses, uiTemplates } from '../uiTemplates';

export const ExportQualityControls = ({
  isCompact = false,
  webpQuality,
  setWebpQuality,
  jpegQuality,
  setJpegQuality,
  jpegBackground,
  setJpegBackground,
}) => (
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
