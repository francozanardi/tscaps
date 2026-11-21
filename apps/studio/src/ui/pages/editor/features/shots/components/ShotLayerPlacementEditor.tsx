import { memo, type ReactNode } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  type LucideIcon,
} from 'lucide-react';
import type {
  InsetShotLayerPlacement,
  ShotLayerBackdrop,
  ShotLayerPlacement,
  ShotLayerPlacementKind,
  SplitShotLayerPlacement,
} from '@core/shots/domain/ShotLayerPlacement';
import { SHOT_LAYER_PLACEMENT_RANGES } from '@core/shots/domain/ShotLayerPlacementRanges';
import type { ShotLayerPlacementRange } from '@core/shots/domain/ShotLayerPlacementRanges';
import type { ShotLayerGroupField } from '@presentation/shots/services/ShotLayerGroupForm';
import type {
  ShotLayerAspectPreset,
  ShotLayerHorizontalAnchor,
  ShotLayerPlacementForm,
  ShotLayerVerticalAnchor,
} from '@presentation/shots/services/ShotLayerPlacementForm';
import { PictureChoice } from '@ui/_shared/components/controls/fields/PictureChoice';
import { SegmentedChoice } from '@ui/_shared/components/controls/fields/SegmentedChoice';
import { Select } from '@ui/_shared/components/controls/fields/Select';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { FieldLabel } from '@ui/_shared/components/controls/fields/FieldLabel';
import { MixedValueMarker } from '@ui/_shared/components/controls/fields/MixedValueMarker';
import { CustomizedFieldOverlay } from '@ui/_shared/components/controls/fields/CustomizedFieldOverlay';
import { OutputFrameCropPicker } from '@ui/pages/editor/features/output-frame/OutputFrameCropPicker';
import { ShotLayerSchematic } from '@ui/pages/editor/features/shots/components/ShotLayerSchematic';
import { useShotLayerPlacementForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerPlacementForm';
import { FIELD_ROW_CLASS, FIELD_ROWS_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';

interface ShotLayerPlacementEditorProps {
  placement: ShotLayerPlacement;
  /** The video's width over its height, or null while not known. */
  frameAspectRatio: number | null;
  /**
   * The asset's width over its height, for a placement drawn for one
   * asset; null (the default) for one that answers for many, whose
   * "Original" shape is then drawn on the frame's.
   */
  assetAspectRatio?: number | null | undefined;
  /**
   * For a placement shown on behalf of several layers: the fields where
   * they hold different values, each marked *Mixed*. None by default.
   */
  mixedFields?: ReadonlySet<ShotLayerGroupField> | undefined;
  /**
   * For a placement shown on behalf of several layers: the layouts they
   * are in. With more than one, only the settings every one of those
   * layouts holds are offered. Just `placement`'s by default.
   */
  layouts?: ReadonlySet<ShotLayerPlacementKind> | undefined;
  /**
   * The fields the layer's own CSS has taken over: each is dimmed under
   * the pill saying so, and still shows what it holds. None by default.
   */
  takenOver?: ReadonlySet<ShotLayerGroupField> | undefined;
  /**
   * Whether every file laid out is a video: only a video is offered a
   * background around it where it is fitted inside its box, since a
   * picture or a GIF may be transparent. False by default.
   */
  filesAreVideos?: boolean | undefined;
  /**
   * Whether what is laid out is a graphic, which draws itself to its box:
   * nothing is offered about filling the box or about the video floating
   * in it instead. False by default.
   */
  isGraphic?: boolean | undefined;
  /**
   * A frame of the one file laid out, as a URL, to pick where it is
   * cropped where it fills a box of another shape; null while it is
   * being taken. Leave it out where the placement answers for several
   * files, which are not cropped from here.
   */
  poster?: string | null | undefined;
  /**
   * What to say under the crop picker about the axis `axis` the file is
   * cropped on: a camera holding a position of its own there. Nothing
   * by default.
   */
  cropNotice?: ((axis: 'x' | 'y') => ReactNode) | undefined;
  /** Called on every change, a slider's included; the write is expected to coalesce a drag into one step. */
  onChange: (placement: ShotLayerPlacement) => void;
}

// What floats in the box: the layer's file over the video, or the video over the file.
const SUBJECT_OPTIONS = [
  { value: 'asset', label: 'This file' },
  { value: 'video', label: 'Video' },
];
const FIT_OPTIONS = [
  { value: 'cover', label: 'Fill', tooltip: 'Fills the box and crops what falls outside it' },
  { value: 'contain', label: 'Fit', tooltip: 'Shows the whole file, with a background around it' },
] as const;
const BACKDROP_OPTIONS = [
  { value: 'blur', label: 'Blurred' },
  { value: 'black', label: 'Black' },
] as const;
// What a video fitted inside its box is shown over until told otherwise: itself, blurred, as the output frame is.
const FRESH_BACKDROP: ShotLayerBackdrop = 'blur';
const NOTE_CLASS = 'text-xs text-fg-muted';

const CENTRED = { x: 0.5, y: 0.5 };
const ANCHOR_ICON_SIZE = 16;
const HORIZONTAL_ANCHOR_ICONS: Readonly<Record<ShotLayerHorizontalAnchor, LucideIcon>> = {
  left: AlignStartVertical,
  center: AlignCenterVertical,
  right: AlignEndVertical,
};
const VERTICAL_ANCHOR_ICONS: Readonly<Record<ShotLayerVerticalAnchor, LucideIcon>> = {
  top: AlignStartHorizontal,
  center: AlignCenterHorizontal,
  bottom: AlignEndHorizontal,
};

const CUSTOM_ASPECT = 'custom';
const NO_MIXED_FIELDS: ReadonlySet<ShotLayerGroupField> = new Set();

/**
 * How one layer of a shot sits in the frame, as three blocks: *Layout*
 * (which of the three), *Box* (where the asset's box is and how big —
 * only for a layout that has one to set) and *Style* (its padding, its
 * corners, how the asset fills it). Only the picked layout's settings
 * show. Every change hands back a whole placement; the write clamps it,
 * and the sliders stop where it would.
 *
 * Knows nothing of where it is mounted or whose placement it is; it
 * draws its own headings, so it stands among the other blocks of a
 * panel rather than under one. Shown for several layers at once, it
 * marks the fields where they differ and leaves out the settings their
 * layouts do not all hold; reading a change back into each of them is
 * the caller's.
 */
export const ShotLayerPlacementEditor = memo(function ShotLayerPlacementEditor({
  placement,
  frameAspectRatio,
  assetAspectRatio = null,
  mixedFields = NO_MIXED_FIELDS,
  layouts,
  takenOver = NO_MIXED_FIELDS,
  filesAreVideos = false,
  isGraphic = false,
  poster,
  cropNotice,
  onChange,
}: ShotLayerPlacementEditorProps) {
  const form = useShotLayerPlacementForm();
  const layoutsShown = layouts ?? new Set([placement.kind]);
  const oneLayout = layoutsShown.size === 1;
  const everyLayoutHasABox = !layoutsShown.has('full');
  const mixed = (field: ShotLayerGroupField) => mixedFields.has(field);
  const taken = (...fields: ShotLayerGroupField[]) => fields.some((field) => takenOver.has(field));
  const layoutOptions = form.layouts().map((kind) => ({
    value: kind,
    label: form.layoutLabel(kind),
    picture: (
      <ShotLayerSchematic
        placement={form.withLayout(placement, kind)}
        frameAspectRatio={frameAspectRatio}
        assetAspectRatio={assetAspectRatio}
      />
    ),
  }));
  return (
    <>
      <Section title="Layout" titleAside={mixed('layout') ? <MixedValueMarker inline /> : null}>
        <CustomizedFieldOverlay customized={taken('layout')} label="Layout">
          <PictureChoice
            label="Layout"
            hideLabel
            oneRow
            value={placement.kind}
            options={layoutOptions}
            onChange={(kind) => onChange(form.withLayout(placement, kind as ShotLayerPlacementKind))}
          />
        </CustomizedFieldOverlay>
      </Section>
      {oneLayout && placement.kind === 'split' && (
        <Section title="Box">
          <SplitBoxSettings
            form={form}
            placement={placement}
            frameAspectRatio={frameAspectRatio}
            mixed={mixed}
            taken={taken}
            onChange={onChange}
          />
        </Section>
      )}
      {oneLayout && placement.kind === 'inset' && (
        <Section title="Box">
          <InsetBoxSettings form={form} placement={placement} mixed={mixed} taken={taken} offersSubject={!isGraphic} onChange={onChange} />
        </Section>
      )}
      {placement.kind !== 'full' && everyLayoutHasABox && (
        <Section title="Style">
          <div className={FIELD_ROWS_CLASS}>
            <TakenRow taken={taken('padding')} label="Padding">
              <PercentSlider
                form={form}
                label="Padding"
                mixed={mixed('padding')}
                value={placement.padding}
                range={placement.kind === 'split' ? SHOT_LAYER_PLACEMENT_RANGES.splitPadding : SHOT_LAYER_PLACEMENT_RANGES.insetPadding}
                step={0.5}
                onChange={(padding) => onChange({ ...placement, padding })}
              />
            </TakenRow>
            <TakenRow taken={taken('cornerRadius')} label="Corners">
              <PercentSlider
                form={form}
                label="Corners"
                mixed={mixed('cornerRadius')}
                value={placement.cornerRadius}
                range={SHOT_LAYER_PLACEMENT_RANGES.cornerRadius}
                step={1}
                onChange={(cornerRadius) => onChange({ ...placement, cornerRadius })}
              />
            </TakenRow>
          </div>
        </Section>
      )}
      {!isGraphic && <Section title={filesAreVideos ? 'Video' : 'File'}>
        <div className={FIELD_ROWS_CLASS}>
          <TakenRow taken={taken('fit')} label="Size">
            <SegmentedChoice
              label="Size"
              mixed={mixed('fit')}
              value={placement.fit}
              options={FIT_OPTIONS}
              onChange={(fit) => onChange(fit === 'contain'
                ? { ...form.withoutCrop(placement), fit: 'contain', ...(filesAreVideos ? { backdrop: placement.backdrop ?? FRESH_BACKDROP } : {}) }
                : { ...form.withoutBackdrop(placement), fit: 'cover' })}
            />
          </TakenRow>
          {placement.fit === 'contain' && filesAreVideos && (
            <TakenRow taken={taken('backdrop')} label="Background">
              <SegmentedChoice
                label="Background"
                mixed={mixed('backdrop')}
                value={placement.backdrop ?? ''}
                options={BACKDROP_OPTIONS}
                onChange={(backdrop) => onChange({ ...placement, backdrop: backdrop === 'black' ? 'black' : 'blur' })}
              />
            </TakenRow>
          )}
        </div>
        {poster !== undefined && (
          <CropPosition
            form={form}
            placement={placement}
            frameAspectRatio={frameAspectRatio}
            assetAspectRatio={assetAspectRatio}
            poster={poster}
            notice={cropNotice}
            onChange={onChange}
          />
        )}
      </Section>}
    </>
  );
});

interface CropPositionProps {
  form: ShotLayerPlacementForm;
  placement: ShotLayerPlacement;
  frameAspectRatio: number | null;
  assetAspectRatio: number | null;
  poster: string | null;
  notice: ((axis: 'x' | 'y') => ReactNode) | undefined;
  onChange: (placement: ShotLayerPlacement) => void;
}

/**
 * Where a file filling a box of another shape is cropped, on the one
 * axis it is cropped on, as a box on a frame of the file; nothing where
 * it is not cropped. The same picker the output frame's crop is set
 * with.
 */
function CropPosition({ form, placement, frameAspectRatio, assetAspectRatio, poster, notice, onChange }: CropPositionProps) {
  const axis = form.croppedAxisOf(placement, frameAspectRatio, assetAspectRatio);
  const boxAspect = form.boxAspectRatioOf(placement, frameAspectRatio, assetAspectRatio);
  if (axis === null || boxAspect === null || assetAspectRatio === null) return null;
  return (
    <div className="flex flex-col gap-2 mt-2">
      <OutputFrameCropPicker
        poster={poster}
        videoAspect={assetAspectRatio}
        frameAspect={boxAspect}
        axis={axis}
        position={placement.position ?? CENTRED}
        onChange={(position) => onChange({ ...placement, position })}
      />
      <p className={NOTE_CLASS}>Drag the box to choose which part of the file shows.</p>
      {notice?.(axis)}
    </div>
  );
}

/** Whether the layers shown hold different values for `field`. */
type MixedFieldQuery = (field: ShotLayerGroupField) => boolean;

/** Whether the layer's own CSS has taken any of `fields` over. */
type TakenFieldQuery = (...fields: ShotLayerGroupField[]) => boolean;

/** One row of fields, dimmed under the pill while the layer's own CSS has taken it over. */
function TakenRow({ taken, label, children }: { taken: boolean; label: string; children: ReactNode }) {
  return (
    <div className={FIELD_ROW_CLASS}>
      <CustomizedFieldOverlay customized={taken} label={label}>{children}</CustomizedFieldOverlay>
    </div>
  );
}

interface SplitBoxSettingsProps {
  form: ShotLayerPlacementForm;
  placement: SplitShotLayerPlacement;
  frameAspectRatio: number | null;
  mixed: MixedFieldQuery;
  taken: TakenFieldQuery;
  onChange: (placement: ShotLayerPlacement) => void;
}

function SplitBoxSettings({ form, placement, frameAspectRatio, mixed, taken, onChange }: SplitBoxSettingsProps) {
  const sides = form.splitSideLabels(frameAspectRatio);
  return (
    <div className={FIELD_ROWS_CLASS}>
      <TakenRow taken={taken('assetSide')} label="Side">
        <SegmentedChoice
          label="Side"
          mixed={mixed('assetSide')}
          value={placement.assetSide}
          options={[
            { value: 'start', label: sides.start },
            { value: 'end', label: sides.end },
          ]}
          onChange={(side) => onChange({ ...placement, assetSide: side === 'end' ? 'end' : 'start' })}
        />
      </TakenRow>
      <TakenRow taken={taken('assetRatio')} label="Size">
        <PercentSlider
          form={form}
          label="Size"
          mixed={mixed('assetRatio')}
          value={placement.assetRatio}
          range={SHOT_LAYER_PLACEMENT_RANGES.splitAssetRatio}
          step={1}
          onChange={(assetRatio) => onChange({ ...placement, assetRatio })}
        />
      </TakenRow>
    </div>
  );
}

interface InsetBoxSettingsProps {
  form: ShotLayerPlacementForm;
  placement: InsetShotLayerPlacement;
  mixed: MixedFieldQuery;
  taken: TakenFieldQuery;
  /** Whether the video can be the one floating in the box instead. */
  offersSubject: boolean;
  onChange: (placement: ShotLayerPlacement) => void;
}

function InsetBoxSettings({ form, placement, mixed, taken, offersSubject, onChange }: InsetBoxSettingsProps) {
  const preset = form.aspectPresetOf(placement);
  const shapeOptions = form.aspectPresets().map((option) => ({ value: option, label: form.aspectPresetLabel(option) }));
  return (
    <div className={FIELD_ROWS_CLASS}>
      {offersSubject && (
        <TakenRow taken={taken('subject')} label="Floating">
          <SegmentedChoice
            label="Floating"
            mixed={mixed('subject')}
            value={placement.subject}
            options={SUBJECT_OPTIONS}
            onChange={(subject) => onChange({ ...placement, subject: subject === 'video' ? 'video' : 'asset' })}
          />
        </TakenRow>
      )}
      <TakenRow taken={taken('centerX', 'centerY')} label="Position">
        <PositionChoice
          form={form}
          placement={placement}
          mixed={mixed('centerX') || mixed('centerY')}
          onChange={onChange}
        />
      </TakenRow>
      <TakenRow taken={taken('width')} label="Size">
        <PercentSlider
          form={form}
          label="Size"
          mixed={mixed('width')}
          value={placement.width}
          range={SHOT_LAYER_PLACEMENT_RANGES.insetWidth}
          step={1}
          onChange={(width) => onChange({ ...placement, width })}
        />
      </TakenRow>
      <TakenRow taken={taken('aspectRatio')} label="Shape">
        <Select
          label="Shape"
          mixed={mixed('aspectRatio')}
          value={preset ?? CUSTOM_ASPECT}
          // A shape set some other way stays named until another is picked.
          options={preset === null ? [...shapeOptions, { value: CUSTOM_ASPECT, label: 'Custom' }] : shapeOptions}
          onChange={(value) => {
            if (value !== CUSTOM_ASPECT) onChange(form.withAspectPreset(placement, value as ShotLayerAspectPreset));
          }}
        />
      </TakenRow>
    </div>
  );
}

interface PositionChoiceProps {
  form: ShotLayerPlacementForm;
  placement: InsetShotLayerPlacement;
  /** Whether the layers shown sit in different places on either axis. */
  mixed: boolean;
  onChange: (placement: ShotLayerPlacement) => void;
}

/**
 * Where the box is, as two alignments side by side: across the frame,
 * then down it. An axis the box was dragged off shows no place picked;
 * picking one moves the box on that axis only.
 */
function PositionChoice({ form, placement, mixed, onChange }: PositionChoiceProps) {
  const horizontalOptions = form.horizontalAnchors().map((anchor) => {
    const Icon = HORIZONTAL_ANCHOR_ICONS[anchor];
    return { value: anchor, label: form.horizontalAnchorLabel(anchor), icon: <Icon size={ANCHOR_ICON_SIZE} /> };
  });
  const verticalOptions = form.verticalAnchors().map((anchor) => {
    const Icon = VERTICAL_ANCHOR_ICONS[anchor];
    return { value: anchor, label: form.verticalAnchorLabel(anchor), icon: <Icon size={ANCHOR_ICON_SIZE} /> };
  });
  return (
    <div className="flex items-center gap-2">
      <FieldLabel label="Position" mixed={mixed} />
      <div className="flex flex-1 min-w-0 gap-2">
        <SegmentedChoice
          ariaLabel="Position across"
          value={form.horizontalAnchorOf(placement)}
          options={horizontalOptions}
          onChange={(anchor) => onChange(form.withHorizontalAnchor(placement, anchor as ShotLayerHorizontalAnchor))}
        />
        <SegmentedChoice
          ariaLabel="Position down"
          value={form.verticalAnchorOf(placement)}
          options={verticalOptions}
          onChange={(anchor) => onChange(form.withVerticalAnchor(placement, anchor as ShotLayerVerticalAnchor))}
        />
      </div>
    </div>
  );
}

interface PercentSliderProps {
  form: ShotLayerPlacementForm;
  label: string;
  mixed: boolean;
  /** As the placement holds it, a fraction. */
  value: number;
  range: ShotLayerPlacementRange;
  /** In percent. */
  step: number;
  onChange: (fraction: number) => void;
}

/** A placement setting held as a fraction, shown and set as a percentage. */
function PercentSlider({ form, label, mixed, value, range, step, onChange }: PercentSliderProps) {
  return (
    <Slider
      label={label}
      mixed={mixed}
      value={form.percentOf(value)}
      min={form.percentOf(range.min)}
      max={form.percentOf(range.max)}
      step={step}
      unit="%"
      onChange={(percent) => onChange(form.fractionOf(percent))}
    />
  );
}
