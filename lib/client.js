window.__ModuleLoader__.load({
  id: 'dsh-model-shelf',
  factory: (require) => {
const STORAGE_KEY = 'dsh-model-shelf.preferences.v1';
const LEGACY_STORAGE_KEY = 'dsh-model-organizer.preferences.v1';
const modelKey = (provider, model) => JSON.stringify([provider, model]);
const groupKey = (list, provider) => JSON.stringify([list, provider]);
const emptyPreferences = () => ({ version: 1, uncommon: [], favorites: [], providerNotes: {}, collapsed: [] });
const normalizeNote = (value) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) : '';
const providerNote = (prefs, id) => Object.hasOwn(prefs.providerNotes ?? {}, id) ? normalizeNote(prefs.providerNotes[id]) : '';

function normalizePreferences(value) {
  if (!value || value.version !== 1) return emptyPreferences();
  const keys = (values) => [...new Set((Array.isArray(values) ? values : []).filter((key) => {
    if (typeof key !== 'string') return false;
    try { const tuple = JSON.parse(key); return Array.isArray(tuple) && tuple.length === 2 && tuple.every((x) => typeof x === 'string'); }
    catch { return false; }
  }))];
  const entries = value.providerNotes && typeof value.providerNotes === 'object' && !Array.isArray(value.providerNotes)
    ? Object.entries(value.providerNotes).map(([id, text]) => [id, normalizeNote(text)]).filter(([id, text]) => id && text) : [];
  return { version: 1, uncommon: keys(value.uncommon), favorites: keys(value.favorites), providerNotes: Object.fromEntries(entries), collapsed: keys(value.collapsed) };
}

function toggleKey(values, key) {
  return values.includes(key) ? values.filter((value) => value !== key) : [...values, key];
}

// Classification is exclusively explicit: no usage telemetry or frequency inference.
function partitionModels(groups, prefs, list, query = '') {
  const uncommon = new Set(prefs.uncommon);
  const favorites = new Set(prefs.favorites ?? []);
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return groups.map((group) => ({ ...group, models: group.models.filter((model) => {
    const key = modelKey(group.id, model.id);
    if (list === 'favorites' ? !favorites.has(key) : uncommon.has(key) !== (list === 'uncommon')) return false;
    const identity = `${group.name ?? ''} ${group.id} ${providerNote(prefs, group.id)} ${model.name ?? ''} ${model.id}`.toLocaleLowerCase();
    return tokens.every((token) => identity.includes(token));
  }) })).filter((group) => group.models.length > 0);
}

function createPreferenceStore(storage, events) {
  let snapshot = emptyPreferences();
  let error = null;
  const listeners = new Set();
  try {
    const current = storage.getItem(STORAGE_KEY);
    if (current !== null) snapshot = normalizePreferences(JSON.parse(current));
    else {
      // Import only the old local prototype's preferences; never overwrite a new key.
      const legacy = JSON.parse(storage.getItem(LEGACY_STORAGE_KEY) ?? 'null');
      if (legacy?.version === 1) {
        snapshot = normalizePreferences(legacy);
        try { storage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); }
        catch { error = '旧版偏好已读取，但保存新偏好失败；刷新后可能无法保留修改。'; }
      }
    }
  }
  catch { error = '无法读取本地偏好；本次修改仍可在当前页面使用。'; }
  const emit = () => { for (const listener of listeners) listener(); };
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try { snapshot = normalizePreferences(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')); error = null; }
    catch { error = '无法读取本地偏好。'; snapshot = { ...snapshot }; }
    emit();
  };
  events?.addEventListener('storage', onStorage);
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getSnapshot: () => snapshot,
    getError: () => error,
    update(change) {
      snapshot = normalizePreferences(change(snapshot));
      try { storage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); error = null; }
      catch { error = '偏好保存失败：当前页面仍有效，但刷新后可能丢失。'; }
      emit();
    },
    dispose() { events?.removeEventListener('storage', onStorage); listeners.clear(); }
  };
}


// React and ReactDOM come from the running DSH client, never a second React copy.
const React = require('react');
const { createPortal } = require('react-dom');
const { createElement: h, useState, useRef, useEffect, useLayoutEffect, useSyncExternalStore, useId } = React;
// Service method calls inherit the consumer's Cordis context; directoryFor creates
// a directory using remote.session, so declare the nested capability explicitly.
const inject = ['slots', 'modelDirectories', 'sessions', 'remote', 'remote.session'];

function makeModelPicker(preferences) {
  return function ModelPicker({ locked, available, directory, load, select }) {
    const state = useSyncExternalStore(directory.subscribe.bind(directory), directory.getSnapshot.bind(directory));
    const prefs = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
    const [open, setOpen] = useState(false);
    const [list, setList] = useState('main');
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(null);
    const [position, setPosition] = useState(null);
    const [localError, setLocalError] = useState(null);
    const [editingNote, setEditingNote] = useState(null);
    const noteInput = useRef(null);
    useEffect(() => { if (editingNote) noteInput.current?.focus(); }, [editingNote?.id]);
    const trigger = useRef(null);
    const panel = useRef(null);
    const search = useRef(null);
    const inFlight = useRef(false);
    const popupEpoch = useRef(0);
    const mounted = useRef(true);
    const popupId = useId();
    const groups = state.groups ?? [];
    const shown = partitionModels(groups, prefs, list, query);
    const allMain = partitionModels(groups, prefs, 'main').reduce((n, g) => n + g.models.length, 0);
    const allUncommon = partitionModels(groups, prefs, 'uncommon').reduce((n, g) => n + g.models.length, 0);
    const allFavorites = partitionModels(groups, prefs, 'favorites').reduce((n, g) => n + g.models.length, 0);
    const currentNote = state.current ? providerNote(prefs, state.current.provider) : '';
    const searching = query.trim().length > 0;
    const expanded = (id) => searching || !prefs.collapsed.includes(groupKey(list, id));
    const visible = shown.flatMap((g) => expanded(g.id) ? g.models.map((m) => ({ group: g, model: m, key: modelKey(g.id, m.id) })) : []);
    const currentGroup = groups.find((g) => g.id === state.current?.provider);
    const currentModel = currentGroup?.models.find((m) => m.id === state.current?.model);
    const reasoning = currentModel?.reasoning;
    const effort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
    const busy = locked || state.status === 'selecting';
    const activeRow = visible.find((item) => item.key === active) ?? visible[0];
    const error = localError ?? state.error ?? preferences.getError();

    useEffect(() => {
      mounted.current = true;
      return () => { mounted.current = false; };
    }, []);

    const close = (restore = true) => {
      const epoch = ++popupEpoch.current;
      setOpen(false);
      setEditingNote(null);
      if (restore) queueMicrotask(() => {
        if (mounted.current && popupEpoch.current === epoch) trigger.current?.focus();
      });
    };

    useEffect(() => {
      if (!open) return;
      const dismiss = (event) => {
        if (!panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) close(false);
      };
      const key = (event) => {
        if (event.key === 'Escape' && !event.isComposing && !event.target.closest?.('.dmo-note-editor')) { event.preventDefault(); close(); }
      };
      document.addEventListener('pointerdown', dismiss, true);
      document.addEventListener('keydown', key);
      return () => {
        document.removeEventListener('pointerdown', dismiss, true);
        document.removeEventListener('keydown', key);
      };
    }, [open]);

    useLayoutEffect(() => {
      if (!open) return;
      const place = () => {
        const anchor = trigger.current?.getBoundingClientRect();
        const card = panel.current;
        if (!anchor || !card) return;
        const vv = window.visualViewport;
        const x0 = vv?.offsetLeft ?? 0, y0 = vv?.offsetTop ?? 0;
        const vw = vv?.width ?? window.innerWidth, vh = vv?.height ?? window.innerHeight;
        // A tall picker may extend beyond the trigger; clamp it to the viewport.
        const width = Math.min(640, vw - 24), maxHeight = Math.min(720, vh - 32);
        card.style.width = `${width}px`;
        card.style.maxHeight = `${maxHeight}px`;
        const height = card.offsetHeight;
        const above = anchor.top - y0 - 12;
        const below = y0 + vh - anchor.bottom - 12;
        let top = above >= height || above >= below ? anchor.top - height - 8 : anchor.bottom + 8;
        top = Math.max(y0 + 12, Math.min(top, y0 + vh - height - 12));
        const left = Math.max(x0 + 12, Math.min(anchor.right - width, x0 + vw - width - 12));
        setPosition((p) => p?.left === left && p?.top === top ? p : { left, top });
      };
      place();
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
      if (panel.current) observer?.observe(panel.current);
      window.addEventListener('resize', place);
      window.addEventListener('scroll', place, true);
      window.visualViewport?.addEventListener('resize', place);
      window.visualViewport?.addEventListener('scroll', place);
      return () => {
        observer?.disconnect();
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, true);
        window.visualViewport?.removeEventListener('resize', place);
        window.visualViewport?.removeEventListener('scroll', place);
      };
    }, [open, list, query, prefs, state]);

    const positioned = position !== null;
    useEffect(() => {
      if (open && positioned) search.current?.focus();
    }, [open, positioned]);

    useEffect(() => {
      if (!open || !activeRow) return;
      const row = [...(panel.current?.querySelectorAll('[data-model-key]') ?? [])].find((node) => node.dataset.modelKey === activeRow.key);
      row?.scrollIntoView({ block: 'nearest' });
    }, [active, query, list]);

    const choose = async (selection, keepOpen = false) => {
      if (busy || inFlight.current || !available) return;
      inFlight.current = true;
      const epoch = popupEpoch.current;
      setLocalError(null);
      try {
        // Reselecting the current model must not reset a customized reasoning effort.
        const sameModel = state.current?.provider === selection.provider && state.current?.model === selection.model;
        const request = sameModel && selection.reasoningEffort === undefined && state.current.reasoningEffort !== undefined
          ? { ...selection, reasoningEffort: state.current.reasoningEffort } : selection;
        const result = await select(request);
        if (!mounted.current || popupEpoch.current !== epoch) return;
        if (!result?.ok) {
          setLocalError(result?.error?.code === 'session/writer-held' ? '该会话正在其他窗口使用，请稍后重试。' : result?.error?.message ?? '模型切换未成功，请重试。');
        } else if (!keepOpen) close();
      } catch (e) {
        if (mounted.current && popupEpoch.current === epoch) setLocalError(e instanceof Error ? e.message : String(e));
      } finally { inFlight.current = false; }
    };

    const changeList = (next) => { setList(next); setActive(null); setEditingNote(null); search.current?.focus(); };
    const toggleFavorite = (key) => {
      preferences.update((p) => ({ ...p, favorites: toggleKey(p.favorites, key) }));
      setActive(null); search.current?.focus();
    };
    const saveNote = () => {
      if (!editingNote) return;
      preferences.update((p) => ({ ...p, providerNotes: { ...p.providerNotes, [editingNote.id]: editingNote.draft } }));
      setEditingNote(null); search.current?.focus();
    };
    const toggleUncommon = (key) => {
      preferences.update((p) => ({ ...p, uncommon: toggleKey(p.uncommon, key) }));
      setActive(null);
      search.current?.focus();
    };
    const setAllCollapsed = (collapse) => {
      const keys = shown.map((g) => groupKey(list, g.id));
      preferences.update((p) => ({ ...p, collapsed: collapse ? [...new Set([...p.collapsed, ...keys])] : p.collapsed.filter((k) => !keys.includes(k)) }));
    };
    const onKeyDown = (event) => {
      if (event.nativeEvent?.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape' && event.target.closest?.('.dmo-note-editor')) {
        event.preventDefault(); event.stopPropagation(); setEditingNote(null); search.current?.focus(); return;
      }
      if (event.key === 'Tab') {
        const nodes = [...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter((n) => n.getClientRects().length);
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (event.target !== search.current || visible.length === 0 || busy) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const index = visible.findIndex((item) => item.key === active);
        const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : visible.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length;
        setActive(visible[next].key);
      } else if (event.key === 'Enter' && activeRow) {
        event.preventDefault();
        choose({ provider: activeRow.group.id, model: activeRow.model.id });
      }
    };
    if (!available) return null;

    const identity = (g, m) => [
      providerNote(prefs, g.id) && h('span', { className: 'dmo-account', key: 'note' }, `账号备注：${providerNote(prefs, g.id)}`),
      h('span', { className: 'dmo-identity', key: 'provider' }, `服务商：${g.name || g.id}（${g.id}）`),
      h('span', { className: 'dmo-identity dmo-id', key: 'model' }, `模型 ID：${m.id}`)
    ];
    const title = currentModel?.name ?? state.current?.model ?? '选择模型';
    const currentText = state.current ? `${currentNote ? currentNote + ' · ' : ''}${currentGroup?.name || state.current.provider}（${state.current.provider}） / ${state.current.model}` : '尚未选择模型';
    const labelEffort = reasoning?.efforts?.find((x) => x.id === effort)?.name ?? state.retainedEffort ?? effort ?? '';
    const toggle = () => {
      if (open) { close(); return; }
      ++popupEpoch.current;
      setQuery(''); setActive(null); setPosition(null); setLocalError(null);
      // Reopen the list containing the active model; never reclassify it.
      setList(state.current && prefs.uncommon.includes(modelKey(state.current.provider, state.current.model)) ? 'uncommon' : 'main');
      setOpen(true);
      Promise.resolve().then(load).catch((e) => { if (mounted.current) setLocalError(String(e.message ?? e)); });
    };
    const popup = open && h('div', {
      className: 'dmo-panel', id: popupId, ref: panel, role: 'dialog', 'aria-label': '模型选择器', 'aria-modal': true,
      style: position ?? { visibility: 'hidden', left: 0, top: 0 }, onKeyDown
    },
      h('div', { className: 'dmo-head' }, h('span', { className: 'dmo-title' }, '模型书架 · Model Shelf'), h('button', { type: 'button', className: 'dmo-close', 'aria-label': '关闭模型选择器', onClick: () => close() }, '×')),
      h('p', { className: 'dmo-hint' }, '由你手动整理：移至“不常用”不会删除模型或 API 配置，可随时移回。'),
      h('input', { ref: search, type: 'search', className: 'dmo-search', placeholder: '搜索模型、ID、服务商或账号备注…', 'aria-label': '搜索模型、ID、服务商或账号备注', value: query, onChange: (e) => { setQuery(e.target.value); setActive(null); } }),
      h('div', { className: 'dmo-tabs', role: 'tablist', 'aria-label': '模型列表分类' },
        h('button', { type: 'button', id: `${popupId}-main`, className: 'dmo-tab', role: 'tab', 'aria-selected': list === 'main', 'aria-controls': `${popupId}-list`, onClick: () => changeList('main') }, `主列表 (${allMain})`),
        h('button', { type: 'button', id: `${popupId}-uncommon`, className: 'dmo-tab', role: 'tab', 'aria-selected': list === 'uncommon', 'aria-controls': `${popupId}-list`, onClick: () => changeList('uncommon') }, `不常用 (${allUncommon})`),
        h('button', { type: 'button', id: `${popupId}-favorites`, className: 'dmo-tab', role: 'tab', 'aria-selected': list === 'favorites', 'aria-controls': `${popupId}-list`, onClick: () => changeList('favorites') }, `收藏 (${allFavorites})`)),
      h('div', { className: 'dmo-tools' },
        h('button', { type: 'button', disabled: searching || shown.length === 0, onClick: () => setAllCollapsed(false) }, '全部展开'),
        h('button', { type: 'button', disabled: searching || shown.length === 0, onClick: () => setAllCollapsed(true) }, '全部折叠'),
        h('span', null, searching ? '搜索时自动展开匹配分组' : '按服务商分组')),
      error && h('p', { className: 'dmo-error', role: 'alert' }, String(error)),
      (state.failures ?? []).map((failure) => h('p', { className: 'dmo-error', key: failure.id, role: 'status' }, `服务商 ${failure.name ?? failure.id} 加载失败：${failure.message ?? ''}`)),
      h('div', { className: 'dmo-list', id: `${popupId}-list`, role: 'tabpanel', 'aria-labelledby': `${popupId}-${list}`, 'aria-busy': state.status === 'loading' || busy },
        state.status === 'loading' && h('p', { className: 'dmo-empty', role: 'status' }, '正在加载模型…'),
        shown.map((g) => h('section', { className: 'dmo-group', key: g.id },
          h('div', { className: 'dmo-group-top' }, h('button', { type: 'button', className: 'dmo-group-heading', 'aria-expanded': expanded(g.id), onClick: () => {
            if (!searching) preferences.update((p) => ({ ...p, collapsed: toggleKey(p.collapsed, groupKey(list, g.id)) }));
          }, disabled: searching },
            h('span', { 'aria-hidden': true }, expanded(g.id) ? '▾' : '▸'),
            h('span', { className: 'dmo-group-title' }, g.name || g.id,
              providerNote(prefs, g.id) && h('span', { className: 'dmo-account' }, `账号备注：${providerNote(prefs, g.id)}`),
              h('span', { className: 'dmo-identity' }, `服务商 ID：${g.id}`)),
            h('span', { className: 'dmo-count' }, `${g.models.length} 款`)),
            h('button', { type: 'button', className: 'dmo-note-action', 'aria-label': `编辑账号备注：${g.name || g.id} / ${g.id}`, onClick: () => setEditingNote({ id: g.id, draft: providerNote(prefs, g.id) }) }, '账号备注')),
          editingNote?.id === g.id && h('div', { className: 'dmo-note-editor' },
            h('label', { className: 'dmo-note-label' }, '账号备注（仅本浏览器保存，勿填密钥）',
              h('input', { ref: noteInput, type: 'text', className: 'dmo-note-input', maxLength: 120, 'aria-label': `账号备注：${g.id}`, placeholder: '例如：个人账号 / 工作账号 / 备用账号', value: editingNote.draft,
                onChange: (e) => setEditingNote({ id: g.id, draft: e.target.value }), onKeyDown: (e) => {
                  if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                  if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); saveNote(); }
                  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditingNote(null); search.current?.focus(); }
                } })),
            h('div', { className: 'dmo-note-buttons' },
              h('button', { type: 'button', className: 'dmo-tab', onClick: saveNote }, '保存备注'),
              h('button', { type: 'button', className: 'dmo-tab', onClick: () => { setEditingNote(null); search.current?.focus(); } }, '取消'))),
          expanded(g.id) && g.models.map((m) => {
            const key = modelKey(g.id, m.id);
            const selected = state.current?.provider === g.id && state.current?.model === m.id;
            const accountSuffix = providerNote(prefs, g.id) ? `，账号备注 ${providerNote(prefs, g.id)}，服务商 ID ${g.id}` : '';
            return h('div', { className: 'dmo-row', key, 'data-model-key': key, 'data-highlighted': activeRow?.key === key },
              h('button', { type: 'button', className: 'dmo-select', disabled: busy, 'aria-label': `选择 ${g.name || g.id} 的 ${m.name || m.id}，模型 ID ${m.id}${providerNote(prefs, g.id) ? '，账号备注 ' + providerNote(prefs, g.id) : ''}`, 'aria-pressed': selected, onClick: () => choose({ provider: g.id, model: m.id }) },
                h('span', { className: 'dmo-check', 'aria-hidden': true }, selected ? '✓' : ''),
                h('span', { className: 'dmo-copy' }, h('span', { className: 'dmo-name' }, m.name || m.id), ...identity(g, m))),
              h('div', { className: 'dmo-row-actions' },
                h('button', { type: 'button', className: 'dmo-favorite', 'aria-pressed': prefs.favorites.includes(key), 'aria-label': `${prefs.favorites.includes(key) ? '取消收藏' : '收藏'}：${g.name || g.id} / ${m.id}${accountSuffix}`, onClick: () => toggleFavorite(key) }, prefs.favorites.includes(key) ? '★ 已收藏' : '☆ 收藏'),
                h('button', { type: 'button', className: 'dmo-move', 'aria-label': `${prefs.uncommon.includes(key) ? '移回主列表' : '移至不常用'}：${g.name || g.id} / ${m.id}${accountSuffix}`, onClick: () => toggleUncommon(key) }, prefs.uncommon.includes(key) ? '移回主列表' : '移至不常用')));
          }))),
        state.status !== 'loading' && shown.length === 0 && h('p', { className: 'dmo-empty', role: 'status' }, searching ? '该列表中没有匹配模型。可切换另一个列表继续搜索。' : list === 'favorites' ? '暂无收藏。请在任一列表点击模型旁的“☆ 收藏”。收藏不会改变主列表 / 不常用分类。' : list === 'uncommon' ? '暂无不常用模型。请在主列表点击模型旁的“移至不常用”。' : '主列表暂无模型；已移出的模型可在“不常用”列表中找回。')),
      h('div', { className: 'dmo-current' },
        h('div', null, '当前模型：', currentText),
        !reasoning && labelEffort && h('div', { className: 'dmo-identity' }, `已保留思考强度：${labelEffort}`),
        state.current && state.routable === false && h('div', { className: 'dmo-error', role: 'status' }, '当前模型暂不可用，原选择和思考强度已保留。'),
        reasoning?.efforts?.length > 0 && h('label', { className: 'dmo-effort-label' }, '思考强度', h('select', { className: 'dmo-effort', 'aria-label': '思考强度', value: effort ?? '', disabled: busy, onChange: (e) => choose({ provider: state.current.provider, model: state.current.model, reasoningEffort: e.target.value }, true) },
          effort === undefined && h('option', { value: '' }, '服务商默认'),
          effort !== undefined && !reasoning.efforts.some((x) => x.id === effort) && h('option', { value: effort }, `${effort}（当前值）`),
          reasoning.efforts.map((x) => h('option', { key: x.id, value: x.id }, x.name || x.id)))),
        h('div', { className: 'dmo-identity' }, '分类、收藏、备注及折叠偏好保存在当前浏览器；不会自动分类。'),
        (localError || state.status === 'error' || state.failures?.length > 0) && h('button', { type: 'button', className: 'dmo-tab', onClick: () => { setLocalError(null); Promise.resolve().then(load).catch((e) => setLocalError(String(e.message ?? e))); } }, '重新加载')));
    return h(React.Fragment, null,
      h('button', { ref: trigger, type: 'button', className: 'dmo-trigger', disabled: locked, 'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': open ? popupId : undefined, title: `${currentText}${labelEffort ? ` · ${labelEffort}` : ''}`, onClick: toggle },
        h('span', { className: 'dmo-trigger-copy' }, `${currentNote ? currentNote + ' · ' : ''}${title}${labelEffort ? ` · ${labelEffort}` : ''}`), h('span', { 'aria-hidden': true }, busy ? '…' : open ? '▴' : '▾')),
      popup && createPortal(popup, document.body));
  };
}

function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-model-shelf';
    style.textContent = ".dmo-trigger{display:flex;align-items:center;gap:6px;max-width:min(480px,55cqw);min-width:0;height:30px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#666);font:inherit;font-size:13px;cursor:pointer}.dmo-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,#eee)}.dmo-trigger-copy{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dmo-trigger:focus-visible,.dmo-panel button:focus-visible,.dmo-search:focus-visible,.dmo-effort:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}.dmo-trigger:disabled,.dmo-panel button:disabled{opacity:.5;cursor:default}.dmo-panel{position:fixed;z-index:1200;box-sizing:border-box;width:min(640px,calc(100vw - 24px));max-height:min(720px,calc(100dvh - 32px));display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:14px;background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary,#222);box-shadow:0 8px 36px #0003;font-family:inherit;font-size:13px}.dmo-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px 8px}.dmo-title{font-weight:600;font-size:15px}.dmo-panel button{font:inherit;color:inherit}.dmo-close{border:0;border-radius:6px;background:transparent;width:28px;height:28px;cursor:pointer}.dmo-hint{margin:0;padding:0 16px 10px;color:var(--dsw-alias-label-tertiary,#777);font-size:12px;line-height:1.5}.dmo-search{box-sizing:border-box;width:calc(100% - 32px);margin:0 16px 10px;padding:9px 11px;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit}.dmo-tabs{display:flex;gap:6px;padding:0 16px 10px}\n.dmo-tabs{flex-wrap:wrap}\n.dmo-group-top{display:flex;align-items:stretch;gap:4px}\n.dmo-group-top .dmo-group-heading{flex:1;min-width:0;width:auto}\n.dmo-note-action{flex:none;align-self:center;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;padding:6px;cursor:pointer;font-size:11px!important}\n.dmo-account{display:block;color:var(--dsw-alias-state-business-primary,#4d6bfe);font-size:12px;font-weight:500;line-height:1.5;overflow-wrap:anywhere}\n.dmo-row-actions{display:flex;flex:none;flex-direction:column;gap:5px;align-items:stretch;max-width:105px;margin-right:5px}\n.dmo-row-actions .dmo-move{margin-right:0;align-self:stretch}\n.dmo-favorite{padding:6px 8px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;font-size:11px!important;cursor:pointer}\n.dmo-favorite[aria-pressed=true]{color:var(--dsw-alias-state-business-primary,#4d6bfe);background:var(--dsw-alias-interactive-bg-hover,#eef1ff)}\n.dmo-note-editor{padding:10px;margin:4px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:8px}\n.dmo-note-label{display:block;font-size:12px;color:var(--dsw-alias-label-secondary,#666)}\n.dmo-note-input{display:block;box-sizing:border-box;width:100%;margin:6px 0 8px;padding:8px;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:6px;background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit}\n.dmo-note-input:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}\n.dmo-note-buttons{display:flex;gap:6px}\n.dmo-tab{border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:8px;background:transparent;padding:7px 12px;cursor:pointer}.dmo-tab[aria-selected=true]{background:var(--dsw-alias-interactive-bg-hover,#eef1ff);color:var(--dsw-alias-state-business-primary,#4d6bfe);border-color:var(--dsw-alias-state-business-primary,#4d6bfe)}.dmo-tools{display:flex;gap:6px;padding:0 16px 8px;color:var(--dsw-alias-label-tertiary,#777);font-size:12px;align-items:center}.dmo-tools button{border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;padding:5px 9px;cursor:pointer;font-size:12px!important;color:inherit}.dmo-tools span{margin-left:auto}.dmo-list{padding:6px 8px 10px;overflow:auto;flex:1;min-height:0}.dmo-group{margin:6px 0;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:10px;overflow:hidden}.dmo-group-heading{display:flex;align-items:center;gap:8px;padding:9px 10px;width:100%;border:0;border-radius:0;background:transparent;text-align:left;cursor:pointer}.dmo-group-heading[disabled]{cursor:default;color:var(--dsw-alias-label-tertiary,#777)}.dmo-group-title{display:flex;flex-direction:column;flex:1;min-width:0}.dmo-count{flex:none;color:var(--dsw-alias-label-tertiary,#777);font-size:12px}.dmo-row{display:flex;align-items:stretch;gap:6px;padding:0 6px;border-top:1px solid var(--dsw-alias-border-l1,#ddd)}.dmo-row:hover,.dmo-row[data-highlighted=true]{background:var(--dsw-alias-interactive-bg-hover,#f2f4ff)}.dmo-select{flex:1;min-width:0;display:flex;align-items:center;gap:8px;text-align:left;padding:10px 8px;border:0;border-radius:8px;background:transparent;cursor:pointer}.dmo-check{width:16px;flex:none;color:var(--dsw-alias-state-business-primary,#4d6bfe)}.dmo-copy{min-width:0;display:flex;flex-direction:column;gap:4px}.dmo-name{font-weight:500;line-height:1.5;overflow-wrap:anywhere}.dmo-identity{display:block;color:var(--dsw-alias-label-tertiary,#777);font-size:11px;line-height:1.5;overflow-wrap:anywhere}.dmo-id{font-family:ui-monospace,Consolas,monospace}.dmo-move{flex:none;align-self:center;padding:6px 8px;max-width:105px;margin-right:5px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;font-size:11px!important;cursor:pointer}\n.dmo-empty{padding:24px 10px;text-align:center;line-height:1.6;color:var(--dsw-alias-label-tertiary,#777)}.dmo-error{padding:8px 16px;margin:0;color:var(--dsw-alias-state-error-primary,#c33);font-size:12px;overflow-wrap:anywhere}.dmo-current{padding:10px 16px;border-top:1px solid var(--dsw-alias-border-l1,#ddd);font-size:12px;line-height:1.6;flex:none;overflow-wrap:anywhere}.dmo-effort-label{display:flex;align-items:center;gap:8px;margin-top:6px}.dmo-effort{padding:5px;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:6px;background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit;max-width:75%}\n@media(max-width:480px){.dmo-head{padding:12px}\n.dmo-move{max-width:76px}\n.dmo-trigger{max-width:48cqw}\n}";
    document.head.appendChild(style);
    return () => style.remove();
  });
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('storage unavailable'); }, setItem() { throw new Error('storage unavailable'); } }; }
  const preferences = createPreferenceStore(storage, window);
  ctx.effect(() => () => preferences.dispose());
  const ModelPicker = makeModelPicker(preferences);
  ctx.slots.inject('conversation.input.model', () => ctx.slots.register({
    name: 'conversation.input.model', priority: -100,
    inject: (sessionId) => {
      const directory = ctx.modelDirectories.directoryFor(sessionId);
      const available = ctx.sessions.subagentAddress(sessionId) === undefined;
      return {
        available, directory: directory.store,
        load: () => available ? directory.load() : undefined,
        select: async (selection) => {
          if (!available) return undefined;
          try { return await directory.select(selection); }
          catch (error) {
            // Native select can leave its shared directory in 'selecting' on RPC rejection.
            // Its connection-reset method clears pending selection and invalidates stale replies.
            directory.resetConnected();
            throw error;
          }
        }
      };
    }
  }, ModelPicker));
}

return { apply, inject, makeModelPicker };
  }
});
