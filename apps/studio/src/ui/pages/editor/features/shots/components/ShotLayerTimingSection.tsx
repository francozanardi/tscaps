import { memo } from 'react';
import type { ShotLayerGroupField } from '@presentation/shots/services/ShotLayerGroupForm';
import { ShotTimeGrid } from '@presentation/shots/services/ShotTimeGrid';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Toggle } from '@ui/_shared/components/controls/fields/Toggle';
import { FIELD_ROW_CLASS, FIELD_ROWS_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';

interface ShotLayerTimingSectionProps {
  inSec: number;
  /** Null plays to the file's own end. */
  outSec: number | null;
  loop: boolean;
  /** How long the file runs, which is as far as either end reaches. */
  durationSec: number;
  /** For a stretch shown on behalf of several layers: the fields where they differ. None by default. */
  mixedFields?: ReadonlySet<ShotLayerGroupField> | undefined;
  /** A new start; the end it would leave too close is the caller's to move. */
  onStartChange: (inSec: number) => void;
  /** A new end, or null for the file's own end. */
  onEndChange: (outSec: number | null) => void;
  onLoopChange: (loop: boolean) => void;
}

// The shortest stretch the sliders leave between the two ends, so the
// end can never be dragged onto the start.
const MIN_STRETCH_SEC = 0.1;
const TIME_GRID = new ShotTimeGrid();
const NO_MIXED_FIELDS: ReadonlySet<ShotLayerGroupField> = new Set();

/**
 * Which part of a video the layer plays. It always starts with its
 * shot; these say where in the file it starts and stops, and whether
 * that part plays again until the shot ends. Each field reports only
 * itself, so the same section can set one layer or several.
 *
 * Draws nothing for a file too short to pick a part of.
 */
export const ShotLayerTimingSection = memo(function ShotLayerTimingSection({
  inSec,
  outSec,
  loop,
  durationSec,
  mixedFields = NO_MIXED_FIELDS,
  onStartChange,
  onEndChange,
  onLoopChange,
}: ShotLayerTimingSectionProps) {
  if (durationSec <= MIN_STRETCH_SEC) return null;
  const endSec = outSec ?? durationSec;
  return (
    <Section title="Timing">
      <div className={FIELD_ROWS_CLASS}>
        <div className={FIELD_ROW_CLASS}>
          <Slider
            label="File start"
            mixed={mixedFields.has('inSec')}
            value={inSec}
            min={0}
            max={durationSec - MIN_STRETCH_SEC}
            step={TIME_GRID.stepSec}
            unit="s"
            onChange={(start) => onStartChange(TIME_GRID.snap(start))}
          />
        </div>
        <div className={FIELD_ROW_CLASS}>
          <Slider
            label="File end"
            mixed={mixedFields.has('outSec')}
            value={endSec}
            // On the grid, as the slider and its typed value step from here. The
            // file's end stays where it is, off the grid or not: reaching it is
            // what stores no end.
            min={TIME_GRID.ceil(inSec + MIN_STRETCH_SEC)}
            max={durationSec}
            step={TIME_GRID.stepSec}
            unit="s"
            // The file's own end is stored as no end at all, so a file
            // that turns out longer than measured still plays to its end.
            onChange={(end) => onEndChange(end >= durationSec ? null : TIME_GRID.snap(end))}
          />
        </div>
        <div className={FIELD_ROW_CLASS}>
          <Toggle label="Loop" mixed={mixedFields.has('loop')} value={loop} onChange={onLoopChange} />
        </div>
      </div>
      <p className="text-2xs text-fg-faint leading-snug m-0">
        Which part of the file plays. The b-roll starts with its shot. With Loop on, this part plays again for as
        long as the b-roll shows.
      </p>
    </Section>
  );
});
