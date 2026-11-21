import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, Tag, TagConditionParser, TimeFragment, Word, type AlignmentConfig, type SvgFilterDefinitions } from '@tscaps/engine';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ModeActivityChecker } from '@core/caption-modes/services/ModeActivityChecker';
import { ModeMatcherRegistry } from '@core/caption-modes/services/ModeMatcherRegistry';
import { ModeTemplateAvailabilityAutomation } from '@core/caption-modes/automations/ModeTemplateAvailabilityAutomation';
import type { ModeMatcherConfig } from '@core/caption-modes/domain/ModeMatcherConfig';
import { ModeActiveTemplateRepository } from '@core/templates/infrastructure/repositories/ModeActiveTemplateRepository';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import { Template } from '@core/templates/domain/Template';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import { BODY_ONLY_MODES, type TemplateModes } from '@core/templates/domain/definition/TemplateMode';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';

const ALIGNMENT: AlignmentConfig = { verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'center', horizontalOffset: 0 };
const NO_LINE_SPLITTER = { mode: 'none' } as unknown as LineSplitterConfig;

function template(id: string, modes: TemplateModes): Template {
  return new Template(
    { id, category: 'lab' } as unknown as TemplateMetadata,
    TYPOGRAPHY_DEFAULTS, ROTATION_DEFAULTS, ALIGNMENT, {} as RenderingConfig, {} as FeaturesConfig, {} as BehindActorTemplateConfig,
    [], [], NO_LINE_SPLITTER, [], [], {} as SvgFilterDefinitions, '', '', [], [], null, [], modes,
  );
}

const posters = template('posters', {
  base: { label: 'Captions', legend: null },
  extra: [{
    tag: 'spotlight',
    label: 'Posters',
    legend: null,
    matchers: [{ type: 'tag-condition', condition: 'hook or peak' } as ModeMatcherConfig],
    segmentSplitterConfigs: [],
    lineSplitter: NO_LINE_SPLITTER,
  }],
});
const plain = template('plain', BODY_ONLY_MODES);

const catalog: TemplateRepository = {
  getAll: () => Promise.resolve([posters, plain]),
  getById: (id) => Promise.resolve([posters, plain].find((candidate) => candidate.metadata.id === id) ?? null),
};

/** A document whose words are `tokens`, each written `text` or `text:tag`. */
function documentOf(tokens: ReadonlyArray<string>): Document {
  const words = tokens.map((token, i) => {
    const [text, tag] = token.split(':');
    return new Word({ id: `w${i}`, text: text!, time: new TimeFragment(i, i + 1), semanticTags: tag ? new Set([Tag.of(tag)]) : undefined });
  });
  return new Document({ sections: [new Section({ kind: 'main', segments: [new Segment({ lines: [new Line({ words })] })] })] });
}

function repositoryOver(store: EditorStore): ModeActiveTemplateRepository {
  return new ModeActiveTemplateRepository(catalog, new ModeActivityChecker(new ModeMatcherRegistry(new TagConditionParser()), store));
}

async function offeredIds(store: EditorStore): Promise<string[]> {
  return (await repositoryOver(store).getAll()).map((offered) => offered.metadata.id);
}

describe('ModeActiveTemplateRepository', () => {
  it('offers a template with modes where its mode would take a word of the open document', async () => {
    const store = new EditorStore();
    store.patch({ document: documentOf(['nobody', 'told:hook', 'me']) });
    expect(await offeredIds(store)).toEqual(['posters', 'plain']);
  });

  it('leaves it out where no word would enter its mode, and where no document is open', async () => {
    const untagged = new EditorStore();
    untagged.patch({ document: documentOf(['nobody', 'told:emphasis', 'me']) });
    expect(await offeredIds(untagged)).toEqual(['plain']);
    expect(await offeredIds(new EditorStore())).toEqual(['plain']);
  });

  it('still answers a template it leaves out by id, for a project that uses it', async () => {
    expect((await repositoryOver(new EditorStore()).getById('posters'))?.metadata.id).toBe('posters');
  });
});

describe('ModeTemplateAvailabilityAutomation', () => {
  it('publishes the templates again once the document gives a mode words', async () => {
    const store = new EditorStore();
    store.patch({ document: documentOf(['nobody', 'told', 'me']) });
    new ModeTemplateAvailabilityAutomation(store, repositoryOver(store)).start();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.snapshot().availableTemplates.map((offered) => offered.metadata.id)).toEqual(['plain']);

    store.patch({ document: documentOf(['nobody', 'told:peak', 'me']) });
    await Promise.resolve();
    await Promise.resolve();
    expect(store.snapshot().availableTemplates.map((offered) => offered.metadata.id)).toEqual(['posters', 'plain']);
  });
});
