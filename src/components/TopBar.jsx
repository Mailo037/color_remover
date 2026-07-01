import { Download, Redo2, RotateCcw, Settings, Undo2 } from 'lucide-react';
import { uiTemplates } from '../uiTemplates';

export const TopBar = ({
  updateInfo,
  isUpdatingApp,
  onUpdateNow,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onResetSettings,
  onOpenSettings,
}) => (
  <header className={uiTemplates.surfaces.topbar}>
    <div className="order-1 flex items-center gap-2.5 sm:gap-3 min-w-0">
      <img src="/favicon.png" alt="Logo" className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow-sm hover:scale-105 transition-transform" />
      <h1 className={uiTemplates.text.appTitle}>Color Remover</h1>
    </div>

    {updateInfo.available && (
      <button
        type="button"
        onClick={onUpdateNow}
        disabled={isUpdatingApp}
        className="order-3 flex min-h-[40px] w-full basis-full items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-100 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20 sm:order-2 sm:min-h-[36px] sm:w-auto sm:basis-auto sm:px-4"
        title={updateInfo.message || 'A new version is available'}
        aria-live="polite"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.14)]" />
        <span className="whitespace-nowrap">New Version</span>
        <span className="min-w-0 truncate font-medium text-blue-600/80 dark:text-blue-200/80">
          {isUpdatingApp ? (updateInfo.source === 'release' ? 'Installing latest release...' : 'Pulling latest commit...') : updateInfo.canPull ? 'Update now' : 'View on GitHub'}
        </span>
        <Download className={`h-3.5 w-3.5 shrink-0 ${isUpdatingApp ? 'animate-bounce' : ''}`} />
      </button>
    )}

    <div className="order-2 flex items-center gap-1.5 sm:order-3 sm:gap-3 shrink-0">
      <div className={uiTemplates.surfaces.toolbarGroup}>
        <button onClick={onUndo} disabled={!canUndo} className={uiTemplates.buttons.toolbarIcon} title="Undo (Ctrl+Z)" aria-label="Undo">
          <Undo2 className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
        </button>
        <button onClick={onRedo} disabled={!canRedo} className={uiTemplates.buttons.toolbarIcon} title="Redo (Ctrl+Y or Ctrl+Shift+Z)" aria-label="Redo">
          <Redo2 className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
        </button>
      </div>
      <button onClick={onResetSettings} className={uiTemplates.buttons.topbarIcon} title="Reset All Settings" aria-label="Reset all settings">
        <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-600 dark:text-neutral-300" />
      </button>
      <button onClick={onOpenSettings} className={uiTemplates.buttons.topbarIcon} title="Global Settings" aria-label="Open global settings">
        <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-600 dark:text-neutral-300" />
      </button>
    </div>
  </header>
);
