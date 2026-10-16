import { readFile, mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const preferences = (await readFile(new URL('src/preferences.js', root), 'utf8')).replace(/^export /gm, '');
const probe = (await readFile(new URL('src/workbuddy-probe.js', root), 'utf8')).replace(/^export /gm, '');
const client = (await readFile(new URL('src/client.js', root), 'utf8')).replace(/^import .* from '\.\/preferences\.js';\r?\n/m, '').replace(/^import .* from '\.\/workbuddy-probe\.js';\r?\n/m, '').replace(/^export /gm, '');
const css = await readFile(new URL('src/style.css', root), 'utf8');
const styledClient = client.replace('function apply(ctx) {', `function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-model-shelf';
    style.textContent = ${JSON.stringify(css)};
    document.head.appendChild(style);
    return () => style.remove();
  });`);
const bundle = `window.__ModuleLoader__.load({
  id: 'dsh-model-shelf',
  factory: (require) => {
${preferences}
${probe}
${styledClient}
return { apply, inject, makeModelPicker };
  }
});
`;
await mkdir(new URL('lib/', root), { recursive: true });
await writeFile(new URL('lib/client.js', root), bundle.replace('export ', ''));
await writeFile(new URL('lib/index.js', root), 'export function apply() {}\n');
console.log('Built Model Shelf client and lifecycle-owned stylesheet.');
