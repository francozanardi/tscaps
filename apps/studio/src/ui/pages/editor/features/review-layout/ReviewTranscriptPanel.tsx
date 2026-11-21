import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { useRef } from 'react';
import { ScrollFade } from '@ui/_shared/components/ScrollFade/ScrollFade';
import { ScrollSlackSpacer } from '@ui/_shared/components/ScrollSlack/ScrollSlackSpacer';
import { TranscriptHost } from '@ui/pages/editor/features/transcript/TranscriptHost';

interface ReviewTranscriptPanelProps {
  document: Document | null;
  activeSegmentId: string | null;
  sheets: Sheet[];
  elementStyles: ElementStyles;
  frozenSegments: FrozenSegmentSet;
  decorationOverrides: DecorationOverrideRegistry;
  videoDuration: number;
  isPlaying: boolean;
}

// The sidebar's card, padding, scroller and fade (SidebarPanel), without its rail: the review holds one panel.
const CARD_CLASS = 'relative flex flex-col h-full min-h-0 bg-surface-1 border border-edge-medium rounded-lg shadow-sm overflow-hidden';
const BODY_CLASS = 'relative flex-1 flex flex-col min-h-0 min-w-0 p-3 pb-0 lg:pb-3';
const SCROLL_CLASS =
  'thin-scroll flex-1 overflow-y-auto min-h-0 -mr-2 pr-2 pb-3 lg:pb-0 outline-none ' +
  '[scrollbar-width:thin] [scrollbar-color:rgb(var(--color-fg-faint)/0.25)_transparent]';

/**
 * The review layout's side panel: the transcript, its words edited as
 * text. Fixing a misheard word is the one correction quicker to make
 * than to describe; anything else is a note for the agent.
 */
export function ReviewTranscriptPanel(props: ReviewTranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div className={CARD_CLASS}>
      <div className={BODY_CLASS}>
        <div className={SCROLL_CLASS} ref={scrollRef}>
          <TranscriptHost {...props} textOnly />
          <ScrollSlackSpacer />
        </div>
        <ScrollFade scrollRef={scrollRef} />
      </div>
    </div>
  );
}
