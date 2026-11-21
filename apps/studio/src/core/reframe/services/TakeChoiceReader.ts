import { z } from 'zod';
import type { FramingChoice, TakeChoice } from '@core/reframe/domain/TakeChoice';

const SUBJECT = {
  show: z.string().min(1).max(1).optional(),
  at: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1).optional() }).optional(),
  closeness: z.number().min(1).max(3).optional(),
  name: z.string().max(60).optional(),
};

/** A reframe's `plan` as its caller writes it: what each take shows, a person's letter or a point, and its switches. */
export const TAKE_PLAN = z.array(z.object({
  take: z.number().int().min(0),
  ...SUBJECT,
  switches: z.array(z.object({ atSec: z.number().min(0), ...SUBJECT })).max(30).optional(),
})).max(300);

export type TakePlanEntries = z.infer<typeof TAKE_PLAN>;

/** What a plan entry says its stretch shows, as the caller gave it. */
interface SubjectEntry {
  readonly show?: string | undefined;
  readonly at?: { readonly x: number; readonly y?: number | undefined } | undefined;
  readonly closeness?: number | undefined;
  readonly name?: string | undefined;
}

export type TakeChoicesRead = { readonly ok: true; readonly choices: ReadonlyArray<TakeChoice> } | { readonly ok: false; readonly problem: string };

/**
 * Reads a reframe's `plan`, already checked against {@link TAKE_PLAN},
 * into the choices the reframe by survey frames by: each entry names a
 * person by `show` or a point by `at`, one of the two, for its take and
 * for each switch inside it. Answers the first entry that names both or
 * neither as a problem, in words its caller can act on.
 */
export class TakeChoiceReader {
  read(plan: TakePlanEntries): TakeChoicesRead {
    const choices: TakeChoice[] = [];
    for (const entry of plan) {
      const where = `take ${entry.take}`;
      const first = this.choiceOf(entry, where);
      if (typeof first === 'string') return { ok: false, problem: first };
      const switches = [];
      for (const each of entry.switches ?? []) {
        const switched = this.choiceOf(each, `the switch at ${each.atSec} s of ${where}`);
        if (typeof switched === 'string') return { ok: false, problem: switched };
        switches.push({ atSec: each.atSec, ...switched });
      }
      choices.push({ take: entry.take, ...first, switches });
    }
    return { ok: true, choices };
  }

  /** The choice an entry gives, or the problem with it. */
  private choiceOf(entry: SubjectEntry, where: string): FramingChoice | string {
    if ((entry.show === undefined) === (entry.at === undefined)) return `Give ${where} either \`show\` (a person's letter) or \`at\` (a point of the picture), one of the two.`;
    return {
      subject: entry.show !== undefined ? { kind: 'person', letter: entry.show } : { kind: 'point', x: entry.at!.x, y: entry.at!.y ?? null },
      closeness: entry.closeness ?? null,
      name: entry.name?.trim() || null,
    };
  }
}
