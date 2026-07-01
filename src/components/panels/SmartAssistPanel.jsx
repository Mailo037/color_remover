import { Bot, Brush, Key, Pipette, Sparkles } from 'lucide-react';
import { cx, uiTemplates } from '../../uiTemplates';
import { CollapsibleSection } from '../CollapsibleSection';

export const SmartAssistPanel = ({
  isOpen,
  onToggle,
  dockPosition,
  onRequestDock,
  onRestoreDock,
  isPanelNarrow,
  originalImage,
  applySmartBackgroundAssist,
  applySmartConnectedAssist,
  applySmartEdgeAssist,
  aiPrompt,
  setAiPrompt,
  apiKey,
  openSettings,
  handleAiGeneration,
  isProcessing,
}) => (
  <CollapsibleSection
    title="Smart Assist"
    icon={Bot}
    isOpen={isOpen}
    onToggle={onToggle}
    description="Transform image with text prompts"
    contentOnlyOnMobile
    panelId="ai"
    dockPosition={dockPosition}
    onRequestDock={onRequestDock}
    onRestoreDock={onRestoreDock}
  >
    <div className="flex flex-col gap-4">
      <div className={`grid gap-2 ${isPanelNarrow ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
        <button
          type="button"
          onClick={applySmartBackgroundAssist}
          disabled={!originalImage}
          className={uiTemplates.buttons.primaryBlue}
        >
          <Sparkles className="h-4 w-4" />
          Find Background
        </button>
        <button
          type="button"
          onClick={applySmartConnectedAssist}
          disabled={!originalImage}
          className={cx(uiTemplates.buttons.primary, 'rounded-xl px-3')}
        >
          <Pipette className="h-4 w-4" />
          Connected Cut
        </button>
        <button
          type="button"
          onClick={applySmartEdgeAssist}
          disabled={!originalImage}
          className={cx(uiTemplates.buttons.neutral, 'rounded-xl px-3 font-semibold text-neutral-800 dark:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50')}
        >
          <Brush className="h-4 w-4" />
          Clean Edges
        </button>
      </div>
      <textarea
        value={aiPrompt}
        onChange={(e) => setAiPrompt(e.target.value)}
        placeholder="Try: remove background, green screen, remove white, connected cut, clean edges..."
        className={uiTemplates.inputs.textarea}
      />

      {!apiKey ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 p-3 rounded-xl text-sm flex items-start gap-3 border border-amber-200 dark:border-amber-800/30">
          <Key className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold mb-1">Local assists work without a key</p>
            <p className="text-amber-600/80 dark:text-amber-400/80">Provider prompts still need a key in <button onClick={openSettings} className="underline font-semibold hover:text-amber-700 dark:hover:text-amber-300">Global Settings</button>.</p>
          </div>
        </div>
      ) : null}
      <button
        onClick={handleAiGeneration}
        disabled={!aiPrompt.trim() || isProcessing}
        className={cx(
          'flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl font-semibold transition-all duration-200',
          aiPrompt.trim() && !isProcessing
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95'
            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
        )}
      >
        <Sparkles className="w-4 h-4" /> Apply Prompt
      </button>
    </div>
  </CollapsibleSection>
);
