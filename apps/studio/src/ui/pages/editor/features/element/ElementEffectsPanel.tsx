import { memo } from 'react';
import type { Segment } from '@tscaps/engine';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { ELEMENT_KIND_LABELS } from '@ui/_shared/components/element-fields/ElementKindLabels';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useLoadedDetectorResult } from '@ui/pages/editor/features/person-segmentation/hooks/useLoadedDetectorResult';
import { useSegmentMaskBackfillPending } from '@ui/pages/editor/features/person-segmentation/hooks/useSegmentMaskBackfillPending';
import { SwitchCard } from '@ui/_shared/components/controls/fields/SwitchCard';
import { BlendEffectPicture } from '@ui/pages/editor/features/element/BlendEffectPicture';
import { BehindActorEffectPicture } from '@ui/pages/editor/features/element/BehindActorEffectPicture';

interface ElementEffectsPanelProps {
  elementId: string;
  kind: ElementKind;
  /** The elements it sits inside, nearest first. */
  ancestorIds: ReadonlyArray<string>;
  /** The scene holding it, or the scene itself. */
  scene: Segment;
  sheet: Sheet | null;
}

const COMPUTING_MASKS_LEGEND = 'Finding the person in this scene…';

/**
 * What the element does to the video beneath it: blend with it, and
 * hide behind the person in it. The two combine freely — a blend over
 * the actor cutout inverts the cutout as it would the video.
 *
 * One untitled section of cards, because the tab strip already names it.
 * An effect that cannot be changed here says why in its legend rather
 * than behind a hover, since the reason is the only thing the user can
 * act on.
 */
export const ElementEffectsPanel = memo(function ElementEffectsPanel(props: ElementEffectsPanelProps) {
  return (
    <Section>
      <BlendCard {...props} />
      <BehindActorCard {...props} />
    </Section>
  );
});

/**
 * An element inside one that already blends shows the switch on and
 * locked rather than offering its own: a blend inside a blend paints as
 * nearly nothing.
 */
function BlendCard({ elementId, kind, ancestorIds }: ElementEffectsPanelProps) {
  const elements = useElements();
  const { elementStyles } = useEditorState();
  const blendingAncestorId = ancestorIds.find((id) => elementStyles.blendOf(id) !== null) ?? null;
  const blendingAncestorKind = blendingAncestorId === null ? null : elementStyles.get(blendingAncestorId)?.kind ?? null;
  const blends = elementStyles.blendOf(elementId) !== null;
  const lockedBy = blendingAncestorKind !== null
    ? `The ${ELEMENT_KIND_LABELS[blendingAncestorKind].toLowerCase()} it sits in already blends with the video.`
    : null;

  return (
    <SwitchCard
      title="Blend with video"
      legend={lockedBy ?? `Inverts the video behind the ${ELEMENT_KIND_LABELS[kind].toLowerCase()}.`}
      picture={<BlendEffectPicture />}
      checked={blends || lockedBy !== null}
      locked={lockedBy !== null}
      onCheckedChange={(on) => {
        if (on) elements.actions.setBlend.execute(elementId, kind, 'difference');
        else elements.actions.setBlend.clear(elementId, kind);
      }}
    />
  );
}

/**
 * Offered to a scene, a word and a glyph, on a template that allows the
 * override and a session that can paint the cutout at all.
 *
 * A scene answers the way its popover used to: the switch commits the
 * opposite of what is in effect, so it always lands on `force-on` or
 * `force-off`. A word or a glyph has no detector to fall back on, so
 * turning it off takes its entry back.
 */
function BehindActorCard({ elementId, kind, scene, sheet }: ElementEffectsPanelProps) {
  const personSegmentation = usePersonSegmentation();
  const captions = useCaptions();
  const { behindActorOverrides } = useEditorState();
  const detectorResult = useLoadedDetectorResult(personSegmentation.loadedCacheStore);
  const isComputingMasks = useSegmentMaskBackfillPending(scene.id);

  const offered = sheet !== null
    && kind !== 'line'
    && sheet.template.features.behindActorOverride
    && personSegmentation.previewSupportChecker.isSupported();
  if (!offered) return null;

  const sceneOn = personSegmentation.gatingService.isEffectivelyOn(
    scene, behindActorOverrides.get(scene.id), detectorResult?.windows ?? null, sheet.template.behindActor,
  );
  const on = kind === 'segment' ? sceneOn : sceneOn || behindActorOverrides.get(elementId) === 'force-on';
  const lockedBy = kind === 'segment' ? null : partLockReason(kind, sceneOn, sheet);

  const toggle = (): void => {
    const next = on ? (kind === 'segment' ? 'force-off' : 'auto') : 'force-on';
    captions.actions.setBehindActorOverride.execute(elementId, next);
    if (next !== 'force-on') return;
    // A word or glyph is painted for its whole scene, so the cutout
    // covers the scene's range either way.
    personSegmentation.actions.ensureSegmentMasks
      .execute({ segmentId: scene.id, range: { start: scene.time.start, end: scene.time.end } })
      .catch((error) => console.error('[behind-actor] segment mask backfill failed', error));
  };

  const description = kind === 'segment'
    ? 'The person in the video passes in front of the scene.'
    : `The person in the video passes in front of this ${ELEMENT_KIND_LABELS[kind].toLowerCase()}, and the rest of the scene stays in front of them.`;
  const legend = lockedBy ?? (isComputingMasks ? COMPUTING_MASKS_LEGEND : description);

  return (
    <SwitchCard
      title="Hide behind person"
      legend={legend}
      picture={<BehindActorEffectPicture />}
      checked={on}
      locked={lockedBy !== null}
      busy={isComputingMasks}
      onCheckedChange={toggle}
    />
  );
}

function partLockReason(kind: ElementKind, sceneOn: boolean, sheet: Sheet): string | null {
  const part = ELEMENT_KIND_LABELS[kind].toLowerCase();
  if (sceneOn) return 'The whole scene already hides behind the person.';
  if (sheet.template.rendering.videoFrame.required) {
    return `This template paints the video inside its captions, so a single ${part} cannot go behind the person.`;
  }
  return null;
}
