import { catalogModelIcons, qwenCatalogIds } from './catalog-icons.js';
// Icon keys describe catalog labels, not verified upstream identity.
const knownCatalogModels = new Set(catalogModelIcons);
const knownQwenModels = new Set(qwenCatalogIds);
const providers = Object.freeze({ 'deepseek-official': 'deepseek', 'deepseek-account': 'deepseek', 'openai-codex': 'openai', 'cline': 'cline', 'qoder': 'qoder', 'qodercn': 'qoder', 'trae': 'trae', 'workbuddy': 'workbuddy', 'workbuddy-ai': 'workbuddy', 'openrouter': 'openrouter', 'huggingface': 'huggingface' });

// Only reviewed, fixed filenames may be fetched; unknown labels never form URLs.
export const DOWNLOADABLE_ICONS = Object.freeze({ openrouter: 'openrouter.png', huggingface: 'huggingface-color.png' });

export function providerIcon(providerId) {
  if (typeof providerId !== 'string') return 'default';
  return Object.hasOwn(providers, providerId.toLowerCase()) ? providers[providerId.toLowerCase()] : 'default';
}

export function modelIcon(modelId, providerId) {
  if (typeof modelId !== 'string') return 'default';
  const id = modelId.toLowerCase();
  const provider = typeof providerId === 'string' ? providerId.toLowerCase() : '';
  if (provider === 'qoder' || provider === 'qodercn') {
    if (/^(?:qmodel|qmodel_latest|qmodel_38max|qfmodel|q37fmodel)$/.test(id)) return 'qwen';
    if (/^(?:dmodel|dfmodel)$/.test(id)) return 'deepseek';
  }
  if (knownCatalogModels.has(id)) return id.startsWith('openai/') ? 'openai' : 'deepseek';
  if (knownQwenModels.has(id)) return 'qwen';
  if (/^~openai\/gpt-(?:astra|luna|mini|sol|terra)-latest$/.test(id)) return 'openai';
  if (/^~deepseek\/deepseek-(?:flash|pro|v4-flash)-latest$/.test(id)) return 'deepseek';
  if (/^(?:cline-pass\/)?qwen3\.[5678]-(?:max|plus|flash|27b)(?:-2026-04-20)?$/.test(id)) return 'qwen';
  if (/^qwen-3\.[568](?:-(?:max|plus))?$/.test(id)) return 'qwen';
  if (/^gpt-[56](?:\.\d{1,2})?-(?:sol|terra|astra|luna)$/.test(id)) return 'openai';
  if (/^(?:deepseek-ai\/)?deepseek-v4\.1-flash(?:-(?:free|sg))?$/.test(id) || id === 'deepseek-v4-pro-official') return 'deepseek';
  if (/^(?:openai|codex)\/gpt-[56](?:\.\d{1,2})?-(?:sol|terra|astra|luna)(?:-pro)?(?::batch)?$/.test(id)) return 'openai';
  if (/^openai\/gpt-[3456](?:\.\d{1,2})?o?(?:-(?:mini|nano|pro|codex))?$/.test(id)) return 'openai';
  if (/^opencode-zen-free\/deepseek-v4(?:\.\d{1,2})?-flash-free$/.test(id)) return 'deepseek';
  if (/^(?:(?:deepseek|cline-pass)\/)?deepseek-v4(?:\.\d{1,2})?-(?:flash|pro)(?:-\d{4})?$/.test(id)) return 'deepseek';
  const models = { 'deepseek-v4.1-flash': 'deepseek', 'deepseek-v3': 'deepseek', 'deepseek-flash': 'deepseek', 'deepseek-v4-flash-vision': 'deepseek', 'deepseek-chat': 'deepseek', 'deepseek-reasoner': 'deepseek', 'gpt-4o': 'openai', 'gpt-6.1-terra': 'openai', 'gpt-6.1-sol': 'openai', 'gpt-6-astra': 'openai', 'claude-3-5-sonnet': 'claude', 'claude-sonnet-4-5': 'claude' };
  if (Object.hasOwn(models, id)) return models[id];
  if (/^deepseek-v[234](?:\.\d{1,2})?(?:-(?:flash|pro|lite))?$/.test(id)) return 'deepseek';
  if (/^gpt-[3456](?:\.\d{1,2})?o?(?:-(?:mini|nano|pro|codex))?$/.test(id)) return 'openai';
  if (/^claude-(?:(?:opus|sonnet|haiku)-[345](?:[.-]\d{1,2})*|[345](?:[.-]\d{1,2})*-(?:opus|sonnet|haiku))$/.test(id)) return 'claude';
  return 'default';
}
