import { describe, expect, it } from 'vitest';
import { EditorWorkspaceStore } from '@presentation/editor/stores/EditorWorkspaceStore';

/**
 * A panel can open the inspector on one of its pages: the ask waits until
 * the inspector takes it, and is then gone, so the next element the
 * inspector opens on keeps the page it remembers.
 */
describe('EditorWorkspaceStore page requests', () => {
  it('holds a request until the inspector settles that very request', () => {
    const store = new EditorWorkspaceStore();
    store.requestInspectorPage('sound');
    const first = store.inspectorPageRequest;
    store.requestInspectorPage('sound');
    const second = store.inspectorPageRequest;

    store.settleInspectorPageRequest(first!);
    expect(store.inspectorPageRequest).toBe(second);
    store.settleInspectorPageRequest(second!);
    expect(store.inspectorPageRequest).toBeNull();
  });
});

describe('EditorWorkspaceStore shot transition requests', () => {
  it('opens the Video mode on the ask, and holds it until the transition settles it', () => {
    const store = new EditorWorkspaceStore();
    store.requestShotTransition('shot-2');
    const request = store.shotTransitionRequest;

    expect(store.activeModeId).toBe('video');
    expect(request).toEqual({ shotId: 'shot-2', spotlight: null });
    store.settleShotTransitionRequest(request!);
    expect(store.shotTransitionRequest).toBeNull();
  });
});
