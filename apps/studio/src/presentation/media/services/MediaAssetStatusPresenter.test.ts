import { describe, expect, it } from 'vitest';
import { MediaAssetStatusPresenter } from '@presentation/media/services/MediaAssetStatusPresenter';

/**
 * A file's state is read from three sources at once, and the reader
 * sees one of them. The order decides which: a file that cannot be
 * shown here says so before anything about its upload.
 */

const presenter = new MediaAssetStatusPresenter();

describe('what a media file says about where it stands', () => {
  it('says nothing once the file is ready and sent', () => {
    const view = presenter.present({
      exists: true,
      type: 'video',
      preparation: { phase: 'ready', progress: null, error: null },
      upload: { phase: 'uploaded', progress: null, error: null },
    });

    expect(view.state).toBe('ready');
    expect(view.note).toBeNull();
    expect(view.badge).toBeNull();
  });

  it('reports the preparation before the upload under way behind it', () => {
    const view = presenter.present({
      exists: true,
      type: 'video',
      preparation: { phase: 'preparing', progress: 0.4, error: null },
      upload: { phase: 'uploading', progress: 0.9, error: null },
    });

    expect(view.state).toBe('preparing');
    expect(view.progress).toBe(0.4);
  });

  it('offers no retry for a refused upload, since trying again changes nothing', () => {
    const view = presenter.present({
      exists: true,
      type: 'video',
      preparation: { phase: 'ready', progress: null, error: null },
      upload: { phase: 'refused', progress: null, error: null, refusal: 'storage' },
    });

    expect(view.state).toBe('refused');
    expect(view.retryable).toBe(false);
    expect(view.note).toContain('space your plan has left');
  });

  it('offers a retry for an upload that did not finish', () => {
    const view = presenter.present({
      exists: true,
      type: 'video',
      preparation: { phase: 'ready', progress: null, error: null },
      upload: { phase: 'failed', progress: null, error: new Error('network') },
    });

    expect(view.state).toBe('failed');
    expect(view.retryable).toBe(true);
  });

  it('says a file whose bytes are gone is missing, whatever its upload says', () => {
    const view = presenter.present({
      exists: true,
      type: 'video',
      preparation: { phase: 'missing', progress: null, error: null },
      upload: { phase: 'failed', progress: null, error: null },
    });

    expect(view.state).toBe('missing');
    expect(view.retryable).toBe(false);
  });

  it('says a GIF this browser cannot play cannot play here, offering no retry, whatever its upload says', () => {
    const view = presenter.present({
      exists: true,
      type: 'gif',
      preparation: { phase: 'unplayable', progress: null, error: new Error('No decoder here can read this GIF.') },
      upload: { phase: 'uploading', progress: 0.5, error: null },
    });

    expect(view.state).toBe('unplayable');
    expect(view.tone).toBe('alert');
    expect(view.retryable).toBe(false);
  });

  it('says an audio file this browser cannot decode cannot play here, and how to make one that does', () => {
    const view = presenter.present({
      exists: true,
      type: 'audio',
      preparation: { phase: 'unplayable', progress: null, error: new Error('Neither decoder plays this file.') },
      upload: null,
    });

    expect(view.state).toBe('unplayable');
    expect(view.retryable).toBe(false);
    expect(view.note).toContain('audio file');
  });

  it('says a file that no longer exists was deleted', () => {
    expect(presenter.present({ exists: false, type: null, preparation: null, upload: null }).state).toBe('deleted');
  });
});
