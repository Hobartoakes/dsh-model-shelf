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

function codexOptionsFromStatus(status, target) {
  if (status?.writable !== true || !['auto', 'legacy'].includes(status.composerModelPicker) ||
      !Array.isArray(status.availableModels) || status.availableModels.filter(m => m?.id === target.model).length !== 1 ||
      (status.disabledModels !== undefined && (!Array.isArray(status.disabledModels) || status.disabledModels.includes(target.model)))) return [];

  return codexFields.filter(f => f.supported(status, target) && f.editor.choices.includes(status[f.id]))
    .map(({ id, label, reset, editor }) => Object.freeze({ id, label, reset, value: status[id], editor, scope: codexScope, owner: codexOwner }));
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

// Discard the echoed settings. An internal error can occur *after* persistence.
function codexWriteReceipt(response) {
  if (response?.ok === false && response.error && response.error.code !== 'internal') return 'refused';
  if (response?.ok !== true || !response.value || typeof response.value !== 'object' || Array.isArray(response.value)) return 'unconfirmed';
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
      if (response?.ok !== true || signal?.aborted || !sameCodexTarget(target, origin)) return [];
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
      try { receipt = codexWriteReceipt(await rpc.call('/api', codexUpdateMethod, { [fresh.id]: value }, signal)); }
      catch { /* The patch may have landed. Do not resend it. */ }
      if (!active()) return 'stale';
      if (receipt === 'refused') return receipt;
      const confirmed = (await read(target, signal)).find(sameField);
      if (!active()) return 'stale';
      return confirmed?.value === value ? receipt : 'unconfirmed';
    } finally {
      saving = false;
    }
  }
  return { read, write };
}
