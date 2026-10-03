import { modelKey, groupKey, toggleKey, partitionModels, createPreferenceStore } from './preferences.js';

// React and ReactDOM come from the running DSH client, never a second React copy.
const React = require('react');
const { createPortal } = require('react-dom');
const { createElement: h, useState, useRef, useEffect, useLayoutEffect, useSyncExternalStore, useId } = React;
// Service method calls inherit the consumer's Cordis context; directoryFor creates
// a directory using remote.session, so declare the nested capability explicitly.
export const inject = ['slots', 'modelDirectories', 'sessions', 'remote', 'remote.session'];

export function makeModelPicker(preferences) {
  return function ModelPicker({ locked, available, directory, load, select }) {
    const state = useSyncExternalStore(directory.subscribe.bind(directory), directory.getSnapshot.bind(directory));
    const prefs = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
    const [open, setOpen] = useState(false);
    const [list, setList] = useState('main');
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(null);
    const [position, setPosition] = useState(null);
    const [localError, setLocalError] = useState(null);
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
        if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); close(); }
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

    const changeList = (next) => { setList(next); setActive(null); search.current?.focus(); };
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
      h('span', { className: 'dmo-identity', key: 'provider' }, `服务商：${g.name || g.id}（${g.id}）`),
      h('span', { className: 'dmo-identity dmo-id', key: 'model' }, `模型 ID：${m.id}`)
    ];
    const title = currentModel?.name ?? state.current?.model ?? '选择模型';
    const currentText = state.current ? `${currentGroup?.name || state.current.provider} / ${state.current.model}` : '尚未选择模型';
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
      h('input', { ref: search, type: 'search', className: 'dmo-search', placeholder: '搜索模型名称、模型 ID 或服务商…', 'aria-label': '搜索模型、ID 或服务商', value: query, onChange: (e) => { setQuery(e.target.value); setActive(null); } }),
      h('div', { className: 'dmo-tabs', role: 'tablist', 'aria-label': '模型列表分类' },
        h('button', { type: 'button', id: `${popupId}-main`, className: 'dmo-tab', role: 'tab', 'aria-selected': list === 'main', 'aria-controls': `${popupId}-list`, onClick: () => changeList('main') }, `主列表 (${allMain})`),
        h('button', { type: 'button', id: `${popupId}-uncommon`, className: 'dmo-tab', role: 'tab', 'aria-selected': list === 'uncommon', 'aria-controls': `${popupId}-list`, onClick: () => changeList('uncommon') }, `不常用 (${allUncommon})`)),
      h('div', { className: 'dmo-tools' },
        h('button', { type: 'button', disabled: searching || shown.length === 0, onClick: () => setAllCollapsed(false) }, '全部展开'),
        h('button', { type: 'button', disabled: searching || shown.length === 0, onClick: () => setAllCollapsed(true) }, '全部折叠'),
        h('span', null, searching ? '搜索时自动展开匹配分组' : '按服务商分组')),
      error && h('p', { className: 'dmo-error', role: 'alert' }, String(error)),
      (state.failures ?? []).map((failure) => h('p', { className: 'dmo-error', key: failure.id, role: 'status' }, `服务商 ${failure.name ?? failure.id} 加载失败：${failure.message ?? ''}`)),
      h('div', { className: 'dmo-list', id: `${popupId}-list`, role: 'tabpanel', 'aria-labelledby': `${popupId}-${list}`, 'aria-busy': state.status === 'loading' || busy },
        state.status === 'loading' && h('p', { className: 'dmo-empty', role: 'status' }, '正在加载模型…'),
        shown.map((g) => h('section', { className: 'dmo-group', key: g.id },
          h('button', { type: 'button', className: 'dmo-group-heading', 'aria-expanded': expanded(g.id), onClick: () => {
            if (!searching) preferences.update((p) => ({ ...p, collapsed: toggleKey(p.collapsed, groupKey(list, g.id)) }));
          }, disabled: searching },
            h('span', { 'aria-hidden': true }, expanded(g.id) ? '▾' : '▸'),
            h('span', { className: 'dmo-group-title' }, g.name || g.id, h('span', { className: 'dmo-identity' }, `服务商 ID：${g.id}`)),
            h('span', { className: 'dmo-count' }, `${g.models.length} 款`)),
          expanded(g.id) && g.models.map((m) => {
            const key = modelKey(g.id, m.id);
            const selected = state.current?.provider === g.id && state.current?.model === m.id;
            return h('div', { className: 'dmo-row', key, 'data-model-key': key, 'data-highlighted': activeRow?.key === key },
              h('button', { type: 'button', className: 'dmo-select', disabled: busy, 'aria-label': `选择 ${g.name || g.id} 的 ${m.name || m.id}，模型 ID ${m.id}`, 'aria-pressed': selected, onClick: () => choose({ provider: g.id, model: m.id }) },
                h('span', { className: 'dmo-check', 'aria-hidden': true }, selected ? '✓' : ''),
                h('span', { className: 'dmo-copy' }, h('span', { className: 'dmo-name' }, m.name || m.id), ...identity(g, m))),
              h('button', { type: 'button', className: 'dmo-move', 'aria-label': `${list === 'main' ? '移至不常用' : '移回主列表'}：${g.name || g.id} / ${m.id}`, onClick: () => toggleUncommon(key) }, list === 'main' ? '移至不常用' : '移回主列表'));
          }))),
        state.status !== 'loading' && shown.length === 0 && h('p', { className: 'dmo-empty', role: 'status' }, searching ? '该列表中没有匹配模型。可切换另一个列表继续搜索。' : list === 'uncommon' ? '暂无不常用模型。请在主列表点击模型旁的“移至不常用”。' : '主列表暂无模型；已移出的模型可在“不常用”列表中找回。')),
      h('div', { className: 'dmo-current' },
        h('div', null, '当前模型：', currentText),
        !reasoning && labelEffort && h('div', { className: 'dmo-identity' }, `已保留思考强度：${labelEffort}`),
        state.current && state.routable === false && h('div', { className: 'dmo-error', role: 'status' }, '当前模型暂不可用，原选择和思考强度已保留。'),
        reasoning?.efforts?.length > 0 && h('label', { className: 'dmo-effort-label' }, '思考强度', h('select', { className: 'dmo-effort', 'aria-label': '思考强度', value: effort ?? '', disabled: busy, onChange: (e) => choose({ provider: state.current.provider, model: state.current.model, reasoningEffort: e.target.value }, true) },
          effort === undefined && h('option', { value: '' }, '服务商默认'),
          effort !== undefined && !reasoning.efforts.some((x) => x.id === effort) && h('option', { value: effort }, `${effort}（当前值）`),
          reasoning.efforts.map((x) => h('option', { key: x.id, value: x.id }, x.name || x.id)))),
        h('div', { className: 'dmo-identity' }, '分类及折叠偏好保存在当前浏览器；不会自动按使用频率分类。'),
        (localError || state.status === 'error' || state.failures?.length > 0) && h('button', { type: 'button', className: 'dmo-tab', onClick: () => { setLocalError(null); Promise.resolve().then(load).catch((e) => setLocalError(String(e.message ?? e))); } }, '重新加载')));
    return h(React.Fragment, null,
      h('button', { ref: trigger, type: 'button', className: 'dmo-trigger', disabled: locked, 'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': open ? popupId : undefined, title: `${currentText}${labelEffort ? ` · ${labelEffort}` : ''}`, onClick: toggle },
        h('span', { className: 'dmo-trigger-copy' }, `${title}${labelEffort ? ` · ${labelEffort}` : ''}`), h('span', { 'aria-hidden': true }, busy ? '…' : open ? '▴' : '▾')),
      popup && createPortal(popup, document.body));
  };
}

export function apply(ctx) {
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
