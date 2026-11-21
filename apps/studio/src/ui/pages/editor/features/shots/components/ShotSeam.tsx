import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ShotTransition } from '@core/shots/domain/ShotTransition';
import type { ShotTransitionRequest } from '@presentation/editor/stores/EditorWorkspaceStore';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { useEditorWorkspaceStore } from '@ui/pages/editor/contexts/EditorWorkspaceContext';
import { useShotTransitionRequest } from '@ui/pages/editor/hooks/useShotTransitionRequest';
import { SpotlightContext, type SpotlightRequest } from '@ui/pages/editor/features/element/SpotlightContext';
import { formatTime } from '@ui/pages/editor/features/transcript/utils';
import { ShotTransitionIcon } from '@ui/pages/editor/features/shots/components/ShotTransitionIcon';
import {
  SHOT_TRANSITION_LABELS,
  SHOT_TRANSITION_SOUND_SCREEN,
  ShotTransitionPanel,
} from '@ui/pages/editor/features/shots/components/ShotTransitionPanel';
import { ShotTransitionSoundScreen } from '@ui/pages/editor/features/shots/components/ShotTransitionSoundScreen';

interface ShotSeamProps {
  /** The shot the seam opens. */
  shotId: string;
  /** Source time; shown as the output plays it. */
  atSec: number;
  /** How the picture passes into the shot, or absent for a plain cut. */
  transition: ShotTransition | undefined;
  /** The open project, whose files the sound picker lists. */
  projectId: string | null;
}

const ROW_CLASS = 'group/seam flex items-center gap-2 py-1 select-none';
const LINE_CLASS =
  'flex-1 h-px bg-edge-subtle transition-colors duration-quick ease-standard group-hover/seam:bg-edge-medium';
const TIME_CLASS = 'font-mono text-3xs text-fg-faint tabular-nums shrink-0';
const TRIGGER_CLASS =
  'group/transition inline-flex items-center gap-1 shrink-0 h-5 px-1 rounded-xs cursor-pointer bg-transparent border-none '
  + 'transition-[opacity,color,background-color] duration-quick ease-standard '
  + 'hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 '
  + 'data-[state=open]:bg-surface-3 data-[state=open]:opacity-100';
const TRIGGER_EMPTY = 'text-fg-faint opacity-50 hover:opacity-100 focus-visible:opacity-100';
const TRIGGER_SET = 'text-fg-secondary hover:text-fg-primary';
// The label opens out of nothing on hover, the way the transcript's
// add-scene control does, so the plus parts the cards quietly at rest.
const LABEL_WRAP =
  'grid grid-cols-[0fr] transition-[grid-template-columns] duration-base ease-emphasized '
  + 'group-hover/transition:grid-cols-[1fr] group-focus-visible/transition:grid-cols-[1fr] group-data-[state=open]/transition:grid-cols-[1fr]';
const LABEL_CLIP = 'overflow-hidden font-mono text-2xs uppercase tracking-[0.06em] whitespace-nowrap';
const SET_LABEL = 'font-mono text-2xs uppercase tracking-[0.06em] whitespace-nowrap';
const DURATION_CLASS = 'font-mono text-2xs text-fg-faint tabular-nums whitespace-nowrap';

/**
 * The line between two shots, which is the shot below opening: when it
 * opens, and how the picture passes into it. A plain cut shows a faint
 * plus that names itself on hover; a transition shows what it is and
 * how long it takes. Either opens the transition's settings, and so
 * does a panel's ask that this shot's transition be opened
 * (`EditorWorkspaceStore.requestShotTransition`), which brings the line
 * into view first and shows the part of the settings it names.
 */
export function ShotSeam({ shotId, atSec, transition, projectId }: ShotSeamProps) {
  const timeMap = useRenderTimeMap();
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const workspace = useEditorWorkspaceStore();
  const request = useShotTransitionRequest();
  const askedHere = request !== null && request.shotId === shotId ? request : null;
  // A panel that asked for this transition: the popover opens once, as the request is first seen.
  const [seenRequest, setSeenRequest] = useState<ShotTransitionRequest | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  if (askedHere !== null && askedHere !== seenRequest) {
    setSeenRequest(askedHere);
    setSpotlight(askedHere.spotlight);
    setOpen(true);
  }
  const spotlightRequest = useMemo<SpotlightRequest>(() => ({ key: spotlight, spotlit: () => setSpotlight(null) }), [spotlight]);
  useEffect(() => {
    if (askedHere === null) return;
    workspace.settleShotTransitionRequest(askedHere);
    rowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [askedHere, workspace]);
  const trigger = transition === undefined ? (
    <button type="button" className={`${TRIGGER_CLASS} ${TRIGGER_EMPTY}`} aria-label="Add a transition">
      <Plus size={11} />
      <span className={LABEL_WRAP}>
        <span className={LABEL_CLIP}>
          <span className="pl-0.5">Transition</span>
        </span>
      </span>
    </button>
  ) : (
    <button type="button" className={`${TRIGGER_CLASS} ${TRIGGER_SET}`} aria-label="Edit the transition">
      <ShotTransitionIcon kind={transition.kind} size={18} />
      <span className={SET_LABEL}>
        {SHOT_TRANSITION_LABELS[transition.kind]}
      </span>
      <span className={DURATION_CLASS}>{transition.durationSec.toFixed(2).replace(/0$/, '')}s</span>
    </button>
  );
  return (
    <div ref={rowRef} className={ROW_CLASS}>
      <span className={LINE_CLASS} />
      <Popover
        open={open}
        onOpenChange={setOpen}
        side="bottom"
        align="center"
        trigger={trigger}
        screens={{
          main: (
            <SpotlightContext.Provider value={spotlightRequest}>
              <ShotTransitionPanel shotId={shotId} transition={transition ?? null} />
            </SpotlightContext.Provider>
          ),
          [SHOT_TRANSITION_SOUND_SCREEN]: <ShotTransitionSoundScreen shotId={shotId} projectId={projectId} />,
        }}
      />
      <span className={TIME_CLASS}>{formatTime(timeMap.toOutputTime(atSec))}</span>
      <span className={LINE_CLASS} />
    </div>
  );
}
