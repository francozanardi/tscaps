/** Shared naming contract for fixed catalog stacks declared by template stylesheets. */
export class FontStackCssVariable {

  static nameFor(stackId: string): string {
    return `--tscaps-font-stack-${stackId}`;
  }

  private constructor() {}
}
