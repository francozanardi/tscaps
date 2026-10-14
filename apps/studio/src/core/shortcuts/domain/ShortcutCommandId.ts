/**
 * Every command a shortcut can trigger. The id is what a keymap is
 * stored under, so an id is never renamed once it has shipped: a user's
 * binding for the old name would silently stop applying.
 */
export type ShortcutCommandId =
  | 'app.showShortcuts'
  | 'edit.undo'
  | 'edit.redo'
  | 'editor.search'
  | 'editor.locate'
  | 'playback.toggle'
  | 'playback.play'
  | 'playback.pause'
  | 'playback.previousFrame'
  | 'playback.nextFrame'
  | 'playback.previousWord'
  | 'playback.nextWord'
  | 'playback.previousScene'
  | 'playback.nextScene'
  | 'playback.volumeUp'
  | 'playback.volumeDown'
  | 'playback.slower'
  | 'playback.faster'
  | 'transcript.previousScene'
  | 'transcript.nextScene'
  | 'transcript.playScene'
  | 'transcript.splitScene'
  | 'transcript.joinPrevious'
  | 'transcript.joinNext'
  | 'timeline.release'
  | 'timeline.cut';
