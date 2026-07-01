import { Brush, Crop, Eraser, MoveDown, Pencil, SlidersHorizontal, Sparkles, Undo2, Wrench, X, ZoomIn } from 'lucide-react';
import { cx, templateClasses, uiTemplates } from '../../uiTemplates';
import { CollapsibleSection } from '../CollapsibleSection';
import { EditableNumber } from '../EditableNumber';

export const AdvancedSettingsPanel = ({
  isOpen,
  onToggle,
  dockPosition,
  onRequestDock,
  onRestoreDock,
  isPanelNarrow,
  smoothness,
  setSmoothness,
  scale,
  setScale,
  autoCrop,
  setAutoCrop,
  replaceTransparent,
  pixelFix,
  setPixelFix,
  padding,
  setPadding,
  processedImage,
  isMaskEditorOpen,
  setIsMaskEditorOpen,
  maskEditMode,
  setMaskEditMode,
  brushSize,
  setBrushSize,
  maskStrokes,
  setMaskStrokes,
}) => (
  <CollapsibleSection title="Advanced Settings" icon={Wrench} isOpen={isOpen} onToggle={onToggle} contentOnlyOnMobile panelId="advanced" dockPosition={dockPosition} onRequestDock={onRequestDock} onRestoreDock={onRestoreDock}>
    <div className="flex flex-col gap-8">
      <div className={`grid gap-6 sm:gap-8 ${isPanelNarrow ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
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

      <div className={`grid gap-4 ${isPanelNarrow ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
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
);
