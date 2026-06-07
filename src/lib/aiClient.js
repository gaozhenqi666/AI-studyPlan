import OpenAI from 'openai';
import { resolveAIConfig } from './aiConfig';

export const getAIClient = () => {
  const cfg = resolveAIConfig();
  if (!cfg.enabled) {
    const err = new Error('AI_NOT_CONFIGURED');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const client = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    dangerouslyAllowBrowser: true
  });

  return { client, model: cfg.model, config: cfg };
};

