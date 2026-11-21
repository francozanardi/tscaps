import { describe, expect, it } from 'vitest';
import { ShotLayerLabels } from '@presentation/shots/services/ShotLayerLabels';

/** What a set of picked layers is called, wherever it is counted. */

const labels = new ShotLayerLabels();

describe('a count of layers', () => {
  it('names one kind by its own name, one or many', () => {
    expect(labels.countOf(['video'])).toBe('1 b-roll');
    expect(labels.countOf(['video', 'video', 'video'])).toBe('3 b-rolls');
    expect(labels.countOf(['image', 'image'])).toBe('2 pictures');
    expect(labels.countOf(['gif'])).toBe('1 GIF');
  });

  it('names pictures and GIFs together as such, and b-rolls with anything else as layers', () => {
    expect(labels.countOf(['image', 'gif'])).toBe('2 pictures and GIFs');
    expect(labels.countOf(['video', 'image', 'gif', 'video'])).toBe('4 layers');
  });

  it('says when there are none', () => {
    expect(labels.countOf([])).toBe('No layers');
  });
});

describe('the shots holding them', () => {
  it('lists each shot once, in order', () => {
    expect(labels.shotsOf([4, 1, 3, 1])).toBe('Shots 1, 3, 4');
    expect(labels.shotsOf([2, 2])).toBe('Shot 2');
  });
});
