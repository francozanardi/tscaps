import { describe, expect, it } from 'vitest';
import { MediaBinGridNavigator } from '@presentation/media/services/MediaBinGridNavigator';

/** Seven tiles, three to a row: 0 1 2 / 3 4 5 / 6. */
const COUNT = 7;
const COLUMNS = 3;

const navigator = new MediaBinGridNavigator();

describe('moving through the media bin with the keyboard', () => {
  it('walks left and right in reading order, across rows', () => {
    expect(navigator.next(2, 'ArrowRight', COUNT, COLUMNS)).toBe(3);
    expect(navigator.next(3, 'ArrowLeft', COUNT, COLUMNS)).toBe(2);
  });

  it('keeps the column going up and down', () => {
    expect(navigator.next(4, 'ArrowUp', COUNT, COLUMNS)).toBe(1);
    expect(navigator.next(1, 'ArrowDown', COUNT, COLUMNS)).toBe(4);
  });

  it('lands on the last tile when the row below is shorter', () => {
    expect(navigator.next(5, 'ArrowDown', COUNT, COLUMNS)).toBe(6);
  });

  it('never wraps around the ends', () => {
    expect(navigator.next(0, 'ArrowLeft', COUNT, COLUMNS)).toBe(0);
    expect(navigator.next(6, 'ArrowRight', COUNT, COLUMNS)).toBe(6);
    expect(navigator.next(1, 'ArrowUp', COUNT, COLUMNS)).toBe(1);
    expect(navigator.next(6, 'ArrowDown', COUNT, COLUMNS)).toBe(6);
  });

  it('jumps to the first and last tile', () => {
    expect(navigator.next(4, 'Home', COUNT, COLUMNS)).toBe(0);
    expect(navigator.next(1, 'End', COUNT, COLUMNS)).toBe(6);
  });
});
