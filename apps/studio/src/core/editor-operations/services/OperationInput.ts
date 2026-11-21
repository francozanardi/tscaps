import { z } from 'zod';
import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';

/** The input of an operation, checked: its value, or why it was refused. */
export type CheckedOperationInput<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problems: ReadonlyArray<OperationProblem> };

/**
 * The input an operation takes, declared once as the fields of a zod
 * object: checked on every run, and offered to callers as JSON Schema.
 * Unknown keys are refused, so a caller that misspells one hears about it
 * instead of having it ignored.
 */
export class OperationInput<Shape extends z.ZodRawShape> {
  private readonly schema: z.ZodObject<Shape>;

  constructor(shape: Shape) {
    this.schema = z.strictObject(shape);
  }

  /** The input's JSON Schema: an object schema with `additionalProperties: false`, fields with a default not required. */
  jsonSchema(): Readonly<Record<string, unknown>> {
    const schema = z.toJSONSchema(this.schema, { target: 'draft-2020-12', unrepresentable: 'any', io: 'input' }) as Record<string, unknown>;
    delete schema['$schema'];
    return schema;
  }

  /**
   * `input` checked against the schema, with one problem per field that
   * failed, named by its path. A field that wants an object or a list and
   * got a string holding one in JSON is read as what the string holds:
   * language models now and then send a long nested value that way, often
   * with a stray closing brace or bracket after it, which is let go.
   */
  check(input: unknown): CheckedOperationInput<z.output<z.ZodObject<Shape>>> {
    let parsed = this.schema.safeParse(input ?? {});
    if (!parsed.success) {
      const unwrapped = this.withJsonStringsRead(input ?? {}, parsed.error.issues);
      if (unwrapped !== null) parsed = this.schema.safeParse(unwrapped);
    }
    if (parsed.success) return { ok: true, value: parsed.data };
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => ({
        severity: 'error' as const,
        message: issue.path.length === 0 ? issue.message : `${issue.path.join('.')}: ${issue.message}`,
      })),
    };
  }

  /**
   * A copy of `input` with each string the issues name, where an object or
   * a list was expected, replaced by the JSON value it holds; null when no
   * such string reads as one.
   */
  private withJsonStringsRead(input: unknown, issues: ReadonlyArray<z.core.$ZodIssue>): unknown {
    let copy: unknown = structuredClone(input);
    let changed = false;
    for (const issue of issues) {
      if (issue.code !== 'invalid_type') continue;
      const expected = issue.expected === 'object' ? 'object' : issue.expected === 'array' ? 'array' : null;
      if (expected === null) continue;
      const value = this.at(copy, issue.path);
      if (typeof value !== 'string') continue;
      const read = this.jsonOf(value, expected);
      if (read === undefined) continue;
      copy = this.replaced(copy, issue.path, read);
      changed = true;
    }
    return changed ? copy : null;
  }

  private jsonOf(text: string, expected: 'object' | 'array'): unknown {
    const value = this.parsed(text) ?? this.parsed(this.withoutStrayClosers(text));
    if (value === undefined) return undefined;
    const fits = expected === 'array' ? Array.isArray(value) : typeof value === 'object' && value !== null && !Array.isArray(value);
    return fits ? value : undefined;
  }

  private parsed(text: string | null): unknown {
    if (text === null) return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      // Not JSON: the original issue stands.
      return undefined;
    }
  }

  /**
   * `text` up to where its first object or list closes, when all that
   * follows is closing braces, brackets and whitespace; null otherwise.
   */
  private withoutStrayClosers(text: string): string | null {
    const start = text.search(/\S/);
    if (start === -1 || (text[start] !== '{' && text[start] !== '[')) return null;
    let depth = 0;
    let inString = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (char === '\\') index += 1;
        else if (char === '"') inString = false;
      } else if (char === '"') {
        inString = true;
      } else if (char === '{' || char === '[') {
        depth += 1;
      } else if ((char === '}' || char === ']') && --depth === 0) {
        const rest = text.slice(index + 1);
        return /^[\s}\]]*$/.test(rest) ? text.slice(0, index + 1) : null;
      }
    }
    return null;
  }

  private at(root: unknown, path: ReadonlyArray<PropertyKey>): unknown {
    let node = root;
    for (const key of path) {
      if (typeof node !== 'object' || node === null) return undefined;
      node = (node as Record<PropertyKey, unknown>)[key];
    }
    return node;
  }

  private replaced(root: unknown, path: ReadonlyArray<PropertyKey>, value: unknown): unknown {
    if (path.length === 0) return value;
    const parent = this.at(root, path.slice(0, -1));
    if (typeof parent === 'object' && parent !== null) (parent as Record<PropertyKey, unknown>)[path[path.length - 1]!] = value;
    return root;
  }
}
