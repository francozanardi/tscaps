/** The shots a run covers, by index in the video, both ends included. */
export interface ShotRunSpan {
  readonly fromIndex: number;
  readonly throughIndex: number;
}

interface ShotRunBarProps {
  /** Every shot of the video, in order, by how long it plays in the output, in seconds. */
  shotLengthsSec: ReadonlyArray<number>;
  covered: ShotRunSpan;
  /** How the covered shots read: in the accent, as something being picked, or quietly, as something said. */
  tone: 'accent' | 'quiet';
}

const SEGMENT_CLASS = 'min-w-0 rounded-[1px] transition-colors duration-quick ease-standard';
const COVERED_CLASS = { accent: 'bg-accent', quiet: 'bg-fg-faint/40' } as const;
const UNCOVERED_CLASS = 'bg-edge-medium';

/**
 * The whole video as a thin line of its shots, each as wide as it plays,
 * with the shots a run covers filled. Decorative: what it shows is
 * always said in words beside it.
 */
export function ShotRunBar({ shotLengthsSec, covered, tone }: ShotRunBarProps) {
  return (
    <div className="flex gap-px h-1" aria-hidden>
      {shotLengthsSec.map((lengthSec, index) => {
        const isCovered = index >= covered.fromIndex && index <= covered.throughIndex;
        return (
          <span
            // Shots are only ever told apart by their place here.
            key={index}
            className={`${SEGMENT_CLASS} ${isCovered ? COVERED_CLASS[tone] : UNCOVERED_CLASS}`}
            style={{ flexGrow: lengthSec, flexBasis: 0 }}
          />
        );
      })}
    </div>
  );
}
