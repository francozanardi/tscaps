import type { z } from 'zod';

/** Reads a tool's arguments against its schema, or throws a sentence that says which ones do not fit. */
export class ToolArguments {
  read<T>(schema: z.ZodType<T>, args: unknown): T {
    const parsed = schema.safeParse(args ?? {});
    if (parsed.success) return parsed.data;
    const issues = parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.') || 'arguments'}: ${issue.message}`);
    throw new Error(`Invalid arguments: ${issues.join('; ')}.`);
  }
}
