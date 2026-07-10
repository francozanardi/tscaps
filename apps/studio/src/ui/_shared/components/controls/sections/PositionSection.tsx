import { memo } from 'react';
import type { AlignmentConfig } from '@tscaps/engine';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

interface PositionSectionProps {
  config: AlignmentConfig;
  onChange: (patch: Partial<AlignmentConfig>) => void;
  /** When true, the Section header is omitted (the surrounding tab provides the title). */
  hideTitle?: boolean | undefined;
}

type HAlign = AlignmentConfig['horizontalAlign'];
type VAlign = AlignmentConfig['verticalAlign'];

const VERTICAL_ALIGNS: VAlign[] = ['top', 'center', 'bottom'];
const HORIZONTAL_ALIGNS: HAlign[] = ['left', 'center', 'right'];

// Preview geometry. Frame = the video canvas; block = a stand-in caption box
// that stays put — the anchor dot is what moves between the 9 reference
// points on the block as the user picks an alignment.
const PREVIEW_W = 100;
const PREVIEW_H = 58;
const BLOCK_W = 56;
const BLOCK_H = 30;
const BLOCK_LEFT = (PREVIEW_W - BLOCK_W) / 2;
const BLOCK_TOP = (PREVIEW_H - BLOCK_H) / 2;

function anchorPointOnBlock(h: HAlign, v: VAlign) {
  const dx = h === 'left' ? 0 : h === 'right' ? BLOCK_W : BLOCK_W / 2;
  const dy = v === 'top' ? 0 : v === 'bottom' ? BLOCK_H : BLOCK_H / 2;
  return { x: BLOCK_LEFT + dx, y: BLOCK_TOP + dy };
}

/**
 * Custom widget for AlignmentConfig. Vertical / horizontal offsets reuse the
 * shared `Slider` atom. The 3x3 anchor picker is paired with a mini preview
 * that shows the chosen reference point sliding to one of the 9 positions on
 * a stand-in caption block — communicating that the anchor names a point on
 * the block, not a translation of the block.
 */
export const PositionSection = memo(function PositionSection({
  config,
  onChange,
  hideTitle,
}: PositionSectionProps) {
  const { x: dotX, y: dotY } = anchorPointOnBlock(
    config.horizontalAlign,
    config.verticalAlign,
  );
  const horizontalPercent = Math.round(config.horizontalOffset * 100);
  const verticalPercent = Math.round(config.verticalOffset * 100);
  const anchorTag = `(${config.horizontalAlign}, ${config.verticalAlign})`;
  return (
    <Section title={hideTitle ? undefined : 'Position'}>
      <Slider
        label="Vertical"
        value={config.verticalOffset}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => onChange({ verticalOffset: v })}
      />
      <Slider
        label="Horizontal"
        value={config.horizontalOffset}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => onChange({ horizontalOffset: v })}
      />
      <div className="flex flex-col gap-2 mt-1">
        <span className="text-xs text-fg-muted">Anchor</span>
        <div className="flex items-center gap-3">
          <div
            className="grid grid-cols-[repeat(3,18px)] grid-rows-[repeat(3,18px)] gap-[3px] shrink-0"
            role="radiogroup"
            aria-label="Anchor"
          >
            {VERTICAL_ALIGNS.flatMap((v) =>
              HORIZONTAL_ALIGNS.map((h) => {
                const active =
                  config.verticalAlign === v && config.horizontalAlign === h;
                const label = `(${h}, ${v})`;
                return (
                  <Tooltip key={`${v}-${h}`} text={label} position="top">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={label}
                      className={
                        active
                          ? 'group flex items-center justify-center border rounded-xs p-0 cursor-pointer bg-accent/20 border-accent transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30'
                          : 'group flex items-center justify-center border rounded-xs p-0 cursor-pointer bg-surface-2 border-edge-medium transition-colors duration-quick ease-standard hover:border-edge-strong focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30'
                      }
                      onClick={() => onChange({ verticalAlign: v, horizontalAlign: h })}
                    >
                      <span
                        aria-hidden="true"
                        className={
                          active
                            ? 'rounded-full transition-[background-color,width,height] duration-quick ease-standard w-[5px] h-[5px] bg-white'
                            : 'rounded-full transition-[background-color,width,height] duration-quick ease-standard w-[3px] h-[3px] bg-edge-strong group-hover:bg-fg-faint'
                        }
                      />
                    </button>
                  </Tooltip>
                );
              }),
            )}
          </div>
          <div
            className="relative shrink-0 rounded-xs border border-edge-medium bg-surface-1 overflow-hidden"
            style={{ width: PREVIEW_W, height: PREVIEW_H }}
            aria-hidden="true"
          >
            <div
              className="absolute bg-accent/15 border border-accent/45 rounded-[2px]"
              style={{
                left: BLOCK_LEFT,
                top: BLOCK_TOP,
                width: BLOCK_W,
                height: BLOCK_H,
              }}
            />
            <span
              className="absolute rounded-full bg-accent transition-[left,top] duration-base ease-emphasized"
              style={{
                left: dotX - 4,
                top: dotY - 4,
                width: 8,
                height: 8,
                boxShadow: '0 0 0 3px rgb(var(--color-accent) / 0.25)',
              }}
            />
          </div>
        </div>
        <p className="text-2xs text-fg-faint leading-snug m-0">
          The{' '}
          <span className="font-mono text-fg-muted">{anchorTag}</span> point of
          the block sits at{' '}
          <span className="font-mono tabular-nums text-fg-muted">
            {horizontalPercent}%
          </span>{' '}
          from left and{' '}
          <span className="font-mono tabular-nums text-fg-muted">
            {verticalPercent}%
          </span>{' '}
          from top.
        </p>
      </div>
    </Section>
  );
});
