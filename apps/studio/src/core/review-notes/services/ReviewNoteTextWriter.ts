import type { ReviewNoteFacts } from '@core/review-notes/domain/ReviewNoteFacts';
import type { ReviewPlace } from '@core/review-notes/domain/ReviewPlace';
import type { ReviewPoint } from '@core/review-notes/domain/ReviewPoint';

const COLUMNS = ['left', 'centre', 'right'] as const;
const ROWS = ['top', 'middle', 'bottom'] as const;

/**
 * Writes notes down for a model to read: for each, its number, its
 * moment in the source video and in the export, what the person said,
 * where on the frame it points and how, what was under it then and what
 * that is now, and the caption on screen when it was made. Says nothing
 * of who reads it or what they should do with it.
 */
export class ReviewNoteTextWriter {
  /** `pictureNotes`: how the pictures that go with the notes differ from the export, said once after them. */
  write(notes: ReadonlyArray<ReviewNoteFacts>, pictureNotes: ReadonlyArray<string> = []): string {
    const count = notes.length;
    const header = `${count} review note${count === 1 ? '' : 's'} from the person, sent together. `
      + 'Times are seconds of the source video, the transcript\'s times. Places are shares of the frame, from its top left.';
    const footer = pictureNotes.length > 0 ? [`About the pictures: ${pictureNotes.join(' ')}`] : [];
    return [header, ...notes.map((facts) => this.noteOf(facts)), ...footer].join('\n\n');
  }

  private noteOf(facts: ReviewNoteFacts): string {
    const { note } = facts;
    const lines = [
      `Note ${note.number} · at ${this.seconds(note.sourceSec)} ${this.exportMomentOf(facts.outputSec)}`,
      `"${note.text}"`,
      this.placeOf(facts),
    ];
    if (facts.refs.length > 0) lines.push(`Under it when made: ${facts.refs.map((ref) => this.refOf(ref)).join('; ')}`);
    if (note.quote !== null) lines.push(`Caption on screen when made: "${note.quote}"`);
    return lines.join('\n');
  }

  private exportMomentOf(outputSec: number | null): string {
    return outputSec === null ? '(cut out of the export now)' : `(${this.seconds(outputSec)} into the export)`;
  }

  private placeOf(facts: ReviewNoteFacts): string {
    const { place, number } = facts.note;
    if (place === null) return 'On the moment, not on a place in the frame.';
    const sentences = [`Points at ${this.areaOf(place.at)} (${this.pointOf(place.at)})${this.drawingOf(place)}.`];
    if (facts.pictured) sentences.push(`The picture of ${this.seconds(facts.note.sourceSec)} shows it over the frame, numbered ${number}.`);
    if (facts.aspectChanged) sentences.push('The frame\'s aspect changed since, so the place may no longer be over what was meant.');
    return sentences.join(' ');
  }

  private drawingOf(place: ReviewPlace): string {
    const lines = place.marks.length;
    if (lines === 0) return '';
    return `, marked with ${lines === 1 ? 'a line drawn by hand' : `${lines} lines drawn by hand`}`;
  }

  private refOf(ref: ReviewNoteFacts['refs'][number]): string {
    if (ref.reading.status === 'gone') return `${ref.name} (gone now: the captions or shots changed since)`;
    return ref.reading.words === null ? ref.name : `${ref.name} "${ref.reading.words}"`;
  }

  private areaOf(point: ReviewPoint): string {
    const column = COLUMNS[this.third(point.x)];
    const row = ROWS[this.third(point.y)];
    if (row === 'middle' && column === 'centre') return 'the centre of the frame';
    return `the ${row} ${column} of the frame`;
  }

  private third(share: number): 0 | 1 | 2 {
    if (share < 1 / 3) return 0;
    return share < 2 / 3 ? 1 : 2;
  }

  private pointOf(point: ReviewPoint): string {
    return `x ${point.x.toFixed(2)}, y ${point.y.toFixed(2)}`;
  }

  private seconds(sec: number): string {
    return `${sec.toFixed(2)} s`;
  }

  private listed(parts: ReadonlyArray<string>): string {
    if (parts.length <= 1) return parts.join('');
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  }
}
