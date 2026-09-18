import { describe, expect, it } from 'vitest';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyGenerator } from '@core/preview/domain/PreviewProxyGenerator';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import { PreviewProxyGenerationPolicy } from '@core/preview/services/PreviewProxyGenerationPolicy';
import { PreviewProxyGenerationBudget } from '@core/preview/services/PreviewProxyGenerationBudget';
import { PreviewProxyResolver } from '@core/preview/services/PreviewProxyResolver';

class MapPreviewProxyRepository implements PreviewProxyRepository {
  private readonly proxies = new Map<string, PreviewProxy>();
  async load(projectId: string): Promise<PreviewProxy | null> { return this.proxies.get(projectId) ?? null; }
  async store(projectId: string, proxy: PreviewProxy): Promise<void> { this.proxies.set(projectId, proxy); }
  async delete(projectId: string): Promise<void> { this.proxies.delete(projectId); }
}

class FixedPreviewProxyGenerator implements PreviewProxyGenerator {
  constructor(private readonly proxy: PreviewProxy) {}
  async generate(): Promise<PreviewProxy> { return this.proxy; }
}

class FixedVideoMetadataProbe implements VideoMetadataProbe {
  constructor(private readonly metadata: VideoSourceMetadata) {}
  async probe(): Promise<VideoSourceMetadata> { return this.metadata; }
}

const SILENT_REPORTER = { report: () => undefined } as unknown as NonBlockingFailureReporter;

function metadata(overrides: Partial<VideoSourceMetadata>): VideoSourceMetadata {
  return {
    mimeType: 'video/mp4',
    sourceReadable: true,
    containerFormat: 'MP4',
    durationSeconds: 30,
    videoCodec: 'avc',
    videoWidthPx: 1080,
    videoHeightPx: 1920,
    hasAudioTrack: true,
    audioCodec: 'aac',
    audioSampleRate: 44100,
    audioChannels: 2,
    ...overrides,
  };
}

function proxyOf(blob: Blob): PreviewProxy {
  return { blob, mimeType: 'video/mp4', widthPx: 270, heightPx: 480 };
}

class ThrowingPreviewProxyGenerator implements PreviewProxyGenerator {
  async generate(): Promise<PreviewProxy> { throw new Error('encoder blew up'); }
}

/** Stands in for an encode the coordinator stopped, whoever asked for it. */
class AbortingPreviewProxyGenerator implements PreviewProxyGenerator {
  async generate(): Promise<PreviewProxy> {
    throw new DOMException('The transcode was aborted.', 'AbortError');
  }
}

function resolverFor(
  sourceMetadata: VideoSourceMetadata,
  generator: PreviewProxyGenerator,
  enabled = true,
  isMobileDevice = false,
): PreviewProxyResolver {
  return new PreviewProxyResolver(
    new MapPreviewProxyRepository(),
    generator,
    new FixedVideoMetadataProbe(sourceMetadata),
    new PreviewProxyGenerationPolicy(isMobileDevice),
    new PreviewProxyGenerationBudget(),
    SILENT_REPORTER,
    enabled,
  );
}

/**
 * Past the mobile pixel ceiling, which is the only thing left that
 * refuses a source outright. Duration no longer decides anything here:
 * how long a run is worth waiting for is measured while it runs.
 */
const TOO_MANY_PIXELS = { videoWidthPx: 3840, videoHeightPx: 2160 };

describe('PreviewProxyResolver generation policy', () => {
  it('generates for a source the policy accepts', async () => {
    const proxyBlob = new Blob(['proxy']);
    const resolver = resolverFor(metadata({}), new FixedPreviewProxyGenerator(proxyOf(proxyBlob)));
    const resolution = await resolver.fromSource(new Blob(['source']));
    expect(resolution.preview).toEqual({ kind: 'proxy', file: proxyBlob });
    expect(resolution.freshProxy).not.toBeNull();
  });

  it('refuses a source a phone should not decode, resolving to the source itself', async () => {
    const source = new Blob(['source']);
    const generator = new FixedPreviewProxyGenerator(proxyOf(new Blob(['proxy'])));
    const resolution = await resolverFor(metadata(TOO_MANY_PIXELS), generator, true, true).fromSource(source);
    expect(resolution.preview).toEqual({ kind: 'original', file: source, reason: 'policy-skipped' });
    expect(resolution.freshProxy).toBeNull();
  });

  // Duration used to refuse a source outright. It no longer does: a long
  // video is exactly where a proxy earns its cost, and how long the encode
  // is worth waiting for is decided while it runs.
  it('starts on a source too long for the old duration budget', async () => {
    const proxyBlob = new Blob(['proxy']);
    const generator = new FixedPreviewProxyGenerator(proxyOf(proxyBlob));
    const resolution = await resolverFor(metadata({ durationSeconds: 20 * 60 }), generator).fromSource(new Blob(['s']));
    expect(resolution.preview).toEqual({ kind: 'proxy', file: proxyBlob });
  });

  it('generates for a refused source when asked to ignore the policy', async () => {
    const proxyBlob = new Blob(['proxy']);
    const generator = new FixedPreviewProxyGenerator(proxyOf(proxyBlob));
    const resolver = resolverFor(metadata(TOO_MANY_PIXELS), generator, true, true);
    const resolution = await resolver.fromSourceIgnoringPolicy(new Blob(['source']));
    expect(resolution.preview).toEqual({ kind: 'proxy', file: proxyBlob });
    expect(resolution.freshProxy).not.toBeNull();
  });

  // Every way a preview ends up on the original bytes must stay
  // distinguishable: each one says something different to a reader, and
  // the affordance that offers a way out reads exactly this field.
  it('separates a failed generation from a policy skip and from a disabled pipeline', async () => {
    const source = new Blob(['source']);
    const failed = await resolverFor(metadata({}), new ThrowingPreviewProxyGenerator()).fromSource(source);
    expect(failed.preview).toEqual({ kind: 'original', file: source, reason: 'generation-failed' });
    expect(failed.freshProxy).toBeNull();

    const generator = new FixedPreviewProxyGenerator(proxyOf(new Blob(['proxy'])));
    const disabled = await resolverFor(metadata({}), generator, false).fromSource(source);
    expect(disabled.preview).toEqual({ kind: 'original', file: source, reason: 'pipeline-disabled' });
  });
});

/**
 * Giving up is not failing: it leaves a playable original and an offer
 * to try again, so it must not travel the reporting path a broken
 * encode does.
 */
describe('PreviewProxyResolver when generation is abandoned', () => {

  it('plays the source and names the budget', async () => {
    const source = new Blob(['source']);
    const resolver = resolverFor(metadata({}), new AbortingPreviewProxyGenerator());
    const resolution = await resolver.fromSource(source);
    expect(resolution.preview).toEqual({ kind: 'original', file: source, reason: 'generation-abandoned' });
    expect(resolution.freshProxy).toBeNull();
  });

  it('reports nothing, where a failed encode reports', async () => {
    const reports: unknown[] = [];
    const reporter = { report: (cause: unknown) => reports.push(cause) } as unknown as NonBlockingFailureReporter;
    const resolverWith = (generator: PreviewProxyGenerator) => new PreviewProxyResolver(
      new MapPreviewProxyRepository(),
      generator,
      new FixedVideoMetadataProbe(metadata({})),
      new PreviewProxyGenerationPolicy(false),
      new PreviewProxyGenerationBudget(),
      reporter,
      true,
    );

    await resolverWith(new AbortingPreviewProxyGenerator()).fromSource(new Blob(['a']));
    expect(reports).toEqual([]);

    await resolverWith(new ThrowingPreviewProxyGenerator()).fromSource(new Blob(['b']));
    expect(reports).toHaveLength(1);
  });
});
