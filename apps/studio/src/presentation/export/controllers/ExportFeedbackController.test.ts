import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ExportStore } from '@core/export/store/ExportStore';
import { ExportFeedbackController } from '@presentation/export/controllers/ExportFeedbackController';

describe('ExportFeedbackController', () => {
  let exportStore: ExportStore;
  let controller: ExportFeedbackController;

  beforeEach(() => {
    exportStore = new ExportStore();
    controller = new ExportFeedbackController(exportStore, new EditorStore());
    controller.start();
  });

  afterEach(() => controller.stop());

  it('confirms a run that finished', () => {
    exportStore.start('rendering');
    exportStore.finish(null);

    expect(controller.phase).toBe('completed');
    expect(controller.toastOpen).toBe(true);
  });

  it('confirms nothing for a run that was cancelled, since it produced no file', () => {
    exportStore.start('rendering');
    exportStore.cancel('user');

    expect(controller.phase).toBeNull();
    expect(controller.toastOpen).toBe(false);
  });
});
