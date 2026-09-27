import type { Template } from '@core/templates/domain/Template';
import type { CalendarDateParser } from '@core/templates/domain/CalendarDateParser';

// Two weeks rather than one: someone who edits once a week still meets
// the mark at least once before it lapses.
const NEW_FOR_DAYS = 14;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Decides which templates the gallery marks as new: those whose
 * `addedOn` day falls within the last two weeks of `today`. The mark
 * lapses on its own, and is the same for every visitor. A template with
 * no `addedOn` is never new.
 */
export class NewTemplatePolicy {

  constructor(
    private readonly calendarDateParser: CalendarDateParser,
    private readonly today: Date,
  ) {}

  isNew(template: Template): boolean {
    const addedOn = template.metadata.addedOn;
    if (addedOn === undefined) return false;
    const addedOnDate = this.calendarDateParser.parse(addedOn);
    if (addedOnDate === null) return false;
    const daysSinceAdded = (this.today.getTime() - addedOnDate.getTime()) / MILLISECONDS_PER_DAY;
    return daysSinceAdded < NEW_FOR_DAYS;
  }
}
