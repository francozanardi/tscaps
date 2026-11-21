import { describe, expect, it } from 'vitest';
import { HorizontalPlacementResolver, HorizontalSideResolver } from '@tscaps/engine/advanced';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ProjectV14ToV15Migration } from '@core/projects/services/migrations/ProjectV14ToV15Migration';
import { StoredCaptionElementScanner } from '@core/projects/services/migrations/StoredCaptionElementScanner';

/**
 * What survives where an element sits moving into the element's own
 * style.
 *
 * A placement is all four of its parts or nothing now, so a stored
 * position this step fails to complete is a caption that snaps back
 * into the flow the user pulled it out of — silently, on load.
 */

const migration = new ProjectV14ToV15Migration(
  new StoredCaptionElementScanner(),
  new HorizontalPlacementResolver(new HorizontalSideResolver()),
);

function project(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    version: 14,
    sheets: [{
      id: 'main',
      typographyConfig: { fontSize: 10 },
      alignmentConfig: { verticalAlign: 'bottom', verticalOffset: 0.8, horizontalAlign: 'center', horizontalOffset: 0.5 },
      textDirection: 'ltr',
    }],
    document: {
      sections: [{
        kind: 'main',
        segments: [{ id: 'seg1', lines: [{ words: [{ id: 'w1', decoration: { id: 'w1:d' } }] }] }],
      }],
    },
    ...overrides,
  };
}

function migrated(overrides: Record<string, unknown>): ElementStyles {
  return ElementStyles.fromSnapshot((migration.migrate(project(overrides)).elementStyles ?? {}) as never);
}

describe('a position stored beside how the element looks', () => {
  it('arrives on the element it belongs to', () => {
    const styles = migrated({
      wordStyleOverrides: { w1: { verticalAlign: 'center', verticalOffset: 0.3, horizontalAlign: 'center', horizontalOffset: 0.2 } },
    });
    expect(styles.placementOf('w1')).toEqual({
      verticalAlign: 'center', verticalOffset: 0.3, horizontalAlign: 'center', horizontalOffset: 0.2,
    });
  });

  it('reaches a glyph as well as the word carrying it', () => {
    const styles = migrated({
      wordStyleOverrides: { 'w1:d': { verticalAlign: 'top', verticalOffset: 0.1, horizontalAlign: 'left', horizontalOffset: 0.05 } },
    });
    expect(styles.placementOf('w1:d')?.verticalAlign).toBe('top');
  });

  it('lands beside CSS the element already carried', () => {
    const styles = migrated({
      elementStyles: { seg1: { kind: 'segment', css: 'color: gold;' } },
      segmentOverrides: { style: { seg1: { verticalAlign: 'top', verticalOffset: 0.1, horizontalAlign: 'left', horizontalOffset: 0 } } },
    });
    expect(styles.get('seg1')?.css).toBe('color: gold;');
    expect(styles.placementOf('seg1')?.verticalOffset).toBe(0.1);
  });
});

describe('a position written before the anchor was kept beside its offset', () => {
  // A placement is all four parts or nothing, so an offset arriving
  // without its anchor would be dropped and the caption would snap
  // back into the flow. What the sheet holds now is the anchor that
  // offset was last read against.
  it('takes the anchor its sheet holds rather than being dropped', () => {
    const styles = migrated({ segmentOverrides: { style: { seg1: { verticalOffset: 0.2 } } } });
    expect(styles.placementOf('seg1')).toEqual({
      verticalAlign: 'bottom', verticalOffset: 0.2, horizontalAlign: 'center', horizontalOffset: 0.5,
    });
  });

  it('is restated in screen terms, which is the vocabulary a stored anchor speaks', () => {
    const rtl = project({ segmentOverrides: { style: { seg1: { horizontalOffset: 0.1 } } } });
    (rtl.sheets as Array<Record<string, unknown>>)[0]!.textDirection = 'rtl';
    (rtl.sheets as Array<Record<string, unknown>>)[0]!.alignmentConfig = {
      verticalAlign: 'bottom', verticalOffset: 0.8, horizontalAlign: 'start', horizontalOffset: 0.1,
    };
    const styles = ElementStyles.fromSnapshot(migration.migrate(rtl).elementStyles as never);
    expect(styles.placementOf('seg1')?.horizontalAlign).toBe('right');
  });

  it('is nothing at all when neither offset was stored', () => {
    const styles = migrated({ segmentOverrides: { style: { seg1: { verticalAlign: 'top' } } } });
    expect(styles.placementOf('seg1')).toBeNull();
  });
});

describe('what the segment overrides held besides a position', () => {
  it('is the behind-actor answer, under a name that says so', () => {
    const data = migration.migrate(project({
      segmentOverrides: { style: { seg1: { verticalOffset: 0.2 } }, behindActor: { seg1: 'force-on' } },
    }));
    expect(data.behindActorOverrides).toEqual({ seg1: 'force-on' });
    expect(data.segmentOverrides).toBeUndefined();
    expect(data.wordStyleOverrides).toBeUndefined();
  });

  it('is absent when the user never answered for any segment', () => {
    expect(migration.migrate(project({})).behindActorOverrides).toBeUndefined();
  });
});
