/** The template-specific half of the contract source is validated against. */
export interface TemplateContractContext {
  /** Ids of every style control the template ships, whatever declared them. */
  readonly styleControlIds: ReadonlyArray<string>;
  /** Fixed stacks declared by the stylesheet, whose variables the wrapper supplies. */
  readonly fontStackIds?: readonly string[];
  /** Ids of the `<filter>` elements the active `filters.svg` defines. */
  readonly filterIds: ReadonlySet<string>;
  /**
   * Where each control was declared, when that is known. A template
   * loaded for editing carries one merged list and has lost the split,
   * so these are absent there and the checks that need them stand
   * down. Reading a template's sources separately — as the build does
   * — recovers it.
   */
  readonly handDeclaredControlIds?: ReadonlyArray<string>;
  readonly stylesheetDeclaredControlIds?: ReadonlyArray<string>;
  /**
   * Every `@keyframes` block the stylesheet's declared animations
   * claim, when the record is at hand. Absent for a template loaded
   * for editing, which carries no build-time registry.
   */
  readonly declaredAnimationKeyframes?: ReadonlySet<string>;
}
