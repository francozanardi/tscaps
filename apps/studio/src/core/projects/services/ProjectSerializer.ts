import { Document, NarrationPace, Section, Segment, Line, Word, Tag, TimeFragment, Decoration, type AlignmentConfig, type TextDirection, type TextDirectionDetector } from '@tscaps/engine';
import type { TemplateReferenceResolver } from '@core/templates/domain/TemplateReferenceResolver';
import type { ControlValue } from '@core/templates/domain/definition/ControlField';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import { TypographyConfigSerializer, type SerializedTypographyConfig } from '@core/sheets/services/TypographyConfigSerializer';
import type { StoredFontStackReader } from '@core/fonts/services/StoredFontStackReader';
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { SheetAnimationSet, type SheetAnimationSetSnapshot } from '@core/sheets/domain/SheetAnimationSet';
import { BehindActorSegmentOverrideRegistry, type BehindActorSegmentOverridesSnapshot } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import { FrozenSegmentSet, type FrozenSegmentSetSnapshot } from '@core/captions/domain/FrozenSegmentSet';
import { ElementStyles, type ElementStylesSnapshot } from '@core/elements/domain/ElementStyles';
import { DocumentElementIdCollector } from '@core/captions/services/DocumentElementIdCollector';
import { DecorationOverrideRegistry, type DecorationOverridesSnapshot } from '@core/captions/domain/DecorationOverrideRegistry';
import { CutRegistry, type CutsSnapshot } from '@core/cuts/domain/CutRegistry';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import { Sheet, HOOK_SHEET_ID } from '@core/sheets/domain/Sheet';
import type { SheetRole } from '@core/sheets/domain/SheetRole';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import type { Template } from '@core/templates/domain/Template';
import { Project } from '@core/projects/domain/Project';
import type { ProjectVideo } from '@core/projects/domain/ProjectVideo';
import type { ProjectMigrator } from '@core/projects/services/migrations/ProjectMigrator';
import { CaptionTrack } from '@core/translations/domain/CaptionTrack';

/**
 * Stable wire schema version. Bump when the serialised shape changes in a
 * non-additive way; ProjectMigrator runs registered migrations to upgrade
 * old payloads up to this version. Bumping without registering a matching
 * migration step will cause old projects to fail to load with an explicit
 * error.
 */
export const PROJECT_SCHEMA_VERSION = 19;

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
  readonly behindActorOverrides?: BehindActorSegmentOverridesSnapshot;
  readonly structurallyEditedSegmentIds?: FrozenSegmentSetSnapshot;
  readonly elementStyles?: ElementStylesSnapshot;
  readonly decorationOverrides?: DecorationOverridesSnapshot;
  readonly cuts?: CutsSnapshot;
  readonly captionTracks?: ReadonlyArray<SerializedCaptionTrack>;
  readonly activeCaptionTrackId?: string | null;
}

interface SerializedDocument {
  readonly sections: ReadonlyArray<SerializedSection>;
  readonly narrationPace?: Record<string, number>;
  readonly language?: string;
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
  /** Absent on payloads written while an Effect's padding still lived in `customTime`. */
  readonly effectTime?: { readonly start: number; readonly end: number };
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
  readonly boundaryScore?: number;
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
  readonly typographyConfig: SerializedTypographyConfig;
  readonly rotationConfig?: RotationConfig;
  readonly segmentSplitterConfigs: ReadonlyArray<SegmentSplitterConfig>;
  readonly lineSplitterConfig: LineSplitterConfig;
  readonly alignmentConfig: AlignmentConfig;
  readonly effectConfigs: ReadonlyArray<EffectConfig>;
  readonly animations?: SheetAnimationSetSnapshot;
  readonly cssOverride: string | null;
  readonly filtersSvgOverride: string | null;
  readonly linkGroupId?: string | null;
  readonly role?: SheetRole | null;
  readonly textDirection?: TextDirection;
}

interface SerializedCaptionTrack {
  readonly id: string;
  readonly name: string;
  readonly kind: 'original' | 'translation';
  readonly sourceTrackId: string | null;
  readonly document: SerializedDocument;
  readonly sheets: ReadonlyArray<SerializedSheet>;
  readonly activeSheetId: string | null;
  readonly behindActorOverrides?: BehindActorSegmentOverridesSnapshot;
  readonly structurallyEditedSegmentIds?: FrozenSegmentSetSnapshot;
  readonly elementStyles?: ElementStylesSnapshot;
  readonly decorationOverrides?: DecorationOverridesSnapshot;
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
    private readonly textDirectionDetector: TextDirectionDetector,
    private readonly documentElementIdCollector: DocumentElementIdCollector,
    private readonly typographyConfigSerializer: TypographyConfigSerializer,
    private readonly storedFontStackReader: StoredFontStackReader,
  ) {}

  serialize(project: Project): SerializedProject {
    const behindActorOverrides = project.behindActorOverrides.toSnapshot();
    const structurallyEditedSegmentIds = project.frozenSegments.toSnapshot();
    // Deleting a word leaves its fragment behind — nothing else is keyed
    // to that id — so it would ride every save from here on, addressing
    // an element that no longer exists.
    const elementStyles = project.document
      ? project.elementStyles.restrictedTo(this.documentElementIdCollector.collect(project.document))
      : project.elementStyles;
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
      ...(!project.behindActorOverrides.isEmpty() ? { behindActorOverrides } : {}),
      ...(structurallyEditedSegmentIds.length > 0 ? { structurallyEditedSegmentIds } : {}),
      ...(!elementStyles.isEmpty() ? { elementStyles: elementStyles.toSnapshot() } : {}),
      ...(Object.keys(decorationOverrides).length > 0 ? { decorationOverrides } : {}),
      ...(cuts.length > 0 ? { cuts } : {}),
      ...(project.captionTracks.length > 0
        ? {
            captionTracks: project.captionTracks.map((track) => this.serializeCaptionTrack(track)),
            activeCaptionTrackId: project.activeCaptionTrackId,
          }
        : {}),
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
    const document = migrated.document ? this.deserializeDocument(migrated.document) : null;
    const fallbackDirection = this.resolveFallbackDirection(migrated, document);
    const sheets = await Promise.all(
      migrated.sheets.map(s => this.deserializeSheet(s, fallbackDirection)),
    );
    const behindActorOverrides = migrated.behindActorOverrides
      ? BehindActorSegmentOverrideRegistry.fromSnapshot(migrated.behindActorOverrides)
      : BehindActorSegmentOverrideRegistry.empty();
    const elementStyles = migrated.elementStyles
      ? ElementStyles.fromSnapshot(migrated.elementStyles)
      : ElementStyles.empty();
    const frozenSegments = (migrated.structurallyEditedSegmentIds
      ? FrozenSegmentSet.fromSnapshot(migrated.structurallyEditedSegmentIds)
      : FrozenSegmentSet.empty())
      .replacingStyled(elementStyles.segmentIds());
    const decorationOverrides = migrated.decorationOverrides
      ? DecorationOverrideRegistry.fromRecord(migrated.decorationOverrides)
      : DecorationOverrideRegistry.empty();
    const cuts = migrated.cuts
      ? CutRegistry.fromSnapshot(migrated.cuts)
      : CutRegistry.empty();
    const captionTracks = migrated.captionTracks
      ? await Promise.all(migrated.captionTracks.map((track) => this.deserializeCaptionTrack(track)))
      : [];
    return new Project(
      migrated.id,
      migrated.name,
      new Date(migrated.createdAt),
      new Date(migrated.updatedAt),
      migrated.video,
      migrated.videoLayout,
      document,
      sheets,
      migrated.activeSheetId,
      behindActorOverrides,
      frozenSegments,
      elementStyles,
      decorationOverrides,
      cuts,
      thumbnail,
      captionTracks,
      migrated.activeCaptionTrackId ?? null,
    );
  }

  private serializeCaptionTrack(track: CaptionTrack): SerializedCaptionTrack {
    const elementStyles = track.elementStyles.restrictedTo(
      this.documentElementIdCollector.collect(track.document),
    );
    const behindActorOverrides = track.behindActorOverrides.toSnapshot();
    const structurallyEditedSegmentIds = track.frozenSegments.toSnapshot();
    const decorationOverrides = track.decorationOverrides.toRecord();
    return {
      id: track.id,
      name: track.name,
      kind: track.kind,
      sourceTrackId: track.sourceTrackId,
      document: this.serializeDocument(track.document),
      sheets: track.sheets.map((sheet) => this.serializeSheet(sheet)),
      activeSheetId: track.activeSheetId,
      ...(!track.behindActorOverrides.isEmpty() ? { behindActorOverrides } : {}),
      ...(structurallyEditedSegmentIds.length > 0 ? { structurallyEditedSegmentIds } : {}),
      ...(!elementStyles.isEmpty() ? { elementStyles: elementStyles.toSnapshot() } : {}),
      ...(Object.keys(decorationOverrides).length > 0 ? { decorationOverrides } : {}),
    };
  }

  private async deserializeCaptionTrack(data: SerializedCaptionTrack): Promise<CaptionTrack> {
    const document = this.deserializeDocument(data.document);
    const fallbackDirection = this.textDirectionDetector.detect(document.getText());
    const sheets = await Promise.all(
      data.sheets.map((sheet) => this.deserializeSheet(sheet, fallbackDirection)),
    );
    const elementStyles = data.elementStyles
      ? ElementStyles.fromSnapshot(data.elementStyles)
      : ElementStyles.empty();
    return new CaptionTrack({
      id: data.id,
      name: data.name,
      kind: data.kind,
      sourceTrackId: data.sourceTrackId,
      document,
      sheets,
      activeSheetId: data.activeSheetId,
      behindActorOverrides: data.behindActorOverrides
        ? BehindActorSegmentOverrideRegistry.fromSnapshot(data.behindActorOverrides)
        : BehindActorSegmentOverrideRegistry.empty(),
      frozenSegments: (data.structurallyEditedSegmentIds
        ? FrozenSegmentSet.fromSnapshot(data.structurallyEditedSegmentIds)
        : FrozenSegmentSet.empty()).replacingStyled(elementStyles.segmentIds()),
      elementStyles,
      decorationOverrides: data.decorationOverrides
        ? DecorationOverrideRegistry.fromRecord(data.decorationOverrides)
        : DecorationOverrideRegistry.empty(),
    });
  }

  private serializeDocument(doc: Document): SerializedDocument {
    return {
      sections: doc.sections.map(s => this.serializeSection(s)),
      ...(doc.narrationPace.isEmpty() ? {} : { narrationPace: doc.narrationPace.toRecord() }),
      ...(doc.language ? { language: doc.language } : {}),
    };
  }

  private deserializeDocument(data: SerializedDocument): Document {
    return new Document({
      sections: data.sections.map(s => this.deserializeSection(s)),
      ...(data.narrationPace ? { narrationPace: NarrationPace.fromRecord(data.narrationPace) } : {}),
      ...(data.language ? { language: data.language } : {}),
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
      ...(segment.effectTime
        ? { effectTime: { start: segment.effectTime.start, end: segment.effectTime.end } }
        : {}),
    };
  }

  private deserializeSegment(data: SerializedSegment): Segment {
    return new Segment({
      lines: data.lines.map(line => this.deserializeLine(line)),
      structureTags: this.tagsFromArray(data.structureTags),
      id: data.id,
      customTime: this.timeFrom(data.customTime),
      effectTime: this.timeFrom(data.effectTime),
    });
  }

  private timeFrom(data: { readonly start: number; readonly end: number } | undefined): TimeFragment | null {
    return data ? new TimeFragment(data.start, data.end) : null;
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
      ...(word.boundaryScore !== null ? { boundaryScore: word.boundaryScore } : {}),
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
      boundaryScore: data.boundaryScore ?? null,
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
      typographyConfig: this.typographyConfigSerializer.serialize(sheet.typographyConfig),
      rotationConfig: sheet.rotationConfig,
      segmentSplitterConfigs: sheet.segmentSplitterConfigs,
      lineSplitterConfig: sheet.lineSplitterConfig,
      alignmentConfig: sheet.alignmentConfig,
      effectConfigs: sheet.effectConfigs,
      cssOverride: sheet.cssOverride,
      filtersSvgOverride: sheet.filtersSvgOverride,
      textDirection: sheet.textDirection,
      ...(sheet.animations.isEmpty() ? {} : { animations: sheet.animations.toSnapshot() }),
      ...(sheet.linkGroupId !== null ? { linkGroupId: sheet.linkGroupId } : {}),
      ...(sheet.role !== null ? { role: sheet.role } : {}),
    };
  }

  /**
   * Direction to fall back on for a sheet that carries none. A payload
   * written before the field existed holds no decision to respect, so
   * the transcript answers for it; anything newer already stores one.
   */
  private resolveFallbackDirection(
    project: SerializedProject,
    document: Document | null,
  ): TextDirection {
    const anySheetMissesIt = project.sheets.some(sheet => sheet.textDirection === undefined);
    if (!anySheetMissesIt || !document) return 'ltr';
    return this.textDirectionDetector.detect(document.getText());
  }

  private async deserializeSheet(data: SerializedSheet, fallbackDirection: TextDirection): Promise<Sheet> {
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
      // Layered over the defaults rather than taken whole: a payload written
      // before a typography field existed carries no value for it, and the
      // sheet would otherwise hold `undefined` behind a non-optional type.
      typographyConfig: this.typographyConfigSerializer.deserialize(data.typographyConfig),
      rotationConfig: data.rotationConfig ?? ROTATION_DEFAULTS,
      segmentSplitterConfigs: data.segmentSplitterConfigs,
      lineSplitterConfig: data.lineSplitterConfig,
      alignmentConfig: data.alignmentConfig,
      effectConfigs: data.effectConfigs,
      animations: SheetAnimationSet.fromSnapshot(data.animations),
      cssOverride: data.cssOverride,
      filtersSvgOverride: data.filtersSvgOverride,
      linkGroupId: data.linkGroupId ?? null,
      // Payloads written before roles existed identify the hook sheet
      // by its fixed id alone.
      role: data.role ?? (data.id === HOOK_SHEET_ID ? 'hook' : null),
      textDirection: data.textDirection ?? fallbackDirection,
    });
  }

  /**
   * Restores the sheet's stored variant preference as written, out of the
   * template's current range or not — the sheet resolves it against
   * whatever template it sits on, and clamping here would erase a preset
   * the project still means to come back to. Substituted templates,
   * projects saved before variants existed, and malformed values all fall
   * back to `0` — the first available slot.
   */
  private resolveVariantIndex(template: Template, data: SerializedSheet): number {
    if (template.metadata.id !== data.templateId) return 0;
    if (data.variantIndex === undefined) return 0;
    if (!Number.isInteger(data.variantIndex) || data.variantIndex < 0) return 0;
    return data.variantIndex;
  }

  // When the resolver substitutes a missing template, the stored style
  // values target controls that the new template does not declare. Seed
  // fresh defaults instead so the sheet renders against a coherent set
  // of controls.
  private buildSheetStyleValues(template: Template, data: SerializedSheet): StyleValues {
    if (template.metadata.id !== data.templateId) {
      return StyleValues.fromTemplate(template.styleControls);
    }
    return StyleValues.restoredFrom(
      template.styleControls,
      this.storedFontStackReader.readStyleValues(template.styleControls, data.styleValues),
    );
  }
}
