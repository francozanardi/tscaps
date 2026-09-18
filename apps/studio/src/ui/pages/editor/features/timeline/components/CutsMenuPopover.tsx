import type { Document } from '@tscaps/engine';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { Silence } from '@core/cuts/domain/Silence';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { CutsMenuButton } from '@ui/pages/editor/features/timeline/components/CutsMenuButton';
import { CutsMenuScreen } from '@ui/pages/editor/features/timeline/components/CutsMenuScreen';
import { RemoveSilencesScreen } from '@ui/pages/editor/features/timeline/components/RemoveSilencesScreen';

interface CutsMenuPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document;
  videoDurationSec: number;
  cuts: CutRegistry;
  onRemoveSilences: (silences: ReadonlyArray<Silence>) => void;
  onRestoreAllCuts: () => void;
}

/**
 * Everything the toolbar offers about cuts, behind one trigger: the
 * automatic ways of making them and the one way of taking them all back.
 *
 * They share a menu because they share a subject, not because they are
 * the same kind of action — the automatic ones each open a screen of
 * their own through the shared Popover's stack, while restoring acts on
 * the press and dismisses.
 */
export function CutsMenuPopover({
  open,
  onOpenChange,
  document,
  videoDurationSec,
  cuts,
  onRemoveSilences,
  onRestoreAllCuts,
}: CutsMenuPopoverProps) {
  const screens = {
    menu: (
      <CutsMenuScreen
        canRestoreAll={!cuts.isEmpty()}
        onRestoreAll={onRestoreAllCuts}
      />
    ),
    silences: (
      <RemoveSilencesScreen
        document={document}
        videoDurationSec={videoDurationSec}
        cuts={cuts}
        onRemoveSilences={onRemoveSilences}
      />
    ),
  };
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={<CutsMenuButton />}
      screens={screens}
      initialScreen="menu"
      align="end"
    />
  );
}
