import { describe, expect, it } from 'vitest';
import { ShotTimeGrid } from '@presentation/shots/services/ShotTimeGrid';

const grid = new ShotTimeGrid();

describe('ShotTimeGrid', () => {
  it('keeps a hundredth of a second that is not a multiple of five', () => {
    expect(grid.snap(1.63)).toBe(1.63);
    expect(grid.snap(0.07)).toBe(0.07);
  });

  it('returns the decimal itself where stepping from a minimum left noise', () => {
    // What a slider holding 0.95 as its minimum reaches 68 steps on.
    const stepped = 68 * grid.stepSec + 0.95;
    expect(grid.snap(stepped)).toBe(1.63);
  });

  it('puts a range minimum off the grid on the next hundredth up, and a maximum on the one below', () => {
    expect(grid.ceil(0.947)).toBe(0.95);
    expect(grid.floor(3.268)).toBe(3.26);
  });

  it('leaves a value already on the grid where it is, noise or not', () => {
    expect(grid.ceil(0.1 + 0.2)).toBe(0.3);
    expect(grid.floor(0.7 - 0.6 + 0.5)).toBe(0.6);
  });
});
