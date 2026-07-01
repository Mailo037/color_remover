import { Layers } from 'lucide-react';
import { cx, templateClasses, uiTemplates } from '../../uiTemplates';
import { CollapsibleSection } from '../CollapsibleSection';

export const EffectsPanel = ({
  isOpen,
  onToggle,
  dockPosition,
  onRequestDock,
  onRestoreDock,
  isPanelNarrow,
  hasShadow,
  setHasShadow,
  shadowColor,
  setShadowColor,
  shadowBlur,
  setShadowBlur,
  shadowOffsetX,
  setShadowOffsetX,
  shadowOffsetY,
  setShadowOffsetY,
}) => (
  <CollapsibleSection title="Effects & Styling" icon={Layers} isOpen={isOpen} onToggle={onToggle} contentOnlyOnMobile panelId="effects" dockPosition={dockPosition} onRequestDock={onRequestDock} onRestoreDock={onRestoreDock}>
    <div className="flex flex-col gap-6">
      <label
        className={uiTemplates.toggles.label}
        onClick={(e) => {
          e.preventDefault();
          setHasShadow(!hasShadow);
        }}
      >
        <div className={templateClasses.toggleTrack(hasShadow, 'indigo')}>
          <span aria-hidden="true" className={templateClasses.toggleThumb(hasShadow)} />
        </div>
        <span className={uiTemplates.toggles.iconLabel}><Layers className={uiTemplates.toggles.icon} /> Enable Drop Shadow / Glow</span>
      </label>

      {hasShadow && (
        <div className={`grid gap-6 animate-in fade-in duration-300 ${isPanelNarrow ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
          <div className="flex flex-col gap-3">
            <label className={uiTemplates.text.compactLabel}>Color</label>
            <div className="flex items-center gap-3">
              <div className={uiTemplates.inputs.colorSwatchSmall}>
                <input type="color" value={shadowColor.length===7 ? shadowColor : '#000'} onChange={(e) => setShadowColor(e.target.value)} className={uiTemplates.inputs.colorInputSmall} />
              </div>
              <input type="text" value={shadowColor} spellCheck="false" onChange={(e)=>{let v=e.target.value; if(!v.startsWith('#')) v='#'+v.replace(/#/g,''); setShadowColor(v.slice(0,7));}} className={uiTemplates.inputs.hex} />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <label className={cx(uiTemplates.text.compactLabel, 'flex items-center justify-between')}>Blur/Glow Size <span>{shadowBlur}px</span></label>
            <input type="range" min="0" max="100" value={shadowBlur} onChange={(e) => setShadowBlur(parseInt(e.target.value))} className={templateClasses.range('indigo')} />
          </div>
          <div className="flex flex-col gap-3">
            <label className={cx(uiTemplates.text.compactLabel, 'flex items-center justify-between')}>Offset X <span>{shadowOffsetX}px</span></label>
            <input type="range" min="-100" max="100" value={shadowOffsetX} onChange={(e) => setShadowOffsetX(parseInt(e.target.value))} className={templateClasses.range('indigo')} />
          </div>
          <div className="flex flex-col gap-3">
            <label className={cx(uiTemplates.text.compactLabel, 'flex items-center justify-between')}>Offset Y <span>{shadowOffsetY}px</span></label>
            <input type="range" min="-100" max="100" value={shadowOffsetY} onChange={(e) => setShadowOffsetY(parseInt(e.target.value))} className={templateClasses.range('indigo')} />
          </div>
        </div>
      )}
    </div>
  </CollapsibleSection>
);
