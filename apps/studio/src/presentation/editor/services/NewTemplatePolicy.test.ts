import { describe, expect, it } from 'vitest';
import type { Template } from '@core/templates/domain/Template';
import { CalendarDateParser } from '@core/templates/domain/CalendarDateParser';
import { NewTemplatePolicy } from '@presentation/editor/services/NewTemplatePolicy';

function template(addedOn: string | undefined): Template {
  return { metadata: { id: 'ada', name: 'Ada', category: 'classic', addedOn } } as unknown as Template;
}

function policyOn(today: string): NewTemplatePolicy {
  return new NewTemplatePolicy(new CalendarDateParser(), new Date(today));
}

describe('NewTemplatePolicy', () => {
  it('marks a template added today', () => {
    expect(policyOn('2026-09-26T10:00:00Z').isNew(template('2026-09-26'))).toBe(true);
  });

  it('still marks it on the fourteenth day', () => {
    expect(policyOn('2026-10-09T23:00:00Z').isNew(template('2026-09-26'))).toBe(true);
  });

  it('stops marking it two weeks after it was added', () => {
    expect(policyOn('2026-10-10T00:00:00Z').isNew(template('2026-09-26'))).toBe(false);
  });

  it('never marks a template that declares no date', () => {
    expect(policyOn('2026-09-26T10:00:00Z').isNew(template(undefined))).toBe(false);
  });

  it('never marks a template whose date names no real day', () => {
    expect(policyOn('2026-02-28T10:00:00Z').isNew(template('2026-02-30'))).toBe(false);
  });
});
