import { Document, NarrationPace, Section, Segment, Line, Word, Tag, TimeFragment, Decoration, type AlignmentConfig } from '@tscaps/engine';
import type { TemplateReferenceResolver } from '@core/templates/domain/TemplateReferenceResolver';
import type { ControlValue } from '@core/templates/domain/definition/ControlField';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { WordStyleOverrideRegistry, type WordStyleOverridesSnapshot } from '@core/captions/domain/WordStyleOverrideRegistry';
import { SegmentOverrides, type SegmentOverridesSnapshot } from '@core/captions/domain/SegmentOverrides';
import { DecorationOverrideRegistry, type DecorationOverridesSnapshot } from '@core/captions/domain/DecorationOverrideRegistry';
import { CutRegistry, type CutsSnapshot } from '@core/cuts/domain/CutRegistry';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import { Sheet } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import type { Template } from '@core/templates/domain/Template';
import { Project } from '@core/projects/domain/Project';
import type { ProjectVideo } from '@core/projects/domain/ProjectVideo';
import type { ProjectMigrator } from '@core/projects/services/migrations/ProjectMigrator';

/**
 * Stable wire schema version. Bump when the serialised shape changes in a
 * non-additive way; ProjectMigrator runs registered migrations to upgrade
 * old payloads up to this version. Bumping without registering a matching
 * migration step will cause old projects to fail to load with an explicit
 * error.
 */
export const PROJECT_SCHEMA_VERSION = 10;

export interface SerializedProject {
  readonly version: number;
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly video: ProjectVideo;
  readonly videoLayout: VideoLayout | null;
  readonly document: SerializedDocument | null;
  readonly sheets: ReadonlyArray<SerializedSheet>;
  readonly activeSheetId: string | null;
  readonly wordStyleOverrides?: WordStyleOverridesSnapshot;
  readonly segmentOverrides?: SegmentOverridesSnapshot;
  readonly decorationOverrides?: DecorationOverridesSnapshot;
  readonly cuts?: CutsSnapshot;
}

interface SerializedDocument {
  readonly sections: ReadonlyArray<SerializedSection>;
  readonly narrationPace?: Record<string, number>;
}

interface SerializedSection {
  readonly id: string;
  readonly kind: string;
  readonly structureTags: ReadonlyArray<string>;
  readonly segments: ReadonlyArray<SerializedSegment>;
}

interface SerializedSegment {
  readonly id: string;
  readonly structureTags: ReadonlyArray<string>;
  readonly lines: ReadonlyArray<SerializedLine>;
  readonly customTime?: { readonly start: number; readonly end: number };
}

interface SerializedLine {
  readonly id: string;
  readonly structureTags: ReadonlyArray<string>;
  readonly words: ReadonlyArray<SerializedWord>;
}

interface SerializedWord {
  readonly id: string;
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly structureTags: ReadonlyArray<string>;
  readonly semanticTags: ReadonlyArray<string>;
  readonly speakerId?: string | null;
  readonly decoration?: SerializedDecoration;
}

interface SerializedDecoration {
  readonly id: string;
  readonly glyph: string;
}

interface SerializedSheet {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly templateId: string;
  readonly variantIndex?: number;
  readonly styleValues: Record<string, ControlValue>;
  readonly typographyConfig: TypographyConfig;
  readonly rotationConfig?: RotationConfig;
  readonly segmentSplitterConfigs: ReadonlyArray<SegmentSplitterConfig>;
  readonly lineSplitterConfig: LineSplitterConfig;
  readonly alignmentConfig: AlignmentConfig;
  readonly effectConfigs: ReadonlyArray<EffectConfig>;
  readonly cssOverride: string | null;
  readonly filtersSvgOverride: string | null;
}

/**
 * Converts Project ↔ JSON. Knows about every persisted shape: the engine
 * domain hierarchy (Document/Section/Segment/Line/Word, with Tags), Sheets,
 * and StyleValues. Templates are referenced by id and rehydrated through
 * the injected TemplateRepository — the serialised form never embeds CSS,
 * style controls, or any other template content.
 *
 * Engine objects expose no `toJSON` of their own; this class is the single
 * place where serialisation knowledge lives, keeping the engine pure.
 */
export class ProjectSerializer {
  constructor(
    private readonly templateReferenceResolver: TemplateReferenceResolver,
    private readonly migrator: ProjectMigrator,
  ) {}

  serialize(project: Project): SerializedProject {
    const wordOverrides = project.wordStyleOverrides.toRecord();
    const segmentOverrides = project.segmentOverrides.toSnapshot();
    const decorationOverrides = project.decorationOverrides.toRecord();
    const cuts = project.cuts.toSnapshot();
    return {
      version: PROJECT_SCHEMA_VERSION,
      id: project.id,
      name: project.name,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      video: project.video,
      videoLayout: project.videoLayout,
      document: project.document ? this.serializeDocument(project.document) : null,
      sheets: project.sheets.map(s => this.serializeSheet(s)),
      activeSheetId: project.activeSheetId,
      ...(Object.keys(wordOverrides).length > 0 ? { wordStyleOverrides: wordOverrides } : {}),
      ...(!project.segmentOverrides.isEmpty() ? { segmentOverrides } : {}),
      ...(Object.keys(decorationOverrides).length > 0 ? { decorationOverrides } : {}),
      ...(cuts.length > 0 ? { cuts } : {}),
    };
  }

  /**
   * Accepts `unknown` because stored payloads may originate from older
   * schema versions: storage trusts whatever was written but reads happen
   * across app upgrades. The migrator brings the payload up to
   * PROJECT_SCHEMA_VERSION before any field is read off it.
   */
  async deserialize(data: unknown, thumbnail: Blob | null): Promise<Project> {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Project payload is not an object.');
    }
    const migrated = this.migrator.migrate(
      data as Record<string, unknown>,
      PROJECT_SCHEMA_VERSION,
    ) as unknown as SerializedProject;
    const sheets = await Promise.all(migrated.sheets.map(s => this.deserializeSheet(s)));
    const wordOverrides = migrated.wordStyleOverrides
      ? WordStyleOverrideRegistry.fromRecord(migrated.wordStyleOverrides)
      : WordStyleOverrideRegistry.empty();
    const segmentOverrides = migrated.segmentOverrides
      ? SegmentOverrides.fromSnapshot(migrated.segmentOverrides)
      : SegmentOverrides.empty();
    const decorationOverrides = migrated.decorationOverrides
      ? DecorationOverrideRegistry.fromRecord(migrated.decorationOverrides)
      : DecorationOverrideRegistry.empty();
    const cuts = migrated.cuts
      ? CutRegistry.fromSnapshot(migrated.cuts)
      : CutRegistry.empty();
    return new Project(
      migrated.id,
      migrated.name,
      new Date(migrated.createdAt),
      new Date(migrated.updatedAt),
      migrated.video,
      migrated.videoLayout,
      migrated.document ? this.deserializeDocument(migrated.document) : null,
      sheets,
      migrated.activeSheetId,
      wordOverrides,
      segmentOverrides,
      decorationOverrides,
      cuts,
      thumbnail,
    );
  }

  private serializeDocument(doc: Document): SerializedDocument {
    const sections = doc.sections.map(s => this.serializeSection(s));
    if (doc.narrationPace.isEmpty()) return { sections };
    return { sections, narrationPace: doc.narrationPace.toRecord() };
  }

  private deserializeDocument(data: SerializedDocument): Document {
    return new Document({
      sections: data.sections.map(s => this.deserializeSection(s)),
      ...(data.narrationPace ? { narrationPace: NarrationPace.fromRecord(data.narrationPace) } : {}),
    });
  }

  private serializeSection(section: Section): SerializedSection {
    return {
      id: section.id,
      kind: section.kind,
      structureTags: this.tagsToArray(section.structureTags),
      segments: section.segments.map(seg => this.serializeSegment(seg)),
    };
  }

  private deserializeSection(data: SerializedSection): Section {
    return new Section({
      segments: data.segments.map(seg => this.deserializeSegment(seg)),
      kind: data.kind,
      structureTags: this.tagsFromArray(data.structureTags),
      id: data.id,
    });
  }

  private serializeSegment(segment: Segment): SerializedSegment {
    return {
      id: segment.id,
      structureTags: this.tagsToArray(segment.structureTags),
      lines: segment.lines.map(line => this.serializeLine(line)),
      ...(segment.customTime
        ? { customTime: { start: segment.customTime.start, end: segment.customTime.end } }
        : {}),
    };
  }

  private deserializeSegment(data: SerializedSegment): Segment {
    return new Segment({
      lines: data.lines.map(line => this.deserializeLine(line)),
      structureTags: this.tagsFromArray(data.structureTags),
      id: data.id,
      customTime: data.customTime ? new TimeFragment(data.customTime.start, data.customTime.end) : null,
    });
  }

  private serializeLine(line: Line): SerializedLine {
    return {
      id: line.id,
      structureTags: this.tagsToArray(line.structureTags),
      words: line.words.map(word => this.serializeWord(word)),
    };
  }

  private deserializeLine(data: SerializedLine): Line {
    return new Line({
      words: data.words.map(word => this.deserializeWord(word)),
      structureTags: this.tagsFromArray(data.structureTags),
      id: data.id,
    });
  }

  private serializeWord(word: Word): SerializedWord {
    return {
      id: word.id,
      text: word.text,
      start: word.time.start,
      end: word.time.end,
      structureTags: this.tagsToArray(word.structureTags),
      semanticTags: this.tagsToArray(word.semanticTags),
      speakerId: word.speakerId,
      ...(word.decoration ? { decoration: this.serializeDecoration(word.decoration) } : {}),
    };
  }

  private deserializeWord(data: SerializedWord): Word {
    return new Word({
      text: data.text,
      time: new TimeFragment(data.start, data.end),
      structureTags: this.tagsFromArray(data.structureTags),
      semanticTags: this.tagsFromArray(data.semanticTags),
      id: data.id,
      speakerId: data.speakerId ?? null,
      decoration: data.decoration ? this.deserializeDecoration(data.decoration) : null,
    });
  }

  private serializeDecoration(decoration: Decoration): SerializedDecoration {
    return { id: decoration.id, glyph: decoration.glyph };
  }

  private deserializeDecoration(data: SerializedDecoration): Decoration {
    return new Decoration({ id: data.id, glyph: data.glyph });
  }

  private tagsToArray(tags: ReadonlySet<Tag>): string[] {
    return Array.from(tags).map(t => t.name);
  }

  private tagsFromArray(names: ReadonlyArray<string>): ReadonlySet<Tag> {
    return new Set(names.map(n => Tag.of(n)));
  }

  private serializeSheet(sheet: Sheet): SerializedSheet {
    return {
      id: sheet.id,
      name: sheet.name,
      color: sheet.color,
      templateId: sheet.template.metadata.id,
      variantIndex: sheet.variantIndex,
      styleValues: { ...sheet.styleValues.values },
      typographyConfig: sheet.typographyConfig,
      rotationConfig: sheet.rotationConfig,
      segmentSplitterConfigs: sheet.segmentSplitterConfigs,
      lineSplitterConfig: sheet.lineSplitterConfig,
      alignmentConfig: sheet.alignmentConfig,
      effectConfigs: sheet.effectConfigs,
      cssOverride: sheet.cssOverride,
      filtersSvgOverride: sheet.filtersSvgOverride,
    };
  }

  private async deserializeSheet(data: SerializedSheet): Promise<Sheet> {
    const template = await this.templateReferenceResolver.resolve(data.templateId);
    const styleValues = this.buildSheetStyleValues(template, data);
    const variantIndex = this.resolveVariantIndex(template, data);
    return new Sheet({
      id: data.id,
      name: data.name,
      color: data.color,
      template,
      variantIndex,
      styleValues,
      typographyConfig: data.typographyConfig,
      rotationConfig: data.rotationConfig ?? ROTATION_DEFAULTS,
      segmentSplitterConfigs: data.segmentSplitterConfigs,
      lineSplitterConfig: data.lineSplitterConfig,
      alignmentConfig: data.alignmentConfig,
      effectConfigs: data.effectConfigs,
      cssOverride: data.cssOverride,
      filtersSvgOverride: data.filtersSvgOverride,
    });
  }

  /**
   * Restores the stored variant index, clamping into the new template's
   * variant range. Substituted templates and projects saved before
   * variants existed both fall back to `0` — the first available slot.
   */
  private resolveVariantIndex(template: Template, data: SerializedSheet): number {
    if (template.metadata.id !== data.templateId) return 0;
    if (data.variantIndex === undefined) return 0;
    if (template.variants.length === 0) return 0;
    return data.variantIndex % template.variants.length;
  }

  // When the resolver substitutes a missing template, the stored style
  // values target controls that the new template does not declare. Seed
  // fresh defaults instead so the sheet renders against a coherent set
  // of controls.
  private buildSheetStyleValues(template: Template, data: SerializedSheet): StyleValues {
    if (template.metadata.id !== data.templateId) {
      return StyleValues.fromTemplate(template.styleControls);
    }
    return new StyleValues(template.styleControls, data.styleValues);
  }
}
