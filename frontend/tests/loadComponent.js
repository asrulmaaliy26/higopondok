import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Polyfill minimal browser environment for React SSR loading
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { href: 'http://localhost:5173', pathname: '/', hostname: 'localhost', host: 'localhost:5173', protocol: 'http:', port: '5173' },
    navigator: globalThis.navigator,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {} }),
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
  };
  const textNode = { data: ' ', textContent: ' ' };
  const styleEl = { 
    id: '_goober', 
    textContent: '', 
    data: '', 
    setAttribute: () => {}, 
    firstChild: textNode, 
    parentNode: null, 
    appendChild: () => {} 
  };
  globalThis.window._goober = styleEl;
  const rootEl = { 
    classList: { add: () => {}, remove: () => {}, contains: () => false }, 
    style: {} 
  };
  globalThis.document = {
    referrer: '',
    documentElement: rootEl,
    createElement: () => ({ ...styleEl, parentNode: null, firstChild: textNode, style: {} }),
    head: { appendChild: () => {}, querySelector: () => styleEl, children: [styleEl] },
    body: { appendChild: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => styleEl,
    querySelectorAll: () => [],
    getElementById: () => styleEl,
  };
  globalThis.localStorage = globalThis.window.localStorage;
  globalThis.sessionStorage = globalThis.window.sessionStorage;
}

let viteServer = null;

export async function getViteServer() {
  if (!viteServer) {
    viteServer = await createServer({
      root: rootDir,
      server: { middlewareMode: true },
      appType: 'custom',
    });
  }
  return viteServer;
}

export async function loadComponent(componentRelativePath) {
  const server = await getViteServer();
  return server.ssrLoadModule(componentRelativePath);
}

export async function closeViteServer() {
  if (viteServer) {
    await viteServer.close();
    viteServer = null;
  }
}
