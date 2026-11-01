// Icon keys describe catalog labels, not verified upstream identity.
const providers = Object.freeze({ 'deepseek-official': 'deepseek', 'openai-codex': 'openai', 'workbuddy': 'workbuddy', 'workbuddy-ai': 'workbuddy' });

export function providerIcon(providerId) {
  if (typeof providerId !== 'string') return 'default';
  return Object.hasOwn(providers, providerId.toLowerCase()) ? providers[providerId.toLowerCase()] : 'default';
}

export function modelIcon(modelId) {
  if (typeof modelId !== 'string') return 'default';
  const id = modelId.toLowerCase();
  const models = { 'deepseek-v4.1-flash': 'deepseek', 'deepseek-v3': 'deepseek', 'deepseek-flash': 'deepseek', 'deepseek-v4-flash-vision': 'deepseek', 'deepseek-chat': 'deepseek', 'deepseek-reasoner': 'deepseek', 'gpt-4o': 'openai', 'gpt-6.1-terra': 'openai', 'claude-3-5-sonnet': 'claude', 'claude-sonnet-4-5': 'claude' };
  if (Object.hasOwn(models, id)) return models[id];
  if (/^deepseek-v[234](?:\.\d{1,2})?(?:-(?:flash|pro|lite))?$/.test(id)) return 'deepseek';
  if (/^gpt-[3456](?:\.\d{1,2})?o?(?:-(?:mini|nano|pro|codex))?$/.test(id)) return 'openai';
  if (/^claude-(?:(?:opus|sonnet|haiku)-[345](?:[.-]\d{1,2})*|[345](?:[.-]\d{1,2})*-(?:opus|sonnet|haiku))$/.test(id)) return 'claude';
  return 'default';
}
