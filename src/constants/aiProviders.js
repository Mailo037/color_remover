export const PROVIDER_LABELS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  replicate: 'Replicate',
  openrouter: 'OpenRouter',
  local: 'Local API',
};

export const AI_PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'replicate', label: 'Replicate' },
  { value: 'openrouter', label: 'OpenRouter (All Models)' },
  { value: 'local', label: 'Local API' },
];

export const PROVIDER_DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  google: 'gemini-1.5-flash',
  replicate: 'black-forest-labs/flux-schnell',
  openrouter: 'openrouter/auto',
  local: '',
};

export const STATIC_PROVIDER_MODELS = {
  openai: [
    { id: 'gpt-4o-mini', name: 'OpenAI: GPT-4o mini', group: 'OpenAI' },
    { id: 'gpt-4o', name: 'OpenAI: GPT-4o', group: 'OpenAI' },
    { id: 'gpt-4.1-mini', name: 'OpenAI: GPT-4.1 mini', group: 'OpenAI' },
    { id: 'gpt-4.1', name: 'OpenAI: GPT-4.1', group: 'OpenAI' },
  ],
  anthropic: [
    { id: 'claude-3-haiku-20240307', name: 'Anthropic: Claude 3 Haiku', group: 'Anthropic' },
    { id: 'claude-3-5-haiku-latest', name: 'Anthropic: Claude 3.5 Haiku', group: 'Anthropic' },
    { id: 'claude-3-5-sonnet-latest', name: 'Anthropic: Claude 3.5 Sonnet', group: 'Anthropic' },
  ],
  google: [
    { id: 'gemini-1.5-flash', name: 'Google: Gemini 1.5 Flash', group: 'Google' },
    { id: 'gemini-1.5-pro', name: 'Google: Gemini 1.5 Pro', group: 'Google' },
    { id: 'gemini-2.0-flash', name: 'Google: Gemini 2.0 Flash', group: 'Google' },
    { id: 'gemini-2.5-flash', name: 'Google: Gemini 2.5 Flash', group: 'Google' },
    { id: 'gemini-2.5-pro', name: 'Google: Gemini 2.5 Pro', group: 'Google' },
  ],
  replicate: [
    { id: 'black-forest-labs/flux-schnell', name: 'Replicate: FLUX.1 Schnell', group: 'Replicate' },
    { id: 'black-forest-labs/flux-dev', name: 'Replicate: FLUX.1 Dev', group: 'Replicate' },
    { id: 'stability-ai/stable-diffusion-3.5-large', name: 'Replicate: Stable Diffusion 3.5 Large', group: 'Replicate' },
  ],
  local: [],
};

export const getProviderLabel = (provider) => PROVIDER_LABELS[provider] || provider;
export const getDefaultModelForProvider = (provider) => PROVIDER_DEFAULT_MODELS[provider] || '';

export const getProviderApiModel = (provider, model) => {
  const selectedModel = model || getDefaultModelForProvider(provider);
  if (!selectedModel || provider === 'openrouter') return selectedModel;

  const providerPrefix = `${provider}/`;
  return selectedModel.startsWith(providerPrefix)
    ? selectedModel.slice(providerPrefix.length)
    : selectedModel;
};
