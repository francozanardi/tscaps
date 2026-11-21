import { describe, expect, it } from 'vitest';
import { OutsideOperationWording } from '@core/automation/services/OutsideOperationWording';
import { AddSoundsOperation } from '@core/editor-operations/services/descriptors/AddSoundsOperation';
import { CreateSheetOperation } from '@core/editor-operations/services/descriptors/CreateSheetOperation';
import { SetCameraOperation } from '@core/editor-operations/services/descriptors/SetCameraOperation';

describe('OutsideOperationWording', () => {
  const wording = new OutsideOperationWording();

  it('sends an outside agent to the sound guide instead of telling it to add sounds only when asked', () => {
    const reworded = wording.of('add_sounds', `${AddSoundsOperation.WHEN_TO_ADD} Adds sound effects from the bundled pack.`);

    expect(reworded).not.toContain('Only when the person asks');
    expect(reworded).toContain('`sound` guide');
    expect(reworded).toContain('Adds sound effects from the bundled pack.');
  });

  it('does not offer a sheet of its own for a speaker the transcript does not tell apart', () => {
    const reworded = wording.of('create_sheet', `Use it to give some captions a look of their own ${CreateSheetOperation.EXAMPLE_USES} while the rest keep theirs.`);

    expect(reworded).not.toContain('a second speaker');
    expect(reworded).toContain('create_speaker_sheet');
  });

  it('tells an outside agent how a zoom keeps a face and how a pan on a layer is paced', () => {
    const reworded = wording.of('set_camera', `Give a shot a camera move. ${SetCameraOperation.FRAMED_AIM} A shot's camera runs for its shot.`);

    expect(reworded).toContain('stays where it was in the frame and grows');
    expect(reworded).toContain('drifts slowly');
    expect(reworded).toContain('A shot\'s camera runs for its shot.');
  });

  it('leaves every other operation as the catalog words it', () => {
    expect(wording.of('set_transition', AddSoundsOperation.WHEN_TO_ADD)).toBe(AddSoundsOperation.WHEN_TO_ADD);
  });
});
