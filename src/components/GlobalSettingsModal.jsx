import {
  Bot,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FlaskConical,
  Key,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { AI_PROVIDER_OPTIONS, getDefaultModelForProvider, getProviderLabel } from '../constants/aiProviders';
import { cx, templateClasses, uiTemplates } from '../uiTemplates';
import { TemplateSelect } from './TemplateSelect';

const LAYOUT_OPTIONS = [
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];

export const GlobalSettingsModal = ({
  isOpen,
  onClose,
  isDarkMode,
  setIsDarkMode,
  layoutPosition,
  setLayoutPosition,
  aiEnabled,
  setAiEnabled,
  isTestPopoverOpen,
  setIsTestPopoverOpen,
  isModelDropdownOpen,
  setIsModelDropdownOpen,
  selectedModelLabel,
  modelSearchQuery,
  setModelSearchQuery,
  filteredModels,
  isLoadingModels,
  aiProvider,
  aiModel,
  setAiModel,
  setAiProvider,
  setIsCustomModelEntry,
  isCustomAiModel,
  isTestingKey,
  handleTestConnection,
  modelSelectValue,
  modelSelectOptions,
  providerModelOptions,
  shouldShowCustomModelInput,
  showApiKey,
  setShowApiKey,
  apiKey,
  setApiKey,
}) => {
  if (!isOpen) return null;

  return (
    <div className={uiTemplates.surfaces.modalBackdrop} onClick={onClose}>
      <div className={uiTemplates.surfaces.modalPanel} onClick={(e) => e.stopPropagation()}>
        <div className={uiTemplates.surfaces.modalHeader}>
          <h3 className="text-lg font-bold text-neutral-800 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-neutral-500" />
            Global Settings
          </h3>
          <button onClick={onClose} className={uiTemplates.buttons.modalClose} aria-label="Close settings">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 app-safe-bottom flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 block">Theme</label>
            <div className={cx(uiTemplates.surfaces.segmentGroup, 'rounded-xl')}>
              <button
                onClick={() => setIsDarkMode(false)}
                className={cx(templateClasses.segmentButton(!isDarkMode), 'flex items-center justify-center gap-2 py-2.5 rounded-lg')}
              >
                <Sun className="w-4 h-4" /> Light
              </button>
              <button
                onClick={() => setIsDarkMode(true)}
                className={cx(templateClasses.segmentButton(isDarkMode), 'flex items-center justify-center gap-2 py-2.5 rounded-lg')}
              >
                <Moon className="w-4 h-4" /> Dark
              </button>
            </div>
          </div>

          <div className="space-y-3 hidden lg:block">
            <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 block">
              Desktop Layout Position
              <span className="block text-xs font-normal text-neutral-500 mt-1">Where should the settings panels be placed relative to the image?</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {LAYOUT_OPTIONS.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => setLayoutPosition(pos.id)}
                  className={cx(uiTemplates.buttons.choice, layoutPosition === pos.id ? uiTemplates.buttons.choiceActive : uiTemplates.buttons.choiceIdle)}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-neutral-100 dark:border-neutral-800" />

          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-500" />
                AI Integration
              </h4>
              <div className="flex items-center gap-3">
                {aiEnabled && (
                  <div className="relative w-full sm:w-auto">
                    <button
                      onClick={() => setIsTestPopoverOpen(!isTestPopoverOpen)}
                      className={cx('flex w-full sm:w-auto items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium border transition-colors', isTestPopoverOpen ? 'bg-neutral-100 dark:bg-[#222] border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white' : 'bg-transparent border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-[#111] text-neutral-700 dark:text-neutral-300')}
                    >
                      <FlaskConical className="w-4 h-4" />
                      Test
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isTestPopoverOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isTestPopoverOpen && (
                      <div className="fixed inset-x-4 top-[calc(1rem+env(safe-area-inset-top))] bottom-[calc(1rem+env(safe-area-inset-bottom))] flex max-h-[calc(100dvh-2rem)] flex-col bg-white dark:bg-[#0f0f0f] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-[400] animate-in fade-in zoom-in-95 duration-200 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[420px] sm:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100dvh-3rem)] sm:-translate-x-1/2 sm:-translate-y-1/2">
                        <div className="p-4 min-h-0 h-full flex flex-col gap-4">
                          <div className="flex items-center justify-between gap-3 shrink-0">
                            <h5 className="font-semibold text-neutral-800 dark:text-neutral-200 text-sm">Select model to test</h5>
                            <button
                              type="button"
                              onClick={() => {
                                setIsTestPopoverOpen(false);
                                setIsModelDropdownOpen(false);
                              }}
                              className={uiTemplates.buttons.closeIcon}
                              aria-label="Close model test"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="relative min-h-0 flex flex-col">
                            <button
                              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                              className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-semibold flex items-center justify-between hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                            >
                              <span className="truncate pr-2">{selectedModelLabel}</span>
                              <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" />
                            </button>

                            {isModelDropdownOpen && (
                              <div className="mt-2 bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-[500] flex max-h-[calc(100dvh-12rem)] sm:max-h-[340px] flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-2 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                                    <input
                                      type="text"
                                      placeholder="Search models"
                                      value={modelSearchQuery}
                                      onChange={(e) => setModelSearchQuery(e.target.value)}
                                      className="w-full bg-transparent border-none focus:ring-0 text-sm py-1.5 pl-8 pr-2 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-500"
                                    />
                                  </div>
                                  <span className="text-xs text-neutral-500 whitespace-nowrap px-2 border-l border-neutral-100 dark:border-neutral-800">
                                    {filteredModels.length} models
                                  </span>
                                </div>

                                <div className="overflow-y-auto custom-scrollbar max-h-[calc(100dvh-18rem)] sm:max-h-[280px] flex-1 px-1 pb-1 pt-0">
                                  {isLoadingModels ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
                                      <div className="w-6 h-6 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin mb-2" />
                                      <span className="text-xs">Loading OpenRouter models...</span>
                                    </div>
                                  ) : filteredModels.length === 0 ? (
                                    <div className="px-3 py-8 text-center text-xs text-neutral-400">
                                      No models found for {getProviderLabel(aiProvider)}.
                                    </div>
                                  ) : Object.entries(
                                    filteredModels.reduce((acc, model) => {
                                      if (!acc[model.group]) acc[model.group] = [];
                                      acc[model.group].push(model);
                                      return acc;
                                    }, {})
                                  ).map(([groupName, groupModels]) => (
                                    <div key={groupName} className="mb-2 last:mb-0">
                                      <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider sticky top-0 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur z-10">
                                        {groupName}
                                      </div>
                                      {groupModels.map(model => (
                                        <button
                                          key={model.id}
                                          onClick={() => {
                                            setAiModel(model.id);
                                            setIsCustomModelEntry(false);
                                            setIsModelDropdownOpen(false);
                                            setModelSearchQuery('');
                                          }}
                                          className={cx('w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-lg text-left text-sm transition-colors', aiModel === model.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#1a1a1a]')}
                                        >
                                          <Sparkles className={`w-3.5 h-3.5 ${aiModel === model.id ? 'text-blue-500' : 'text-blue-400 dark:text-blue-500'} shrink-0`} />
                                          <span className="flex-1 truncate">{model.name}</span>
                                          {aiModel === model.id && <Check className="w-4 h-4 shrink-0" />}
                                        </button>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              handleTestConnection();
                              setIsTestPopoverOpen(false);
                            }}
                            disabled={isTestingKey || (!aiModel && !getDefaultModelForProvider(aiProvider))}
                            className={`w-full py-2.5 min-h-[44px] rounded-lg text-sm font-semibold transition-all ${!aiModel && !getDefaultModelForProvider(aiProvider) ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed' : 'bg-[#414389] hover:bg-[#4b4e9f] text-white shadow-md hover:shadow-lg active:scale-[0.98]'}`}
                          >
                            {isTestingKey ? 'Testing...' : 'Run Test'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <label className="flex items-center cursor-pointer group min-h-[44px]">
                  <div className={templateClasses.toggleTrack(aiEnabled)}>
                    <span aria-hidden="true" className={templateClasses.toggleThumb(aiEnabled)} />
                  </div>
                  <input type="checkbox" className="sr-only" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
                </label>
              </div>
            </div>

            {aiEnabled && (
              <>
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className={cx(uiTemplates.text.compactLabel, 'block')}>Provider</label>
                  <TemplateSelect
                    value={aiProvider}
                    onChange={(nextProvider) => {
                      setAiProvider(nextProvider);
                      setAiModel('');
                      setIsCustomModelEntry(false);
                    }}
                    options={AI_PROVIDER_OPTIONS}
                    ariaLabel="Provider"
                    placeholder="Choose provider"
                  />
                </div>

                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className={cx(uiTemplates.text.compactLabel, 'block')}>Model</label>
                  <TemplateSelect
                    value={modelSelectValue}
                    onChange={(nextModel) => {
                      if (nextModel === '__custom') {
                        setIsCustomModelEntry(true);
                        if (!isCustomAiModel) setAiModel('');
                        return;
                      }

                      setIsCustomModelEntry(false);
                      setAiModel(nextModel);
                    }}
                    options={modelSelectOptions}
                    ariaLabel="Model"
                    placeholder="Choose model"
                    searchable
                    searchPlaceholder={`Search ${getProviderLabel(aiProvider)} models`}
                    emptyMessage={`No models found for ${getProviderLabel(aiProvider)}.`}
                  />

                  {aiProvider === 'openrouter' && isLoadingModels && providerModelOptions.length === 0 && (
                    <p className="text-xs text-neutral-400">Loading OpenRouter models...</p>
                  )}

                  {shouldShowCustomModelInput && (
                    <input
                      type="text"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder={`Enter a ${getProviderLabel(aiProvider)} model ID`}
                      spellCheck="false"
                      className={uiTemplates.inputs.textMono}
                    />
                  )}

                  <p className={uiTemplates.text.helperRelaxed}>The selected model is used for AI edits and connection tests.</p>
                </div>

                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className={cx(uiTemplates.text.compactLabel, 'block')}>API Key</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Key className="w-4 h-4 text-neutral-400" />
                    </div>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={`Enter your ${aiProvider === 'local' ? 'API URL/Key' : aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1)} key`}
                      className={uiTemplates.inputs.textMonoWithIcon}
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute inset-y-0 right-0 min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className={uiTemplates.text.helperRelaxed}>Keys are stored securely in your browser's local storage and are never sent to our servers.</p>
                </div>
              </>
            )}
          </div>

          <div className="lg:hidden text-sm text-neutral-500 dark:text-neutral-400 text-center">
            Layout options are only available on larger desktop screens.
          </div>
        </div>
      </div>
    </div>
  );
};
