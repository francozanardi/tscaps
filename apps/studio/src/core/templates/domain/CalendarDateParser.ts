const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Reads a calendar day written as `YYYY-MM-DD`. The day is taken as UTC
 * midnight, so the same string names the same instant on every machine.
 */
export class CalendarDateParser {

  /**
   * Returns the day at UTC midnight, or `null` when the string is not in
   * the `YYYY-MM-DD` shape or names a day the calendar does not have,
   * such as `2026-02-30`.
   */
  parse(value: string): Date | null {
    const match = CALENDAR_DATE_PATTERN.exec(value);
    if (match === null) return null;
    const [, year, month, day] = match.map(Number) as [number, number, number, number];
    const date = new Date(Date.UTC(year, month - 1, day));
    // `Date.UTC` rolls an out-of-range day over into the next month
    // instead of refusing it, so a day that does not exist comes back as
    // a different one.
    const rolledOver = date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day;
    return rolledOver ? null : date;
  }
}
