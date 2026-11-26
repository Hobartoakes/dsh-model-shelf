import { readFile, mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const preferences = (await readFile(new URL('src/preferences.js', root), 'utf8')).replace(/^export /gm, '');
const probe = (await readFile(new URL('src/workbuddy-probe.js', root), 'utf8')).replace(/^export /gm, '');
const catalogIcons = (await readFile(new URL('src/catalog-icons.js', root), 'utf8')).replace(/^export /gm, '');
const icons = (await readFile(new URL('src/icons.js', root), 'utf8')).replace(/^import .* from '\.\/catalog-icons\.js';\r?\n/m, '').replace(/^export /gm, '');
const iconCache = (await readFile(new URL('src/icon-cache.js', root), 'utf8')).replace(/^export /gm, '');
const codex = (await readFile(new URL('src/codex-options.js', root), 'utf8')).replace(/^export /gm, '');
const providerPanel = (await readFile(new URL('src/provider-option-panel.js', root), 'utf8')).replace(/^import .* from '\.\/codex-options\.js';\r?\n/m, '').replace(/^export /gm, '');
const iconFiles = { deepseek: 'deepseek-color.png', openai: 'openai.png', cline: 'cline.png', qwen: 'qwen-color.png', qoder: 'qoder-color.png', trae: 'trae-color.png' };
const iconData = Object.fromEntries(await Promise.all(Object.entries(iconFiles).map(async ([key, file]) => [key, 'data:image/png;base64,' + (await readFile(new URL(`src/assets/${file}`, root))).toString('base64')])));
const client = (await readFile(new URL('src/client.js', root), 'utf8')).replace(/^import .* from '\.\/preferences\.js';\r?\n/m, '').replace(/^import .* from '\.\/workbuddy-probe\.js';\r?\n/m, '').replace(/^import .* from '\.\/icons\.js';\r?\n/m, '').replace(/^import .* from '\.\/(?:icon-cache|provider-option-panel)\.js';\r?\n/gm, '').replace(/^export /gm, '');
const css = await readFile(new URL('src/style.css', root), 'utf8');
const bundle = `window.__ModuleLoader__.load({
  id: 'dsh-model-shelf',
  factory: (require) => {
${preferences}
${probe}
${catalogIcons}
${icons}
${iconCache}
${codex}
${providerPanel}
const ICON_DATA = ${JSON.stringify(iconData)};
const SHELF_CSS = ${JSON.stringify(css.replace(/\r\n/g, '\n'))};
${client}
return { apply, inject, makeModelPicker };
  }
});
`;
await mkdir(new URL('lib/', root), { recursive: true });
await writeFile(new URL('lib/client.js', root), bundle.replace(/\r\n/g, '\n'));
await writeFile(new URL('lib/index.js', root), 'export function apply() {}\n');
console.log('Built Model Shelf client and lifecycle-owned stylesheet.');
