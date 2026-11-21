import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { css as cssLang } from '@codemirror/lang-css';
import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { CodeEditorField } from '@ui/_shared/components/CodeEditorField/CodeEditorField';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useCurrentTheme } from '@ui/_shared/hooks/useCurrentTheme';

const FLUSH_DEBOUNCE_MS = 250;
const EDITOR_HEIGHT = '260px';
const CSS_EXTENSIONS = [cssLang()];

const placeholderFor = (timingVariable: string) => `color: gold;

animation: pop 0.4s var(${timingVariable}) ease both;

@keyframes pop {
  from { scale: 0.4; opacity: 0 }
}`;

// A layer plays its own entrance through the shorthand the framework plays, so its presets' exits keep working.
const layerPlaceholderFor = (timingVariable: string) => `rotate: -4deg;

--layer-entrance-animation: drop 0.6s var(${timingVariable}) ease both;

@keyframes drop {
  from { translate: 0 -30cqh; opacity: 0 }
}`;

// A shot's own video: what its panels do not offer, on the camera they leave in place.
const SHOT_VIDEO_PLACEHOLDER = `scale: -1 1;
rotate: 1.5deg;
filter: brightness(1.15);`;

/** What writes the text typed into the panel: an element's own store, by default the captions'. */
export interface ElementCssWrite {
  execute(elementId: string, kind: ElementKind, css: string): void;
}

interface ElementCodePanelProps {
  elementId: string;
  kind: ElementKind;
  fragment: ElementStyle | null;
  /** Where the text goes; the caption elements' store when left out. Kept the same object across renders. */
  cssWrite?: ElementCssWrite | undefined;
  /** Whether the element is a shot's own video, which has a camera rather than a layout and ends of its own. False by default. */
  isShotVideo?: boolean | undefined;
}

/**
 * The CSS written against one element. Declarations only — the selector
 * is added when the stylesheet is assembled, so the text stays about the
 * element and moving it elsewhere needs no rewriting. `&` reaches the
 * element again for states and descendants, and `@keyframes` written
 * here belong to this element alone.
 *
 * Keystrokes reach the store on a short debounce, so styling is
 * something the user watches happen rather than something they commit to
 * before seeing. Half-written CSS is no hazard on the way there: a rule
 * left open is sealed before it reaches the page.
 */
export const ElementCodePanel = memo(function ElementCodePanel({ elementId, kind, fragment, cssWrite, isShotVideo = false }: ElementCodePanelProps) {
  const elements = useElements();
  const write = cssWrite ?? elements.actions.setCss;
  const { cssValidator, timingVariableResolver } = elements.services;
  const theme = useCurrentTheme();
  const stored = fragment?.css ?? '';

  const [draft, setDraft] = useState(stored);
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWriteRef = useRef<string | null>(null);

  // Re-seeded when the panel switches element, and when the stored text
  // moves under a field nobody is typing in — an undo, or the clear
  // button. Holding off while focused is what keeps the debounced write
  // from racing the keystrokes that produced it.
  const [seed, setSeed] = useState({ elementId, stored });
  if (seed.elementId !== elementId || (!isFocused && seed.stored !== stored)) {
    setSeed({ elementId, stored });
    setDraft(stored);
  }

  const flushPendingWrite = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const pending = pendingWriteRef.current;
    pendingWriteRef.current = null;
    if (pending !== null) write.execute(elementId, kind, pending);
  }, [write, elementId, kind]);

  // Leaving mid-debounce must not lose the edit. The cleanup closes over
  // the element the text was typed against, so it lands on that one even
  // when the reason for leaving is a switch to another.
  useEffect(() => flushPendingWrite, [flushPendingWrite]);

  const handleChange = useCallback((next: string) => {
    setDraft(next);
    pendingWriteRef.current = next;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(flushPendingWrite, FLUSH_DEBOUNCE_MS);
  }, [flushPendingWrite]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    flushPendingWrite();
  }, [flushPendingWrite]);

  const problems = useMemo(
    () => cssValidator.validate(draft, kind).map((problem) => problem.message),
    [cssValidator, draft, kind],
  );

  const timingVariable = timingVariableResolver.resolve(kind, ElementAnimationScope.SELF);
  const isLayer = kind === 'layer';

  return (
    <Section title="CSS">
      <CodeEditorField
        value={draft}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        languageExtensions={CSS_EXTENSIONS}
        theme={theme}
        height={EDITOR_HEIGHT}
        dialogTitle="Element CSS"
        placeholder={isShotVideo ? SHOT_VIDEO_PLACEHOLDER : isLayer ? layerPlaceholderFor(timingVariable) : placeholderFor(timingVariable)}
        problems={problems}
      />
      {isShotVideo ? (
        <p className="m-0 text-2xs text-fg-muted leading-snug">
          Wins over the camera picked in the panel. Animations need{' '}
          <code className="font-mono">var({timingVariable})</code> as their delay.
        </p>
      ) : isLayer ? (
        <p className="m-0 text-2xs text-fg-muted leading-snug">
          Wins over the layout and motion picked in the panel. Animations need{' '}
          <code className="font-mono">var({timingVariable})</code> as their delay, or{' '}
          <code className="font-mono">var({timingVariableResolver.resolve(kind, ElementAnimationScope.EXIT)})</code> to leave.
        </p>
      ) : (
        <p className="m-0 text-2xs text-fg-muted leading-snug">
          Wins over the template. Animations need{' '}
          <code className="font-mono">var({timingVariable})</code> as their delay.
        </p>
      )}
    </Section>
  );
});
