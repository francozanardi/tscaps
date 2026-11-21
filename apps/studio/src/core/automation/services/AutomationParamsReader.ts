import type { z } from 'zod';
import { AutomationCallFailedError } from '@core/automation/domain/AutomationCallFailedError';

/** Reads a call's params against the method's schema, or rejects the call saying what does not fit. */
export class AutomationParamsReader {
  /** Throws `AutomationCallFailedError` naming the first fields that do not fit. */
  read<T>(method: string, schema: z.ZodType<T>, params: unknown): T {
    const parsed = schema.safeParse(params ?? {});
    if (parsed.success) return parsed.data;
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || 'params'}: ${issue.message}`)
      .join('; ');
    throw new AutomationCallFailedError(method, `invalid params (${issues})`);
  }
}
