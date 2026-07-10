import type { Document } from '@tscaps/engine';
import type { CutRange, CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { Silence } from '@core/cuts/domain/Silence';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { AutoCutTriggerButton } from '@ui/pages/editor/features/cuts/components/AutoCutTriggerButton';
import { AutoCutMenuScreen } from '@ui/pages/editor/features/cuts/components/AutoCutMenuScreen';
import { RemoveSilencesScreen } from '@ui/pages/editor/features/cuts/components/RemoveSilencesScreen';
import { RemoveBadTakesScreen } from '@ui/pages/editor/features/cuts/components/RemoveBadTakesScreen';

interface AutoCutPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document;
  videoDurationSec: number;
  cuts: CutRegistry;
  onRemoveSilences: (silences: ReadonlyArray<Silence>) => void;
  onRemoveBadTakes: (ranges: ReadonlyArray<CutRange>) => void;
}

/**
 * Popover anchored to a topbar trigger that exposes the auto-cut
 * features (currently: remove silences). Navigation between screens
 * uses the shared Popover's stack — the menu screen lists the
 * features and each item navigates to its dedicated screen.
 */
export function AutoCutPopover({
  open,
  onOpenChange,
  document,
  videoDurationSec,
  cuts,
  onRemoveSilences,
  onRemoveBadTakes,
}: AutoCutPopoverProps) {
  const screens = {
    menu: <AutoCutMenuScreen />,
    silences: (
      <RemoveSilencesScreen
        document={document}
        videoDurationSec={videoDurationSec}
        cuts={cuts}
        onRemoveSilences={onRemoveSilences}
      />
    ),
    badTakes: (
      <RemoveBadTakesScreen
        document={document}
        videoDurationSec={videoDurationSec}
        cuts={cuts}
        onRemoveBadTakes={onRemoveBadTakes}
      />
    ),
  };
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={<AutoCutTriggerButton />}
      screens={screens}
      initialScreen="menu"
    />
  );
}
