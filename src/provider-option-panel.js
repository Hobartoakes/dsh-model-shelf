import { createCodexOptions } from './codex-options.js';

// An optional Cordis child owns this binding, never the model seat itself.
// Without both observables (old hosts), there is no safe lifetime for writes.
export function createProviderConnection() {
  const listeners = new Set();
  let current = null, owner;
  const emit = value => { if (current !== value) { current = value; for (const fn of listeners) fn(); } };
  return {
    getSnapshot: () => current,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    attach(connection) {
      const lease = {}; owner = lease; emit(null);
      const { state, generation, rpc } = connection ?? {};
      if (!rpc || typeof rpc.call !== 'function' || ![state,generation].every(s => typeof s?.subscribe === 'function' && typeof s.getSnapshot === 'function')) return;
      let last, live = true;
      const io = createCodexOptions(rpc), stops = [];
      const update = () => {
        if (!live || lease !== owner) return;
        let next;
        try { if (state.getSnapshot() === 'connected') next = generation.getSnapshot()?.id; } catch { /* unavailable */ }
        if (!Number.isSafeInteger(next) || next < 1) next = undefined;
        if (next !== last || next === undefined) { last = next; emit(next === undefined ? null : { io }); }
      };
      const detach = () => {
        live = false;
        if (lease === owner) { owner = undefined; emit(null); }
        for (const stop of stops) stop();
      };
      try {
        for (const s of [state,generation]) {
          const stop = s.subscribe(update);
          if (typeof stop !== 'function') { detach(); return; }
          stops.push(stop);
        }
        update(); return detach;
      } catch { detach(); }
    }
  };
}

// This is a closed evidence list, not a vendor/model-name heuristic. The
// pinned adapter produced a reasoning object at these levels (and its declared
// medium default). Other catalog models can still offer declared verbosity.
function verifiedCodexReasoning(model, effort, implicit) {
  if (implicit && effort !== 'medium') return false;
  return model.id === 'gpt-5.4' && ['low','medium','high'].includes(effort) &&
    Array.isArray(model.reasoning?.efforts) && model.reasoning.efforts.some(e => e?.id === effort);
}

export function observeProviderTarget(directory, connection, sessionId) {
  let epoch = 0, previous, snapshot = null;
  const getSnapshot = () => {
    const link = connection.getSnapshot(), state = directory.getSnapshot();
    let keys;
    if (link && state.status === 'ready' && state.routable === true && state.current?.provider === 'openai-codex') {
      const groups = Array.isArray(state.groups) ? state.groups.filter(g => g?.id === state.current.provider) : [];
      const models = groups.length === 1 && Array.isArray(groups[0].models) && groups[0].models.filter(m => m?.id === state.current.model);
      if (models?.length === 1) {
        const model = models[0], effort = state.current.reasoningEffort === undefined ? model.reasoning?.defaultEffort : state.current.reasoningEffort;
        keys = [link, groups[0], model, effort, verifiedCodexReasoning(model, effort, state.current.reasoningEffort === undefined)];
      }
    }
    if (!keys) { previous = undefined; snapshot = null; }
    else if (!previous || keys.some((value,i) => value !== previous[i])) {
      previous = keys;
      snapshot = { io: link.io, target: { sessionId, provider: state.current.provider, model: state.current.model, epoch: ++epoch, reasoningActive: keys[4] } };
    }
    return snapshot;
  };
  // Observe each transition synchronously, even when React batches A → B → A.
  const subscribe = notify => {
    const changed = () => { getSnapshot(); notify(); };
    const offDirectory = directory.subscribe(changed), offConnection = connection.subscribe(changed);
    return () => { offDirectory(); offConnection(); };
  };
  return { getSnapshot, subscribe };
}

// One mounted opening owns one baseline per field. Never manufacture a fresh
// Option from a receipt. After submitting, reread explicitly before editing
// that field again; ambiguous receipts must not trigger more reads or writes.
export function openProviderDrafts(io, target, isCurrent, publish) {
  const controller = new AbortController(), signal = controller.signal;
  let rows = [], busy = false;
  const current = () => !signal.aborted && isCurrent();
  const emit = () => publish({ rows, busy });
  const replace = (old, patch) => { rows = rows.map(r => r === old ? { ...r, ...patch } : r); emit(); };
  const editable = id => !busy && current() && rows.find(r => r.option.id === id && !r.result);
  return {
    async load() {
      if (!current() || busy) return;
      busy = true; rows = []; emit();
      let options;
      try { options = await io.read(target, signal); } catch { options = []; }
      if (!current()) return;
      busy = false; rows = options.map(option => ({ option, value: option.value })); emit();
    },
    edit(id, change) {
      const row = editable(id);
      if (!row) return;
      const value = change.reset === true ? row.option.reset : change.set;
      if (!row.option.editor.choices.includes(value)) return;
      replace(row, { value, change: value === row.option.value ? undefined : change });
    },
    cancel(id) { const row = editable(id); if (row) replace(row, { value: row.option.value, change: undefined }); },
    async save(id) {
      const row = editable(id);
      if (!row?.change) return;
      busy = true; emit(); // synchronous guard before the first await
      let result;
      try { result = await io.write(target, row.option, row.change, signal, current); }
      catch { result = 'unconfirmed'; }
      if (!current()) return;
      busy = false; replace(row, { result, change: undefined });
    },
    close() { controller.abort(); }
  };
}

const providerSaveText = { applied: '已保存', 'saved-not-live': '已保存，当前实例尚未同步', conflict: '设置已变更，请重新读取',
  refused: '未保存：目标不可写或连接器已拒绝', unconfirmed: '未确认，请重新读取；不会自动重试', stale: '目标已变化，请重新读取' };
const providerChoiceText = { default:'模型默认', low:'低', medium:'中', high:'高', auto:'自动（保留默认摘要）', concise:'简明', detailed:'详细', none:'无摘要（不关闭推理）' };

export function makeProviderOptionPanel(React) {
  const { createElement: h, useState, useRef, useLayoutEffect } = React;
  return function ProviderOptionPanel({ io, target, canEdit, isCurrent }) {
    const [view, setView] = useState({ rows: [] });
    const active = useRef(null), guard = useRef(isCurrent);
    guard.current = isCurrent;
    useLayoutEffect(() => {
      if (!canEdit) return;
      const drafts = openProviderDrafts(io, target, () => guard.current(), setView);
      active.current = drafts; void drafts.load();
      return () => { drafts.close(); active.current = null; };
    }, [io, target, canEdit]);
    if (!canEdit || !view.rows.length) return null;
    const scopes = [...new Set(view.rows.map(row => row.option.scope))];
    return h('section', { className: 'dmo-provider-options', 'aria-label': '服务商选项' },
      h('strong', null, '服务商选项'), scopes.map(scope => h('p', { key: scope },scope + '。')),
      view.rows.map(({option, value, change, result}) => {
        const disabled = view.busy || !!result, { id, label } = option;
        const confirmed = result === 'applied' || result === 'saved-not-live';
        return h('div', { key: id, className: 'dmo-provider-field', 'data-provider-option': id },
          h('label', null, label, h('select', { value, disabled, 'aria-label': label, onChange: e => active.current?.edit(id, { set: e.target.value }) },
            option.editor.choices.map(v => h('option', { key:v, value:v },providerChoiceText[v] ?? v)))),
          h('small', null, (confirmed ? '已读回：' : '编辑前：') + providerChoiceText[confirmed ? value : option.value]),
          option.reset !== undefined && h('button', { type:'button', disabled, onClick: () => active.current?.edit(id,{reset:true}) }, '恢复默认'),
          h('button', { type:'button', disabled: disabled || !change, onClick: () => active.current?.cancel(id) }, '取消'),
          h('button', { type:'button', disabled: disabled || !change, onClick: () => void active.current?.save(id) }, '保存'),
          result && h('span', { role:'status' }, providerSaveText[result] ?? providerSaveText.unconfirmed));
      }),
      view.rows.some(r => r.result) && view.rows.some(r => r.change) && h('small', null, '重新读取会丢弃其他未保存的草稿。'),
      view.rows.some(r => r.result) && h('button', { type:'button', disabled:view.busy, onClick: () => void active.current?.load() }, '重新读取服务商选项'));
  };
}
