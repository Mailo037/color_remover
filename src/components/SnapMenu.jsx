import { MoveDown, X } from 'lucide-react';
import { PANEL_LABELS, SNAP_TARGETS } from '../constants/docking';
import { cx, uiTemplates } from '../uiTemplates';

export const SnapMenu = ({
  snapMenu,
  snapMenuRef,
  dockedPanels,
  onClose,
  onDockPanel,
  onRestoreDock,
}) => {
  if (!snapMenu) return null;

  return (
    <div
      ref={snapMenuRef}
      className={uiTemplates.surfaces.snapMenu}
      style={{ left: snapMenu.x, top: snapMenu.y }}
      role="menu"
      aria-label={`Dock ${PANEL_LABELS[snapMenu.panelId] || 'panel'}`}
    >
      <div className={uiTemplates.surfaces.snapMenuHeader}>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">Dock {PANEL_LABELS[snapMenu.panelId]}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Snap target</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cx(uiTemplates.buttons.closeIcon, 'shrink-0 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-neutral-800 dark:hover:text-white')}
          aria-label="Close dock menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 p-2">
        {SNAP_TARGETS.map((target) => {
          const isSelected = dockedPanels[snapMenu.panelId] === target.id;

          return (
            <button
              key={target.id}
              type="button"
              onClick={() => onDockPanel(snapMenu.panelId, target.id)}
              className={cx(uiTemplates.buttons.snapTarget, isSelected ? uiTemplates.buttons.snapTargetActive : uiTemplates.buttons.snapTargetIdle)}
              aria-checked={isSelected}
              role="menuitemradio"
            >
              <span className="relative h-10 w-14 rounded-lg border border-neutral-300 bg-white shadow-inner dark:border-neutral-700 dark:bg-black">
                <span className={`absolute rounded-md bg-blue-500/85 ${target.previewClass}`} />
              </span>
              {target.label}
            </button>
          );
        })}
      </div>

      {dockedPanels[snapMenu.panelId] && (
        <div className="border-t border-neutral-100 p-2 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => onRestoreDock(snapMenu.panelId)}
            className={uiTemplates.buttons.snapRestore}
          >
            <MoveDown className="h-4 w-4" />
            Return to list
          </button>
        </div>
      )}
    </div>
  );
};
