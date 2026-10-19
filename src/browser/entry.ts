import { createBrowserDemo } from './runtime.js';
declare const __DEMO_SNAPSHOT_FILE__: string;
declare global { interface Window { maimaiDemo: { fetch: typeof fetch } } }

const script = document.currentScript as HTMLScriptElement;
const ready = fetch(new URL(__DEMO_SNAPSHOT_FILE__, script.src)).then(async response => {
  if (!response.ok) throw new Error('演示菜单暂时没有加载好，请刷新重试。');
  let storage: Storage | undefined;
  try { storage = window.sessionStorage; } catch { /* Memory-only demo is supported. */ }
  return createBrowserDemo(await response.json(), storage);
});
window.maimaiDemo = { fetch: async (input, init) => (await ready).fetch(input, init) };
