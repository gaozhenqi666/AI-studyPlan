const STORAGE_KEY = 'ai_config_v1';

export const getAIConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setAIConfig = (config) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

export const clearAIConfig = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const resolveAIConfig = () => {
  const stored = getAIConfig();
  const apiKey = stored?.apiKey || import.meta.env.VITE_DEEPSEEK_API_KEY;
  const baseURL = stored?.baseURL || 'https://api.deepseek.com/v1';
  const model = stored?.model || 'deepseek-chat';
  const enabled = !!apiKey;

  return {
    enabled,
    apiKey: apiKey || '',
    baseURL,
    model,
    source: stored?.apiKey ? 'localStorage' : (import.meta.env.VITE_DEEPSEEK_API_KEY ? 'env' : 'none')
  };
};

