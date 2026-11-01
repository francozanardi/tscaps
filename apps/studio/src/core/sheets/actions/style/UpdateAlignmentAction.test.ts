import { describe, expect, it } from 'vitest';
import type { AlignmentConfig, SvgFilterDefinitions } from '@tscaps/engine';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import { UpdateAlignmentAction } from '@core/sheets/actions/style/UpdateAlignmentAction';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { AnchorSupport, FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import { Template } from '@core/templates/domain/Template';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';

/**
 * A template whose layout is built from one edge of the caption holds
 * that edge as the anchor. Whatever reaches the action asking for
 * another one — a panel, a gesture, anything added later — the caption
 * keeps the anchor its layout needs.
 */

const BOTTOM_ANCHORED: AlignmentConfig = {
  verticalAlign: 'bottom',
  verticalOffset: 0.74,
  horizontalAlign: 'center',
  horizontalOffset: 0.5,
};

const linkedSheetsSync = {
  applyStyleEdit: (updated: Sheet, sheets: ReadonlyArray<Sheet>) =>
    sheets.map((sheet) => (sheet.id === updated.id ? updated : sheet)),
} as unknown as LinkedSheetsSync;

function templateWith(anchor: AnchorSupport): Template {
  return new Template(
    { id: 'anchored', category: 'lab' } as unknown as TemplateMetadata,
    TYPOGRAPHY_DEFAULTS,
    ROTATION_DEFAULTS,
    BOTTOM_ANCHORED,
    {} as RenderingConfig,
    { anchor } as FeaturesConfig,
    {} as BehindActorTemplateConfig,
    [],
    [],
    { type: 'none' } as unknown as LineSplitterConfig,
    [],
    [],
    {} as SvgFilterDefinitions,
    '',
    '',
    [],
  );
}

function storeWith(anchor: AnchorSupport): EditorStore {
  const store = new EditorStore();
  const sheet = Sheet.fromTemplate('main', 'Main', null, templateWith(anchor), 'ltr');
  store.patch({ sheets: [sheet], activeSheetId: 'main' });
  return store;
}

function alignmentOf(store: EditorStore): AlignmentConfig {
  return store.sheet('main')!.alignmentConfig;
}

describe('a template that holds its vertical anchor', () => {
  it('keeps it when asked for another', () => {
    const store = storeWith({ vertical: false });
    new UpdateAlignmentAction(store, linkedSheetsSync).execute('main', { verticalAlign: 'center', verticalOffset: 0.4 });

    expect(alignmentOf(store)).toEqual(BOTTOM_ANCHORED);
  });

  it('still moves the caption along it', () => {
    const store = storeWith({ vertical: false });
    new UpdateAlignmentAction(store, linkedSheetsSync).execute('main', { verticalAlign: 'bottom', verticalOffset: 0.6 });
    new UpdateAlignmentAction(store, linkedSheetsSync).execute('main', { horizontalAlign: 'left', horizontalOffset: 0.1 });

    expect(alignmentOf(store)).toEqual({ verticalAlign: 'bottom', verticalOffset: 0.6, horizontalAlign: 'left', horizontalOffset: 0.1 });
  });
});

describe('a template that leaves its vertical anchor free', () => {
  it('takes another one', () => {
    const store = storeWith({ vertical: true });
    new UpdateAlignmentAction(store, linkedSheetsSync).execute('main', { verticalAlign: 'center', verticalOffset: 0.4 });

    expect(alignmentOf(store)).toMatchObject({ verticalAlign: 'center', verticalOffset: 0.4 });
  });
});
