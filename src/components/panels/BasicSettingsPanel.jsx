import { Archive, Download, Eraser, Layers, Palette, Pipette, Plus, Settings, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { EXPORT_FORMAT_OPTIONS } from '../../constants/exportFormats';
import { cx, templateClasses, uiTemplates } from '../../uiTemplates';
import { CollapsibleSection } from '../CollapsibleSection';
import { EditableNumber } from '../EditableNumber';
import { TemplateSelect } from '../TemplateSelect';

export const BasicSettingsPanel = ({
  isOpen,
  onToggle,
  dockPosition,
  onRequestDock,
  onRestoreDock,
  isPanelNarrow,
  targetColor,
  setTargetColor,
  isPickingColor,
  setIsPickingColor,
  replaceTransparent,
  setReplaceTransparent,
  replaceColor,
  setReplaceColor,
  tolerance,
  setTolerance,
  multiColors,
  setMultiColors,
  colors,
  setColors,
  contiguousOnly,
  setContiguousOnly,
  isPickingSeed,
  setIsPickingSeed,
  contiguousSeed,
  batchItems,
  processAllBatchItems,
  isBatchProcessing,
  selectBatchItem,
  activeBatchId,
  batchExportFormat,
  setBatchExportFormat,
  handleDownloadBatchZip,
}) => (
  <CollapsibleSection title="Basic Settings" icon={Settings} isOpen={isOpen} onToggle={onToggle} contentOnlyOnMobile panelId="basic" dockPosition={dockPosition} onRequestDock={onRequestDock} onRestoreDock={onRestoreDock}>
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className={`grid gap-6 sm:gap-8 ${isPanelNarrow ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
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
            <button
              onClick={() => setIsPickingColor(!isPickingColor)}
              className={cx('p-3 rounded-lg border transition-all', isPickingColor ? uiTemplates.buttons.colorPickActive : uiTemplates.buttons.colorPickIdle)}
              title="Pick color from original image"
            >
              <Pipette className="w-5 h-5" />
            </button>
          </div>
        </div>

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
);
