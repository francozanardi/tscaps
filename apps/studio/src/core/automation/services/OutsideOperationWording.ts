import { AddSoundsOperation } from '@core/editor-operations/services/descriptors/AddSoundsOperation';
import { CreateSheetOperation } from '@core/editor-operations/services/descriptors/CreateSheetOperation';
import { SetCameraOperation } from '@core/editor-operations/services/descriptors/SetCameraOperation';

/** A part of one operation's description, and what an agent driving the editor from outside reads in its place. */
interface Rewording {
  readonly operation: string;
  readonly find: string;
  readonly replace: string;
}

const REWORDINGS: ReadonlyArray<Rewording> = [
  {
    operation: 'add_sounds',
    find: AddSoundsOperation.WHEN_TO_ADD,
    replace: 'Read the `sound` guide first: a sound marks something that appears on screen, and a worked edit usually has a few, each with a job.',
  },
  {
    operation: 'set_camera',
    find: SetCameraOperation.FRAMED_AIM,
    replace: [
      'On a shot that is framed (set_framing, or a reframe), a move given no x or y closes in on where the framing put its subject, a person\'s face, which stays where it was in the frame and grows: leave x and y out to zoom on the person.',
      'A pan picked on a layer with no fromX or toX drifts slowly about the middle of the picture, as far as stays slow for the layout and the length the layer has then (the answer says how far it `travels`): lay the layer out and set the shots it runs through first, and pick the pan again after changing either. A pan that crosses more than about a tenth of the frame\'s width a second reads as a swipe.',
    ].join(' '),
  },
  {
    operation: 'create_sheet',
    find: CreateSheetOperation.EXAMPLE_USES,
    replace: '(a quote, a list; for a speaker the transcript tells apart, create_speaker_sheet instead, and never a speaker you worked out yourself)',
  },
];

/**
 * The operations' descriptions as an agent driving the editor from
 * outside reads them. A few parts of the catalog's own hold an agent
 * back where it is not given the guides to go further (no sound effects
 * unless asked); an agent that has them obeys that and makes a flatter
 * edit, so here those parts say what its guides say, and what its
 * guides lean on (how a zoom keeps a face, how a pan is paced). Every
 * other word is the catalog's.
 */
export class OutsideOperationWording {
  /** The description of the operation named `operation`, with its reworded parts in place. */
  of(operation: string, description: string): string {
    return REWORDINGS
      .filter((rewording) => rewording.operation === operation)
      .reduce((text, rewording) => text.replace(rewording.find, rewording.replace), description);
  }
}
