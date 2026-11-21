import { useCallback, useState } from 'react';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { AppError } from '@core/errors/domain/AppError';
import { useErrors } from '@ui/_shared/contexts/modules/ErrorsContext';
import { useMedia } from '@ui/_shared/contexts/modules/MediaContext';

export interface AudioFileUpload {
  /** Whether a file handed over is still being added. */
  readonly isAdding: boolean;
  /** Adds `file` to the project as an audio file, then picks it; a file that cannot be added says why. */
  readonly add: (file: File) => void;
}

/** Adds the user's audio files to the project, picking each once it is in. */
export function useAudioFileUpload(onPick: (source: AudioSourceRef) => void): AudioFileUpload {
  const { actions } = useMedia();
  const { appNoticeChannel } = useErrors();
  const [isAdding, setIsAdding] = useState(false);
  const add = useCallback((file: File) => {
    setIsAdding(true);
    actions.import.execute(file, 'project', 'sound-upload', ['audio']).then(
      (added) => {
        setIsAdding(false);
        onPick({ kind: 'media', mediaId: added.id });
      },
      (error: unknown) => {
        setIsAdding(false);
        // The import only ever rejects with its own failure, which carries its copy.
        appNoticeChannel.publish(error as AppError);
      },
    );
  }, [actions, appNoticeChannel, onPick]);
  return { isAdding, add };
}
