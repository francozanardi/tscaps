/**
 * Snapshot of what the current browser can do for this app. Carries
 * the codec-encoding verdict and the partition of known templates
 * into those that render correctly and those that don't.
 *
 * `allTemplateIds` is the universe the report was computed against;
 * any id outside it has no verdict and must be treated as unknown.
 */
export class SupportReport {
  constructor(
    readonly webcodecsSupported: boolean,
    readonly supportedTemplateIds: ReadonlySet<string>,
    readonly allTemplateIds: ReadonlySet<string>,
  ) {}

  /** True when video can be encoded and at least one template renders correctly. */
  isAppUsable(): boolean {
    return this.webcodecsSupported && this.supportedTemplateIds.size > 0;
  }

  /** Subset of `allTemplateIds` that did not pass the render check. */
  unsupportedTemplateIds(): string[] {
    return [...this.allTemplateIds].filter((id) => !this.supportedTemplateIds.has(id));
  }
}
