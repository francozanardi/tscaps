import { describe, expect, it } from 'vitest';
import { CalendarDateParser } from '@core/templates/domain/CalendarDateParser';
import { AddedOnTemplateJsonContractRule } from '@core/templates/services/contract/AddedOnTemplateJsonContractRule';

describe('AddedOnTemplateJsonContractRule', () => {
  const rule = new AddedOnTemplateJsonContractRule(new CalendarDateParser());

  it('accepts a template that declares no date', () => {
    expect(rule.check({ name: 'X' })).toEqual([]);
  });

  it('accepts a real day written as YYYY-MM-DD', () => {
    expect(rule.check({ name: 'X', addedOn: '2026-09-26' })).toEqual([]);
  });

  it('refuses a day the calendar does not have', () => {
    expect(rule.check({ name: 'X', addedOn: '2026-02-30' })).toHaveLength(1);
  });

  it('refuses another date format', () => {
    expect(rule.check({ name: 'X', addedOn: '26/09/2026' })).toHaveLength(1);
  });

  it('refuses a date that is not a string', () => {
    expect(rule.check({ name: 'X', addedOn: 20260926 })).toHaveLength(1);
  });
});
