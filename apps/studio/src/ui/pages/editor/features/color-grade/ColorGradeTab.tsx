import { memo } from 'react';
import { ColorGrade, type ColorGradeField } from '@core/color-grade/domain/ColorGrade';
import { PictureChoice } from '@ui/_shared/components/controls/fields/PictureChoice';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { useColorGrade } from '@ui/_shared/contexts/modules/ColorGradeContext';
import { EditorTab } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { GradedPoster } from '@ui/pages/editor/features/color-grade/GradedPoster';
import { useShotPoster } from '@ui/pages/editor/features/shots/hooks/useShotPoster';
import { useVideoFrameSampler } from '@ui/pages/editor/features/shots/hooks/useVideoFrameSampler';

interface ColorGradeTabProps {
  colorGrade: ColorGrade;
  /** What the looks are shown on is taken from; null while there is nothing to sample. */
  posterSource: Blob | null;
  /** How long the video runs, which picks the moment the looks are shown on. */
  videoDurationSec: number;
  /** The video's width over its height, or null where it is not known. */
  videoAspectRatio: number | null;
}

const FIELD_LABELS: Readonly<Record<ColorGradeField, string>> = {
  exposure: 'Exposure',
  contrast: 'Contrast',
  saturation: 'Saturation',
  temperature: 'Temperature',
  tint: 'Tint',
  vignette: 'Vignette',
};
const PERCENT = 100;
// A third of the way in: past an opening black or title card, and well before the end.
const POSTER_SHARE = 1 / 3;
const LOOK_HEIGHT_PX = 40;
const CUSTOM = 'custom';
const NOTE_CLASS = 'text-xs text-fg-muted';

/**
 * The colour of the whole picture beneath the captions — the video and
 * everything shown over it: a look to start from, each one drawn on a
 * frame of the video in that look, then each adjustment on its own. A
 * look sets every adjustment, which stay free to change after; once one
 * is changed, no look reads as picked. Each change is one undo step, and
 * a slider drag is one too.
 */
export const ColorGradeTab = memo(function ColorGradeTab({
  colorGrade,
  posterSource,
  videoDurationSec,
  videoAspectRatio,
}: ColorGradeTabProps) {
  const { looks, actions } = useColorGrade();
  const sampler = useVideoFrameSampler();
  const poster = useShotPoster(sampler, posterSource, videoDurationSec * POSTER_SHARE);
  const shape = videoAspectRatio !== null && videoAspectRatio > 0 ? videoAspectRatio : 16 / 9;
  const picked = looks.lookOf(colorGrade);
  const options = looks.list().map((look) => ({
    value: look.id,
    label: look.label,
    picture: (
      <GradedPoster
        poster={poster}
        grade={look.grade.toFootageGrade()}
        widthPx={Math.round(LOOK_HEIGHT_PX * Math.min(shape, 1.6))}
        heightPx={LOOK_HEIGHT_PX}
      />
    ),
  }));

  return (
    <EditorTab title="Color">
      <div className="flex flex-col">
        <Section title="Look">
          <PictureChoice
            label="Look"
            hideLabel
            value={picked?.id ?? CUSTOM}
            options={options}
            onChange={(id) => {
              const look = looks.list().find((candidate) => candidate.id === id);
              if (look) actions.set.execute(look.grade);
            }}
          />
          <p className={NOTE_CLASS}>
            Grades the whole picture beneath the captions: the video, b-roll and pictures.
          </p>
        </Section>
        <Section title="Adjust">
          {ColorGrade.fields().map((field) => {
            const [min, max] = ColorGrade.rangeOf(field);
            return (
              <Slider
                key={field}
                label={FIELD_LABELS[field]}
                value={Math.round(colorGrade.valueOf(field) * PERCENT)}
                min={min * PERCENT}
                max={max * PERCENT}
                step={1}
                onChange={(value) => actions.set.setField(field, value / PERCENT)}
              />
            );
          })}
        </Section>
      </div>
    </EditorTab>
  );
});
