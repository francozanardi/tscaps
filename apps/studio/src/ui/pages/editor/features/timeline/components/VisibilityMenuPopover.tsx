import { useState } from 'react';
import type { TimelineDetail } from '@core/timeline/domain/TimelineDetail';
import type { TimelineView } from '@core/timeline/domain/TimelineView';
import type { TimelineDetailVisibility } from '@presentation/timeline/controllers/TimelineVisibilityController';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { VisibilityMenuButton } from '@ui/pages/editor/features/timeline/components/VisibilityMenuButton';
import { VisibilityMenuScreen } from '@ui/pages/editor/features/timeline/components/VisibilityMenuScreen';
import { TimelineViewScreen } from '@ui/pages/editor/features/timeline/components/TimelineViewScreen';

interface VisibilityMenuPopoverProps {
  view: TimelineView;
  onViewChange: (view: TimelineView) => void;
  visible: TimelineDetailVisibility;
  onToggle: (detail: TimelineDetail) => void;
}

/** What the timeline shows, and at which level, behind one trigger. */
export function VisibilityMenuPopover({ view, onViewChange, visible, onToggle }: VisibilityMenuPopoverProps) {
  const [isOpen, setOpen] = useState(false);
  return (
    <Popover
      open={isOpen}
      onOpenChange={setOpen}
      align="start"
      trigger={<VisibilityMenuButton />}
      screens={{
        menu: (
          <VisibilityMenuScreen view={view} visible={visible} onToggle={onToggle} />
        ),
        level: <TimelineViewScreen view={view} onViewChange={onViewChange} />,
      }}
      initialScreen="menu"
    />
  );
}
