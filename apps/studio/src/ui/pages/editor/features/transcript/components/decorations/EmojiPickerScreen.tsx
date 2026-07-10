import { useCallback, useEffect, useState } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { useTheme } from '@bootstrap/ThemeContext';
import type { Theme } from '@presentation/theme/controllers/ThemeController';

interface EmojiPickerScreenProps {
  onPick: (glyph: string) => void;
}

interface PickedEmoji {
  readonly native: string;
}

/**
 * Compact emoji picker wrapping `@emoji-mart`. Drops the category
 * nav and skin-tone controls to keep the chrome minimal; the search
 * field and a single-row recent strip are the only entry points
 * beyond scrolling. Calls `onPick` with the picked emoji's native
 * unicode glyph.
 */
export function EmojiPickerScreen({ onPick }: EmojiPickerScreenProps) {
  const theme = useTheme();
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => theme.getTheme());
  useEffect(() => {
    const update = () => setCurrentTheme(theme.getTheme());
    theme.addEventListener('change', update);
    update();
    return () => theme.removeEventListener('change', update);
  }, [theme]);

  const handleSelect = useCallback((emoji: PickedEmoji) => {
    if (emoji.native) onPick(emoji.native);
  }, [onPick]);

  return (
    <div className="p-2 flex flex-col gap-2 box-border">
      <PopoverHeader title="Pick emoji" />
      <div className="[&_em-emoji-picker]:!min-h-0 [&_em-emoji-picker]:!h-[200px]">
        <Picker
          data={data}
          theme={currentTheme}
          onEmojiSelect={handleSelect}
          previewPosition="none"
          skinTonePosition="none"
          navPosition="none"
          searchPosition="top"
          autoFocus
          perLine={8}
          maxFrequentRows={1}
          emojiButtonSize={28}
          emojiSize={20}
          noCountryFlags
        />
      </div>
    </div>
  );
}
