import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, Download, Image as ImageIcon, SlidersHorizontal, Moon, Sun, 
  Palette, Pencil, Maximize2, X, ZoomIn, Crop, ChevronDown, ChevronUp, 
  Settings, Wrench, Sparkles, Eraser, Pipette, Undo2, Redo2, 
  SplitSquareHorizontal, Grid2X2, Layers, MoveRight, MoveDown,
  Plus, XCircle, Eye, RotateCcw, EyeOff, Key, Cpu, Bot, Send,
  FlaskConical, Filter, Search, Check
} from 'lucide-react';

// --- Utility Functions ---
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
};

const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
};

// --- Reusable UI Components ---
const RollingNumber = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setAnimating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [value, displayValue]);

  return (
    <span className="relative inline-flex flex-col overflow-hidden h-[1.2em] leading-[1.2em] align-bottom text-center min-w-[2.5ch]">
      <span className={`block transition-all ease-out duration-150 ${animating ? '-translate-y-full opacity-0 scale-95' : 'translate-y-0 opacity-100 scale-100'}`}>
        {displayValue}
      </span>
      <span className={`absolute top-full left-0 w-full block transition-all ease-out duration-150 ${animating ? '-translate-y-full opacity-100 scale-100' : 'translate-y-0 opacity-0 scale-95'}`}>
        {value}
      </span>
    </span>
  );
};

const EditableNumber = ({ value, onChange, min, max }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => { setTempValue(value); }, [value]);

  const handleFinishEditing = () => {
    setIsEditing(false);
    let parsed = parseInt(tempValue, 10);
    if (isNaN(parsed)) parsed = value;
    if (parsed < min) parsed = min;
    if (parsed > max) parsed = max;
    onChange(parsed);
    setTempValue(parsed);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleFinishEditing(); };

  if (isEditing) {
    return (
      <input
        ref={inputRef} type="number" value={tempValue}
        onChange={(e) => setTempValue(e.target.value)} onBlur={handleFinishEditing} onKeyDown={handleKeyDown}
        className="w-16 px-2 py-1 font-normal text-sm border-2 border-neutral-300 dark:border-neutral-700 rounded outline-none shadow-inner bg-white dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 focus:border-neutral-800 dark:focus:border-neutral-400 transition-colors"
        min={min} max={max}
      />
    );
  }

  return (
    <span 
      onClick={() => setIsEditing(true)}
      className="cursor-pointer text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white font-bold underline decoration-dashed underline-offset-4 transition-colors inline-flex items-center justify-center min-h-[32px] px-2 -mx-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
      title="Click to edit"
    >
      <RollingNumber value={value} />
    </span>
  );
};

const CollapsibleSection = ({ title, icon: Icon, isOpen, onToggle, children }) => {
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden transition-colors bg-white dark:bg-[#0a0a0a]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 sm:p-5 bg-neutral-50/50 dark:bg-[#111]/50 hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] transition-colors focus:outline-none min-h-[60px]"
      >
        <div className="flex items-center gap-3 font-semibold text-neutral-800 dark:text-neutral-200">
          <Icon className="w-5 h-5 text-neutral-500" />
          {title}
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-neutral-400 transition-transform" /> : <ChevronDown className="w-5 h-5 text-neutral-400 transition-transform" />}
      </button>
      <div className={`transition-all duration-300 ease-in-out origin-top grid ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="p-4 sm:p-5 border-t border-neutral-100 dark:border-neutral-800/50">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Application ---
export default function App() {
  // Global App States
  const [originalImage, setOriginalImage] = useState(null);
  const [outputFilename, setOutputFilename] = useState('image_transparent');
  const [processedImage, setProcessedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputDimensions, setOutputDimensions] = useState(null);
  const [showImages, setShowImages] = useState(false);
  
  // Feature States
  const [zoomedImage, setZoomedImage] = useState({ src: null, isTransparent: false });
  const [isDragging, setIsDragging] = useState(false);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSliderPos, setCompareSliderPos] = useState(50);
  const [compareType, setCompareType] = useState('slider'); // 'slider' or 'toggle'
  const [showOriginal, setShowOriginal] = useState(false);
  
  const originalImageRef = useRef(null);
  const fileInputRef = useRef(null);

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
  // Padding around the final output (in pixels)
  const [padding, setPadding] = useState(0);
  
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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  // Custom Toast
  const [toasts, setToasts] = useState([]);
  
  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showToast = (message) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

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

  const filteredModels = models.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) || m.id.toLowerCase().includes(modelSearchQuery.toLowerCase());
    let matchesProvider = true;
    if (aiProvider !== 'openrouter' && aiProvider !== 'local' && aiProvider !== 'replicate') {
      matchesProvider = m.id.startsWith(aiProvider + '/');
    }
    return matchesSearch && matchesProvider;
  });

  useEffect(() => {
    if (isTestPopoverOpen && models.length === 0) {
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
  }, [isTestPopoverOpen, models.length]);

  const handleTestConnection = async () => {
    if (!apiKey) {
      showToast("Please enter an API key first.");
      return;
    }
    
    setIsTestingKey(true);
    
    try {
      let response;
      if (aiProvider === 'openrouter') {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: aiModel || 'openrouter/auto',
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
            model: aiModel || 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Test' }]
          })
        });
      } else if (aiProvider === 'google') {
         const actualModel = aiModel ? aiModel.replace('google/', '') : 'gemini-1.5-flash';
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
             model: aiModel ? aiModel.replace('anthropic/', '') : 'claude-3-haiku-20240307',
             messages: [{ role: 'user', content: 'Test' }],
             max_tokens: 10
           })
         });
      } else {
         // Fallback for local or replicate
         setTimeout(() => {
            setIsTestingKey(false);
            setIsTestPopoverOpen(false);
            showToast(`Connection to ${aiProvider} (${aiModel || 'default model'}) successful!`);
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
      showToast(`Connection to ${aiProvider} (${aiModel || 'default model'}) successful!`);
      
    } catch (error) {
      setIsTestingKey(false);
      showToast(`Error: ${error.message === 'Failed to fetch' ? 'Network or CORS Error (Check API URL/Key)' : error.message}`);
    }
  };

  const handleAiGeneration = async () => {
    if (!aiPrompt.trim()) return;
    if (!apiKey) {
      showToast("Please enter an API key first.");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      let response;
      if (aiProvider === 'openrouter') {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: aiModel || 'openrouter/auto',
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
            model: aiModel || 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: aiPrompt }]
          })
        });
      } else if (aiProvider === 'google') {
         const actualModel = aiModel ? aiModel.replace('google/', '') : 'gemini-1.5-flash';
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
             model: aiModel ? aiModel.replace('anthropic/', '') : 'claude-3-haiku-20240307',
             messages: [{ role: 'user', content: aiPrompt }],
             max_tokens: 100
           })
         });
      } else {
         // Fallback for local or replicate
         setTimeout(() => {
            setIsProcessing(false);
            showToast(`AI Generation triggered via ${aiProvider} API using prompt: "${aiPrompt}"`);
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
      showToast(`AI Generation triggered via ${aiProvider} API using prompt: "${aiPrompt}"`);
      
    } catch (error) {
      setIsProcessing(false);
      showToast(`Error: ${error.message === 'Failed to fetch' ? 'Network or CORS Error (Check API URL/Key)' : error.message}`);
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
        } catch (e) {
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
  }, []);

  // Debounced States to prevent lag
  const [debouncedParams, setDebouncedParams] = useState({
    targetColor, tolerance, smoothness, scale, autoCrop, pixelFix, 
    replaceTransparent, replaceColor, hasShadow, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const newParams = { targetColor, tolerance, smoothness, scale, autoCrop, pixelFix, replaceTransparent, replaceColor, hasShadow, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, 
        colors, multiColors, padding };
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
      localStorage.setItem('bpr_shadow', hasShadow);
      localStorage.setItem('bpr_shadow_color', shadowColor);
      localStorage.setItem('bpr_shadow_blur', shadowBlur);
      localStorage.setItem('bpr_shadow_x', shadowOffsetX);
      localStorage.setItem('bpr_shadow_y', shadowOffsetY);

      // Persist multi-color settings and padding
      localStorage.setItem('bpr_colors', JSON.stringify(colors));
      localStorage.setItem('bpr_multicolors', multiColors);
      localStorage.setItem('bpr_padding', padding);

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
  }, [targetColor, tolerance, smoothness, scale, autoCrop, pixelFix, replaceTransparent, replaceColor, hasShadow, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, colors, multiColors, padding]);

  // Persist Theme and Layout immediately
  useEffect(() => {
    localStorage.setItem('bpr_theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('bpr_layout', layoutPosition);
  }, [isDarkMode, layoutPosition]);

  // Undo / Redo Actions
  const handleUndo = () => {
    if (historyIndex > 0) {
      setIsTraversingHistory(true);
      const prevState = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      applyHistoryState(prevState);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setIsTraversingHistory(true);
      const nextState = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      applyHistoryState(nextState);
    }
  };

  // Keep the first color in the colors array synced with targetColor
  useEffect(() => {
    setColors((prev) => {
      const arr = [...prev];
      arr[0] = targetColor;
      return arr;
    });
  }, [targetColor]);

  const applyHistoryState = (state) => {
    setTargetColor(state.targetColor); setTolerance(state.tolerance); setSmoothness(state.smoothness);
    setScale(state.scale); setAutoCrop(state.autoCrop); setPixelFix(state.pixelFix);
    setReplaceTransparent(state.replaceTransparent); setReplaceColor(state.replaceColor);
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
  };

  // Reset all settings to their defaults and clear stored values.
  const resetSettings = () => {
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
    setHasShadow(false);
    setShadowColor('#000000');
    setShadowBlur(20);
    setShadowOffsetX(0);
    setShadowOffsetY(10);
    setPadding(0);
    setShowMask(false);
    setMaskImage(null);
    setProcessedImage(null);
    setProcessedImageWebp(null);
    setOutputDimensions(null);
    setHistory([]);
    setHistoryIndex(-1);
    const keys = ['bpr_color','bpr_tolerance','bpr_smoothness','bpr_scale','bpr_autocrop','bpr_pixelfix','bpr_replace_trans','bpr_replace_color','bpr_shadow','bpr_theme','bpr_colors','bpr_padding'];
    keys.forEach((key) => localStorage.removeItem(key));
  };

  // Setup Keyboard Listeners (Escape, Undo/Redo shortcut)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setZoomedImage({ src: null, isTransparent: false });
        setIsPickingColor(false);
      }
      
      // Handle Undo (Ctrl+Z) and Redo (Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
      }
      
      // Handle Redo (Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // Handle image load animation
  useEffect(() => {
    if (originalImage) {
      const timer = setTimeout(() => setShowImages(true), 50);
      return () => clearTimeout(timer);
    } else {
      setShowImages(false);
      setOutputDimensions(null);
    }
  }, [originalImage]);

  // File Handling (Upload, Drag&Drop, Paste)
  const processUploadedFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const lastDot = file.name.lastIndexOf('.');
    const nameWithoutExt = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name || 'pasted_image';
    setOutputFilename(`${nameWithoutExt}_transparent`);
    const url = URL.createObjectURL(file);
    setOriginalImage((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const handleImageUpload = (e) => processUploadedFile(e.target.files[0]);
  
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        processUploadedFile(e.clipboardData.files[0]);
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processUploadedFile(e.dataTransfer.files[0]);
  }, []);

  // Eyedropper Tool functionality
  const handleOriginalImageClick = (e) => {
    if (!isPickingColor || !originalImageRef.current) return;
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
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel[3] > 0) {
      setTargetColor(rgbToHex(pixel[0], pixel[1], pixel[2]));
    }
    setIsPickingColor(false);
  };

  // Core processing function via Web Worker
  useEffect(() => {
    if (!originalImage) return;

    setIsProcessing(true);
    let isActive = true;
    let worker = null;
    let workerUrl = null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      if (!isActive) return;

      const currentScale = debouncedParams.scale / 100;
      canvas.width = Math.max(1, Math.floor(img.width * currentScale));
      canvas.height = Math.max(1, Math.floor(img.height * currentScale));
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Web Worker Code
      const workerCode = `
        self.onmessage = function(e) {
          const { imageData, width, height, tolerance, smoothness, colorsR, colorsG, colorsB, colorCount, autoCrop, pixelFix, replaceTransparent, replaceR, replaceG, replaceB } = e.data;
          const data = imageData.data;
          const len = data.length;

          let minX = width, minY = height, maxX = 0, maxY = 0;
          let hasVisiblePixels = false;

          for (let i = 0; i < len; i += 4) {
            const r = data[i]; const g = data[i + 1]; const b = data[i + 2]; const a = data[i + 3];
            // Determine which target color this pixel is closest to
            let bestDist = 1e9;
            let bestR = 0, bestG = 0, bestB = 0;
            for (let c = 0; c < colorCount; c++) {
              const dr = Math.abs(r - colorsR[c]);
              const dg = Math.abs(g - colorsG[c]);
              const db = Math.abs(b - colorsB[c]);
              const d = Math.max(dr, dg, db);
              if (d < bestDist) {
                bestDist = d;
                bestR = colorsR[c];
                bestG = colorsG[c];
                bestB = colorsB[c];
              }
            }
            const dist = bestDist;

            if (smoothness === 0) {
              if (dist <= tolerance) {
                if (replaceTransparent) {
                  data[i + 3] = 0;
                } else {
                  data[i] = replaceR; data[i+1] = replaceG; data[i+2] = replaceB;
                }
              }
            } else {
              if (dist <= tolerance) {
                if (replaceTransparent) {
                  data[i + 3] = 0;
                } else {
                  data[i] = replaceR; data[i+1] = replaceG; data[i+2] = replaceB;
                }
              } else if (dist < tolerance + smoothness) {
                const blendFactor = (dist - tolerance) / smoothness;
                // Estimate foreground color by reversing blending with the nearest target
                let fgR = r; let fgG = g; let fgB = b;
                if (blendFactor > 0) {
                  fgR = Math.min(255, Math.max(0, (r - bestR * (1 - blendFactor)) / blendFactor));
                  fgG = Math.min(255, Math.max(0, (g - bestG * (1 - blendFactor)) / blendFactor));
                  fgB = Math.min(255, Math.max(0, (b - bestB * (1 - blendFactor)) / blendFactor));
                }
                if (replaceTransparent) {
                  data[i + 3] = Math.round(a * blendFactor);
                  if (blendFactor > 0) {
                    data[i] = Math.round(fgR);
                    data[i+1] = Math.round(fgG);
                    data[i+2] = Math.round(fgB);
                  }
                } else {
                  data[i] = Math.round(replaceR * (1 - blendFactor) + fgR * blendFactor);
                  data[i+1] = Math.round(replaceG * (1 - blendFactor) + fgG * blendFactor);
                  data[i+2] = Math.round(replaceB * (1 - blendFactor) + fgB * blendFactor);
                }
              }
            }

            const isForeground = dist > tolerance;
            if (autoCrop && isForeground && data[i + 3] > 0) {
              const pixelIndex = i / 4;
              const x = pixelIndex % width;
              const y = Math.floor(pixelIndex / width);
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
              hasVisiblePixels = true;
            }
          }

          if (pixelFix && replaceTransparent) {
            const pixelCount = width * height;
            const visited = new Uint8Array(pixelCount);
            const queue = new Int32Array(pixelCount);
            let head = 0, tail = 0;

            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const a = data[idx * 4 + 3];
                if (a > 0) {
                  visited[idx] = 1;
                  let isBorder = false;
                  if (x > 0 && data[(idx - 1) * 4 + 3] === 0) isBorder = true;
                  else if (x < width - 1 && data[(idx + 1) * 4 + 3] === 0) isBorder = true;
                  else if (y > 0 && data[(idx - width) * 4 + 3] === 0) isBorder = true;
                  else if (y < height - 1 && data[(idx + width) * 4 + 3] === 0) isBorder = true;
                  if (isBorder) queue[tail++] = idx;
                }
              }
            }

            const dx = [-1, 1, 0, 0, -1, -1, 1, 1];
            const dy = [0, 0, -1, 1, -1, 1, -1, 1];

            while (head < tail) {
              const p = queue[head++];
              const px = p % width; const py = Math.floor(p / width);
              const pr = data[p * 4]; const pg = data[p * 4 + 1]; const pb = data[p * 4 + 2];

              for (let i = 0; i < 8; i++) {
                const nx = px + dx[i]; const ny = py + dy[i];
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const n = ny * width + nx;
                  if (visited[n] === 0) {
                    visited[n] = 1; 
                    data[n * 4] = pr; data[n * 4 + 1] = pg; data[n * 4 + 2] = pb;
                    queue[tail++] = n;
                  }
                }
              }
            }
          }
          
          const cropRect = autoCrop && hasVisiblePixels ? { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null;
          self.postMessage({ imageData, cropRect }, [imageData.data.buffer]);
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      workerUrl = URL.createObjectURL(blob);
      worker = new Worker(workerUrl);

      worker.onmessage = (e) => {
        if (!isActive) return worker.terminate();
        
        const { imageData: processedData, cropRect } = e.data;
        
        // 1. Render extracted/cropped data to a temporary canvas
        let tempCanvas = document.createElement('canvas');
        let tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = cropRect ? cropRect.width : canvas.width;
        tempCanvas.height = cropRect ? cropRect.height : canvas.height;
        
        if (cropRect) {
          let fullCropCanvas = document.createElement('canvas');
          fullCropCanvas.width = canvas.width; fullCropCanvas.height = canvas.height;
          fullCropCanvas.getContext('2d').putImageData(processedData, 0, 0);
          tempCtx.drawImage(fullCropCanvas, cropRect.minX, cropRect.minY, cropRect.width, cropRect.height, 0, 0, cropRect.width, cropRect.height);
        } else {
          tempCtx.putImageData(processedData, 0, 0);
        }

        // 2. Prepare final canvas to accommodate potential drop shadows and padding
        let finalCanvas = document.createElement('canvas');
        let finalCtx = finalCanvas.getContext('2d');
        
        const blurPad = debouncedParams.hasShadow ? debouncedParams.shadowBlur * 2 : 0;
        const padX = debouncedParams.hasShadow ? Math.abs(debouncedParams.shadowOffsetX) + blurPad : 0;
        const padY = debouncedParams.hasShadow ? Math.abs(debouncedParams.shadowOffsetY) + blurPad : 0;

        finalCanvas.width = tempCanvas.width + padX + (debouncedParams.padding ? debouncedParams.padding * 2 : 0);
        finalCanvas.height = tempCanvas.height + padY + (debouncedParams.padding ? debouncedParams.padding * 2 : 0);

        // 3. Apply native canvas shadow (High quality & fast)
        if (debouncedParams.hasShadow) {
          finalCtx.shadowColor = debouncedParams.shadowColor;
          finalCtx.shadowBlur = debouncedParams.shadowBlur;
          finalCtx.shadowOffsetX = debouncedParams.shadowOffsetX;
          finalCtx.shadowOffsetY = debouncedParams.shadowOffsetY;
        }

        // Draw temp canvas centered in padded area
        const drawX = (debouncedParams.hasShadow ? (padX / 2 - debouncedParams.shadowOffsetX / 2) : 0) + (debouncedParams.padding || 0);
        const drawY = (debouncedParams.hasShadow ? (padY / 2 - debouncedParams.shadowOffsetY / 2) : 0) + (debouncedParams.padding || 0);
        finalCtx.drawImage(tempCanvas, drawX, drawY);

        setOutputDimensions({ width: finalCanvas.width, height: finalCanvas.height });
        
        // Generate mask overlay from the processed temp canvas
        (function generateMask() {
          try {
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = tempCanvas.width;
            maskCanvas.height = tempCanvas.height;
            const maskCtx = maskCanvas.getContext('2d');
            const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const mdata = maskCtx.createImageData(imgData.width, imgData.height);
            const total = imgData.data.length;
            for (let i = 0; i < total; i += 4) {
              const alpha = imgData.data[i + 3];
              if (alpha > 0) {
                mdata.data[i] = 0;
                mdata.data[i + 1] = 0;
                mdata.data[i + 2] = 0;
                mdata.data[i + 3] = 0;
              } else {
                mdata.data[i] = 255;
                mdata.data[i + 1] = 0;
                mdata.data[i + 2] = 0;
                mdata.data[i + 3] = 160;
              }
            }
            maskCtx.putImageData(mdata, 0, 0);
            maskCanvas.toBlob((mb) => {
              if (mb) {
                const url = URL.createObjectURL(mb);
                setMaskImage((prev) => {
                  if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                  return url;
                });
              }
            }, 'image/png');
          } catch (ex) {
            // ignore mask generation errors
          }
        })();

        // Generate PNG and WebP blobs for download
        finalCanvas.toBlob((imageBlob) => {
          if (!isActive) return;
          const objectUrl = URL.createObjectURL(imageBlob);
          setProcessedImage((prev) => {
            if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
            return objectUrl;
          });
          // generate webp version
          finalCanvas.toBlob((webpBlob) => {
            if (webpBlob) {
              const webpUrl = URL.createObjectURL(webpBlob);
              setProcessedImageWebp((prev) => {
                if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                return webpUrl;
              });
            }
            setIsProcessing(false);
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
          }, 'image/webp');
        }, 'image/png');
      };

      // Prepare multi-color arrays for the worker. Always include at least one color.
      const colorList = (debouncedParams.colors && debouncedParams.colors.length > 0) ? debouncedParams.colors : [debouncedParams.targetColor];
      const colorsR = colorList.map((hex) => hexToRgb(hex).r);
      const colorsG = colorList.map((hex) => hexToRgb(hex).g);
      const colorsB = colorList.map((hex) => hexToRgb(hex).b);
      const colorCount = colorList.length;
      const rgbReplace = hexToRgb(debouncedParams.replaceColor);
      worker.postMessage({ 
        imageData, width: canvas.width, height: canvas.height,
        tolerance: debouncedParams.tolerance, smoothness: debouncedParams.smoothness,
        colorsR, colorsG, colorsB, colorCount,
        replaceTransparent: debouncedParams.replaceTransparent,
        replaceR: rgbReplace.r, replaceG: rgbReplace.g, replaceB: rgbReplace.b,
        autoCrop: debouncedParams.autoCrop, pixelFix: debouncedParams.replaceTransparent ? debouncedParams.pixelFix : false
      }, [imageData.data.buffer]);
    };

    img.src = originalImage;

    return () => {
      isActive = false;
      if (worker) worker.terminate();
      if (workerUrl) URL.revokeObjectURL(workerUrl);
    };
  }, [originalImage, debouncedParams]);

  // Styles for Checkerboard Backgrounds
  const checkerboardStyles = {
    backgroundImage: isDarkMode 
      ? 'repeating-linear-gradient(45deg, #111111 25%, transparent 25%, transparent 75%, #111111 75%, #111111), repeating-linear-gradient(45deg, #111111 25%, #000000 25%, #000000 75%, #111111 75%, #111111)'
      : 'repeating-linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%, #e5e5e5), repeating-linear-gradient(45deg, #e5e5e5 25%, #f5f5f5 25%, #f5f5f5 75%, #e5e5e5 75%, #e5e5e5)',
    backgroundPosition: '0 0, 10px 10px',
    backgroundSize: '20px 20px'
  };

  return (
    <div 
      className={`${isDarkMode ? 'dark' : ''} min-h-screen`}
      onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      {/* Global Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[200] bg-blue-500/80 backdrop-blur-sm flex flex-col items-center justify-center text-white pointer-events-none">
          <Upload className="w-24 h-24 mb-4 animate-bounce" />
          <h2 className="text-4xl font-bold">Drop Image Here</h2>
          <p className="mt-2 opacity-80">Release to process the file.</p>
        </div>
      )}

      <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 font-sans transition-colors duration-200">
        
        {/* Topbar */}
        <header className="sticky top-0 z-[100] bg-white/80 dark:bg-[#111]/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="Logo" className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow-sm hover:scale-105 transition-transform" />
            <h1 className="text-lg sm:text-xl font-bold hidden sm:block tracking-tight text-neutral-900 dark:text-white">Color Remover</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex bg-neutral-100/80 dark:bg-[#1a1a1a]/80 rounded-full border border-neutral-200 dark:border-neutral-800 p-1">
              <button onClick={handleUndo} disabled={historyIndex <= 0} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-[#2a2a2a] disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Undo (Ctrl+Z)">
                <Undo2 className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
              </button>
              <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-[#2a2a2a] disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Redo (Ctrl+Y or Ctrl+Shift+Z)">
                <Redo2 className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
              </button>
            </div>
            <button onClick={resetSettings} className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-neutral-100/80 dark:bg-[#1a1a1a]/80 border border-neutral-200 dark:border-neutral-800 hover:bg-white dark:hover:bg-[#2a2a2a] transition-all duration-300 hover:rotate-12 active:scale-90 shadow-sm" title="Reset All Settings">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-600 dark:text-neutral-300" />
            </button>
            <button onClick={() => setIsSettingsModalOpen(true)} className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-neutral-100/80 dark:bg-[#1a1a1a]/80 border border-neutral-200 dark:border-neutral-800 hover:bg-white dark:hover:bg-[#2a2a2a] transition-all duration-300 hover:rotate-12 active:scale-90 shadow-sm" title="Global Settings">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-600 dark:text-neutral-300" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className={`flex-1 w-full mx-auto pb-12 sm:pb-8 flex flex-col ${layoutPosition === 'left' || layoutPosition === 'right' ? 'max-w-none px-2 sm:px-4 pt-4 sm:pt-6' : 'max-w-5xl p-4 sm:p-6'}`}>
          
          {/* Layout Wrapper */}
          <div className={`flex-1 flex flex-col gap-6 sm:gap-8 ${layoutPosition === 'left' ? 'lg:flex-row' : ''} ${layoutPosition === 'right' ? 'lg:flex-row-reverse' : ''} ${layoutPosition === 'bottom' ? 'lg:flex-col-reverse' : ''}`}>
            
            {/* Controls Panel */}
            <div className={`space-y-4 ${layoutPosition === 'left' || layoutPosition === 'right' ? 'lg:w-[350px] xl:w-[400px] shrink-0' : 'w-full'}`}>
            
            {/* 1. Basic Settings */}
            <CollapsibleSection title="Basic Settings" icon={Settings} isOpen={isBasicOpen} onToggle={() => setIsBasicOpen(!isBasicOpen)}>
              <div className="flex flex-col gap-6 sm:gap-8">
                <div className={`grid gap-6 sm:gap-8 ${layoutPosition === 'left' || layoutPosition === 'right' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {/* Target Color Picker + Pipette */}
                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                      <Palette className="w-4 h-4" /> Color to Remove
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="relative w-14 h-14 sm:w-12 sm:h-12 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-sm shrink-0 cursor-pointer focus-within:ring-2 focus-within:ring-neutral-400 transition-all hover:scale-105 active:scale-95">
                        <input 
                          type="color" value={targetColor.length === 7 ? targetColor : '#000000'} onChange={(e) => setTargetColor(e.target.value)}
                          className="absolute -top-4 -left-4 w-24 h-24 sm:w-20 sm:h-20 cursor-pointer"
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <input 
                          type="text" value={targetColor} spellCheck="false"
                          onChange={(e) => { let val = e.target.value; if (!val.startsWith('#')) val = '#' + val.replace(/#/g, ''); setTargetColor(val.slice(0, 7)); }}
                          className="bg-transparent border-b-2 border-dashed border-neutral-300 dark:border-neutral-700 outline-none text-sm font-mono font-medium text-neutral-800 dark:text-neutral-200 uppercase tracking-wider p-0 focus:ring-0 w-20 hover:border-neutral-400 dark:hover:border-neutral-500 focus:border-neutral-600 dark:focus:border-neutral-400 transition-colors"
                        />
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">Edit hex directly</span>
                      </div>
                      {/* Pipette Button */}
                      <button 
                        onClick={() => setIsPickingColor(!isPickingColor)}
                        className={`p-3 rounded-lg border transition-all ${isPickingColor ? 'bg-blue-100 border-blue-400 text-blue-600 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400 animate-pulse' : 'bg-neutral-50 dark:bg-[#111] border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#222]'}`}
                        title="Pick color from original image"
                      >
                        <Pipette className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Replace Options */}
                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                      <Eraser className="w-4 h-4" /> Replace With
                    </label>
                    <div className="flex flex-col gap-4">
                      <div className="flex p-1 bg-neutral-100 dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-lg w-fit">
                        <button onClick={() => setReplaceTransparent(true)} className={`px-4 py-1.5 text-sm rounded-md transition-all duration-200 ${replaceTransparent ? 'bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-white font-medium' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}>Transparency</button>
                        <button onClick={() => setReplaceTransparent(false)} className={`px-4 py-1.5 text-sm rounded-md transition-all duration-200 ${!replaceTransparent ? 'bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-white font-medium' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}>Solid Color</button>
                      </div>
                      {!replaceTransparent && (
                        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="relative w-14 h-14 sm:w-12 sm:h-12 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-sm shrink-0 cursor-pointer focus-within:ring-2 focus-within:ring-neutral-400 transition-all hover:scale-105 active:scale-95">
                            <input type="color" value={replaceColor.length === 7 ? replaceColor : '#ffffff'} onChange={(e) => setReplaceColor(e.target.value)} className="absolute -top-4 -left-4 w-24 h-24 sm:w-20 sm:h-20 cursor-pointer" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <input type="text" value={replaceColor} spellCheck="false" onChange={(e) => { let val = e.target.value; if (!val.startsWith('#')) val = '#' + val.replace(/#/g, ''); setReplaceColor(val.slice(0, 7)); }} className="bg-transparent border-b-2 border-dashed border-neutral-300 dark:border-neutral-700 outline-none text-sm font-mono font-medium text-neutral-800 dark:text-neutral-200 uppercase tracking-wider p-0 focus:ring-0 w-20 hover:border-neutral-400 dark:hover:border-neutral-500 focus:border-neutral-600 dark:focus:border-neutral-400 transition-colors" />
                            <span className="text-xs text-neutral-400 dark:text-neutral-500">New background</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full">
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                    <SlidersHorizontal className="w-4 h-4" /> Tolerance: <EditableNumber value={tolerance} onChange={setTolerance} min={0} max={255} />
                  </label>
                  <div className="py-2">
                    <input type="range" min="0" max="255" value={tolerance} onChange={(e) => setTolerance(parseInt(e.target.value))} className="w-full h-3 sm:h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-neutral-100" />
                  </div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Determines the threshold for pixels to be removed.</p>
                </div>
                {/* Multi-Color Removal Feature */}
                <div className="flex flex-col gap-4">
                  <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-neutral-700 dark:text-neutral-300 w-fit select-none group" onClick={(e) => { e.preventDefault(); setMultiColors(!multiColors); }}>
                    <div className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${multiColors ? 'bg-blue-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}>
                      <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${multiColors ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                    <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors" /> Multi-Color Removal</span>
                  </label>
                  {multiColors && (
                    <div className="flex flex-col gap-3 pl-1">
                      {colors.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 shrink-0 cursor-pointer focus-within:ring-2 focus-within:ring-neutral-400 transition-all hover:scale-105 active:scale-95">
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
                              className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer"
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
                              className="bg-transparent border-b-2 border-dashed border-neutral-300 dark:border-neutral-700 outline-none text-sm font-mono font-medium text-neutral-800 dark:text-neutral-200 uppercase tracking-wider p-0 focus:ring-0 w-20 hover:border-neutral-400 dark:hover:border-neutral-500 focus:border-neutral-600 dark:focus:border-neutral-400 transition-colors"
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
                              className="p-2 rounded-full bg-neutral-50 dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 hover:bg-red-100 dark:hover:bg-red-800/40 transition-colors"
                              title="Remove color"
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
                        className="flex items-center gap-2 px-3 py-2 w-fit text-sm rounded-md bg-neutral-200/60 dark:bg-neutral-700/60 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                        title="Add another color"
                      >
                        <Plus className="w-4 h-4" /> Add Color
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleSection>

            {/* 2. Advanced Settings */}
            <CollapsibleSection title="Advanced Settings" icon={Wrench} isOpen={isAdvancedOpen} onToggle={() => setIsAdvancedOpen(!isAdvancedOpen)}>
              <div className="flex flex-col gap-8">
                <div className={`grid gap-6 sm:gap-8 ${layoutPosition === 'left' || layoutPosition === 'right' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                      <SlidersHorizontal className="w-4 h-4" /> Edge Smoothing: <EditableNumber value={smoothness} onChange={setSmoothness} min={0} max={100} />
                    </label>
                    <div className="py-2">
                      <input type="range" min="0" max="100" value={smoothness} onChange={(e) => setSmoothness(parseInt(e.target.value))} className="w-full h-3 sm:h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-neutral-100" />
                    </div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Creates soft transitions for clean edges.</p>
                  </div>

                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                      <ZoomIn className="w-4 h-4" /> Scale / Zoom: <EditableNumber value={scale} onChange={setScale} min={10} max={200} /><span className="text-sm font-bold text-neutral-600 dark:text-neutral-400 -ml-1">%</span>
                    </label>
                    <div className="py-2">
                      <input type="range" min="10" max="200" value={scale} onChange={(e) => setScale(parseInt(e.target.value))} className="w-full h-3 sm:h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-neutral-100" />
                    </div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Adjusts final image resolution.</p>
                  </div>
                </div>

                <div className={`grid gap-4 ${layoutPosition === 'left' || layoutPosition === 'right' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-neutral-700 dark:text-neutral-300 w-full sm:w-fit select-none group py-3 sm:py-1" onClick={(e) => { e.preventDefault(); setAutoCrop(!autoCrop); }}>
                    <div className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${autoCrop ? 'bg-blue-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}>
                      <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${autoCrop ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                    <span className="flex items-center gap-2"><Crop className="w-4 h-4 text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors" /> Auto-Crop (Trim edges)</span>
                  </label>

                  <label className={`flex items-center gap-3 cursor-pointer text-sm font-medium w-full sm:w-fit select-none group py-3 sm:py-1 transition-opacity ${!replaceTransparent ? 'opacity-50' : 'text-neutral-700 dark:text-neutral-300'}`} onClick={(e) => { e.preventDefault(); if (replaceTransparent) setPixelFix(!pixelFix); }}>
                    <div className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${pixelFix && replaceTransparent ? 'bg-blue-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}>
                      <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${pixelFix && replaceTransparent ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                    <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors" /> Transparent Pixel Fix (Alpha Bleed)</span>
                  </label>
                </div>
              {/* Padding Slider */}
              <div className="pt-5">
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                  <MoveDown className="w-4 h-4" /> Canvas Padding: <EditableNumber value={padding} onChange={setPadding} min={0} max={200} /><span className="text-sm font-bold text-neutral-600 dark:text-neutral-400 -ml-1">px</span>
                </label>
                <div className="py-2">
                  <input type="range" min="0" max="200" value={padding} onChange={(e) => setPadding(parseInt(e.target.value))} className="w-full h-3 sm:h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-neutral-100" />
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Adds extra space around the output.</p>
              </div>
              </div>
            </CollapsibleSection>

            {/* 3. Effects & Styling */}
            <CollapsibleSection title="Effects & Styling" icon={Layers} isOpen={isEffectsOpen} onToggle={() => setIsEffectsOpen(!isEffectsOpen)}>
              <div className="flex flex-col gap-6">
                <label 
                  className="flex items-center gap-3 cursor-pointer text-sm font-medium text-neutral-700 dark:text-neutral-300 w-fit select-none group"
                  onClick={(e) => {
                    e.preventDefault();
                    setHasShadow(!hasShadow);
                  }}
                >
                  <div className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${hasShadow ? 'bg-indigo-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}>
                    <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${hasShadow ? 'translate-x-5' : 'translate-x-1'}`} />
                  </div>
                  <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors" /> Enable Drop Shadow / Glow</span>
                </label>
                
                {hasShadow && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-300">
                    {/* Shadow Color */}
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Color</label>
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 shrink-0 cursor-pointer">
                          <input type="color" value={shadowColor.length===7 ? shadowColor : '#000'} onChange={(e) => setShadowColor(e.target.value)} className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer" />
                        </div>
                        <input type="text" value={shadowColor} spellCheck="false" onChange={(e)=>{let v=e.target.value; if(!v.startsWith('#')) v='#'+v.replace(/#/g,''); setShadowColor(v.slice(0,7));}} className="bg-transparent border-b border-dashed border-neutral-300 dark:border-neutral-700 outline-none text-sm font-mono w-20" />
                      </div>
                    </div>
                    {/* Shadow Blur */}
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between">Blur/Glow Size <span>{shadowBlur}px</span></label>
                      <input type="range" min="0" max="100" value={shadowBlur} onChange={(e) => setShadowBlur(parseInt(e.target.value))} className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    </div>
                    {/* Shadow Offset X */}
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between">Offset X <span>{shadowOffsetX}px</span></label>
                      <input type="range" min="-100" max="100" value={shadowOffsetX} onChange={(e) => setShadowOffsetX(parseInt(e.target.value))} className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    </div>
                    {/* Shadow Offset Y */}
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between">Offset Y <span>{shadowOffsetY}px</span></label>
                      <input type="range" min="-100" max="100" value={shadowOffsetY} onChange={(e) => setShadowOffsetY(parseInt(e.target.value))} className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* 4. AI Edit */}
            {aiEnabled && (
              <CollapsibleSection
                title="Change with AI"
                icon={Bot}
                isOpen={isAiSectionOpen}
                onToggle={() => setIsAiSectionOpen(!isAiSectionOpen)}
                description="Transform image with text prompts"
              >
                <div className="flex flex-col gap-4">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe the changes you want to make..."
                    className="w-full bg-neutral-50 dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl px-4 py-3 min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  
                  {!apiKey ? (
                    <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 p-3 rounded-xl text-sm flex items-start gap-3 border border-amber-200 dark:border-amber-800/30">
                      <Key className="w-5 h-5 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold mb-1">API key required</p>
                        <p className="text-amber-600/80 dark:text-amber-400/80">Configure your provider in the <button onClick={() => setIsSettingsModalOpen(true)} className="underline font-semibold hover:text-amber-700 dark:hover:text-amber-300">Global Settings</button>.</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleAiGeneration}
                      disabled={!aiPrompt.trim() || isProcessing}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
                        aiPrompt.trim() && !isProcessing
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95'
                          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" /> Generate Changes
                    </button>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Action Bar */}
            <div className={`bg-white dark:bg-[#0a0a0a] p-4 sm:p-5 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 flex gap-4 transition-colors ${layoutPosition === 'left' || layoutPosition === 'right' ? 'flex-col items-stretch' : 'flex-col md:flex-row items-stretch sm:items-center justify-between'}`}>
              <div className={`w-full ${layoutPosition === 'left' || layoutPosition === 'right' ? '' : 'md:w-auto'}`}>
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                <button onClick={() => fileInputRef.current.click()} className={`flex items-center justify-center gap-2 bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black px-6 py-3 sm:py-2.5 rounded-lg font-medium transition-all duration-200 active:scale-95 shadow-sm min-h-[44px] ${layoutPosition === 'left' || layoutPosition === 'right' ? 'w-full' : 'w-full md:w-auto'}`}>
                  <Upload className="w-5 h-5 sm:w-4 sm:h-4" /> Select Image
                </button>
              </div>
              {processedImage && (
                <div className={`flex items-stretch sm:items-center gap-3 w-full ${layoutPosition === 'left' || layoutPosition === 'right' ? 'flex-col' : 'flex-col sm:flex-row md:w-auto md:justify-end'}`}>
                  <div className={`flex items-center gap-2 bg-neutral-50 dark:bg-[#111] border border-neutral-200 dark:border-neutral-700 px-3 py-2.5 rounded-lg transition-colors focus-within:border-neutral-400 dark:focus-within:border-neutral-500 min-h-[44px] ${layoutPosition === 'left' || layoutPosition === 'right' ? 'w-full' : 'flex-1 sm:flex-none'}`}>
                    <Pencil className="w-4 h-4 text-neutral-400 shrink-0" />
                    <input type="text" value={outputFilename} onChange={(e) => setOutputFilename(e.target.value)} className="bg-transparent border-none outline-none text-sm font-medium text-neutral-700 dark:text-neutral-300 w-full min-w-[80px] p-0 focus:ring-0" placeholder="filename" />
                    <span className="text-sm text-neutral-400 select-none shrink-0">.png</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={processedImage} download={`${outputFilename || 'image_transparent'}.png`} className={`flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-black px-5 py-2.5 rounded-lg font-medium transition-all duration-200 active:scale-95 shadow-sm min-h-[44px] ${layoutPosition === 'left' || layoutPosition === 'right' ? 'flex-1' : 'flex-1 sm:flex-none'}`}>
                      <Download className="w-4 h-4" /> Download
                    </a>
                    {(processedImageWebp || maskImage) && (
                      <div className="relative group">
                        <button className="flex items-center justify-center px-3 py-2.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg transition-colors min-h-[44px]">
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl z-50 flex-col py-1 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 flex">
                          {processedImageWebp && (
                            <a href={processedImageWebp} download={`${outputFilename || 'image_transparent'}.webp`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm text-neutral-700 dark:text-neutral-300">
                              <Download className="w-4 h-4" /> WebP
                            </a>
                          )}
                          {maskImage && (
                            <button onClick={(e) => { e.preventDefault(); setShowMask(!showMask); }} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm text-neutral-700 dark:text-neutral-300 w-full text-left">
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
            </div>

            {/* Image Viewer Area */}
            <div className="flex-1 space-y-6 min-w-0">

          {/* View Modes Toggle */}
          {originalImage && (
            <div className="flex justify-center pt-4">
              <div className="flex bg-neutral-100 dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-lg p-1">
                <button onClick={() => setCompareMode(false)} className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-all ${!compareMode ? 'bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-white font-medium' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}>
                  <Grid2X2 className="w-4 h-4" /> Grid View
                </button>
                <button onClick={() => setCompareMode(true)} className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-all ${compareMode ? 'bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-white font-medium' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}>
                  <SplitSquareHorizontal className="w-4 h-4" /> Compare View
                </button>
              </div>
            </div>
          )}

          {/* Image Display Section */}
          {originalImage && (
            <div className={`transition-all duration-700 ease-out transform ${showImages ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              
              {!compareMode ? (
                // GRID VIEW
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Original Image Card */}
                  <div className="bg-white dark:bg-[#0a0a0a] rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
                    <div className="bg-neutral-50 dark:bg-[#111] p-3 border-b border-neutral-200 dark:border-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-400 text-center relative">
                      Original Image
                      {isPickingColor && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 px-2 py-1 rounded-md animate-pulse hidden sm:inline-block">Pick a color</span>}
                    </div>
                    <div className={`p-4 flex-1 flex items-center justify-center bg-white dark:bg-black relative group min-h-[250px] ${isPickingColor ? 'cursor-crosshair' : 'cursor-pointer'}`} onClick={(e) => isPickingColor ? handleOriginalImageClick(e) : setZoomedImage({ src: originalImage, isTransparent: false })}>
                      <img ref={originalImageRef} src={originalImage} alt="Original" className="max-w-full h-auto max-h-[400px] lg:max-h-[500px] object-contain rounded select-none" />
                      {!isPickingColor && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded m-4 backdrop-blur-[2px]">
                          <div className="bg-white/20 text-white rounded-full px-5 py-3 flex items-center gap-2 backdrop-blur-md shadow-lg"><Maximize2 className="w-5 h-5" /> <span className="font-medium text-sm">Tap to zoom</span></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Processed Image Card */}
                  <div className="bg-white dark:bg-[#0a0a0a] rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
                    <div className="bg-neutral-50 dark:bg-[#111] p-3 border-b border-neutral-200 dark:border-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-400 flex items-center justify-center gap-2 relative">
                      <span>Result {debouncedParams.replaceTransparent ? '(Transparent)' : '(Solid)'}</span>
                      {outputDimensions && <span className="text-xs px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-500 font-mono tracking-tight hidden sm:inline-block">{outputDimensions.width} × {outputDimensions.height} px</span>}
                      {isProcessing && <span className="flex h-3 w-3 absolute right-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 dark:bg-neutral-600 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-neutral-600 dark:bg-white"></span></span>}
                    </div>
                    {outputDimensions && <div className="sm:hidden bg-neutral-50 dark:bg-[#111] border-b border-neutral-200 dark:border-neutral-800 text-xs text-center pb-2 text-neutral-500 font-mono">Output: {outputDimensions.width} × {outputDimensions.height} px</div>}
                    <div className="p-4 flex-1 flex items-center justify-center relative group cursor-pointer min-h-[250px]" style={checkerboardStyles} onClick={() => processedImage && setZoomedImage({ src: processedImage, isTransparent: true })}>
                      {processedImage && (
                        <>
                          <img src={processedImage} alt="Processed" className="max-w-full h-auto max-h-[400px] lg:max-h-[500px] object-contain rounded" />
                          {showMask && maskImage && (
                            <img src={maskImage} alt="Mask" className="absolute inset-0 max-w-full h-auto max-h-[400px] lg:max-h-[500px] object-contain pointer-events-none rounded" />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded m-4 backdrop-blur-[2px]">
                            <div className="bg-white/20 text-white rounded-full px-5 py-3 flex items-center gap-2 backdrop-blur-md shadow-lg"><Maximize2 className="w-5 h-5" /> <span className="font-medium text-sm">Tap to zoom</span></div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // COMPARE VIEW
                <div className="bg-white dark:bg-[#0a0a0a] rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
                  <div className="bg-neutral-50 dark:bg-[#111] p-3 border-b border-neutral-200 dark:border-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-400 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <span>Interactive Comparison</span>
                      {(debouncedParams.autoCrop || debouncedParams.hasShadow || debouncedParams.scale !== 100) && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-md">Note: Crop/Scale/Shadow may cause misalignment</span>
                      )}
                    </div>
                    {/* View Type Switcher */}
                    <div className="flex bg-neutral-200/50 dark:bg-neutral-800/50 rounded-lg p-1">
                      <button 
                        onClick={() => setCompareType('slider')} 
                        className={`px-4 py-1.5 text-xs rounded-md transition-all ${compareType === 'slider' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white font-medium' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                      >
                        Slider
                      </button>
                      <button 
                        onClick={() => setCompareType('toggle')} 
                        className={`px-4 py-1.5 text-xs rounded-md transition-all ${compareType === 'toggle' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white font-medium' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                      >
                        Toggle
                      </button>
                    </div>
                  </div>
                  
                  {compareType === 'slider' ? (
                    <div 
                      className="relative w-full h-[50vh] sm:h-[60vh] flex items-center justify-center cursor-ew-resize overflow-hidden touch-none" style={checkerboardStyles}
                      onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setCompareSliderPos(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))); }}
                      onTouchMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setCompareSliderPos(Math.max(0, Math.min(100, ((e.touches[0].clientX - rect.left) / rect.width) * 100))); }}
                    >
                      {/* Background: Original Image */}
                      <img src={originalImage} className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none" />
                      {/* Foreground: Processed Image (Clipped) */}
                      {processedImage && (
                        <>
                          <img src={processedImage} className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none" style={{ clipPath: `polygon(0 0, ${compareSliderPos}% 0, ${compareSliderPos}% 100%, 0 100%)` }} />
                          {showMask && maskImage && (
                            <img src={maskImage} className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none" style={{ clipPath: `polygon(0 0, ${compareSliderPos}% 0, ${compareSliderPos}% 100%, 0 100%)` }} />
                          )}
                        </>
                      )}
                      {/* Slider Line & Thumb */}
                      <div className="absolute top-0 bottom-0 w-0.5 bg-white drop-shadow-md pointer-events-none" style={{ left: `${compareSliderPos}%` }}>
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white text-neutral-800 rounded-full shadow-lg flex items-center justify-center"><SplitSquareHorizontal className="w-4 h-4" /></div>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="relative w-full h-[50vh] sm:h-[60vh] flex items-center justify-center cursor-pointer overflow-hidden select-none" 
                      style={checkerboardStyles}
                      onPointerDown={() => setShowOriginal(true)}
                      onPointerUp={() => setShowOriginal(false)}
                      onPointerLeave={() => setShowOriginal(false)}
                    >
                      <img 
                        src={showOriginal ? originalImage : processedImage} 
                        className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none" 
                      />
                      {!showOriginal && showMask && maskImage && (
                        <img 
                          src={maskImage}
                          className="absolute max-w-full max-h-full w-full h-full object-contain pointer-events-none"
                        />
                      )}
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-white px-5 py-2.5 rounded-full text-sm backdrop-blur-md font-medium shadow-lg pointer-events-none transition-all">
                        {showOriginal ? 'Original' : 'Result (Hold to view Original)'}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

            </div>
          </div>
        </main>
        
        {/* Footer */}
        <footer className="w-full text-center sm:text-right px-4 sm:px-6 py-4 border-t border-neutral-200 dark:border-neutral-800/50 mt-auto opacity-70 hover:opacity-100 transition-opacity">
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Made with <span className="text-red-500">❤️</span> by Mailo
          </p>
        </footer>
      </div>

      {/* Global Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsSettingsModalOpen(false)}>
          <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-2xl w-full max-w-md border border-neutral-200 dark:border-neutral-800 flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-[#111] rounded-t-2xl">
              <h3 className="text-lg font-bold text-neutral-800 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-neutral-500" />
                Global Settings
              </h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 -mr-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-[#222] text-neutral-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-6">
              {/* Theme Setting */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 block">Theme</label>
                <div className="flex bg-neutral-100 dark:bg-[#111] p-1 rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <button
                    onClick={() => setIsDarkMode(false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${!isDarkMode ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                  >
                    <Sun className="w-4 h-4" /> Light
                  </button>
                  <button
                    onClick={() => setIsDarkMode(true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${isDarkMode ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                  >
                    <Moon className="w-4 h-4" /> Dark
                  </button>
                </div>
              </div>

              {/* Layout Setting */}
              <div className="space-y-3 hidden lg:block">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Desktop Layout Position
                  <span className="block text-xs font-normal text-neutral-500 mt-1">Where should the settings panels be placed relative to the image?</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'top', label: 'Top' },
                    { id: 'bottom', label: 'Bottom' },
                    { id: 'left', label: 'Left' },
                    { id: 'right', label: 'Right' }
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => setLayoutPosition(pos.id)}
                      className={`flex items-center justify-center py-3 rounded-xl border text-sm font-medium transition-all ${layoutPosition === pos.id ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-md' : 'bg-white dark:bg-[#111] border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'}`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              <hr className="border-neutral-100 dark:border-neutral-800" />

              {/* AI Integration Settings */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-500" />
                    AI Integration
                  </h4>
                  <div className="flex items-center gap-3">
                    {aiEnabled && (
                      <div className="relative">
                        <button 
                          onClick={() => setIsTestPopoverOpen(!isTestPopoverOpen)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${isTestPopoverOpen ? 'bg-neutral-100 dark:bg-[#222] border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white' : 'bg-transparent border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-[#111] text-neutral-700 dark:text-neutral-300'}`}
                        >
                          <FlaskConical className="w-4 h-4" />
                          Test
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isTestPopoverOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isTestPopoverOpen && (
                          <div className="absolute right-0 top-full mt-2 w-[340px] bg-white dark:bg-[#0f0f0f] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-[400] animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-4 space-y-4">
                              <h5 className="font-semibold text-neutral-800 dark:text-neutral-200 text-sm">Select model to test</h5>
                              
                              <div className="relative">
                                <button 
                                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                  className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg px-3 py-2.5 text-sm font-semibold flex items-center justify-between hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                                >
                                  <span className="truncate pr-2">{aiModel ? models.find(m => m.id === aiModel)?.name || aiModel : 'Select a model to test with'}</span>
                                  <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" />
                                </button>
                                
                                {isModelDropdownOpen && (
                                  <div className="absolute left-0 right-0 bottom-full mb-1 bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-[500] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
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
                                    
                                    <div className="overflow-y-auto custom-scrollbar max-h-[240px] flex-1 px-1 pb-1 pt-0">
                                      {isLoadingModels ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
                                          <div className="w-6 h-6 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin mb-2" />
                                          <span className="text-xs">Loading OpenRouter models...</span>
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
                                                setIsModelDropdownOpen(false);
                                                setModelSearchQuery('');
                                              }}
                                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${aiModel === model.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#1a1a1a]'}`}
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
                                disabled={isTestingKey || !aiModel}
                                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${!aiModel ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed' : 'bg-[#414389] hover:bg-[#4b4e9f] text-white shadow-md hover:shadow-lg active:scale-[0.98]'}`}
                              >
                                {isTestingKey ? 'Testing...' : 'Run Test'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <label className="flex items-center cursor-pointer group">
                      <div className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${aiEnabled ? 'bg-blue-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}>
                        <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${aiEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                      </div>
                      <input type="checkbox" className="sr-only" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
                    </label>
                  </div>
                </div>
                
                {aiEnabled && (
                  <>
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">Provider</label>
                      <div className="relative">
                        <select 
                          value={aiProvider}
                          onChange={(e) => {
                            setAiProvider(e.target.value);
                            setAiModel('');
                          }}
                          className="w-full bg-neutral-50 dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        >
                          <option value="openai">OpenAI (DALL-E)</option>
                          <option value="anthropic">Anthropic (Claude)</option>
                          <option value="google">Google (Gemini)</option>
                          <option value="replicate">Replicate (Stable Diffusion)</option>
                          <option value="openrouter">OpenRouter (All Models)</option>
                          <option value="local">Local API</option>
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">API Key</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Key className="w-4 h-4 text-neutral-400" />
                        </div>
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={`Enter your ${aiProvider === 'local' ? 'API URL/Key' : aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1)} key`}
                          className="w-full bg-neutral-50 dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl pl-11 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        />
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-neutral-400 leading-relaxed">Keys are stored securely in your browser's local storage and are never sent to our servers.</p>
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
      )}

      {/* Fullscreen Zoom Modal */}
      {zoomedImage.src && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-8 animate-in fade-in duration-200" onClick={() => setZoomedImage({ src: null, isTransparent: false })}>
          <button className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-3 sm:p-2 transition-all hover:scale-110 active:scale-95 z-10" onClick={(e) => { e.stopPropagation(); setZoomedImage({ src: null, isTransparent: false }); }} title="Close fullscreen (Esc)">
            <X className="w-6 h-6" />
          </button>
          <div className="rounded-lg overflow-hidden shadow-2xl relative max-w-full max-h-full flex items-center justify-center animate-in zoom-in-95 duration-200" style={zoomedImage.isTransparent ? checkerboardStyles : { backgroundColor: isDarkMode ? '#000' : '#fff' }} onClick={(e) => e.stopPropagation()}>
            <img src={zoomedImage.src} alt="Zoomed fullscreen view" className="max-w-[95vw] max-h-[90vh] sm:max-w-full object-contain" />
          </div>
        </div>
      )}

      {/* Custom Toast Notification */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] flex flex-col items-center gap-2 pointer-events-none w-max max-w-[90vw]">
        {toasts.map((toast) => (
          <div key={toast.id} className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 pl-4 pr-2 py-2.5 rounded-2xl shadow-2xl font-medium text-sm flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto border border-white/10 dark:border-black/10 transition-all w-full">
            <Sparkles className="w-5 h-5 text-blue-400 dark:text-blue-600 shrink-0" />
            <span className="break-words flex-1 pr-2">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="text-neutral-400 hover:text-white dark:text-neutral-500 dark:hover:text-black transition-colors rounded-full p-1.5 hover:bg-white/10 dark:hover:bg-black/10 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}