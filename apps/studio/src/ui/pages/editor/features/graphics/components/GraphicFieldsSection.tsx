import { memo, useCallback, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { GraphicField } from '@core/graphics/domain/GraphicField';
import type { GraphicParamValue } from '@core/graphics/domain/GraphicStage';
import type { ShotGraphicLayer } from '@core/shots/domain/ShotLayer';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { ColorPicker } from '@ui/_shared/components/controls/fields/ColorPicker';
import { Toggle } from '@ui/_shared/components/controls/fields/Toggle';
import { FIELD_LABEL_CLASS } from '@ui/_shared/components/controls/fields/field-label-classes';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { GraphicImageEncoder } from '@presentation/graphics/services/GraphicImageEncoder';
import { useDebouncedDraft } from '@ui/pages/editor/features/graphics/hooks/useDebouncedDraft';
import { EmojiPickerScreen } from '@ui/pages/editor/features/transcript/components/decorations/EmojiPickerScreen';

// Typing replays the graphic from its start, so a value lands once the user pauses rather than on every key.
const TYPING_PAUSE_MS = 350;

const INPUT_CLASS =
  'flex-1 min-w-0 h-[26px] px-2 text-xs text-fg-secondary bg-surface-2 border border-edge-medium rounded-xs outline-none '
  + 'transition-colors duration-quick ease-standard hover:border-edge-strong '
  + 'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30';

// A text field takes line breaks. It is one row high and grows with what it holds, wrapped lines too, up to six
// rows, then scrolls; a browser that cannot size a field to its content counts the lines typed instead.
const TEXT_AREA_CLASS =
  'flex-1 min-w-0 px-2 py-[5px] text-xs leading-[14px] text-fg-secondary bg-surface-2 border border-edge-medium rounded-xs outline-none resize-none '
  + '[field-sizing:content] min-h-[26px] max-h-[96px] '
  + 'transition-colors duration-quick ease-standard hover:border-edge-strong '
  + 'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30';
const TEXT_AREA_MAX_ROWS = 6;

interface GraphicFieldsSectionProps {
  layer: ShotGraphicLayer;
  /** Drawn beside the section's title: what the graphic is, a preset's name or *Custom*. */
  titleAside?: ReactNode;
}

// Pinned to the bottom of the tab while the presets scroll beneath it; its own fields scroll past this height.
const PANEL_CLASS = 'sticky bottom-0 z-10 -mx-2 px-2 bg-surface-1 border-t border-edge-medium shadow-[0_-6px_12px_-8px_rgba(0,0,0,0.25)]';
const HEADER_CLASS =
  'w-full flex items-center gap-2 py-3 bg-transparent border-none cursor-pointer text-left '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-xs';
const TITLE_CLASS = 'font-mono text-2xs uppercase tracking-[0.08em] text-fg-muted';

/**
 * The fields a graphic's document declares, each as the control its
 * kind asks for, holding the value set or the field's default: a panel
 * pinned to the bottom of the tab, titled *Content*, that folds away to
 * its title, led by whether the graphic keeps the captions off the shots
 * it shows on.
 * A graphic that declares no field says so in one line.
 */
export const GraphicFieldsSection = memo(function GraphicFieldsSection({ layer, titleAside }: GraphicFieldsSectionProps) {
  const [open, setOpen] = useState(true);
  const { actions } = useShots();
  const { fields, params } = layer.graphic;
  const setParam = useCallback(
    (fieldId: string, value: GraphicParamValue) => actions.setGraphic.setParam(layer.id, fieldId, value),
    [actions, layer.id],
  );
  const setHidesCaptions = useCallback(
    (hidesCaptions: boolean) => actions.setGraphic.setHidesCaptions(layer.id, hidesCaptions),
    [actions, layer.id],
  );
  return (
    <div className={PANEL_CLASS}>
      <button type="button" className={HEADER_CLASS} aria-expanded={open} onClick={() => setOpen((was) => !was)}>
        <ChevronDown size={14} className={`text-fg-muted transition-transform duration-quick ease-standard ${open ? '' : '-rotate-90'}`} aria-hidden />
        <span className={TITLE_CLASS}>Content</span>
        <span className="ml-auto">{titleAside}</span>
      </button>
      {open && (
      <div className="thin-scroll flex flex-col gap-3 pb-3 max-h-[40vh] overflow-y-auto">
        <Toggle
          label={layer.throughShotId === undefined ? 'Hide captions on this shot' : 'Hide captions on its shots'}
          value={layer.graphic.hidesCaptions}
          onChange={setHidesCaptions}
        />
        {fields.length === 0 && (
          <p className="m-0 text-xs text-fg-muted leading-snug">Nothing to fill in. Its text and colours are in its code.</p>
        )}
        {fields.map((field) => (
          <GraphicFieldControl
            key={`${layer.id}:${field.id}`}
            layerId={layer.id}
            field={field}
            value={params[field.id] ?? field.defaultValue}
            onChange={setParam}
          />
        ))}
      </div>
      )}
    </div>
  );
});

interface GraphicFieldControlProps {
  layerId: string;
  field: GraphicField;
  value: GraphicParamValue;
  onChange: (fieldId: string, value: GraphicParamValue) => void;
}

function GraphicFieldControl({ layerId, field, value, onChange }: GraphicFieldControlProps) {
  if (field.kind === 'number') return <GraphicNumberFieldControl layerId={layerId} field={field} value={value} onChange={onChange} />;
  return <GraphicTextLikeFieldControl layerId={layerId} field={field} value={value} onChange={onChange} />;
}

/**
 * A number field typed as text, so it can be emptied and retyped: what is
 * typed lands once it reads as a number; leaving it with anything else in
 * it puts the value back.
 */
function GraphicNumberFieldControl({ layerId, field, value, onChange }: GraphicFieldControlProps) {
  const write = useCallback((typed: string) => {
    const number = Number(typed);
    if (typed.trim() !== '' && Number.isFinite(number)) onChange(field.id, number);
  }, [onChange, field.id]);
  const { draft, change, flush } = useDebouncedDraft<string>(`${layerId}:${field.id}`, String(value), write, TYPING_PAUSE_MS);
  return (
    <label className="flex items-center gap-2">
      <span className={FIELD_LABEL_CLASS}>{field.label}</span>
      <input
        type="text"
        inputMode="decimal"
        className={INPUT_CLASS}
        value={draft}
        onChange={(event) => change(event.target.value)}
        onBlur={() => {
          if (draft.trim() === '' || !Number.isFinite(Number(draft))) change(String(value));
          flush();
        }}
      />
    </label>
  );
}

function GraphicTextLikeFieldControl({ layerId, field, value, onChange }: GraphicFieldControlProps) {
  const write = useCallback((next: GraphicParamValue) => onChange(field.id, next), [onChange, field.id]);
  const { draft, change, flush } = useDebouncedDraft<GraphicParamValue>(`${layerId}:${field.id}`, value, write, TYPING_PAUSE_MS);
  if (field.kind === 'emoji') {
    return <GraphicEmojiFieldControl label={field.label} value={String(value)} onChange={write} />;
  }
  if (field.kind === 'image') {
    return <GraphicImageFieldControl label={field.label} value={String(value)} onChange={write} />;
  }
  if (field.kind === 'color') {
    return (
      <div className="flex items-center gap-2">
        <span className={FIELD_LABEL_CLASS}>{field.label}</span>
        <ColorPicker label={field.label} showsLabel={false} value={String(value)} onChange={write} />
      </div>
    );
  }
  const text = String(draft);
  return (
    <label className="flex items-start gap-2">
      <span className={`${FIELD_LABEL_CLASS} pt-[5px]`}>{field.label}</span>
      <textarea
        className={TEXT_AREA_CLASS}
        rows={Math.min(TEXT_AREA_MAX_ROWS, text.split('\n').length)}
        spellCheck={false}
        value={text}
        onChange={(event) => change(event.target.value)}
        onBlur={flush}
      />
    </label>
  );
}

const IMAGE_ENCODER = new GraphicImageEncoder();
const IMAGE_BUTTON_CLASS =
  'h-[26px] inline-flex items-center rounded-xs border border-edge-medium bg-surface-2 text-xs text-fg-secondary cursor-pointer '
  + 'transition-colors duration-quick ease-standard hover:border-edge-strong '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30';

/** An image field: its picture, a button to pick another, and one to take it away. */
function GraphicImageFieldControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [failed, setFailed] = useState(false);
  const pick = (file: File | undefined) => {
    if (file === undefined) return;
    IMAGE_ENCODER.encode(file).then((encoded) => {
      setFailed(false);
      onChange(encoded);
    }, () => setFailed(true));
  };
  return (
    <div className="flex items-center gap-2 min-w-0 flex-wrap">
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      <span className="w-[26px] h-[26px] shrink-0 rounded-full overflow-hidden border border-edge-medium bg-surface-2">
        {value !== '' && <img src={value} alt="" className="w-full h-full object-cover" draggable={false} />}
      </span>
      <button type="button" className={`${IMAGE_BUTTON_CLASS} px-2`} onClick={() => input.current?.click()}>
        {value === '' ? 'Choose image' : 'Replace'}
      </button>
      {value !== '' && (
        <button
          type="button"
          className={`${IMAGE_BUTTON_CLASS} px-1.5`}
          aria-label={`Remove ${label}`}
          title="Remove"
          onClick={() => onChange('')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {failed && <span className="text-2xs text-danger">Not an image</span>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`Pick ${label}`}
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
}

/** An emoji field: its glyph, opening the emoji picker the captions use, and a button to take it away. */
function GraphicEmojiFieldControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      <Popover
        open={open}
        onOpenChange={setOpen}
        screens={{ picker: <GraphicEmojiPickerScreen onPick={onChange} /> }}
        initialScreen="picker"
        trigger={(
          <button type="button" className={`${IMAGE_BUTTON_CLASS} gap-1.5 px-2`} aria-label={`Pick ${label}`}>
            {value !== '' && <span className="text-base leading-none">{value}</span>}
            {value === '' ? 'Choose emoji' : 'Change'}
          </button>
        )}
      />
      {value !== '' && (
        <button
          type="button"
          className={`${IMAGE_BUTTON_CLASS} px-1.5`}
          aria-label={`Remove ${label}`}
          title="Remove"
          onClick={() => onChange('')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function GraphicEmojiPickerScreen({ onPick }: { onPick: (glyph: string) => void }) {
  const { close } = usePopoverNav();
  return <EmojiPickerScreen onPick={(glyph) => { onPick(glyph); close(); }} />;
}
