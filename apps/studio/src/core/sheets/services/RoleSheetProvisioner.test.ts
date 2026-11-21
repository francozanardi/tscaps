import { describe, expect, it } from 'vitest';
import type { TextDirection } from '@tscaps/engine';
import type { Template } from '@core/templates/domain/Template';
import type { RoleTemplatePicker } from '@core/sheets/services/RoleTemplatePicker';
import { RoleSheetProvisioner } from '@core/sheets/services/RoleSheetProvisioner';
import { Sheet } from '@core/sheets/domain/Sheet';
import { BODY_ONLY_MODES } from '@core/templates/domain/definition/TemplateMode';

/**
 * Which way a role's sheet reads.
 *
 * A role names a part of the same recording every other sheet describes,
 * so its sheet reads the way the project reads. Both ways of building it
 * have to agree on that, and they used not to: cloning Main carries the
 * answer along, while building from a template does not, because a
 * template says nothing about language. The miss surfaced as an Arabic
 * caption whose closing full stop painted at the far end of the line.
 */

function template(id: string): Template {
  return { styleControls: [], variants: [], metadata: { id }, modes: BODY_ONLY_MODES } as unknown as Template;
}

const MAIN_TEMPLATE = template('main-template');
const ROLE_TEMPLATE = template('role-template');

function pickerOffering(picked: Template | null): RoleTemplatePicker {
  return { pick: () => picked } as unknown as RoleTemplatePicker;
}

function mainReading(textDirection: TextDirection): Sheet {
  return Sheet.fromTemplate('main', 'Main', null, MAIN_TEMPLATE, textDirection);
}

describe('provisioning the sheet for a role', () => {
  it('reads the way Main reads when the role gets a template of its own', () => {
    const provisioner = new RoleSheetProvisioner(pickerOffering(ROLE_TEMPLATE));

    const hook = provisioner.create('hook', mainReading('rtl'), [ROLE_TEMPLATE]);

    // Guards the test itself: without this the fallback branch, which was
    // always right, could satisfy the assertion below.
    expect(hook.template).toBe(ROLE_TEMPLATE);
    expect(hook.textDirection).toBe('rtl');
  });

  it('reads the way Main reads when nothing fits and the sheet is a copy of Main', () => {
    const provisioner = new RoleSheetProvisioner(pickerOffering(null));

    const hook = provisioner.create('hook', mainReading('rtl'), []);

    expect(hook.template).toBe(MAIN_TEMPLATE);
    expect(hook.textDirection).toBe('rtl');
  });
});
