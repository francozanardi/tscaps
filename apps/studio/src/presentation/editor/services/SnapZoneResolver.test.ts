import { describe, expect, it } from 'vitest';
import { SnapZoneResolver } from '@presentation/editor/services/SnapZoneResolver';

// A caption wide enough that pinning it to the left margin and centring
// it name the same place; and one of an ordinary width, that they don't.
const HUGE_WIDTH = 0.96;
const ORDINARY_WIDTH = 0.4;
const ORDINARY_HEIGHT = 0.1;

describe('SnapZoneResolver', () => {
  const resolver = new SnapZoneResolver();

  const horizontal = (centroidX: number, width: number) =>
    resolver.resolve(centroidX, 0.5, width, ORDINARY_HEIGHT).horizontal;

  describe('bands a box can be told apart', () => {
    it('offers all three to a caption that fits between the margins', () => {
      const bands = resolver.bandsFor({ widthFrac: ORDINARY_WIDTH, heightFrac: ORDINARY_HEIGHT });
      expect(bands.horizontal.map((band) => band.center)).toEqual([0.06, 0.5, 0.94]);
      expect(bands.vertical.map((band) => band.center)).toEqual([0.12, 0.5, 0.88]);
    });

    it('drops the side bands of a caption nearly as wide as the frame', () => {
      const bands = resolver.bandsFor({ widthFrac: HUGE_WIDTH, heightFrac: ORDINARY_HEIGHT });
      expect(bands.horizontal.map((band) => band.center)).toEqual([0.5]);
      expect(bands.vertical.map((band) => band.center)).toEqual([0.12, 0.5, 0.88]);
    });

    it('drops the top and bottom bands of a caption nearly as tall as the frame', () => {
      const bands = resolver.bandsFor({ widthFrac: ORDINARY_WIDTH, heightFrac: 0.9 });
      expect(bands.vertical.map((band) => band.center)).toEqual([0.5]);
    });
  });

  describe('a caption nearly as wide as the frame', () => {
    it('is free to sit off the centre band', () => {
      const resolution = horizontal(0.62, HUGE_WIDTH);
      expect(resolution.snapped).toBe(false);
    });

    it('never snaps to a side band, whichever way it is dragged', () => {
      for (let centroidX = 0; centroidX <= 1; centroidX += 0.01) {
        const resolution = horizontal(centroidX, HUGE_WIDTH);
        expect(resolution.snappedBandCenter).not.toBe(0.06);
        expect(resolution.snappedBandCenter).not.toBe(0.94);
      }
    });

    it('still snaps to the frame centre', () => {
      const resolution = horizontal(0.51, HUGE_WIDTH);
      expect(resolution).toMatchObject({ align: 'center', offset: 0.5, snapped: true });
    });
  });

  describe('side bands, on a caption that has them', () => {
    it('pulls the caption edge to the margin, not its centroid', () => {
      const resolution = horizontal(0.06 + ORDINARY_WIDTH / 2, ORDINARY_WIDTH);
      expect(resolution).toMatchObject({ align: 'left', offset: 0.06, snapped: true });
    });

    it('leaves the caption free between the margin and the centre', () => {
      expect(horizontal(0.35, ORDINARY_WIDTH).snapped).toBe(false);
    });
  });

  describe('reach', () => {
    it('lets a caption hang out of the frame, anchoring it by its centre', () => {
      const resolution = horizontal(0.1, ORDINARY_WIDTH);
      expect(resolution).toMatchObject({ align: 'center', offset: 0.1, snapped: false });
    });

    it('stops the caption when its own centre reaches the frame edge', () => {
      expect(horizontal(-0.4, ORDINARY_WIDTH).offset).toBe(0);
      expect(horizontal(1.4, ORDINARY_WIDTH).offset).toBe(1);
    });

    it('keeps every offset a point on the frame', () => {
      for (let centroidX = -0.5; centroidX <= 1.5; centroidX += 0.01) {
        for (const width of [0.1, ORDINARY_WIDTH, 0.8, HUGE_WIDTH]) {
          const { offset } = horizontal(centroidX, width);
          expect(offset).toBeGreaterThanOrEqual(0);
          expect(offset).toBeLessThanOrEqual(1);
        }
      }
    });

    it('trades reach for the anchor a scoped drag keeps', () => {
      const { horizontal: resolution } = resolver.resolve(
        0.1, 0.5, ORDINARY_WIDTH, ORDINARY_HEIGHT, { vertical: 'bottom', horizontal: 'left' },
      );
      expect(resolution).toMatchObject({ align: 'left', offset: 0 });
    });
  });

  describe('a held vertical anchor', () => {
    // A caption spanning most of the frame's height, whose centroid lands
    // in the middle tercio wherever it is dropped.
    const TALL_HEIGHT = 0.6;
    const holdingBottom = (centroidX: number, centroidY: number) =>
      resolver.resolve(centroidX, centroidY, ORDINARY_WIDTH, TALL_HEIGHT, { vertical: 'bottom', horizontal: null });

    it('is never replaced, wherever the caption is dropped', () => {
      for (let centroidY = 0; centroidY <= 1; centroidY += 0.05) {
        expect(holdingBottom(0.5, centroidY).vertical.align).toBe('bottom');
      }
    });

    it('puts the held edge where the caption was dropped', () => {
      const { vertical } = holdingBottom(0.5, 0.4);
      expect(vertical.snapped).toBe(false);
      expect(vertical.offset).toBeCloseTo(0.4 + TALL_HEIGHT / 2, 10);
    });

    it('still pulls the held edge onto a band', () => {
      const { vertical } = holdingBottom(0.5, 0.875 - TALL_HEIGHT / 2);
      expect(vertical).toMatchObject({ align: 'bottom', offset: 0.88, snapped: true });
    });

    it('leaves the other axis free to follow the tercio', () => {
      expect(holdingBottom(0.3, 0.4).horizontal.align).toBe('left');
      expect(holdingBottom(0.7, 0.4).horizontal.align).toBe('right');
    });
  });

  describe('a free anchor', () => {
    it('follows the centroid tercio while the anchor stays on the frame', () => {
      expect(horizontal(0.3, ORDINARY_WIDTH).align).toBe('left');
      expect(horizontal(0.45, 0.1).align).toBe('center');
      expect(horizontal(0.7, ORDINARY_WIDTH).align).toBe('right');
    });

    it('holds the caption at the same place across the anchor change', () => {
      const { align, offset, snapped } = horizontal(0.7, ORDINARY_WIDTH);
      expect(snapped).toBe(false);
      expect(align).toBe('right');
      expect(offset).toBeCloseTo(0.7 + ORDINARY_WIDTH / 2, 10);
    });
  });
});
