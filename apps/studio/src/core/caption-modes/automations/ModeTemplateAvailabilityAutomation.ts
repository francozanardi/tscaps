import type { EditorStore } from '@core/editor/store/EditorStore';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';

/**
 * Keeps `availableTemplates` in step with the open document, for a
 * catalog that leaves out templates whose modes would take no word of it.
 * Re-reads the catalog whenever the document changes (a transcription
 * lands, a tag is set by hand, a project is opened) and publishes it only
 * when the templates it offers differ, so an edit that changes no mode's
 * answer touches nothing.
 */
export class ModeTemplateAvailabilityAutomation {
  private lastDocument: unknown = undefined;
  private publishedIds: string | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly templateRepository: TemplateRepository,
  ) {}

  start(): void {
    this.store.addEventListener('change', this.onChange);
    this.onChange();
  }

  stop(): void {
    this.store.removeEventListener('change', this.onChange);
  }

  private readonly onChange = (): void => {
    const document = this.store.snapshot().document;
    if (document === this.lastDocument) return;
    this.lastDocument = document;
    void this.republishTemplates(document);
  };

  /** A catalog read that resolves after the document has changed again is dropped rather than published late. */
  private async republishTemplates(documentAtRead: unknown): Promise<void> {
    const availableTemplates = await this.templateRepository.getAll();
    if (this.lastDocument !== documentAtRead) return;
    const ids = availableTemplates.map((template) => template.metadata.id).join('|');
    if (ids === this.publishedIds) return;
    this.publishedIds = ids;
    this.store.patch({ availableTemplates });
  }
}
