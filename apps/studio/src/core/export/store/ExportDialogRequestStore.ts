import type { ExportDialogOpener } from '@core/export/domain/ExportDialogOpener';

/**
 * Asks the editor to open its export dialog, as the Export button does,
 * for a caller that has no button to press (the assistant). Whoever
 * shows the editor listens for `'request'` and opens the dialog through
 * its own path, so every check the button runs first still runs.
 * Nothing is exported until the person confirms in the dialog.
 */
export class ExportDialogRequestStore extends EventTarget implements ExportDialogOpener {
  /** Asks for the dialog; ignored while no editor is listening. */
  request(): void {
    this.dispatchEvent(new Event('request'));
  }
}
