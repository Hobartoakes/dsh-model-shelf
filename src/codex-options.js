// Codex 3.2.28 registers openai-codex and these exact, DSH-authorized RPCs.
// The caller supplies the connection for the current host lifecycle, not an agent tool.
const codexStatusMethod = 'codex-subscription/preferences/status';
const codexUpdateMethod = 'codex-subscription/preferences/update';
const codexOwner = 'dsh-codex-subscription';
const codexScope = '修改此 Codex 连接器的默认值，其他使用它的会话也会受到影响';
function codexField(id, label, choices, supported) {
  const editor = Object.freeze({ choices: Object.freeze(choices) });
  return { id, label, editor, reset: choices[0], supported };
}
const codexFields = [
  codexField('outputVerbosity', '回答详略', ['default', 'low', 'medium', 'high'],
    (status, target) => Array.isArray(status.verbosityModels) && status.verbosityModels.includes(target.model)),
  // The caller sets reasoningActive only for an effective directory effort whose payload was verified.
  codexField('reasoningSummary', '推理摘要', ['auto', 'concise', 'detailed', 'none'],
    (_, target) => target.reasoningActive === true)
];

function validCodexTarget(target) {
  return target?.provider === 'openai-codex' && typeof target.model === 'string' && target.model.trim() !== '' &&
    typeof target.sessionId === 'string' && target.sessionId.trim() !== '' && target.epoch != null;
}

// In 3.2.28 an online/ok availableModels entry came from a parsed account
// row with explicit supportsFast/supportsUltrafast booleans. Outside that
// catalog fastModels alone can be a model-name fallback, not account evidence.
function codexSpeedOption(status, model) {
  const { catalogStatus, fastModels, ultrafastModels, speedMode } = status;
  if (catalogStatus?.source !== 'online' || catalogStatus.refresh !== 'ok' ||
      !Array.isArray(status.disabledModels) || !Array.isArray(fastModels) || !Array.isArray(ultrafastModels) ||
      !['standard', 'fast', 'ultrafast'].includes(speedMode)) return;
  const fast = fastModels.includes(model), ultra = ultrafastModels.includes(model);
  if (!fast && !ultra) return;
  const choices = Object.freeze(['standard', ...(fast ? ['fast'] : []), ...(ultra ? ['ultrafast'] : [])]);
  const notice = (fast ? '快速模式会消耗更多 Credits。' : '') +
    (ultra ? '极速模式（Beta）会更快消耗订阅额度和 Credits。' : '');
  // The saved value belongs to the connector, not to this model. Keep it as
  // the conflict baseline even if it is no longer among the writable choices.
  const editor = Object.freeze({ choices, ...(choices.includes(speedMode) ? {} : { unavailableText: '当前模型按标准速度处理' }) });
  return Object.freeze({ id: 'speedMode', label: '响应速度', value: speedMode, reset: 'standard', editor,
    owner: codexOwner, scope: codexScope, notice });
}

function codexOptionsFromStatus(status, target) {
  if (status?.writable !== true || !['auto', 'legacy'].includes(status.composerModelPicker) ||
      !Array.isArray(status.availableModels) || status.availableModels.filter(m => m?.id === target.model).length !== 1 ||
      (status.disabledModels !== undefined && (!Array.isArray(status.disabledModels) || status.disabledModels.includes(target.model)))) return [];

  const fields = codexFields.filter(f => f.supported(status, target) && f.editor.choices.includes(status[f.id]))
    .map(({ id, label, reset, editor }) => Object.freeze({ id, label, reset, value: status[id], editor, scope: codexScope, owner: codexOwner }));
  const speed = codexSpeedOption(status, target.model);
  if (speed) fields.push(speed);
  return fields;
}

function codexTargetSnapshot({ sessionId, provider, model, epoch, reasoningActive }) {
  return { sessionId, provider, model, epoch, reasoningActive };
}

function sameCodexTarget(target, snapshot) {
  return Object.keys(snapshot).every(key => target[key] === snapshot[key]);
}

function codexChangeValue(field, change) {
  if (!change || typeof change !== 'object') return;
  const keys = Reflect.ownKeys(change);
  if (keys.length !== 1) return;
  if (keys[0] === 'reset' && change.reset === true) return field.reset;
  if (keys[0] === 'set' && field.editor.choices.includes(change.set)) return change.set;
}

function codexReplySucceeded(response) {
  return response?.ok === true && !Object.hasOwn(response, 'error');
}

// In Codex 3.2.28 subscription-rpc.js these preference-fields.js errors return
// before preferences.update(). The same 'internal' code can also occur AFTER persistence.
const codexValidationError = {
  outputVerbosity: 'Invalid output verbosity preference',
  reasoningSummary: 'Invalid reasoning summary preference',
  speedMode: 'Invalid speed mode preference'
};
function codexWriteReceipt(response, field, sentValue) {
  if (response?.ok === false) {
    return !Object.hasOwn(response, 'value') && response.error?.code === 'internal' && response.error.message === codexValidationError[field]
      ? 'refused' : 'unconfirmed';
  }
  if (!codexReplySucceeded(response) || !response.value || typeof response.value !== 'object' || Array.isArray(response.value)) return 'unconfirmed';
  // The connector returns all preferences. Only its echo of this patch can acknowledge the write.
  if (!Object.hasOwn(response.value, field) || response.value[field] !== sentValue) return 'unconfirmed';
  const synced = response.value.liveSynced;
  if (synced === false) return 'saved-not-live';
  return synced === undefined || synced === true ? 'applied' : 'unconfirmed';
}

export function createCodexOptions(rpc) {
  // Keep the returned Option itself as the draft baseline. A copy or an Option from
  // an earlier connection cannot authorize a write. No raw status is cached here.
  const origins = new WeakMap();
  let saving = false;

  async function read(target, signal) {
    if (!validCodexTarget(target) || signal?.aborted || typeof rpc?.call !== 'function') return [];
    const origin = codexTargetSnapshot(target);
    try {
      const response = await rpc.call('/api', codexStatusMethod, {}, signal);
      if (!codexReplySucceeded(response) || signal?.aborted || !sameCodexTarget(target, origin)) return [];
      const fields = codexOptionsFromStatus(response.value, origin);
      for (const field of fields) origins.set(field, origin);
      return fields;
    } catch {
      // Optional service: do not expose raw status or transport diagnostics to the picker.
      return [];
    }
  }

  async function write(target, expected, change, signal, isCurrent) {
    const origin = origins.get(expected);
    if (!validCodexTarget(target) || !origin || typeof isCurrent !== 'function') return 'refused';
    const active = () => {
      try { return !signal?.aborted && sameCodexTarget(target, origin) && isCurrent() === true; }
      catch { return false; }
    };
    if (!active()) return 'stale';
    const value = codexChangeValue(expected, change);
    if (value === undefined || saving) return 'refused';
    saving = true;
    try {
      const sameField = f => f.id === expected.id && f.owner === expected.owner;
      const fresh = (await read(target, signal)).find(sameField);
      if (!active()) return 'stale';
      if (!fresh || !fresh.editor.choices.includes(value)) return 'refused';
      if (fresh.value !== expected.value) return 'conflict';

      // No owner CAS exists: another client can still win between this check and dispatch.
      let receipt = 'unconfirmed';
      try {
        const response = await rpc.call('/api', codexUpdateMethod, { [fresh.id]: value }, signal);
        receipt = codexWriteReceipt(response, fresh.id, value);
      } catch { /* The patch may have landed. Do not resend it. */ }
      if (!active()) return 'stale';
      if (receipt === 'refused') return receipt;
      const confirmed = (await read(target, signal)).find(sameField);
      if (!active()) return 'stale';
      return confirmed?.value === value && confirmed.editor.choices.includes(value) ? receipt : 'unconfirmed';
    } finally {
      saving = false;
    }
  }
  return { read, write };
}
