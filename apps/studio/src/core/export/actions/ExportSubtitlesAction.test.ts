import { describe, expect, it, vi } from 'vitest';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { SubtitleFileSerializerRegistry } from '@core/export/services/SubtitleFileSerializerRegistry';
import type { FileDownloader } from '@core/_shared/domain/FileDownloader';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { ExportSubtitlesAction } from '@core/export/actions/ExportSubtitlesAction';

describe('ExportSubtitlesAction', () => {
  it('writes nothing when the active project output is plan-gated', () => {
    const download = vi.fn();
    const capture = vi.fn();
    const serializers = { get: vi.fn() };
    const action = new ExportSubtitlesAction(
      { snapshot: vi.fn(() => ({})) } as unknown as EditorStore,
      {} as CutAwareDocumentBuilder,
      serializers as unknown as SubtitleFileSerializerRegistry,
      { download } as unknown as FileDownloader,
      { capture } as unknown as Telemetry,
      {
        access: () => ({
          available: false,
          reason: { kind: 'outside-plan', feature: 'translations' },
        }),
      },
    );

    action.execute({ format: 'srt', granularity: 'segment' });

    expect(serializers.get).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });
});
