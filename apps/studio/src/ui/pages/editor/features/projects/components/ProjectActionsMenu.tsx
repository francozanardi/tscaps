import { forwardRef } from 'react';
import { Download, MoreVertical, Trash2 } from 'lucide-react';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';

interface ProjectActionsMenuProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When false the Export item is hidden. */
  canExport: boolean;
  onExport: () => void;
  onDelete: () => void;
}

const MENU_TRIGGER =
  'inline-flex items-center justify-center w-6 h-6 -mr-1 rounded-xs cursor-pointer ' +
  'bg-transparent border-none text-fg-faint ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-2 hover:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:bg-surface-2 focus-visible:text-fg-primary ' +
  'data-[state=open]:bg-surface-2 data-[state=open]:text-fg-primary';

const MENU_SCREEN = 'p-1.5 flex flex-col gap-0.5 w-[168px] box-border';

const MENU_ITEM_BASE =
  'flex items-center gap-2 w-full text-left text-xs px-2 py-2 rounded-xs border-none bg-transparent cursor-pointer ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none';

const MENU_ITEM = `${MENU_ITEM_BASE} text-fg-secondary hover:bg-surface-3 hover:text-fg-primary focus-visible:bg-surface-3 focus-visible:text-fg-primary`;
const MENU_ITEM_DANGER = `${MENU_ITEM_BASE} text-fg-secondary hover:bg-danger/15 hover:text-danger focus-visible:bg-danger/15 focus-visible:text-danger`;

/**
 * Kebab menu attached to a dashboard project card. Renders a subtle
 * three-dot trigger that opens a Popover with the per-project actions
 * (Export when enabled, Delete). Each action closes the menu before
 * firing so the surface returns to a clean state.
 */
export function ProjectActionsMenu({
  projectId,
  projectName,
  open,
  onOpenChange,
  canExport,
  onExport,
  onDelete,
}: ProjectActionsMenuProps) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={<MenuTriggerButton />}
      triggerTooltip="Project actions"
      screens={{
        menu: (
          <MenuScreen
            projectId={projectId}
            projectName={projectName}
            canExport={canExport}
            onExport={onExport}
            onDelete={onDelete}
          />
        ),
      }}
      initialScreen="menu"
      align="end"
    />
  );
}

const MenuTriggerButton = forwardRef<HTMLButtonElement>(
  function MenuTriggerButton(props, ref) {
    return (
      <button
        {...props}
        ref={ref}
        type="button"
        className={MENU_TRIGGER}
        aria-label="Project actions"
      >
        <MoreVertical size={14} />
      </button>
    );
  },
);

interface MenuScreenProps {
  projectId: string;
  projectName: string;
  canExport: boolean;
  onExport: () => void;
  onDelete: () => void;
}

function MenuScreen({
  canExport,
  onExport,
  onDelete,
}: MenuScreenProps) {
  const { close } = usePopoverNav();
  return (
    <div className={MENU_SCREEN}>
      {canExport && (
        <button
          type="button"
          className={MENU_ITEM}
          onClick={() => { close(); onExport(); }}
        >
          <Download size={14} />
          <span className="flex-1">Export</span>
        </button>
      )}
      <button
        type="button"
        className={MENU_ITEM_DANGER}
        onClick={() => { close(); onDelete(); }}
      >
        <Trash2 size={14} />
        <span className="flex-1">Delete</span>
      </button>
    </div>
  );
}
