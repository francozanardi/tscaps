/** Opens the editor's export dialog, as its Export button does; nothing is exported until the person confirms there. */
export interface ExportDialogOpener {
  request(): void;
}
