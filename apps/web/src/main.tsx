import { createRoot } from 'react-dom/client';

const appVersion = readEnvString('VITE_RELEASE_VERSION') ?? 'dev';

function readEnvString(key: string): string | null {
  const raw = (import.meta.env as Record<string, string | undefined>)[key];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
const root = createRoot(rootElement);


const { createEditorApp } = await import('@bootstrap/editor/createEditorApp');
const app = await createEditorApp({ appVersion });
root.render(app);
