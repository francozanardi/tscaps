// banned-words-allow-file: close,closed
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import CodeMirror, { type Extension } from '@uiw/react-codemirror';
import * as Dialog from '@radix-ui/react-dialog';
import { Maximize2, X } from 'lucide-react';
import type { Theme } from '@presentation/theme/controllers/ThemeController';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';

const FLUSH_DEBOUNCE_MS = 250;

interface TemplateSourceEditorProps {
  /** Identity of the sheet whose source this editor edits. */
  sheetId: string;
  /** Current source — the user's override when present, otherwise the
   * template's pristine source. */
  source: string;
  /** Whether the sheet currently carries an override for this source.
   * When this flips from `true` to `false` (template change or reset)
   * the local buffer re-syncs to `source` and any pending flush is dropped. */
  isOverridden: boolean;
  languageExtensions: Extension[];
  theme: Theme;
  onChange: (source: string) => void;
  /** Optional intro paragraph rendered above the editor. */
  intro?: ReactNode;
  /** Optional synchronous validator. When it returns a non-null string
   * the editor renders an error banner inline. Purely informational —
   * the render path is responsible for its own fallback on parse failure. */
  validate?: (source: string) => string | null;
  /** Title shown in the maximized dialog. */
  dialogTitle: string;
}

/**
 * Editor for a per-sheet template source override (CSS or
 * `filters.svg`). Buffers keystrokes locally and forwards them to
 * `onChange` on a short debounce so the store and the render
 * pipeline don't run on every key press.
 */
export const TemplateSourceEditor = memo(function TemplateSourceEditor({
  sheetId,
  source,
  isOverridden,
  languageExtensions,
  theme,
  onChange,
  intro,
  validate,
  dialogTitle,
}: TemplateSourceEditorProps) {
  const [value, setValue] = useState<string>(source);
  const [validationError, setValidationError] = useState<string | null>(() =>
    validate ? validate(source) : null,
  );

  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [lastSheetId, setLastSheetId] = useState(sheetId);
  const [lastOverridePresence, setLastOverridePresence] = useState(isOverridden);
  if (lastSheetId !== sheetId || (lastOverridePresence && !isOverridden)) {
    setLastSheetId(sheetId);
    setLastOverridePresence(isOverridden);
    setValue(source);
    setValidationError(validate ? validate(source) : null);
  } else if (lastOverridePresence !== isOverridden) {
    setLastOverridePresence(isOverridden);
  }

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [sheetId, isOverridden]);

  const handleChange = useCallback((next: string) => {
    setValue(next);
    if (validate) setValidationError(validate(next));
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      onChange(next);
    }, FLUSH_DEBOUNCE_MS);
  }, [onChange, validate]);

  const [isExpanded, setIsExpanded] = useState(false);
  const isMobileViewport = useIsMobileViewport();

  return (
    <div className="flex flex-col gap-2.5">
      {intro}
      {validationError && (
        <div
          role="alert"
          className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-xs px-2 py-1.5 font-mono whitespace-pre-wrap"
        >
          {validationError}
        </div>
      )}
      <div className="relative rounded-xs overflow-hidden border border-edge-subtle">
        <CodeMirror
          value={value}
          onChange={handleChange}
          extensions={languageExtensions}
          theme={theme}
          height="60vh"
          basicSetup={EDITOR_BASIC_SETUP}
        />
        {/* Sidebar is narrow on desktop, useless on mobile. */}
        {!isMobileViewport && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label="Expand editor"
            title="Expand editor"
            className="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-xs bg-surface-2/80 backdrop-blur-sm border border-edge-subtle text-fg-muted cursor-pointer transition-colors duration-quick ease-standard hover:text-fg-secondary hover:border-edge-strong focus-visible:outline-none focus-visible:border-accent focus-visible:text-fg-secondary"
          >
            <Maximize2 size={12} />
          </button>
        )}
      </div>
      <Dialog.Root open={isExpanded} onOpenChange={setIsExpanded}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[1000] bg-black/60 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[1001] -translate-x-1/2 -translate-y-1/2 bg-surface-2 border border-edge-subtle rounded-md shadow-md w-[90vw] max-w-[1200px] flex flex-col gap-3 p-5 focus:outline-none data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out">
            <div className="flex items-center justify-between gap-2">
              <Dialog.Title className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-secondary m-0">
                {dialogTitle}
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Edit the template's source for this sheet in an expanded view.
              </Dialog.Description>
              <Dialog.Close
                aria-label="Close"
                className="inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border border-edge-subtle text-fg-muted cursor-pointer transition-colors duration-quick ease-standard hover:text-fg-secondary hover:border-edge-strong focus-visible:outline-none focus-visible:border-accent focus-visible:text-fg-secondary"
              >
                <X size={14} />
              </Dialog.Close>
            </div>
            <div className="rounded-xs overflow-hidden border border-edge-subtle">
              <CodeMirror
                value={value}
                onChange={handleChange}
                extensions={languageExtensions}
                theme={theme}
                height="80vh"
                basicSetup={EDITOR_BASIC_SETUP}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
});

const EDITOR_BASIC_SETUP = {
  lineNumbers: true,
  foldGutter: true,
  highlightActiveLine: true,
  autocompletion: true,
  bracketMatching: true,
};
