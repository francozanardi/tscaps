import { memo, useCallback, useState } from 'react';
import { css as cssLanguage } from '@codemirror/lang-css';
import { html as htmlLanguage } from '@codemirror/lang-html';
import { javascript as javascriptLanguage } from '@codemirror/lang-javascript';
import type { Extension } from '@uiw/react-codemirror';
import type { GraphicDocumentPart } from '@core/shots/actions/SetShotGraphicAction';
import type { ShotGraphicLayer } from '@core/shots/domain/ShotLayer';
import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import { CodeEditorField } from '@ui/_shared/components/CodeEditorField/CodeEditorField';
import { SegmentedChoice } from '@ui/_shared/components/controls/fields/SegmentedChoice';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useCurrentTheme } from '@ui/_shared/hooks/useCurrentTheme';
import { ElementCodePanel } from '@ui/pages/editor/features/element/ElementCodePanel';
import { useShotLayerCssWrite } from '@ui/pages/editor/features/shots/hooks/useShotLayerCssWrite';
import { useDebouncedDraft } from '@ui/pages/editor/features/graphics/hooks/useDebouncedDraft';
import { useGraphicMessages } from '@ui/pages/editor/features/graphics/hooks/useGraphicMessages';

// Every change starts the graphic over, so code lands once the user pauses.
const TYPING_PAUSE_MS = 600;
const EDITOR_HEIGHT = '300px';

type CodePart = GraphicDocumentPart | 'box';

const PARTS: ReadonlyArray<{ value: CodePart; label: string; tooltip: string }> = [
  { value: 'html', label: 'HTML', tooltip: 'What the graphic is made of' },
  { value: 'css', label: 'CSS', tooltip: 'How it looks' },
  { value: 'js', label: 'JS', tooltip: 'How it moves, over tscaps.render(t)' },
  { value: 'box', label: 'Box', tooltip: 'The CSS of the box it is drawn in on the frame' },
];

const LANGUAGES: Readonly<Record<GraphicDocumentPart, Extension[]>> = {
  html: [htmlLanguage()],
  css: [cssLanguage()],
  js: [javascriptLanguage()],
};

const DIALOG_TITLES: Readonly<Record<GraphicDocumentPart, string>> = {
  html: 'Graphic HTML',
  css: 'Graphic CSS',
  js: 'Graphic JavaScript',
};

interface GraphicCodePanelProps {
  layer: ShotGraphicLayer;
  /** The CSS of the layer's box, as its style holds it. */
  boxStyle: ElementStyle | null;
}

/**
 * A graphic's document, a part at a time — its HTML, its CSS, its
 * JavaScript — and the CSS of the box it is drawn in on the frame, as
 * any layer's. Under the document, what its code said lately: the lines
 * it logged and the errors it threw.
 */
export const GraphicCodePanel = memo(function GraphicCodePanel({ layer, boxStyle }: GraphicCodePanelProps) {
  const [part, setPart] = useState<CodePart>('js');
  const cssWrite = useShotLayerCssWrite();
  return (
    <div className="flex flex-col gap-4">
      <SegmentedChoice
        ariaLabel="Which part of the code"
        value={part}
        options={PARTS}
        onChange={(value) => setPart(value as CodePart)}
      />
      {part === 'box' ? (
        <ElementCodePanel elementId={layer.id} kind="layer" fragment={boxStyle} cssWrite={cssWrite} />
      ) : (
        <>
          <GraphicDocumentEditor key={`${layer.id}:${part}`} layer={layer} part={part} />
          <GraphicMessages layerId={layer.id} />
        </>
      )}
    </div>
  );
});

function GraphicDocumentEditor({ layer, part }: { layer: ShotGraphicLayer; part: GraphicDocumentPart }) {
  const { actions } = useShots();
  const theme = useCurrentTheme();
  const write = useCallback((text: string) => actions.setGraphic.setDocument(layer.id, part, text), [actions, layer.id, part]);
  const { draft, change, flush } = useDebouncedDraft(`${layer.id}:${part}`, layer.graphic.document[part], write, TYPING_PAUSE_MS);
  return (
    <CodeEditorField
      value={draft}
      onChange={change}
      onBlur={flush}
      languageExtensions={LANGUAGES[part]}
      theme={theme}
      height={EDITOR_HEIGHT}
      dialogTitle={DIALOG_TITLES[part]}
    />
  );
}

const LEVEL_CLASS = {
  log: 'text-fg-secondary',
  warn: 'text-warning',
  error: 'text-danger',
} as const;

function GraphicMessages({ layerId }: { layerId: string }) {
  const messages = useGraphicMessages(layerId);
  return (
    <Section title="Console">
      {messages.length === 0 ? (
        <p className="m-0 text-2xs text-fg-muted">Nothing logged yet. What the code logs or throws shows here.</p>
      ) : (
        <ol className="m-0 p-0 list-none flex flex-col gap-1 max-h-40 overflow-y-auto font-mono text-2xs leading-snug">
          {messages.map((message, index) => (
            <li key={index} className={`whitespace-pre-wrap break-words ${LEVEL_CLASS[message.level]}`}>{message.text}</li>
          ))}
        </ol>
      )}
    </Section>
  );
}
