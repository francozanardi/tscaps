import { type ReactElement } from 'react';
import { Smile, Palette, Trash2 } from 'lucide-react';
import type { AlignmentConfig, Decoration } from '@tscaps/engine';
import type { WordStyleOverrides } from '@core/captions/domain/WordStyleOverrides';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { EmojiPickerScreen } from '@ui/pages/editor/features/transcript/components/decorations/EmojiPickerScreen';
import { DecorationStyleOverridesPanel } from '@ui/pages/editor/features/transcript/components/decorations/DecorationStyleOverridesPanel';

interface EmojiPopoverActions {
  onCommitGlyph: (glyph: string) => void;
  onCommitStyleOverrides: (overrides: WordStyleOverrides) => void;
  onDelete: () => void;
}

interface EmojiPopoverData extends EmojiPopoverActions {
  decoration: Decoration;
  /** Decoration's inherited alignment (sheet + segment + placement default, no user override) — drives the position-field baseline. */
  inheritedAlignment: AlignmentConfig;
  styleOverrides: WordStyleOverrides;
  styleBaseline: Partial<WordStyleOverrides>;
}

interface EmojiPopoverWithTrigger extends EmojiPopoverData {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  point?: never;
}

interface EmojiPopoverWithPoint extends EmojiPopoverData {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: { x: number; y: number };
  trigger?: never;
}

export type EmojiPopoverProps = EmojiPopoverWithTrigger | EmojiPopoverWithPoint;

const ACTION_BTN_BASE =
  'flex items-center gap-[7px] w-full text-left text-2xs px-2 py-[5px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none';
const ACTION_BTN = `${ACTION_BTN_BASE} text-info/75 hover:bg-info/10 hover:text-info focus-visible:bg-info/10 focus-visible:text-info`;
const ACTION_BTN_DELETE = `${ACTION_BTN_BASE} text-danger/75 hover:bg-danger/10 hover:text-danger focus-visible:bg-danger/10 focus-visible:text-danger`;

/**
 * Popover for an emoji decoration. Three screens: `menu` (glyph
 * preview + action buttons), `picker` (searchable emoji-mart grid),
 * `styles` (size / rotation panel). Anchor is either a DOM element
 * via `trigger` or a viewport point via `point`.
 */
export function EmojiPopover(props: EmojiPopoverProps) {
  const screens = {
    menu: <EmojiMenuScreen {...props} />,
    picker: <EmojiPickerScreen onPick={props.onCommitGlyph} />,
    styles: (
      <DecorationStyleOverridesPanel
        inheritedAlignment={props.inheritedAlignment}
        currentOverrides={props.styleOverrides}
        baseline={props.styleBaseline}
        onCommit={props.onCommitStyleOverrides}
      />
    ),
  };

  if ('trigger' in props && props.trigger) {
    return (
      <Popover
        open={props.open}
        onOpenChange={props.onOpenChange}
        trigger={props.trigger}
        screens={screens}
        initialScreen="menu"
      />
    );
  }
  return (
    <Popover
      open={props.open}
      onOpenChange={props.onOpenChange}
      point={props.point!}
      screens={screens}
      initialScreen="menu"
    />
  );
}

type MenuScreenProps = EmojiPopoverData;

function EmojiMenuScreen({ decoration, onDelete }: MenuScreenProps) {
  const { navigate, close } = usePopoverNav();
  return (
    <div className="p-2 flex flex-col gap-2 w-[180px] box-border">
      <div className="flex items-center gap-2">
        <span className="text-3xl leading-none">{decoration.glyph}</span>
        <button className={ACTION_BTN} onClick={() => navigate('picker')}>
          <Smile size={13} /> Change emoji
        </button>
      </div>
      <div className="flex flex-col gap-[3px]">
        <button className={ACTION_BTN} onClick={() => navigate('styles')}>
          <Palette size={13} /> Edit style
        </button>
        <button className={ACTION_BTN_DELETE} onClick={() => { onDelete(); close(); }}>
          <Trash2 size={13} /> Remove emoji
        </button>
      </div>
    </div>
  );
}
