import { modelKey, groupKey, toggleKey, partitionModels, favoriteRows, isUncommon, orderedKeys, reorderKeys, setProviderUncommon, setFavorite, createPreferenceStore, providerNote } from './preferences.js';
import { isWorkBuddyProvider, loadProbeStatus, requestProbe, probeStateFor, effortSourceFor, contextWindowFor, formatCapacity, requestContextWindow } from './workbuddy-probe.js';

// React and ReactDOM come from the running DSH client, never a second React copy.
const React = require('react');
const { createPortal } = require('react-dom');
const { createElement: h, useState, useRef, useEffect, useLayoutEffect, useSyncExternalStore, useId } = React;
// Service method calls inherit the consumer's Cordis context; directoryFor creates
// a directory using remote.session, so declare the nested capability explicitly.
export const inject = ['slots', 'modelDirectories', 'sessions', 'remote', 'remote.session'];

// DSH 0.2.1 gives the model seat a child slot, `conversation.input.model.label`,
// that host badges (the built-in 1017 marker) register into. Rendering it needs
// the entry to *declare* that key, and a key may only be declared once — so
// declaring it here would make the host's own model-selection plugin throw
// `slot "…" is already declared` on every load. That is a real regression, not a
// cosmetic one, so this plugin deliberately does not declare it and renders
// plain model names: the host badge is simply absent inside the shelf.
// See README "兼容性" and docs/HOST-COMPATIBILITY.md.

// Record unsearched catalog arrivals, retaining offline identities and their slots.
// Returning the original snapshot when equal is essential: store updates notify React.
function withCatalogOrder(prefs, groups) {
  const merge = (saved, current) => orderedKeys(saved, [...saved, ...current]);
  const same = (a, b) => a.length === b.length && a.every((key, i) => key === b[i]);
  const main = merge(prefs.providerOrder.main, partitionModels(groups, prefs, 'main').map(g => g.id));
  const uncommon = merge(prefs.providerOrder.uncommon, partitionModels(groups, prefs, 'uncommon').map(g => g.id));
  const favorites = merge(prefs.favoriteOrder, favoriteRows(groups, prefs).map(row => row.key));
  if (same(main, prefs.providerOrder.main) && same(uncommon, prefs.providerOrder.uncommon) && same(favorites, prefs.favoriteOrder)) return prefs;
  return { ...prefs, providerOrder: { main, uncommon }, favoriteOrder: favorites };
}

export function makeModelPicker(preferences) {
  return function ModelPicker({ locked, available, directory, load, select }) {
    const state = useSyncExternalStore(directory.subscribe.bind(directory), directory.getSnapshot.bind(directory));
    const prefs = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
    const [open, setOpen] = useState(false);
    const [list, setList] = useState('main');
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(null);
    const [orderStatus, setOrderStatus] = useState('');
    const drag = useRef(null);
    const [dropKey, setDropKey] = useState(null);
    const suppressClick = useRef(false);
    const cancelDrag = () => { drag.current = null; setDropKey(null); };
    const finishDrag = () => {
      cancelDrag();
      // Native dragend can be followed by a click; do not select or fold then.
      setTimeout(() => { suppressClick.current = false; }, 0);
    };
    const [position, setPosition] = useState(null);
    const [localError, setLocalError] = useState(null);
    const [probeStatus, setProbeStatus] = useState(undefined);
    const [probeBusy, setProbeBusy] = useState(false);
    const [contextBusy, setContextBusy] = useState(false);
    const [probeConfirm, setProbeConfirm] = useState(false);
    const [probeNote, setProbeNote] = useState(null);
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
    const flatFavorites = favoriteRows(groups, prefs, query);
    const visible = list === 'favorites' ? flatFavorites : shown.flatMap((g) => expanded(g.id) ? g.models.map((m) => ({ group: g, model: m, key: modelKey(g.id, m.id) })) : []);
    useEffect(() => {
      // Discovery is not consent to replace unreadable storage or clear its warning.
      if (!preferences.getError() && withCatalogOrder(prefs, groups) !== prefs) preferences.update(p => withCatalogOrder(p, groups));
    }, [groups, prefs]);
    const orderKind = list === 'favorites' ? 'favorite' : 'provider';
    const orderKeys = (p = preferences.getSnapshot(), catalog = directory.getSnapshot().groups ?? []) => list === 'favorites'
      ? favoriteRows(catalog, p).map(row => row.key)
      : partitionModels(catalog, p, list).map(g => g.id);
    // Invalidate on every observed departure, not just at drop: switching back
    // or a disappearing source returning must never resurrect an old gesture.
    useLayoutEffect(() => {
      if (drag.current && (!open || searching || drag.current.list !== list || !orderKeys().includes(drag.current.key))) cancelDrag();
    }, [open, query, list, groups, prefs]);
    const validMove = (payload, target) => {
      const keys = orderKeys();
      return open && !searching && payload?.list === list && payload.kind === orderKind
        && keys.includes(payload.key) && keys.includes(target) && payload.key !== target;
    };
    const reorder = (payload, target) => {
      if (!validMove(payload, target)) return;
      preferences.update(p => {
        const seeded = withCatalogOrder(p, directory.getSnapshot().groups ?? []);
        const keys = payload.kind === 'favorite' ? seeded.favoriteOrder : seeded.providerOrder[list];
        const next = reorderKeys(keys, payload.key, target);
        return payload.kind === 'favorite' ? { ...seeded, favoriteOrder: next }
          : { ...seeded, providerOrder: { ...seeded.providerOrder, [list]: next } };
      });
      const keys = orderKeys();
      setOrderStatus(`${payload.key} 已移至第 ${keys.indexOf(payload.key) + 1} / ${keys.length} 项`);
    };
    const dropProps = (key) => ({
      'data-drop-target': dropKey === key || undefined,
      onDragOver: e => { if (validMove(drag.current, key)) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropKey(key); } },
      onDrop: e => { e.preventDefault(); e.stopPropagation(); reorder(drag.current, key); finishDrag(); },
      onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropKey(null); }
    });
    const renderedOrderKeys = orderKeys(prefs, groups);
    const orderControls = (key, label) => {
      const keys = renderedOrderKeys, index = keys.indexOf(key);
      const step = (direction, event) => {
        event.stopPropagation();
        const controls = event.currentTarget.parentElement;
        const current = orderKeys(), neighbor = current[current.indexOf(key) + direction];
        reorder({ list, kind: orderKind, key }, neighbor);
        // Keep the same action unless it has reached the boundary, then offer
        // the reverse action on the same identity rather than losing focus.
        queueMicrotask(() => {
          const preferred = controls.querySelector(direction < 0 ? '.dmo-order-up' : '.dmo-order-down');
          (preferred?.disabled ? controls.querySelector(direction < 0 ? '.dmo-order-down' : '.dmo-order-up') : preferred)?.focus();
        });
      };
      return h('div', { className: 'dmo-order', onClick: e => e.stopPropagation() },
      h('button', { type: 'button', className: 'dmo-drag', disabled: searching, draggable: !searching, 'aria-label': `拖动排序：${label}`, title: '拖动排序',
        onDragStart: e => { if (searching) { e.preventDefault(); return; } drag.current = { list, kind: orderKind, key }; suppressClick.current = true; e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', key); },
        onDragEnd: finishDrag }, '⠿'),
      h('button', { type: 'button', className: 'dmo-order-up', disabled: searching || index <= 0, 'aria-label': `上移：${label}`, onClick: e => step(-1, e) }, '↑'),
      h('button', { type: 'button', className: 'dmo-order-down', disabled: searching || index >= keys.length - 1, 'aria-label': `下移：${label}`, onClick: e => step(1, e) }, '↓'));
    };
    const currentGroup = groups.find((g) => g.id === state.current?.provider);
    const currentModel = currentGroup?.models.find((m) => m.id === state.current?.model);
    const reasoning = currentModel?.reasoning;
    const effort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
    const busy = locked || state.status === 'selecting';
    const activeRow = visible.find((item) => item.key === active) ?? visible[0];
    const error = localError ?? state.error ?? preferences.getError();
    // WorkBuddy detection state for the *current* model. The picker only ever
    // changes that model's reasoning effort, so it is the only model whose
    // detection state can change anything here.
    const probe = probeStateFor(probeStatus, state.current?.model);
    const effortSource = effortSourceFor(probeStatus, state.current?.model);
    // Per-model context window: only a CTXPATCH host reports capacities at all,
    // so an unpatched install simply never produces a row here.
    const contextRow = contextWindowFor(probeStatus, state.current?.model);
    const declaredEfforts = (reasoning?.efforts?.length ?? 0) > 0;
    const detection = state.current && !declaredEfforts && probe.kind === 'detectable' ? probe : null;
    // A verified verdict the directory has not published yet. Reporting it is the
    // honest option: the picker must not invent a level the adapter does not offer.
    const staleDetected = probe.kind === 'detected' && !declaredEfforts;

    useEffect(() => {
      mounted.current = true;
      return () => { mounted.current = false; };
    }, []);

    // Ask the owning plugin once per popup (and per model), never per render:
    // its status route also fetches live credit, and this plugin is a guest.
    useEffect(() => {
      if (!open) return;
      setProbeConfirm(false);
      setProbeNote(null);
      const providerId = state.current?.provider;
      if (!isWorkBuddyProvider(providerId)) { setProbeStatus(undefined); return; }
      let cancelled = false;
      setProbeStatus(undefined);
      loadProbeStatus(providerId)
        .then((status) => { if (!cancelled) setProbeStatus(status); })
        .catch(() => { if (!cancelled) setProbeStatus(undefined); });
      return () => { cancelled = true; };
    }, [open, state.current?.provider, state.current?.model]);

    const close = (restore = true) => {
      cancelDrag();
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
        // `resetEffort` is this plugin's own flag, never a value the directory
        // accepts: it selects the same model with no `reasoningEffort` at all,
        // which is exactly how the shared directory's own "Default" entry clears
        // a customised level. It must therefore bypass the retention below.
        const { resetEffort, ...pick } = selection;
        // Reselecting the current model must not reset a customized reasoning effort —
        // but only while the exact target model still publishes that effort. A route
        // that declares no effort levels must fall back to its own default instead of
        // inheriting a level its upstream rejects.
        const sameModel = state.current?.provider === pick.provider && state.current?.model === pick.model;
        const targetEfforts = (state.groups ?? []).find((g) => g.id === pick.provider)?.models.find((m) => m.id === pick.model)?.reasoning?.efforts ?? [];
        const retainedEffort = state.current?.reasoningEffort;
        const keepEffort = resetEffort !== true && sameModel && pick.reasoningEffort === undefined && retainedEffort !== undefined
          && targetEfforts.some((x) => x.id === retainedEffort);
        const request = keepEffort ? { ...pick, reasoningEffort: retainedEffort } : pick;
        const result = await select(request);
        if (!mounted.current || popupEpoch.current !== epoch) return;
        if (!result?.ok) {
          setLocalError(result?.error?.code === 'session/writer-held' ? '该会话正在其他窗口使用，请稍后重试。' : result?.error?.message ?? '模型切换未成功，请重试。');
        } else if (!keepOpen) close();
      } catch (e) {
        if (mounted.current && popupEpoch.current === epoch) setLocalError(e instanceof Error ? e.message : String(e));
      } finally { inFlight.current = false; }
    };

    const changeList = (next) => {
      cancelDrag();
      preferences.update(p => ({ ...p, lastList: next }));
      setList(next); setActive(null); setEditingNote(null); search.current?.focus();
    };
    const toggleFavorite = (provider, model) => {
      preferences.update(p => setFavorite(p, provider, model, !p.favorites.includes(modelKey(provider, model))));
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
    const moveProvider = (provider, uncommon) => {
      // Seed the entire destination before moving, never just the searched subset.
      preferences.update(p => setProviderUncommon(withCatalogOrder(p, groups), provider, uncommon));
      setActive(null); search.current?.focus();
    };
    const setAllCollapsed = (collapse) => {
      const keys = shown.map((g) => groupKey(list, g.id));
      preferences.update((p) => ({ ...p, collapsed: collapse ? [...new Set([...p.collapsed, ...keys])] : p.collapsed.filter((k) => !keys.includes(k)) }));
    };
    const onKeyDown = (event) => {
      suppressClick.current = false;
      cancelDrag();
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
      // An explicit remembered tab wins even when empty; legacy users follow classification.
      setList(prefs.lastList ?? (state.current && isUncommon(prefs, state.current.provider, state.current.model) ? 'uncommon' : 'main'));
      setOpen(true);
      Promise.resolve().then(load).catch((e) => { if (mounted.current) setLocalError(String(e.message ?? e)); });
    };
    // Pin or clear this model's window. The owner keeps the choice; reloading the
    // directory is what makes the new size reach the next request.
    const applyContextWindow = async (contextWindow) => {
      const providerId = state.current?.provider;
      const modelId = state.current?.model;
      if (providerId === undefined || modelId === undefined) return;
      setContextBusy(true);
      setProbeNote(null);
      try {
        const result = await requestContextWindow(providerId, probeStatus, modelId, contextWindow);
        if (result.state !== 'ok') {
          if (mounted.current) setProbeNote({ tone: 'error', text: result.reason ?? '容量修改未生效。' });
          return;
        }
        try { await Promise.resolve(load()); } catch { /* a rejected reload keeps the old directory, which is still safe */ }
        const refreshed = await loadProbeStatus(providerId, { force: true });
        if (!mounted.current) return;
        setProbeStatus(refreshed);
        setProbeNote({ tone: 'ok', text: contextWindow === null ? '已恢复服务商默认容量。' : `上下文容量已设为 ${formatCapacity(contextWindow)}。` });
      } catch (error) {
        if (mounted.current) setProbeNote({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
      } finally {
        if (mounted.current) setContextBusy(false);
      }
    };
    const runDetection = async () => {
      const providerId = state.current?.provider;
      const modelId = state.current?.model;
      setProbeConfirm(false);
      setProbeNote(null);
      if (providerId === undefined || modelId === undefined) return;
      setProbeBusy(true);
      try {
        const result = await requestProbe(providerId, probeStatus, modelId);
        if (result.state !== 'ok') {
          if (mounted.current) setProbeNote({ tone: 'error', text: result.reason ?? '检测未完成。' });
          return;
        }
        // A successful detection makes the owning plugin invalidate its catalog;
        // reloading the directory is what turns the verdict into a dropdown.
        try { await Promise.resolve(load()); } catch { /* a rejected reload keeps the old directory, which is still safe */ }
        const refreshed = await loadProbeStatus(providerId, { force: true });
        if (!mounted.current) return;
        setProbeStatus(refreshed);
        setProbeNote(result.validation === 'validating' && result.efforts.length > 0
          ? { tone: 'ok', text: `已检测：${result.efforts.join(' / ')}` }
          : result.validation === 'non-validating'
            ? { tone: 'error', text: '上游接受任意档位取值，无法确认有效档位，因此不提供档位选择。' }
            : { tone: 'error', text: '检测未得到可用档位。' });
      } catch (error) {
        if (mounted.current) setProbeNote({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
      } finally {
        if (mounted.current) setProbeBusy(false);
      }
    };
    const probeBlock = !state.current ? null : probeBusy
      ? h('p', { className: 'dmo-probe', role: 'status' }, '正在检测思考强度…')
      : h(React.Fragment, null,
        probeNote !== null && !staleDetected && h('p', { className: `dmo-probe ${probeNote.tone === 'ok' ? 'dmo-probe-ok' : 'dmo-probe-error'}`, role: 'status' }, probeNote.text),
        detection !== null && (probeConfirm
          ? h('div', { className: 'dmo-probe-confirm' },
            h('span', null, `将请求 WorkBuddy 向上游发送探测请求，以确认「${currentModel?.name || state.current.model}」接受的思考强度档位。`),
            h('div', { className: 'dmo-note-buttons' },
              h('button', { type: 'button', className: 'dmo-tab', disabled: busy, onClick: runDetection }, '确认检测'),
              h('button', { type: 'button', className: 'dmo-tab', onClick: () => setProbeConfirm(false) }, '取消')))
          : h('p', { className: 'dmo-probe' },
            h('span', null, '该模型未声明思考强度，可由 WorkBuddy 检测。'),
            h('button', { type: 'button', className: 'dmo-effort-reset', disabled: busy, onClick: () => { setProbeNote(null); setProbeConfirm(true); } }, '检测思考强度'))),
        detection === null && probeNote === null && probe.kind === 'rejected' && h('p', { className: 'dmo-probe', role: 'status' }, '该模型已检测：上游接受任意档位取值，因此不提供档位选择。'),
        // A detected model whose levels have not reached the directory yet: the
        // verdict is known, the control is not. Offer the refresh, not a fake select.
        detection === null && staleDetected && h('p', { className: 'dmo-probe' },
          h('span', null, `已探测到档位：${probe.efforts.join(' / ')}（模型面板尚未更新）`),
          h('button', { type: 'button', className: 'dmo-effort-reset', disabled: busy, onClick: () => { setLocalError(null); Promise.resolve().then(load).catch((e) => setLocalError(String(e.message ?? e))); } }, '刷新档位')),
        detection === null && probeNote === null && probe.kind === 'signed-out' && !declaredEfforts && h('p', { className: 'dmo-probe', role: 'status' }, 'WorkBuddy 未登录，暂时无法检测思考强度。'));
    const noteAction = (g) => h('button', { type: 'button', className: 'dmo-note-action', 'aria-label': `编辑账号备注：${g.name || g.id} / ${g.id}`, onClick: (e) => { e.stopPropagation(); setEditingNote({ id: g.id, draft: providerNote(prefs, g.id) }); } }, '账号备注');
    const providerAction = (g) => {
      const archived = prefs.uncommonProviders.includes(g.id);
      return h('button', { type: 'button', className: 'dmo-provider-action', 'aria-label': `${archived ? '恢复服务商' : '整组移至不常用'}：${g.id}`, onClick: (e) => { e.stopPropagation(); moveProvider(g.id, !archived); } }, archived ? '恢复服务商' : '整组移至不常用');
    };
    const noteEditor = editingNote && h('div', { className: 'dmo-note-editor' },
      h('label', { className: 'dmo-note-label' }, '账号备注（仅本浏览器保存，勿填密钥）',
        h('input', { ref: noteInput, type: 'text', className: 'dmo-note-input', maxLength: 120, 'aria-label': `账号备注：${editingNote.id}`, placeholder: '例如：个人账号 / 工作账号 / 备用账号', value: editingNote.draft,
          onChange: (e) => setEditingNote({ id: editingNote.id, draft: e.target.value }), onKeyDown: (e) => {
            if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); saveNote(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditingNote(null); search.current?.focus(); }
          } })),
      h('div', { className: 'dmo-note-buttons' },
        h('button', { type: 'button', className: 'dmo-tab', onClick: saveNote }, '保存备注'),
        h('button', { type: 'button', className: 'dmo-tab', onClick: () => { setEditingNote(null); search.current?.focus(); } }, '取消')));
    const renderRow = (g, m) => {
      const key = modelKey(g.id, m.id);
      const archived = prefs.uncommonProviders.includes(g.id);
      const selected = state.current?.provider === g.id && state.current?.model === m.id;
      const accountSuffix = providerNote(prefs, g.id) ? `，账号备注 ${providerNote(prefs, g.id)}，服务商 ID ${g.id}` : '';
      return h('div', { className: 'dmo-row', key, 'data-model-key': key, 'data-provider-id': g.id, 'data-highlighted': activeRow?.key === key, ...(list === 'favorites' ? dropProps(key) : {}) },
        list === 'favorites' && orderControls(key, `${g.id} / ${m.id}`),
        h('div', { role: 'button', tabIndex: 0, className: 'dmo-select', 'aria-disabled': busy, 'aria-label': `选择 ${g.name || g.id} 的 ${m.name || m.id}，模型 ID ${m.id}${providerNote(prefs, g.id) ? '，账号备注 ' + providerNote(prefs, g.id) : ''}`, 'aria-pressed': selected, onClick: () => { if (!busy) choose({ provider: g.id, model: m.id }); }, onKeyDown: (e) => { if (e.nativeEvent?.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!busy) choose({ provider: g.id, model: m.id }); } } },
          h('span', { className: 'dmo-check', 'aria-hidden': true }, selected ? '✓' : ''),
          h('span', { className: 'dmo-copy' }, h('span', { className: 'dmo-name' }, m.name || m.id), ...identity(g, m))),
        h('div', { className: 'dmo-row-actions' },
          h('button', { type: 'button', className: 'dmo-favorite', 'aria-pressed': prefs.favorites.includes(key), 'aria-label': `${prefs.favorites.includes(key) ? '取消收藏' : '收藏'}：${g.name || g.id} / ${m.id}${accountSuffix}`, onClick: () => toggleFavorite(g.id, m.id) }, prefs.favorites.includes(key) ? '★ 已收藏' : '☆ 收藏'),
          h('button', { type: 'button', className: 'dmo-move', disabled: archived, title: archived ? '先恢复服务商，再调整单模型分类' : undefined, 'aria-label': `${archived ? '先恢复服务商' : prefs.uncommon.includes(key) ? '移回主列表' : '移至不常用'}：${g.name || g.id} / ${m.id}${accountSuffix}`, onClick: () => toggleUncommon(key) }, archived ? '先恢复服务商' : prefs.uncommon.includes(key) ? '移回主列表' : '移至不常用'),
          list === 'favorites' && noteAction(g),
          list === 'favorites' && archived && providerAction(g)));
    };

    const popup = open && h('div', {
      className: 'dmo-panel', id: popupId, ref: panel, role: 'dialog', 'aria-label': '模型选择器', 'aria-modal': true,
      style: position ?? { visibility: 'hidden', left: 0, top: 0 }, onKeyDown,
      onPointerDownCapture: () => { suppressClick.current = false; cancelDrag(); },
      onClickCapture: e => { if (suppressClick.current && e.target.closest('.dmo-select, .dmo-group-heading')) { e.preventDefault(); e.stopPropagation(); } }
    },
      h('div', { className: 'dmo-head' }, h('span', { className: 'dmo-title' }, '模型书架 · Model Shelf'), h('button', { type: 'button', className: 'dmo-close', 'aria-label': '关闭模型选择器', onClick: () => close() }, '×')),
      h('p', { className: 'dmo-hint' }, '由你手动整理：移至“不常用”不会删除模型或 API 配置，可随时移回。'),
      h('input', { ref: search, type: 'search', className: 'dmo-search', placeholder: '搜索模型、ID、服务商或账号备注…', 'aria-label': '搜索模型、ID、服务商或账号备注', value: query, onChange: (e) => { cancelDrag(); setQuery(e.target.value); setActive(null); } }),
      h('div', { className: 'dmo-tabs', role: 'tablist', 'aria-label': '模型列表分类' },
        h('button', { type: 'button', id: `${popupId}-main`, className: 'dmo-tab', role: 'tab', 'aria-selected': list === 'main', 'aria-controls': `${popupId}-list`, onClick: () => changeList('main') }, `主列表 (${allMain})`),
        h('button', { type: 'button', id: `${popupId}-uncommon`, className: 'dmo-tab', role: 'tab', 'aria-selected': list === 'uncommon', 'aria-controls': `${popupId}-list`, onClick: () => changeList('uncommon') }, `不常用 (${allUncommon})`),
        h('button', { type: 'button', id: `${popupId}-favorites`, className: 'dmo-tab', role: 'tab', 'aria-selected': list === 'favorites', 'aria-controls': `${popupId}-list`, onClick: () => changeList('favorites') }, `收藏 (${allFavorites})`)),
      list !== 'favorites' && h('div', { className: 'dmo-tools' },
        h('button', { type: 'button', disabled: searching || shown.length === 0, onClick: () => setAllCollapsed(false) }, '全部展开'),
        h('button', { type: 'button', disabled: searching || shown.length === 0, onClick: () => setAllCollapsed(true) }, '全部折叠'),
        h('span', null, searching ? '搜索时自动展开匹配分组' : '按服务商分组')),
      error && h('p', { className: 'dmo-error', role: 'alert' }, String(error)),
      (state.failures ?? []).map((failure) => h('p', { className: 'dmo-error', key: failure.id, role: 'status' }, `服务商 ${failure.name ?? failure.id} 加载失败：${failure.message ?? ''}`)),
      h('div', { className: 'dmo-order-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, orderStatus),
      noteEditor,
      h('div', { className: 'dmo-list', id: `${popupId}-list`, role: 'tabpanel', 'aria-labelledby': `${popupId}-${list}`, 'aria-busy': state.status === 'loading' || busy },
        state.status === 'loading' && h('p', { className: 'dmo-empty', role: 'status' }, '正在加载模型…'),
        list === 'favorites' ? flatFavorites.map(({ group, model }) => renderRow(group, model)) : shown.map((g) => h('section', { className: 'dmo-group', key: g.id, 'data-provider-id': g.id, ...dropProps(g.id) },
          h('div', { className: 'dmo-group-top' }, orderControls(g.id, g.id), h('div', { role: 'button', tabIndex: 0, className: 'dmo-group-heading', 'aria-expanded': expanded(g.id), 'aria-disabled': searching, onClick: () => {
            if (!searching) preferences.update((p) => ({ ...p, collapsed: toggleKey(p.collapsed, groupKey(list, g.id)) }));
          }, onKeyDown: (e) => { if (e.nativeEvent?.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!searching) preferences.update((p) => ({ ...p, collapsed: toggleKey(p.collapsed, groupKey(list, g.id)) })); } } },
            h('span', { 'aria-hidden': true }, expanded(g.id) ? '▾' : '▸'),
            h('span', { className: 'dmo-group-title' }, g.name || g.id,
              providerNote(prefs, g.id) && h('span', { className: 'dmo-account' }, `账号备注：${providerNote(prefs, g.id)}`),
              h('span', { className: 'dmo-identity' }, `服务商 ID：${g.id}`)),
            h('span', { className: 'dmo-count' }, `${g.models.length} 款`)),
            h('div', { className: 'dmo-provider-actions' }, noteAction(g), providerAction(g))),
          expanded(g.id) && g.models.map(m => renderRow(g, m)))),
        state.status !== 'loading' && shown.length === 0 && h('p', { className: 'dmo-empty', role: 'status' }, searching ? '该列表中没有匹配模型。可切换另一个列表继续搜索。' : list === 'favorites' ? '暂无收藏。请在任一列表点击模型旁的“☆ 收藏”。收藏不会改变主列表 / 不常用分类。' : list === 'uncommon' ? '暂无不常用模型。请在主列表点击模型旁的“移至不常用”。' : '主列表暂无模型；已移出的模型可在“不常用”列表中找回。')),
      h('div', { className: 'dmo-current' },
        h('div', null, '当前模型：', currentText),
        !reasoning && labelEffort && h('div', { className: 'dmo-identity' }, `已保留思考强度：${labelEffort}`),
        state.current && state.routable === false && h('div', { className: 'dmo-error', role: 'status' }, '当前模型暂不可用，原选择和思考强度已保留。'),
        reasoning?.efforts?.length > 0 && h('label', { className: 'dmo-effort-label' }, '思考强度', h('select', { className: 'dmo-effort', 'aria-label': '思考强度', value: effort ?? '', disabled: busy,
          // The empty value is the directory's own "provider default", expressed by
          // sending no `reasoningEffort` at all.
          onChange: (e) => { const next = e.target.value; choose(next === '' ? { provider: state.current.provider, model: state.current.model, resetEffort: true } : { provider: state.current.provider, model: state.current.model, reasoningEffort: next }, true); } },
          effort === undefined && h('option', { value: '' }, '服务商默认'),
          effort !== undefined && !reasoning.efforts.some((x) => x.id === effort) && h('option', { value: effort }, `${effort}（当前值）`),
          reasoning.efforts.map((x) => h('option', { key: x.id, value: x.id }, x.name || x.id))),
          // Only the *pinned* level is a choice; when nothing is pinned the level
          // shown is the adapter's own default, which the directory already reports.
          effortSource === 'probe' && h('span', { className: 'dmo-effort-source' }, '已探测')),
        // An explicit unpin, because the select can only express one while the model
        // still publishes levels — a model that publishes none has no select at all,
        // yet can still be holding a level pinned before the switch.
        state.current && state.current.reasoningEffort !== undefined && h('button', { type: 'button', className: 'dmo-effort-reset', disabled: busy, onClick: () => choose({ provider: state.current.provider, model: state.current.model, resetEffort: true }, true) }, '恢复服务商默认'),
        // Only a model the host actually offers a choice for: one declared
        // capacity with nothing pinned leaves nothing to decide.
        contextRow !== undefined && (contextRow.declared.length > 1 || contextRow.override !== undefined) && h('label', { className: 'dmo-effort-label' }, '上下文容量',
          h('select', { className: 'dmo-effort', 'aria-label': '上下文容量', disabled: busy || contextBusy, value: contextRow.override === undefined ? '' : String(contextRow.override),
            onChange: (e) => { const next = e.target.value; applyContextWindow(next === '' ? null : Number(next)); } },
          h('option', { value: '' }, '服务商默认'),
          contextRow.override !== undefined && !contextRow.declared.includes(contextRow.override) && h('option', { value: String(contextRow.override) }, `${formatCapacity(contextRow.override)}（当前值）`),
          contextRow.declared.map((size) => h('option', { key: size, value: String(size) }, formatCapacity(size)))),
          contextRow.effective !== undefined && h('span', { className: 'dmo-effort-source dmo-context-note' }, `当前生效 ${formatCapacity(contextRow.effective)}`)),
        probeBlock,
        h('div', { className: 'dmo-identity' }, '分类、收藏、备注及折叠偏好保存在当前浏览器；不会自动分类。'),
        (localError || state.status === 'error' || state.failures?.length > 0) && h('button', { type: 'button', className: 'dmo-tab', onClick: () => { setLocalError(null); Promise.resolve().then(load).catch((e) => setLocalError(String(e.message ?? e))); } }, '重新加载')));
    return h(React.Fragment, null,
      h('div', { ref: trigger, role: 'button', tabIndex: 0, className: 'dmo-trigger', 'aria-label': `${title} · ${currentText}${labelEffort ? ` · ${labelEffort}` : ''}`, 'aria-disabled': locked, 'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': open ? popupId : undefined, title: `${currentText}${labelEffort ? ` · ${labelEffort}` : ''}`, onClick: () => { if (!locked) toggle(); }, onKeyDown: (e) => { if (e.nativeEvent?.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!locked) toggle(); } } },
        h('svg', { className: 'dmo-trigger-icon', width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' },
          h('path', { d: 'M3 3v13h14M6 4h3v9H6zM12 3l3-1 3 10-3 1z' })),
        h('span', { className: 'dmo-trigger-copy' }, `${currentNote ? currentNote + ' · ' : ''}${title}${labelEffort ? ` · ${labelEffort}` : ''}`), h('span', { 'aria-hidden': true }, busy ? '…' : open ? '▴' : '▾')),
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
