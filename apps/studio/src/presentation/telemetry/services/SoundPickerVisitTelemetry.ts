import type { Telemetry } from '@core/telemetry/domain/Telemetry';

/** What was picked in the sound picker: a bundled sound, or one of the user's files. */
export type SoundPickerPick = 'builtin' | 'file';

/**
 * Follows one opening of the sound picker and reports, as it closes,
 * whether anything was picked and how much was listened to first:
 * `sound_picker_closed`. That is what tells a pack people browse and
 * leave from one they pick from.
 *
 * One instance per opening; `closed` reports once and the instance says
 * nothing after. Never a sound's name or a file's: only counts and kinds.
 */
export class SoundPickerVisitTelemetry {
  private auditionedCount = 0;
  private pick: SoundPickerPick | null = null;
  private lastList: string;
  private hasClosed = false;

  /** `mode` is what the sound is for; `firstList` the list the picker opens on. */
  constructor(
    private readonly telemetry: Telemetry,
    private readonly mode: string,
    firstList: string,
  ) {
    this.lastList = firstList;
  }

  auditioned(): void {
    this.auditionedCount += 1;
  }

  showedList(list: string): void {
    this.lastList = list;
  }

  picked(pick: SoundPickerPick): void {
    this.pick = pick;
  }

  closed(): void {
    if (this.hasClosed) return;
    this.hasClosed = true;
    this.telemetry.capture('sound_picker_closed', {
      mode: this.mode,
      last_list: this.lastList,
      auditioned_count: this.auditionedCount,
      picked: this.pick,
    });
  }
}
