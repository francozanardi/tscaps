import { createRoot } from 'react-dom/client';
import { DevLogBridge } from '@bootstrap/DevLogBridge';

if (import.meta.env.DEV) {
  new DevLogBridge().install();
}

const appVersion = readEnvString('VITE_RELEASE_VERSION') ?? 'dev';
const previewProxyEnabled = readEnvBool('VITE_PREVIEW_PROXY_ENABLED', true);

function readEnvString(key: string): string | null {
  const raw = (import.meta.env as Record<string, string | undefined>)[key];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readEnvBool(key: string, fallback: boolean): boolean {
  const raw = readEnvString(key);
  if (raw === null) return fallback;
  return raw.toLowerCase() !== 'false';
}
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
const root = createRoot(rootElement);


const { createEditorApp } = await import('@bootstrap/editor/createEditorApp');
const app = await createEditorApp({ appVersion, previewProxyEnabled });
root.render(app);
