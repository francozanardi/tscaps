import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';

/**
 * Escape lets go of the selected element, unless something opened over
 * it (a popover, a menu) took that Escape to close itself.
 */

function escape(prevented: boolean): KeyboardEvent {
  const event = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }) as unknown as KeyboardEvent;
  if (prevented) event.preventDefault();
  return event;
}

function setUp() {
  // The window, standing in for the page Escape is pressed on: no field holds the key.
  const target = Object.assign(new EventTarget(), { closest: () => null });
  vi.stubGlobal('window', target);
  const controller = new OverlaySelectionController();
  controller.start();
  controller.selectShotLayer('broll');
  return { controller, press: (prevented: boolean) => target.dispatchEvent(escape(prevented)) };
}

describe('OverlaySelectionController on Escape', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lets go of the selection', () => {
    const { controller, press } = setUp();

    press(false);

    expect(controller.selectionSnapshot()).toBeNull();
  });

  it('keeps it when the Escape closed something opened over it', () => {
    const { controller, press } = setUp();

    press(true);

    expect(controller.selectionSnapshot()).not.toBeNull();
  });
});
