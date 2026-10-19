import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist/pages');
await mkdir(output, { recursive: true });
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex').slice(0, 12);
async function asset(stem: string, extension: string, value: string | Uint8Array) {
  const name = `${stem}.${hash(value)}.${extension}`;
  await writeFile(resolve(output, name), value);
  return name;
}

// Publish an explicit allowlist, never the project directory or its .env / DB.
const snapshot = JSON.parse(await readFile(resolve(root, 'fixtures/mcp-calls.json'), 'utf8'));
const snapshotName = await asset('menu-snapshot', 'json', JSON.stringify(snapshot));
const compiled = await build({
  entryPoints: [resolve(root, 'src/browser/entry.ts')],
  bundle: true, write: false, minify: true, platform: 'browser', format: 'iife', target: ['es2022'], legalComments: 'eof',
  alias: { 'node:crypto': resolve(root, 'src/browser/crypto.ts') },
  define: { __DEMO_SNAPSHOT_FILE__: JSON.stringify(snapshotName) },
  metafile: true,
});
if (Object.keys(compiled.metafile!.inputs).some(name => /src\/(db\.ts|mcp\/client\.ts|server\.ts)$/.test(name))) throw new Error('SERVER_CODE_IN_BROWSER_BUILD');
const engineName = await asset('demo-engine', 'js', compiled.outputFiles[0]!.contents);
let js = await readFile(resolve(root, 'public/app.js'), 'utf8');
js = js.replace(/(['"])\/assets\//g, '$1./assets/');
const appName = await asset('app', 'js', js);
const styleName = await asset('style', 'css', await readFile(resolve(root, 'public/style.css')));
const themeName = await asset('theme', 'css', await readFile(resolve(root, 'public/theme.css')));
let html = await readFile(resolve(root, 'public/index.html'), 'utf8');
html = html.replace(/href="\/style\.css"/, `href="./${styleName}"`)
  .replace(/href="\/theme\.css[^\"]*"/, `href="./${themeName}"`)
  .replace(/<script src="\/app\.js[^\"]*" defer><\/script>/, `<script src="./${engineName}" defer></script>\n  <script src="./${appName}" defer></script>`)
  .replace(/(src|href)="\//g, '$1="./')
  .replace('</head>', '<meta name="description" content="麦麦现拼在线试玩：同店陌生人各选所需，现场拼一份大套餐。真实菜单快照，独立模拟，不会真实下单或扣款。">\n</head>')
  .replace('</footer>', '<br><a href="https://github.com/lululynne/maimai-xianpin" target="_blank" rel="noopener">查看 GitHub 项目 · ⭐ Star</a></footer>');
await writeFile(resolve(output, 'index.html'), html);
await writeFile(resolve(output, '.nojekyll'), '');
await cp(resolve(root, 'public/assets'), resolve(output, 'assets'), { recursive: true });
for (const name of ['LICENSE', 'NOTICE.md']) await cp(resolve(root, name), resolve(output, name));
console.log(`Browser demo ready: ${output}`);
