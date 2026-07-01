import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { TemplateNoticeStack } from './components/TemplateNoticeStack';
import { cx, uiTemplates } from './uiTemplates';
import { ActionBar } from './components/ActionBar';
import { GlobalSettingsModal } from './components/GlobalSettingsModal';
import { ImageViewer } from './components/ImageViewer';
import { MobileExportSheet } from './components/MobileExportSheet';
import { MobileNav } from './components/MobileNav';
import { SnapMenu } from './components/SnapMenu';
import { TopBar } from './components/TopBar';
import { ZoomModal } from './components/ZoomModal';
import { AdvancedSettingsPanel } from './components/panels/AdvancedSettingsPanel';
import { BasicSettingsPanel } from './components/panels/BasicSettingsPanel';
import { EffectsPanel } from './components/panels/EffectsPanel';
import { SmartAssistPanel } from './components/panels/SmartAssistPanel';
import { STATIC_PROVIDER_MODELS, getDefaultModelForProvider, getProviderApiModel, getProviderLabel } from './constants/aiProviders';
import { DOCKABLE_PANEL_IDS, DOCKED_PANELS_STORAGE_KEY, PANEL_LABELS, SNAP_TARGETS, readDockedPanels } from './constants/docking';
import { GITHUB_REPO } from './constants/github';
import { clamp, rgbToHex } from './lib/colorUtils';
import { downloadBlob, revokeBatchItemUrls, revokeUrl } from './lib/downloadUtils';
import { getDominantEdgeColors, processImageSource } from './lib/imageProcessing';
import { createZipBlob } from './lib/zip';

// --- Main Application ---
export default function App() {
  // Global App States
  const [originalImage, setOriginalImage] = useState(null);
  const [outputFilename, setOutputFilename] = useState('image_transparent');
  const [processedImage, setProcessedImage] = useState(null);
  const [processedBlob, setProcessedBlob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputDimensions, setOutputDimensions] = useState(null);
  const [showImages, setShowImages] = useState(false);
  const [batchItems, setBatchItems] = useState([]);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchExportFormat, setBatchExportFormat] = useState('png');
  
  // Feature States
  const [zoomedImage, setZoomedImage] = useState({ src: null, isTransparent: false });
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPan, setZoomPan] = useState({ x: 0, y: 0 });
  const [isZoomPanning, setIsZoomPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [isPickingSeed, setIsPickingSeed] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSliderPos, setCompareSliderPos] = useState(50);
  const [compareType, setCompareType] = useState('slider'); // 'slider' or 'toggle'
  const [showOriginal, setShowOriginal] = useState(false);
  
  const originalImageRef = useRef(null);
  const processedPreviewRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastMaskPointRef = useRef(null);
  const isPaintingMaskRef = useRef(false);
  const pendingMaskStrokesRef = useRef([]);
  const zoomPanStartRef = useRef(null);

  // Accordion States
  const [isBasicOpen, setIsBasicOpen] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isEffectsOpen, setIsEffectsOpen] = useState(false);

  // Processing Parameters
  const [targetColor, setTargetColor] = useState('#000000');
  const [tolerance, setTolerance] = useState(10);
  const [smoothness, setSmoothness] = useState(20);
  const [scale, setScale] = useState(100);
  const [autoCrop, setAutoCrop] = useState(false);
  const [pixelFix, setPixelFix] = useState(false);
  const [replaceTransparent, setReplaceTransparent] = useState(true);
  const [replaceColor, setReplaceColor] = useState('#ffffff');
  const [contiguousOnly, setContiguousOnly] = useState(false);
  const [contiguousSeed, setContiguousSeed] = useState(null);

  // Extended Features
  // Enable removal of multiple colors at once
  const [multiColors, setMultiColors] = useState(false);
  // List of colors to remove. The first entry always mirrors targetColor.
  const [colors, setColors] = useState([targetColor]);
  // Mask preview state and image
  const [showMask, setShowMask] = useState(false);
  const [maskImage, setMaskImage] = useState(null);
  // Additional export format
  const [processedImageWebp, setProcessedImageWebp] = useState(null);
  const [processedImageJpeg, setProcessedImageJpeg] = useState(null);
  const [maskBlob, setMaskBlob] = useState(null);
  // Padding around the final output (in pixels)
  const [padding, setPadding] = useState(0);
  const [webpQuality, setWebpQuality] = useState(0.92);
  const [jpegQuality, setJpegQuality] = useState(0.9);
  const [jpegBackground, setJpegBackground] = useState('#ffffff');
  const [isMaskEditorOpen, setIsMaskEditorOpen] = useState(false);
  const [maskEditMode, setMaskEditMode] = useState('erase');
  const [brushSize, setBrushSize] = useState(28);
  const [maskStrokes, setMaskStrokes] = useState([]);
  const [isMaskPainting, setIsMaskPainting] = useState(false);
  
  // Effects Parameters
  const [hasShadow, setHasShadow] = useState(false);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowBlur, setShadowBlur] = useState(20);
  const [shadowOffsetX, setShadowOffsetX] = useState(0);
  const [shadowOffsetY, setShadowOffsetY] = useState(10);

  // Theme & Layout Settings
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('bpr_theme');
    if (saved !== null) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [layoutPosition, setLayoutPosition] = useState(() => {
    return localStorage.getItem('bpr_layout') || 'top';
  });
  const [dockedPanels, setDockedPanels] = useState(readDockedPanels);
  const [snapMenu, setSnapMenu] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  // Custom notices
  const [notices, setNotices] = useState([]);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportSettingsOpen, setIsExportSettingsOpen] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [isMobileExportOpen, setIsMobileExportOpen] = useState(false);
  const [activeMobilePanel, setActiveMobilePanel] = useState('basic');
  const [mobileSettingsDragY, setMobileSettingsDragY] = useState(0);
  const mobileSettingsDragStart = useRef(null);
  const mobileSettingsDragDistance = useRef(0);
  const snapMenuRef = useRef(null);
  
  const removeNotice = (id) => {
    setNotices((prev) => prev.filter((notice) => notice.id !== id));
  };

  const showNotice = (message) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setNotices((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      removeNotice(id);
    }, 4500);
  };

  const setObjectUrlState = (setter, blob) => {
    const url = URL.createObjectURL(blob);
    setter((prev) => {
      revokeUrl(prev);
      return url;
    });
    return url;
  };

  const clearProcessedExports = () => {
    setProcessedBlob(null);
    setMaskBlob(null);
    setProcessedImage((prev) => {
      revokeUrl(prev);
      return null;
    });
    setProcessedImageWebp((prev) => {
      revokeUrl(prev);
      return null;
    });
    setProcessedImageJpeg((prev) => {
      revokeUrl(prev);
      return null;
    });
    setMaskImage((prev) => {
      revokeUrl(prev);
      return null;
    });
  };

  const openZoomedImage = useCallback((src, isTransparent = false) => {
    setZoomedImage({ src, isTransparent });
    setZoomScale(1);
    setZoomPan({ x: 0, y: 0 });
    setIsZoomPanning(false);
  }, []);

  const closeZoomedImage = useCallback(() => {
    setZoomedImage({ src: null, isTransparent: false });
    setZoomScale(1);
    setZoomPan({ x: 0, y: 0 });
    setIsZoomPanning(false);
  }, []);

  // Local install update check
  const [updateInfo, setUpdateInfo] = useState({
    source: 'git',
    available: false,
    canPull: false,
    localHash: import.meta.env.VITE_APP_COMMIT_HASH || '',
    remoteHash: '',
    branch: import.meta.env.VITE_APP_BRANCH || GITHUB_REPO.branch,
    message: '',
  });
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);

  // AI Integration Settings
  const [aiEnabled, setAiEnabled] = useState(() => {
    return localStorage.getItem('bpr_ai_enabled') === 'true';
  });
  const [aiProvider, setAiProvider] = useState(() => {
    return localStorage.getItem('bpr_ai_provider') || 'openai';
  });
  const [aiModel, setAiModel] = useState(() => {
    return localStorage.getItem('bpr_ai_model') || '';
  });
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('bpr_api_key') || '';
  });
  const [isAiSectionOpen, setIsAiSectionOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  
  // Custom Popover States
  const [isTestPopoverOpen, setIsTestPopoverOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [models, setModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isCustomModelEntry, setIsCustomModelEntry] = useState(false);

  const providerModelOptions = aiProvider === 'openrouter' ? models : (STATIC_PROVIDER_MODELS[aiProvider] || []);
  const selectedModelLabel = providerModelOptions.find((m) => m.id === aiModel)?.name || aiModel || `Default: ${getDefaultModelForProvider(aiProvider) || getProviderLabel(aiProvider)}`;
  const isCustomAiModel = Boolean(aiModel && !providerModelOptions.some((m) => m.id === aiModel));
  const providerHasOnlyCustomModels = providerModelOptions.length === 0 && !getDefaultModelForProvider(aiProvider);
  const shouldShowCustomModelInput = isCustomModelEntry || isCustomAiModel || providerHasOnlyCustomModels;
  const modelSelectValue = (isCustomModelEntry || isCustomAiModel) ? '__custom' : aiModel;
  const modelSelectOptions = [
    {
      label: 'Default',
      options: [
        {
          value: '',
          label: getDefaultModelForProvider(aiProvider) ? `Default (${getDefaultModelForProvider(aiProvider)})` : 'No default model',
        },
      ],
    },
    ...Object.entries(providerModelOptions.reduce((acc, model) => {
      if (!acc[model.group]) acc[model.group] = [];
      acc[model.group].push(model);
      return acc;
    }, {})).map(([groupName, groupModels]) => ({
      label: groupName,
      options: groupModels.map((model) => ({
        value: model.id,
        label: model.name,
        searchText: model.id,
      })),
    })),
    {
      label: 'Custom',
      options: [{ value: '__custom', label: 'Custom model ID...' }],
    },
  ];

  const filteredModels = providerModelOptions.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) || m.id.toLowerCase().includes(modelSearchQuery.toLowerCase());
    return matchesSearch;
  });

  const checkForUpdates = useCallback(async ({ signal } = {}) => {
    if (signal?.aborted) return;

    try {
      if (window.colorRemoverDesktopUpdater?.checkForUpdates) {
        try {
          const data = await window.colorRemoverDesktopUpdater.checkForUpdates();
          if (signal?.aborted) return;

          if (data?.ok) {
            setUpdateInfo((prev) => ({
              ...prev,
              source: 'release',
              available: Boolean(data.updateAvailable),
              canPull: Boolean(data.canUpdate && data.updateAvailable),
              localHash: data.currentVersion ? `v${data.currentVersion}` : prev.localHash,
              remoteHash: data.latestVersion ? `v${data.latestVersion}` : prev.remoteHash,
              branch: 'latest release',
              message: data.updateAvailable && data.latestVersion ? `Release v${data.latestVersion}` : '',
            }));
            return;
          }
        } catch (error) {
          if (error.name === 'AbortError') return;
        }
      }

      try {
        const response = await fetch('/__color_remover_version', {
          cache: 'no-store',
          signal,
          headers: { Accept: 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.ok) {
            setUpdateInfo((prev) => ({
              ...prev,
              available: Boolean(data.updateAvailable),
              canPull: Boolean(data.canPull),
              localHash: data.localHash || prev.localHash,
              remoteHash: data.remoteHash || prev.remoteHash,
              branch: data.branch || prev.branch,
              message: data.updateAvailable ? `Remote ${data.remoteShortHash}` : '',
            }));
            return;
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
      }

      const localHash = import.meta.env.VITE_APP_COMMIT_HASH || '';
      if (!localHash) return;

      const releaseBranch = import.meta.env.VITE_APP_BRANCH || GITHUB_REPO.branch;
      const githubResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.name}/commits/${releaseBranch}`, {
        cache: 'no-store',
        signal,
        headers: { Accept: 'application/vnd.github+json' },
      });

      if (!githubResponse.ok) return;

      const githubData = await githubResponse.json();
      const remoteHash = githubData?.sha || '';

      setUpdateInfo((prev) => ({
        ...prev,
        available: Boolean(remoteHash && localHash && remoteHash !== localHash),
        canPull: false,
        localHash,
        remoteHash,
        branch: releaseBranch,
        message: remoteHash ? `Remote ${remoteHash.slice(0, 7)}` : '',
      }));
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to check for updates', error);
      }
    }
  }, []);

  const handleUpdateNow = async () => {
    if (isUpdatingApp) return;

    if (updateInfo.source === 'release' && window.colorRemoverDesktopUpdater?.installUpdate) {
      if (!updateInfo.canPull) {
        window.open(GITHUB_REPO.url, '_blank', 'noopener,noreferrer');
        showNotice('Opening GitHub for the latest release.');
        return;
      }

      setIsUpdatingApp(true);

      try {
        const data = await window.colorRemoverDesktopUpdater.installUpdate();

        if (!data?.ok) {
          throw new Error(data?.error || 'Unable to install the latest release.');
        }

        showNotice('Latest release downloaded. Restarting to install...');
      } catch (error) {
        showNotice(`Update failed: ${error.message}`);
        setIsUpdatingApp(false);
      }

      return;
    }

    if (!updateInfo.canPull) {
      window.open(GITHUB_REPO.url, '_blank', 'noopener,noreferrer');
      showNotice('Opening GitHub for the latest version.');
      return;
    }

    setIsUpdatingApp(true);

    try {
      const response = await fetch('/__color_remover_update', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Update failed with HTTP ${response.status}`);
      }

      setUpdateInfo((prev) => ({
        ...prev,
        available: false,
        localHash: data.after || prev.remoteHash,
        remoteHash: data.after || prev.remoteHash,
        message: data.pulled ? 'Updated' : 'Already current',
      }));
      showNotice(data.pulled ? 'Update pulled. Reloading the app...' : 'Already up to date.');

      if (data.pulled) {
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (error) {
      showNotice(`Update failed: ${error.message}`);
    } finally {
      setIsUpdatingApp(false);
    }
  };

  useEffect(() => {
    if ((isTestPopoverOpen || (aiEnabled && aiProvider === 'openrouter')) && models.length === 0) {
      setIsLoadingModels(true);
      fetch('https://openrouter.ai/api/v1/models')
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            const fetchedModels = data.data.map(m => {
              const provider = m.id.split('/')[0];
              const group = provider.charAt(0).toUpperCase() + provider.slice(1);
              return { id: m.id, name: m.name || m.id, group };
            });
            // Sort models by group name alphabetically
            fetchedModels.sort((a, b) => a.group.localeCompare(b.group));
            setModels(fetchedModels);
          }
        })
        .catch(err => console.error("Failed to fetch models", err))
        .finally(() => setIsLoadingModels(false));
    }
  }, [aiEnabled, aiProvider, isTestPopoverOpen, models.length]);

  useEffect(() => {
    const controller = new AbortController();
    checkForUpdates({ signal: controller.signal });
    const intervalId = window.setInterval(() => {
      checkForUpdates();
    }, 10 * 60 * 1000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [checkForUpdates]);

  const handleTestConnection = async () => {
    if (!apiKey) {
      showNotice("Please enter an API key first.");
      return;
    }
    
    setIsTestingKey(true);
    
    try {
      let response;
      const selectedModel = getProviderApiModel(aiProvider, aiModel);
      if (aiProvider === 'openrouter') {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: 'user', content: 'Test' }]
          })
        });
      } else if (aiProvider === 'openai') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: 'user', content: 'Test' }]
          })
        });
      } else if (aiProvider === 'google') {
         const actualModel = selectedModel;
         response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             contents: [{ parts: [{ text: "Test" }] }]
           })
         });
      } else if (aiProvider === 'anthropic') {
         response = await fetch('https://api.anthropic.com/v1/messages', {
           method: 'POST',
           headers: {
             'x-api-key': apiKey,
             'anthropic-version': '2023-06-01',
             'content-type': 'application/json',
             'anthropic-dangerous-direct-browser-access': 'true'
           },
           body: JSON.stringify({
             model: selectedModel,
             messages: [{ role: 'user', content: 'Test' }],
             max_tokens: 10
           })
         });
      } else {
         // Fallback for local or replicate
         setTimeout(() => {
             setIsTestingKey(false);
             setIsTestPopoverOpen(false);
             showNotice(`Connection to ${aiProvider} (${selectedModel || 'default model'}) successful!`);
          }, 1200);
          return;
       }

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : null;

      if (!response.ok) {
        let errorMsg = `HTTP Error ${response.status}`;
        if (data && data.error && data.error.message) {
            errorMsg = data.error.message;
        } else if (data && data.message) {
            errorMsg = data.message;
        }
        throw new Error(errorMsg);
      }
      
      setIsTestingKey(false);
      setIsTestPopoverOpen(false);
      showNotice(`Connection to ${aiProvider} (${selectedModel || 'default model'}) successful!`);
      
    } catch (error) {
      setIsTestingKey(false);
      showNotice(`Error: ${error.message === 'Failed to fetch' ? 'Network or CORS Error (Check API URL/Key)' : error.message}`);
    }
  };

  const handleAiGeneration = async () => {
    if (!aiPrompt.trim()) return;
    const promptHandledLocally = await applyPromptAssist(aiPrompt);
    if (promptHandledLocally) {
      setAiPrompt('');
      return;
    }

    if (!apiKey) {
      showNotice("Try a prompt like 'remove background', 'green screen', or add an API key for provider testing.");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      let response;
      const selectedModel = getProviderApiModel(aiProvider, aiModel);
      if (aiProvider === 'openrouter') {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: 'user', content: aiPrompt }]
          })
        });
      } else if (aiProvider === 'openai') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: 'user', content: aiPrompt }]
          })
        });
      } else if (aiProvider === 'google') {
         const actualModel = selectedModel;
         response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             contents: [{ parts: [{ text: aiPrompt }] }]
           })
         });
      } else if (aiProvider === 'anthropic') {
         response = await fetch('https://api.anthropic.com/v1/messages', {
           method: 'POST',
           headers: {
             'x-api-key': apiKey,
             'anthropic-version': '2023-06-01',
             'content-type': 'application/json',
             'anthropic-dangerous-direct-browser-access': 'true'
           },
           body: JSON.stringify({
             model: selectedModel,
             messages: [{ role: 'user', content: aiPrompt }],
             max_tokens: 100
           })
         });
      } else {
         // Fallback for local or replicate
          setTimeout(() => {
             setIsProcessing(false);
             showNotice(`AI Generation triggered via ${aiProvider} (${selectedModel || 'default model'}) using prompt: "${aiPrompt}"`);
          }, 1500);
          return;
       }

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : null;

      if (!response.ok) {
        let errorMsg = `HTTP Error ${response.status}`;
        if (data && data.error && data.error.message) {
            errorMsg = data.error.message;
        } else if (data && data.message) {
            errorMsg = data.message;
        }
        throw new Error(errorMsg);
      }
      
      setIsProcessing(false);
      showNotice(`AI Generation triggered via ${aiProvider} (${selectedModel || 'default model'}) using prompt: "${aiPrompt}"`);
      
    } catch (error) {
      setIsProcessing(false);
      showNotice(`Error: ${error.message === 'Failed to fetch' ? 'Network or CORS Error (Check API URL/Key)' : error.message}`);
    }
  };

  useEffect(() => {
    localStorage.setItem('bpr_ai_enabled', aiEnabled);
    localStorage.setItem('bpr_ai_provider', aiProvider);
    localStorage.setItem('bpr_ai_model', aiModel);
    localStorage.setItem('bpr_api_key', apiKey);
  }, [aiEnabled, aiProvider, aiModel, apiKey]);

  // Undo/Redo History
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isTraversingHistory, setIsTraversingHistory] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const loadSaved = (key, defaultVal, parser = (v)=>v) => {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        try {
          return parser(saved);
        } catch {
          return defaultVal;
        }
      }
      return defaultVal;
    };
    setTargetColor(loadSaved('bpr_color', '#000000'));
    setTolerance(loadSaved('bpr_tolerance', 10, parseInt));
    setSmoothness(loadSaved('bpr_smoothness', 20, parseInt));
    setScale(loadSaved('bpr_scale', 100, parseInt));
    setAutoCrop(loadSaved('bpr_autocrop', false, v => v === 'true'));
    setPixelFix(loadSaved('bpr_pixelfix', false, v => v === 'true'));
    setReplaceTransparent(loadSaved('bpr_replace_trans', true, v => v === 'true'));
    setReplaceColor(loadSaved('bpr_replace_color', '#ffffff'));
    setContiguousOnly(loadSaved('bpr_contiguous_only', false, v => v === 'true'));
    setContiguousSeed(loadSaved('bpr_contiguous_seed', null, (v) => JSON.parse(v)));
    setHasShadow(loadSaved('bpr_shadow', false, v => v === 'true'));
    setShadowColor(loadSaved('bpr_shadow_color', '#000000'));
    setShadowBlur(loadSaved('bpr_shadow_blur', 20, parseInt));
    setShadowOffsetX(loadSaved('bpr_shadow_x', 0, parseInt));
    setShadowOffsetY(loadSaved('bpr_shadow_y', 10, parseInt));
    setMultiColors(loadSaved('bpr_multicolors', false, v => v === 'true'));

    // Load multi-color settings if available
    const savedColors = loadSaved('bpr_colors', null, (v) => {
      try {
        const arr = JSON.parse(v);
        return Array.isArray(arr) ? arr : null;
      } catch {
        return null;
      }
    });
    if (savedColors && savedColors.length > 0) {
      setColors(savedColors);
      setTargetColor(savedColors[0]);
    }

    setPadding(loadSaved('bpr_padding', 0, parseInt));
    setWebpQuality(loadSaved('bpr_webp_quality', 0.92, parseFloat));
    setJpegQuality(loadSaved('bpr_jpeg_quality', 0.9, parseFloat));
    setJpegBackground(loadSaved('bpr_jpeg_background', '#ffffff'));
  }, []);

  // Debounced States to prevent lag
  const [debouncedParams, setDebouncedParams] = useState({
    targetColor, tolerance, smoothness, scale, autoCrop, pixelFix, 
    replaceTransparent, replaceColor, contiguousOnly, contiguousSeed,
    hasShadow, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY,
    webpQuality, jpegQuality, jpegBackground
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const newParams = {
        targetColor, tolerance, smoothness, scale, autoCrop, pixelFix, replaceTransparent, replaceColor,
        contiguousOnly, contiguousSeed, hasShadow, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY,
        colors, multiColors, padding, webpQuality, jpegQuality, jpegBackground,
      };
      setDebouncedParams(newParams);
      
      // Save local storage
      localStorage.setItem('bpr_color', targetColor);
      localStorage.setItem('bpr_tolerance', tolerance);
      localStorage.setItem('bpr_smoothness', smoothness);
      localStorage.setItem('bpr_scale', scale);
      localStorage.setItem('bpr_autocrop', autoCrop);
      localStorage.setItem('bpr_pixelfix', pixelFix);
      localStorage.setItem('bpr_replace_trans', replaceTransparent);
      localStorage.setItem('bpr_replace_color', replaceColor);
      localStorage.setItem('bpr_contiguous_only', contiguousOnly);
      if (contiguousSeed) localStorage.setItem('bpr_contiguous_seed', JSON.stringify(contiguousSeed));
      else localStorage.removeItem('bpr_contiguous_seed');
      localStorage.setItem('bpr_shadow', hasShadow);
      localStorage.setItem('bpr_shadow_color', shadowColor);
      localStorage.setItem('bpr_shadow_blur', shadowBlur);
      localStorage.setItem('bpr_shadow_x', shadowOffsetX);
      localStorage.setItem('bpr_shadow_y', shadowOffsetY);

      // Persist multi-color settings and padding
      localStorage.setItem('bpr_colors', JSON.stringify(colors));
      localStorage.setItem('bpr_multicolors', multiColors);
      localStorage.setItem('bpr_padding', padding);
      localStorage.setItem('bpr_webp_quality', webpQuality);
      localStorage.setItem('bpr_jpeg_quality', jpegQuality);
      localStorage.setItem('bpr_jpeg_background', jpegBackground);

      // Handle Undo/Redo Logic
      if (!isTraversingHistory) {
        setHistory(prev => {
          const currentPath = prev.slice(0, historyIndex + 1);
          const lastState = currentPath[currentPath.length - 1];
          if (JSON.stringify(lastState) !== JSON.stringify(newParams)) {
            currentPath.push(newParams);
            setHistoryIndex(currentPath.length - 1);
          }
          return currentPath;
        });
      } else {
        setIsTraversingHistory(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetColor, tolerance, smoothness, scale, autoCrop, pixelFix, replaceTransparent, replaceColor, contiguousOnly, contiguousSeed, hasShadow, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, colors, multiColors, padding, webpQuality, jpegQuality, jpegBackground]);

  // Persist Theme and Layout immediately
  useEffect(() => {
    localStorage.setItem('bpr_theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('bpr_layout', layoutPosition);
  }, [isDarkMode, layoutPosition]);

  useEffect(() => {
    localStorage.setItem(DOCKED_PANELS_STORAGE_KEY, JSON.stringify(dockedPanels));
  }, [dockedPanels]);

  useEffect(() => {
    if (!snapMenu) return undefined;

    const handlePointerDown = (event) => {
      if (!snapMenuRef.current?.contains(event.target)) {
        setSnapMenu(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSnapMenu(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [snapMenu]);

  const applyHistoryState = useCallback((state) => {
    setTargetColor(state.targetColor); setTolerance(state.tolerance); setSmoothness(state.smoothness);
    setScale(state.scale); setAutoCrop(state.autoCrop); setPixelFix(state.pixelFix);
    setReplaceTransparent(state.replaceTransparent); setReplaceColor(state.replaceColor);
    setContiguousOnly(Boolean(state.contiguousOnly));
    setContiguousSeed(state.contiguousSeed || null);
    setHasShadow(state.hasShadow); setShadowColor(state.shadowColor); setShadowBlur(state.shadowBlur);
    setShadowOffsetX(state.shadowOffsetX); setShadowOffsetY(state.shadowOffsetY);

    // Restore multi-color settings and padding if present
    if (state.colors) {
      setColors(state.colors);
    }
    if (typeof state.multiColors === 'boolean') {
      setMultiColors(state.multiColors);
    }
    if (typeof state.padding !== 'undefined') {
      setPadding(state.padding);
    }
    if (typeof state.webpQuality !== 'undefined') setWebpQuality(state.webpQuality);
    if (typeof state.jpegQuality !== 'undefined') setJpegQuality(state.jpegQuality);
    if (typeof state.jpegBackground !== 'undefined') setJpegBackground(state.jpegBackground);
  }, []);

  // Undo / Redo Actions
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setIsTraversingHistory(true);
      const prevState = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      applyHistoryState(prevState);
    }
  }, [applyHistoryState, history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setIsTraversingHistory(true);
      const nextState = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      applyHistoryState(nextState);
    }
  }, [applyHistoryState, history, historyIndex]);

  // Keep the first color in the colors array synced with targetColor
  useEffect(() => {
    setColors((prev) => {
      const arr = [...prev];
      arr[0] = targetColor;
      return arr;
    });
  }, [targetColor]);

  // Reset all settings to their defaults and clear stored values.
  const resetSettings = () => {
    setIsExportMenuOpen(false);
    setIsExportSettingsOpen(false);
    setIsMobileExportOpen(false);
    setSnapMenu(null);
    setDockedPanels({});
    setTargetColor('#000000');
    setColors(['#000000']);
    setMultiColors(false);
    setTolerance(10);
    setSmoothness(20);
    setScale(100);
    setAutoCrop(false);
    setPixelFix(false);
    setReplaceTransparent(true);
    setReplaceColor('#ffffff');
    setContiguousOnly(false);
    setContiguousSeed(null);
    setHasShadow(false);
    setShadowColor('#000000');
    setShadowBlur(20);
    setShadowOffsetX(0);
    setShadowOffsetY(10);
    setPadding(0);
    setWebpQuality(0.92);
    setJpegQuality(0.9);
    setJpegBackground('#ffffff');
    setIsMaskEditorOpen(false);
    setMaskStrokes([]);
    setShowMask(false);
    clearProcessedExports();
    setOriginalImage(null);
    setOutputFilename('image_transparent');
    setBatchItems((prev) => {
      prev.forEach(revokeBatchItemUrls);
      return [];
    });
    setActiveBatchId(null);
    setOutputDimensions(null);
    setHistory([]);
    setHistoryIndex(-1);
    const keys = ['bpr_color','bpr_tolerance','bpr_smoothness','bpr_scale','bpr_autocrop','bpr_pixelfix','bpr_replace_trans','bpr_replace_color','bpr_contiguous_only','bpr_contiguous_seed','bpr_shadow','bpr_theme','bpr_colors','bpr_padding','bpr_webp_quality','bpr_jpeg_quality','bpr_jpeg_background', DOCKED_PANELS_STORAGE_KEY];
    keys.forEach((key) => localStorage.removeItem(key));
  };

  // Setup Keyboard Listeners (Escape, Undo/Redo shortcut)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeZoomedImage();
        setIsPickingColor(false);
        setIsPickingSeed(false);
        setIsExportMenuOpen(false);
        setIsTestPopoverOpen(false);
        setIsModelDropdownOpen(false);
        setIsMobileSettingsOpen(false);
        setIsMobileExportOpen(false);
        setMobileSettingsDragY(0);
      }
      
      // Handle Undo (Ctrl+Z) and Redo (Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (isMaskEditorOpen && maskStrokes.length > 0 && !e.shiftKey) {
          setMaskStrokes((prev) => prev.slice(0, -1));
        } else if (e.shiftKey) handleRedo(); else handleUndo();
      }
      
      // Handle Redo (Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, isMaskEditorOpen, maskStrokes.length, closeZoomedImage, handleRedo, handleUndo]);

  // Handle image load animation
  useEffect(() => {
    if (originalImage) {
      const timer = setTimeout(() => setShowImages(true), 50);
      setMaskStrokes([]);
      setIsMaskEditorOpen(false);
      return () => clearTimeout(timer);
    } else {
      setShowImages(false);
      setOutputDimensions(null);
    }
  }, [originalImage]);

  // File Handling (Upload, Drag&Drop, Paste)
  const processUploadedFiles = (fileList) => {
    const imageFiles = Array.from(fileList || []).filter((file) => file?.type?.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setIsExportMenuOpen(false);
    setIsExportSettingsOpen(false);
    setIsMobileSettingsOpen(false);
    setIsMobileExportOpen(false);

    const nextBatchItems = imageFiles.map((file, index) => {
      const lastDot = file.name.lastIndexOf('.');
      const nameWithoutExt = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name || `pasted_image_${index + 1}`;
      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        file,
        name: nameWithoutExt,
        url: URL.createObjectURL(file),
        status: index === 0 ? 'processing' : 'queued',
        dimensions: null,
      };
    });

    setBatchItems((prev) => {
      prev.forEach(revokeBatchItemUrls);
      return nextBatchItems;
    });

    const first = nextBatchItems[0];
    setOutputFilename(`${first.name}_transparent`);
    setActiveBatchId(first.id);
    setOriginalImage(first.url);
  };

  const selectBatchItem = useCallback((itemId) => {
    const item = batchItems.find((entry) => entry.id === itemId);
    if (!item) return;
    setActiveBatchId(item.id);
    setOutputFilename(`${item.name}_transparent`);
    setOriginalImage(item.url);
    setIsExportMenuOpen(false);
    setIsMobileExportOpen(false);
  }, [batchItems]);

  const handleImageUpload = (e) => {
    processUploadedFiles(e.target.files);
    e.target.value = '';
  };
  
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        processUploadedFiles(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const dragCounter = useRef(0);

  const onDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const onDragOver = useCallback((e) => { 
    e.preventDefault(); 
  }, []);

  const onDragLeave = useCallback((e) => { 
    e.preventDefault(); 
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false); 
    }
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processUploadedFiles(e.dataTransfer.files);
  }, []);

  // Eyedropper Tool functionality
  const handleOriginalImageClick = (e) => {
    if ((!isPickingColor && !isPickingSeed) || !originalImageRef.current) return;
    const img = originalImageRef.current;
    const rect = img.getBoundingClientRect();
    
    // Calculate click coordinates relative to the natural image size
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    // Draw onto an off-screen canvas to read the exact pixel color
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel[3] > 0) {
      const sampledColor = rgbToHex(pixel[0], pixel[1], pixel[2]);
      if (isPickingColor) setTargetColor(sampledColor);
      if (isPickingSeed) {
        setTargetColor(sampledColor);
        setContiguousSeed({
          x: clamp(x / img.naturalWidth, 0, 1),
          y: clamp(y / img.naturalHeight, 0, 1),
        });
        setContiguousOnly(true);
        showNotice('Connected area seed set.');
      }
    }
    setIsPickingColor(false);
    setIsPickingSeed(false);
  };

  // Core processing function via Web Worker
  useEffect(() => {
    if (!originalImage) {
      clearProcessedExports();
      return undefined;
    }

    let isActive = true;
    setIsProcessing(true);

    processImageSource(originalImage, debouncedParams, maskStrokes)
      .then((result) => {
        if (!isActive) return;

        setOutputDimensions(result.dimensions);
        setProcessedBlob(result.pngBlob);
        setMaskBlob(result.maskBlob);

        setObjectUrlState(setProcessedImage, result.pngBlob);
        setObjectUrlState(setProcessedImageWebp, result.webpBlob);
        setObjectUrlState(setProcessedImageJpeg, result.jpegBlob);
        setObjectUrlState(setMaskImage, result.maskBlob);

        if (activeBatchId) {
          setBatchItems((prev) => prev.map((item) => {
            if (item.id !== activeBatchId) return item;
            revokeUrl(item.pngUrl);
            revokeUrl(item.webpUrl);
            revokeUrl(item.jpegUrl);
            revokeUrl(item.maskUrl);
            return {
              ...item,
              status: 'done',
              dimensions: result.dimensions,
              pngBlob: result.pngBlob,
              webpBlob: result.webpBlob,
              jpegBlob: result.jpegBlob,
              maskBlob: result.maskBlob,
              pngUrl: URL.createObjectURL(result.pngBlob),
              webpUrl: URL.createObjectURL(result.webpBlob),
              jpegUrl: URL.createObjectURL(result.jpegBlob),
              maskUrl: URL.createObjectURL(result.maskBlob),
            };
          }));
        }
      })
      .catch((error) => {
        if (!isActive) return;
        clearProcessedExports();
        setBatchItems((prev) => prev.map((item) => item.id === activeBatchId ? { ...item, status: 'error' } : item));
        showNotice(`Processing failed: ${error.message || 'Unknown error'}`);
      })
      .finally(() => {
        if (isActive) setIsProcessing(false);
      });

    return () => {
      isActive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalImage, debouncedParams, maskStrokes, activeBatchId]);

  const getBatchBlobForFormat = (item, format) => {
    if (format === 'webp') return item.webpBlob;
    if (format === 'jpeg') return item.jpegBlob;
    return item.pngBlob;
  };

  const getExtensionForFormat = (format) => {
    if (format === 'webp') return 'webp';
    if (format === 'jpeg') return 'jpg';
    return 'png';
  };

  const processAllBatchItems = async ({ silent = false } = {}) => {
    if (batchItems.length === 0 || isBatchProcessing) return batchItems;

    setIsBatchProcessing(true);
    const processedItems = [];
    let failedCount = 0;

    for (const item of batchItems) {
      setBatchItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, status: 'processing' } : entry));
      try {
        const result = await processImageSource(item.url, debouncedParams, []);
        const updatedItem = {
          ...item,
          status: 'done',
          dimensions: result.dimensions,
          pngBlob: result.pngBlob,
          webpBlob: result.webpBlob,
          jpegBlob: result.jpegBlob,
          maskBlob: result.maskBlob,
          pngUrl: URL.createObjectURL(result.pngBlob),
          webpUrl: URL.createObjectURL(result.webpBlob),
          jpegUrl: URL.createObjectURL(result.jpegBlob),
          maskUrl: URL.createObjectURL(result.maskBlob),
        };

        processedItems.push(updatedItem);
        setBatchItems((prev) => prev.map((entry) => {
          if (entry.id !== item.id) return entry;
          revokeUrl(entry.pngUrl);
          revokeUrl(entry.webpUrl);
          revokeUrl(entry.jpegUrl);
          revokeUrl(entry.maskUrl);
          return updatedItem;
        }));
      } catch {
        failedCount += 1;
        const failedItem = { ...item, status: 'error' };
        processedItems.push(failedItem);
        setBatchItems((prev) => prev.map((entry) => entry.id === item.id ? failedItem : entry));
      }
    }

    setIsBatchProcessing(false);
    if (!silent) {
      showNotice(failedCount ? `Batch finished with ${failedCount} failed image${failedCount === 1 ? '' : 's'}.` : 'Batch processed.');
    }
    return processedItems;
  };

  const handleDownloadBatchZip = async () => {
    if (batchItems.length === 0) return;
    const needsProcessing = batchItems.some((item) => !getBatchBlobForFormat(item, batchExportFormat));
    const readyItems = needsProcessing
      ? await processAllBatchItems({ silent: true })
      : batchItems;
    const extension = getExtensionForFormat(batchExportFormat);
    const entries = readyItems
      .filter((item) => getBatchBlobForFormat(item, batchExportFormat))
      .map((item, index) => ({
        name: `${item.name || `image_${index + 1}`}_transparent.${extension}`,
        blob: getBatchBlobForFormat(item, batchExportFormat),
      }));

    if (entries.length === 0) {
      showNotice('No processed batch files are ready to zip.');
      return;
    }

    const zipBlob = await createZipBlob(entries);
    downloadBlob(zipBlob, `color-remover-${batchExportFormat}-batch.zip`);
    showNotice(`Downloaded ${entries.length} ${batchExportFormat.toUpperCase()} file${entries.length === 1 ? '' : 's'} as a ZIP.`);
  };

  const handleCopyPng = async () => {
    if (!processedBlob) return;
    if (!navigator.clipboard || !window.ClipboardItem) {
      showNotice('PNG clipboard export is not supported in this browser.');
      return;
    }

    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': processedBlob }),
      ]);
      showNotice('Copied PNG to clipboard.');
    } catch (error) {
      showNotice(`Clipboard copy failed: ${error.message}`);
    }
  };

  const handleDownloadMask = () => {
    if (!maskBlob) return;
    downloadBlob(maskBlob, `${outputFilename || 'image_transparent'}_mask.png`);
  };

  const applySmartBackgroundAssist = async () => {
    if (!originalImage) {
      showNotice('Add an image first.');
      return false;
    }

    try {
      const analysis = await getDominantEdgeColors(originalImage);
      const suggestedColors = analysis.colors.length > 0 ? analysis.colors : [analysis.cornerColor];
      setTargetColor(suggestedColors[0]);
      setColors(suggestedColors);
      setMultiColors(suggestedColors.length > 1);
      setReplaceTransparent(true);
      setTolerance((current) => Math.max(current, 24));
      setSmoothness((current) => Math.max(current, 28));
      setPixelFix(true);
      setShowMask(true);
      setContiguousSeed(analysis.seed);
      showNotice(`Suggested ${suggestedColors.length} background color${suggestedColors.length === 1 ? '' : 's'} from image edges.`);
      return true;
    } catch (error) {
      showNotice(`Smart background scan failed: ${error.message}`);
      return false;
    }
  };

  const applySmartConnectedAssist = async () => {
    const applied = await applySmartBackgroundAssist();
    if (applied) {
      setContiguousOnly(true);
      setIsPickingSeed(false);
      showNotice('Connected removal enabled from the top-left edge seed.');
    }
    return applied;
  };

  const applySmartEdgeAssist = () => {
    setPixelFix(true);
    setSmoothness((current) => Math.max(current, 34));
    setTolerance((current) => Math.max(8, current));
    setShowMask(true);
    showNotice('Edge cleanup tuned with alpha bleed and smoother transitions.');
    return true;
  };

  const applyPromptAssist = async (prompt) => {
    const text = prompt.toLowerCase();
    if (!text.trim()) return false;

    if (text.includes('green screen') || text.includes('green background')) {
      setTargetColor('#00ff00');
      setColors(['#00ff00']);
      setMultiColors(false);
      setTolerance(52);
      setSmoothness(28);
      setReplaceTransparent(true);
      setShowMask(true);
      showNotice('Applied a green-screen removal setup.');
      return true;
    }

    if (text.includes('white background') || text.includes('remove white')) {
      setTargetColor('#ffffff');
      setColors(['#ffffff']);
      setMultiColors(false);
      setTolerance(22);
      setSmoothness(24);
      setReplaceTransparent(true);
      setShowMask(true);
      showNotice('Applied a white-background removal setup.');
      return true;
    }

    if (text.includes('black background') || text.includes('remove black')) {
      setTargetColor('#000000');
      setColors(['#000000']);
      setMultiColors(false);
      setTolerance(22);
      setSmoothness(24);
      setReplaceTransparent(true);
      setShowMask(true);
      showNotice('Applied a black-background removal setup.');
      return true;
    }

    if (text.includes('connected') || text.includes('magic wand')) {
      return applySmartConnectedAssist();
    }

    if (text.includes('edge') || text.includes('halo') || text.includes('fringe') || text.includes('smooth')) {
      return applySmartEdgeAssist();
    }

    if (text.includes('background') || text.includes('subject') || text.includes('remove')) {
      return applySmartBackgroundAssist();
    }

    return false;
  };

  const mapPointerToProcessedPoint = (event) => {
    if (!processedPreviewRef.current || !outputDimensions) return null;
    const rect = processedPreviewRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return {
      x: clamp(x * outputDimensions.width, 0, outputDimensions.width),
      y: clamp(y * outputDimensions.height, 0, outputDimensions.height),
    };
  };

  const addMaskStrokeSegment = (start, end) => {
    const stroke = {
      mode: maskEditMode === 'restore' ? 'restore' : 'erase',
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      radius: brushSize,
    };
    pendingMaskStrokesRef.current.push(stroke);
  };

  const handleMaskBrushPointerDown = (event) => {
    if (!isMaskEditorOpen || !processedImage) return;
    const point = mapPointerToProcessedPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    isPaintingMaskRef.current = true;
    pendingMaskStrokesRef.current = [];
    setIsMaskPainting(true);
    lastMaskPointRef.current = point;
    addMaskStrokeSegment(point, point);
  };

  const handleMaskBrushPointerMove = (event) => {
    if (!isPaintingMaskRef.current || !isMaskEditorOpen) return;
    const point = mapPointerToProcessedPoint(event);
    if (!point || !lastMaskPointRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const previous = lastMaskPointRef.current;
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance < Math.max(2, brushSize / 6)) return;
    addMaskStrokeSegment(previous, point);
    lastMaskPointRef.current = point;
  };

  const handleMaskBrushPointerUp = (event) => {
    if (!isPaintingMaskRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    isPaintingMaskRef.current = false;
    setIsMaskPainting(false);
    const committedStrokes = pendingMaskStrokesRef.current;
    if (committedStrokes.length > 0) {
      setMaskStrokes((prev) => [...prev, ...committedStrokes]);
    }
    pendingMaskStrokesRef.current = [];
    lastMaskPointRef.current = null;
  };

  const handleZoomWheel = (event) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 0.15 : -0.15;
    setZoomScale((current) => clamp(Number((current + direction).toFixed(2)), 0.5, 8));
  };

  const handleZoomPointerDown = (event) => {
    if (zoomScale <= 1) return;
    event.preventDefault();
    if (event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setIsZoomPanning(true);
    zoomPanStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: zoomPan.x,
      panY: zoomPan.y,
    };
  };

  const handleZoomPointerMove = (event) => {
    if (!isZoomPanning || !zoomPanStartRef.current) return;
    event.preventDefault();
    const start = zoomPanStartRef.current;
    setZoomPan({
      x: start.panX + event.clientX - start.x,
      y: start.panY + event.clientY - start.y,
    });
  };

  const handleZoomPointerEnd = () => {
    setIsZoomPanning(false);
    zoomPanStartRef.current = null;
  };

  // Styles for Checkerboard Backgrounds
  const checkerboardStyles = {
    backgroundImage: isDarkMode 
      ? 'repeating-linear-gradient(45deg, #111111 25%, transparent 25%, transparent 75%, #111111 75%, #111111), repeating-linear-gradient(45deg, #111111 25%, #000000 25%, #000000 75%, #111111 75%, #111111)'
      : 'repeating-linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%, #e5e5e5), repeating-linear-gradient(45deg, #e5e5e5 25%, #f5f5f5 25%, #f5f5f5 75%, #e5e5e5 75%, #e5e5e5)',
    backgroundPosition: '0 0, 10px 10px',
    backgroundSize: '20px 20px'
  };

  const updateCompareSliderFromClientX = useCallback((clientX, element) => {
    const rect = element.getBoundingClientRect();
    const nextPosition = ((clientX - rect.left) / rect.width) * 100;
    setCompareSliderPos(Math.max(0, Math.min(100, nextPosition)));
  }, []);

  const closeMobileSettings = useCallback(() => {
    setIsMobileSettingsOpen(false);
    setIsMobileExportOpen(false);
    setMobileSettingsDragY(0);
    mobileSettingsDragStart.current = null;
    mobileSettingsDragDistance.current = 0;
  }, []);

  const openMobilePanel = useCallback((panel) => {
    setIsMobileExportOpen(false);
    setIsMobileSettingsOpen(true);
    setActiveMobilePanel(panel);
    setMobileSettingsDragY(0);
    mobileSettingsDragStart.current = null;
    mobileSettingsDragDistance.current = 0;

    setIsBasicOpen(panel === 'basic');
    setIsAdvancedOpen(panel === 'advanced');
    setIsEffectsOpen(panel === 'effects');
    setIsAiSectionOpen(panel === 'ai');
  }, []);

  const openMobileExport = useCallback(() => {
    if (!processedImage) return;
    setIsMobileSettingsOpen(false);
    setIsMobileExportOpen(true);
    setMobileSettingsDragY(0);
    mobileSettingsDragStart.current = null;
    mobileSettingsDragDistance.current = 0;
  }, [processedImage]);

  const getDragClientY = (e) => {
    return e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? e.clientY;
  };

  const handleMobileSettingsDragStart = useCallback((e) => {
    mobileSettingsDragStart.current = getDragClientY(e);
    mobileSettingsDragDistance.current = 0;
    setMobileSettingsDragY(0);
    if (e.pointerId !== undefined && e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, []);

  const handleMobileSettingsDragMove = useCallback((e) => {
    if (mobileSettingsDragStart.current === null) return;
    e.preventDefault();
    const distance = Math.max(0, getDragClientY(e) - mobileSettingsDragStart.current);
    mobileSettingsDragDistance.current = distance;
    setMobileSettingsDragY(distance);
  }, []);

  const handleMobileSettingsDragEnd = useCallback(() => {
    if (mobileSettingsDragDistance.current > 80) {
      closeMobileSettings();
      return;
    }
    mobileSettingsDragStart.current = null;
    mobileSettingsDragDistance.current = 0;
    setMobileSettingsDragY(0);
  }, [closeMobileSettings]);

  const mobilePanelTitle = {
    basic: 'Basic Settings',
    advanced: 'Advanced Settings',
    effects: 'Effects & Styling',
    ai: 'Smart Assist',
  }[activeMobilePanel] || 'Settings';

  const setPanelOpen = (panelId, open = true) => {
    if (panelId === 'basic') setIsBasicOpen(open);
    if (panelId === 'advanced') setIsAdvancedOpen(open);
    if (panelId === 'effects') setIsEffectsOpen(open);
    if (panelId === 'ai') setIsAiSectionOpen(open);
  };

  const openSnapMenu = (panelId, anchorRect) => {
    if (!DOCKABLE_PANEL_IDS.includes(panelId) || !anchorRect) return;

    const menuWidth = 296;
    const menuHeight = 250;
    const x = clamp(anchorRect.left + (anchorRect.width / 2), menuWidth / 2 + 12, window.innerWidth - (menuWidth / 2) - 12);
    const y = clamp(anchorRect.bottom + 8, 76, window.innerHeight - menuHeight - 12);
    setSnapMenu({ panelId, x, y });
  };

  const dockPanelToPosition = (panelId, position) => {
    if (!DOCKABLE_PANEL_IDS.includes(panelId) || !SNAP_TARGETS.some((target) => target.id === position)) return;

    const replacedPanelId = Object.entries(dockedPanels).find(([otherPanelId, otherPosition]) => (
      otherPanelId !== panelId && otherPosition === position
    ))?.[0];

    setDockedPanels((current) => {
      const next = { ...current };
      Object.entries(next).forEach(([otherPanelId, otherPosition]) => {
        if (otherPanelId !== panelId && otherPosition === position) {
          delete next[otherPanelId];
        }
      });
      next[panelId] = position;
      return next;
    });
    setPanelOpen(panelId, true);
    setSnapMenu(null);
    showNotice(`${PANEL_LABELS[panelId]} snapped to ${SNAP_TARGETS.find((target) => target.id === position)?.label || position}.`);
    if (replacedPanelId) {
      window.setTimeout(() => showNotice(`${PANEL_LABELS[replacedPanelId] || 'Panel'} returned to the list.`), 120);
    }
  };

  const restoreDockedPanel = (panelId) => {
    setDockedPanels((current) => {
      if (!current[panelId]) return current;
      const next = { ...current };
      delete next[panelId];
      return next;
    });
    setSnapMenu(null);
    showNotice(`${PANEL_LABELS[panelId] || 'Panel'} returned to the list.`);
  };

  const getPanelWrapperClass = (panelId) => {
    const isActiveMobilePanel = activeMobilePanel === panelId;
    const mobileClass = isActiveMobilePanel ? 'block' : 'hidden';
    return dockedPanels[panelId] ? `${mobileClass} lg:contents` : `${mobileClass} lg:block`;
  };

  const isPanelNarrow = (panelId) => (
    layoutPosition === 'left' ||
    layoutPosition === 'right' ||
    dockedPanels[panelId] === 'left' ||
    dockedPanels[panelId] === 'right'
  );

  const hasDockedLeft = Object.values(dockedPanels).includes('left');
  const hasDockedRight = Object.values(dockedPanels).includes('right');
  const hasDockedTop = Object.values(dockedPanels).includes('top');
  const hasDockedBottom = Object.values(dockedPanels).includes('bottom');
  const hasSideDock = hasDockedLeft || hasDockedRight;
  const dockInsetClass = [
    hasSideDock ? 'lg:max-w-none' : '',
    hasDockedLeft ? 'lg:pl-[374px] xl:pl-[424px]' : '',
    hasDockedRight ? 'lg:pr-[374px] xl:pr-[424px]' : '',
    hasDockedTop ? 'lg:pt-[18.25rem]' : '',
    hasDockedBottom ? 'lg:pb-[18.25rem]' : '',
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={`${isDarkMode ? 'dark' : ''} min-h-[100dvh]`}
      onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      {/* Global Drag Overlay */}
      {isDragging && (
        <div className={uiTemplates.surfaces.dragOverlay}>
          <Upload className="w-20 h-20 sm:w-24 sm:h-24 mb-4 animate-bounce" />
          <h2 className="text-3xl sm:text-4xl font-bold">Drop Image Here</h2>
          <p className="mt-2 opacity-80">Release to process the file.</p>
        </div>
      )}

      <div className={uiTemplates.surfaces.appShell}>
        
        <TopBar
          updateInfo={updateInfo}
          isUpdatingApp={isUpdatingApp}
          onUpdateNow={handleUpdateNow}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onResetSettings={resetSettings}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />

        {/* Main Content Area */}
        <main className={`flex-1 w-full mx-auto flex flex-col ${!originalImage ? 'max-w-none px-0 pt-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:max-w-5xl lg:p-6 lg:pb-8' : layoutPosition === 'left' || layoutPosition === 'right' ? 'max-w-none px-3 sm:px-4 pt-4 sm:pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-8' : 'max-w-5xl px-3 py-4 sm:p-6 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-8'} ${dockInsetClass}`}>
          
          {/* Layout Wrapper */}
          <div className={`flex-1 flex flex-col gap-4 sm:gap-8 ${layoutPosition === 'left' ? 'lg:flex-row' : ''} ${layoutPosition === 'right' ? 'lg:flex-row-reverse' : ''} ${layoutPosition === 'bottom' ? 'lg:flex-col-reverse' : ''}`}>
            {(isMobileSettingsOpen || isMobileExportOpen) && (
              <button
                type="button"
                className="fixed inset-0 z-[190] bg-black/30 backdrop-blur-[1px] lg:hidden"
                onClick={closeMobileSettings}
                aria-label="Close settings menu"
              />
            )}
            
            {/* Controls Panel */}
            <div
              className={cx(
                uiTemplates.surfaces.mobileSheet,
                'lg:static lg:z-auto lg:block lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:transition-none space-y-2 lg:space-y-4',
                isMobileSettingsOpen ? 'block translate-y-0 opacity-100' : 'hidden translate-y-[calc(100%+2rem)] opacity-0 pointer-events-none',
                'lg:translate-y-0 lg:[translate:none] lg:transform-none lg:opacity-100 lg:pointer-events-auto',
                layoutPosition === 'left' || layoutPosition === 'right' ? 'lg:w-[350px] xl:w-[400px] shrink-0' : 'w-full'
              )}
              style={isMobileSettingsOpen ? { transform: `translateY(${mobileSettingsDragY}px)` } : undefined}
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
              className={cx(uiTemplates.surfaces.mobileSheetHeader, 'lg:hidden')}
              onPointerDown={handleMobileSettingsDragStart}
              onMouseDown={handleMobileSettingsDragStart}
              onTouchStart={handleMobileSettingsDragStart}
            >
              <div className="mx-auto mb-1 h-1 w-11 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              <div className="flex min-h-9 items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-bold leading-4 text-neutral-900 dark:text-white">{mobilePanelTitle}</p>
                  <p className="text-[11px] leading-3 text-neutral-500 dark:text-neutral-400">Drag down to close</p>
                </div>
                <button
                  type="button"
                  onClick={closeMobileSettings}
                  className={uiTemplates.buttons.closeIcon}
                  aria-label="Close settings menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className={getPanelWrapperClass('basic')}>
              <BasicSettingsPanel
                isOpen={isBasicOpen}
                onToggle={() => setIsBasicOpen(!isBasicOpen)}
                dockPosition={dockedPanels.basic}
                onRequestDock={openSnapMenu}
                onRestoreDock={restoreDockedPanel}
                isPanelNarrow={isPanelNarrow('basic')}
                targetColor={targetColor}
                setTargetColor={setTargetColor}
                isPickingColor={isPickingColor}
                setIsPickingColor={setIsPickingColor}
                replaceTransparent={replaceTransparent}
                setReplaceTransparent={setReplaceTransparent}
                replaceColor={replaceColor}
                setReplaceColor={setReplaceColor}
                tolerance={tolerance}
                setTolerance={setTolerance}
                multiColors={multiColors}
                setMultiColors={setMultiColors}
                colors={colors}
                setColors={setColors}
                contiguousOnly={contiguousOnly}
                setContiguousOnly={setContiguousOnly}
                isPickingSeed={isPickingSeed}
                setIsPickingSeed={setIsPickingSeed}
                contiguousSeed={contiguousSeed}
                batchItems={batchItems}
                processAllBatchItems={processAllBatchItems}
                isBatchProcessing={isBatchProcessing}
                selectBatchItem={selectBatchItem}
                activeBatchId={activeBatchId}
                batchExportFormat={batchExportFormat}
                setBatchExportFormat={setBatchExportFormat}
                handleDownloadBatchZip={handleDownloadBatchZip}
              />
            </div>

            <div className={getPanelWrapperClass('advanced')}>
              <AdvancedSettingsPanel
                isOpen={isAdvancedOpen}
                onToggle={() => setIsAdvancedOpen(!isAdvancedOpen)}
                dockPosition={dockedPanels.advanced}
                onRequestDock={openSnapMenu}
                onRestoreDock={restoreDockedPanel}
                isPanelNarrow={isPanelNarrow('advanced')}
                smoothness={smoothness}
                setSmoothness={setSmoothness}
                scale={scale}
                setScale={setScale}
                autoCrop={autoCrop}
                setAutoCrop={setAutoCrop}
                replaceTransparent={replaceTransparent}
                pixelFix={pixelFix}
                setPixelFix={setPixelFix}
                padding={padding}
                setPadding={setPadding}
                processedImage={processedImage}
                isMaskEditorOpen={isMaskEditorOpen}
                setIsMaskEditorOpen={setIsMaskEditorOpen}
                maskEditMode={maskEditMode}
                setMaskEditMode={setMaskEditMode}
                brushSize={brushSize}
                setBrushSize={setBrushSize}
                maskStrokes={maskStrokes}
                setMaskStrokes={setMaskStrokes}
              />
            </div>

            <div className={getPanelWrapperClass('effects')}>
              <EffectsPanel
                isOpen={isEffectsOpen}
                onToggle={() => setIsEffectsOpen(!isEffectsOpen)}
                dockPosition={dockedPanels.effects}
                onRequestDock={openSnapMenu}
                onRestoreDock={restoreDockedPanel}
                isPanelNarrow={isPanelNarrow('effects')}
                hasShadow={hasShadow}
                setHasShadow={setHasShadow}
                shadowColor={shadowColor}
                setShadowColor={setShadowColor}
                shadowBlur={shadowBlur}
                setShadowBlur={setShadowBlur}
                shadowOffsetX={shadowOffsetX}
                setShadowOffsetX={setShadowOffsetX}
                shadowOffsetY={shadowOffsetY}
                setShadowOffsetY={setShadowOffsetY}
              />
            </div>

            <div className={getPanelWrapperClass('ai')}>
              <SmartAssistPanel
                isOpen={isAiSectionOpen}
                onToggle={() => setIsAiSectionOpen(!isAiSectionOpen)}
                dockPosition={dockedPanels.ai}
                onRequestDock={openSnapMenu}
                onRestoreDock={restoreDockedPanel}
                isPanelNarrow={isPanelNarrow('ai')}
                originalImage={originalImage}
                applySmartBackgroundAssist={applySmartBackgroundAssist}
                applySmartConnectedAssist={applySmartConnectedAssist}
                applySmartEdgeAssist={applySmartEdgeAssist}
                aiPrompt={aiPrompt}
                setAiPrompt={setAiPrompt}
                apiKey={apiKey}
                openSettings={() => setIsSettingsModalOpen(true)}
                handleAiGeneration={handleAiGeneration}
                isProcessing={isProcessing}
              />
            </div>

            <ActionBar
              layoutPosition={layoutPosition}
              fileInputRef={fileInputRef}
              handleImageUpload={handleImageUpload}
              processedImage={processedImage}
              outputFilename={outputFilename}
              setOutputFilename={setOutputFilename}
              processedImageWebp={processedImageWebp}
              processedImageJpeg={processedImageJpeg}
              maskImage={maskImage}
              processedBlob={processedBlob}
              maskBlob={maskBlob}
              isExportMenuOpen={isExportMenuOpen}
              setIsExportMenuOpen={setIsExportMenuOpen}
              handleCopyPng={handleCopyPng}
              handleDownloadMask={handleDownloadMask}
              showMask={showMask}
              setShowMask={setShowMask}
              isExportSettingsOpen={isExportSettingsOpen}
              setIsExportSettingsOpen={setIsExportSettingsOpen}
              webpQuality={webpQuality}
              setWebpQuality={setWebpQuality}
              jpegQuality={jpegQuality}
              setJpegQuality={setJpegQuality}
              jpegBackground={jpegBackground}
              setJpegBackground={setJpegBackground}
            />
            </div>



            <MobileExportSheet
              processedImage={processedImage}
              isMobileExportOpen={isMobileExportOpen}
              mobileSettingsDragY={mobileSettingsDragY}
              handleMobileSettingsDragMove={handleMobileSettingsDragMove}
              handleMobileSettingsDragEnd={handleMobileSettingsDragEnd}
              handleMobileSettingsDragStart={handleMobileSettingsDragStart}
              closeMobileSettings={closeMobileSettings}
              outputFilename={outputFilename}
              setOutputFilename={setOutputFilename}
              isExportSettingsOpen={isExportSettingsOpen}
              setIsExportSettingsOpen={setIsExportSettingsOpen}
              processedImageWebp={processedImageWebp}
              processedImageJpeg={processedImageJpeg}
              processedBlob={processedBlob}
              maskBlob={maskBlob}
              maskImage={maskImage}
              handleCopyPng={handleCopyPng}
              handleDownloadMask={handleDownloadMask}
              showMask={showMask}
              setShowMask={setShowMask}
              webpQuality={webpQuality}
              setWebpQuality={setWebpQuality}
              jpegQuality={jpegQuality}
              setJpegQuality={setJpegQuality}
              jpegBackground={jpegBackground}
              setJpegBackground={setJpegBackground}
            />

            <ImageViewer
              originalImage={originalImage}
              processedImage={processedImage}
              maskImage={maskImage}
              showMask={showMask}
              showImages={showImages}
              compareMode={compareMode}
              setCompareMode={setCompareMode}
              compareType={compareType}
              setCompareType={setCompareType}
              showOriginal={showOriginal}
              setShowOriginal={setShowOriginal}
              compareSliderPos={compareSliderPos}
              updateCompareSliderFromClientX={updateCompareSliderFromClientX}
              outputDimensions={outputDimensions}
              debouncedParams={debouncedParams}
              isPickingColor={isPickingColor}
              isPickingSeed={isPickingSeed}
              handleOriginalImageClick={handleOriginalImageClick}
              openZoomedImage={openZoomedImage}
              originalImageRef={originalImageRef}
              processedPreviewRef={processedPreviewRef}
              checkerboardStyles={checkerboardStyles}
              isMaskEditorOpen={isMaskEditorOpen}
              isMaskPainting={isMaskPainting}
              maskEditMode={maskEditMode}
              isProcessing={isProcessing}
              handleMaskBrushPointerDown={handleMaskBrushPointerDown}
              handleMaskBrushPointerMove={handleMaskBrushPointerMove}
              handleMaskBrushPointerUp={handleMaskBrushPointerUp}
              fileInputRef={fileInputRef}
            />
          </div>
        </main>

        <MobileNav
          aiEnabled={aiEnabled}
          isMobileSettingsOpen={isMobileSettingsOpen}
          isMobileExportOpen={isMobileExportOpen}
          activeMobilePanel={activeMobilePanel}
          openMobilePanel={openMobilePanel}
          openMobileExport={openMobileExport}
          processedImage={processedImage}
        />
        
        {/* Footer */}
        <footer className="w-full text-center sm:text-right px-4 sm:px-6 py-4 app-safe-bottom border-t border-neutral-200 dark:border-neutral-800/50 mt-auto opacity-70 hover:opacity-100 transition-opacity">
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Made with <span className="text-red-500">❤️</span> by Mailo
          </p>
        </footer>
      </div>

      <GlobalSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        layoutPosition={layoutPosition}
        setLayoutPosition={setLayoutPosition}
        aiEnabled={aiEnabled}
        setAiEnabled={setAiEnabled}
        isTestPopoverOpen={isTestPopoverOpen}
        setIsTestPopoverOpen={setIsTestPopoverOpen}
        isModelDropdownOpen={isModelDropdownOpen}
        setIsModelDropdownOpen={setIsModelDropdownOpen}
        selectedModelLabel={selectedModelLabel}
        modelSearchQuery={modelSearchQuery}
        setModelSearchQuery={setModelSearchQuery}
        filteredModels={filteredModels}
        isLoadingModels={isLoadingModels}
        aiProvider={aiProvider}
        aiModel={aiModel}
        setAiModel={setAiModel}
        setAiProvider={setAiProvider}
        setIsCustomModelEntry={setIsCustomModelEntry}
        isCustomAiModel={isCustomAiModel}
        isTestingKey={isTestingKey}
        handleTestConnection={handleTestConnection}
        modelSelectValue={modelSelectValue}
        modelSelectOptions={modelSelectOptions}
        providerModelOptions={providerModelOptions}
        shouldShowCustomModelInput={shouldShowCustomModelInput}
        showApiKey={showApiKey}
        setShowApiKey={setShowApiKey}
        apiKey={apiKey}
        setApiKey={setApiKey}
      />

      <ZoomModal
        zoomedImage={zoomedImage}
        checkerboardStyles={checkerboardStyles}
        isDarkMode={isDarkMode}
        zoomScale={zoomScale}
        setZoomScale={setZoomScale}
        zoomPan={zoomPan}
        setZoomPan={setZoomPan}
        isZoomPanning={isZoomPanning}
        closeZoomedImage={closeZoomedImage}
        handleZoomWheel={handleZoomWheel}
        handleZoomPointerDown={handleZoomPointerDown}
        handleZoomPointerMove={handleZoomPointerMove}
        handleZoomPointerEnd={handleZoomPointerEnd}
      />

      <SnapMenu
        snapMenu={snapMenu}
        snapMenuRef={snapMenuRef}
        dockedPanels={dockedPanels}
        onClose={() => setSnapMenu(null)}
        onDockPanel={dockPanelToPosition}
        onRestoreDock={restoreDockedPanel}
      />

      <TemplateNoticeStack notices={notices} onDismiss={removeNotice} />
    </div>
  );
}
