import type { BehindActorPreviewSupportChecker } from '@core/person-segmentation/services/BehindActorPreviewSupportChecker';
import type { Project } from '@core/projects/domain/Project';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { Template } from '@core/templates/domain/Template';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import type { TemplateSubstitutionNotifier } from '@core/templates/domain/TemplateSubstitutionNotifier';

/**
 * Replaces the templates of a project's sheets that need the
 * text-behind-actor effect when the session cannot render it, and
 * announces each replacement through the substitution notifier.
 *
 * Reads the support checker at call time, so it must run once the
 * project's preview has been published — before that the session has
 * no video to answer about.
 */
export class BehindActorTemplateSubstituter {

  constructor(
    private readonly supportChecker: BehindActorPreviewSupportChecker,
    private readonly templates: TemplateRepository,
    private readonly substitutionNotifier: TemplateSubstitutionNotifier,
  ) {}

  /** Returns `project` untouched when the effect is supported or no sheet asks for it. */
  async substitute(project: Project): Promise<Project> {
    if (this.supportChecker.isSupported()) return project;
    const allSheets = project.captionTracks.length > 0
      ? project.captionTracks.flatMap((track) => [...track.sheets])
      : project.sheets;
    if (!allSheets.some((sheet) => sheet.template.behindActor.required)) return project;
    const fallback = await this.pickFallback();
    if (project.captionTracks.length > 0) {
      return project.withCaptionTracks(project.captionTracks.map((track) => track.with({
        sheets: track.sheets.map((sheet) => this.replaceIfBehindActor(sheet, fallback)),
      })));
    }
    return project.withSheets(project.sheets.map((sheet) => this.replaceIfBehindActor(sheet, fallback)));
  }

  private replaceIfBehindActor(sheet: Sheet, fallback: Template): Sheet {
    if (!sheet.template.behindActor.required) return sheet;
    this.substitutionNotifier.notifySubstitution(sheet.template.metadata.id);
    return sheet.withTemplate(fallback);
  }

  /**
   * Skips opt-in templates rather than trusting the catalog's order:
   * replacing one behind-actor template with another leaves the sheet
   * as unrenderable as it was.
   */
  private async pickFallback(): Promise<Template> {
    const fallback = (await this.templates.getAll()).find((template) => !template.behindActor.required);
    if (!fallback) throw new Error('No templates available to substitute a behind-actor template.');
    return fallback;
  }
}
