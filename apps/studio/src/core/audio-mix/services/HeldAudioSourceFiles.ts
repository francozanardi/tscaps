import type { AudioSourceFiles } from '@core/audio-mix/domain/AudioSourceFiles';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';

/** Where a file stands: still being read, held, or found not to be had. */
export type HeldAudioSourceStatus = 'reading' | 'held' | 'unavailable';

/** One file as held: what became of its read, and the read it came from. */
interface HeldAudioFile {
  readonly status: HeldAudioSourceStatus;
  readonly file: Blob | null;
  readonly read: symbol;
}

/**
 * {@link AudioSourceFiles} that holds in memory every file it has read
 * through `files`, so a file answers with the same `Blob`, the same
 * object, every time it is asked for — which is how whoever plays it
 * tells a file it already opened from a new one.
 *
 * It never waits: a file not held yet answers null for now while its
 * read starts, and subscribers hear when it lands. A file that could not
 * be had answers null until {@link forgetUnavailable}.
 */
export class HeldAudioSourceFiles implements AudioSourceFiles {
  private readonly held = new Map<string, HeldAudioFile>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly files: AudioSourceFiles) {}

  load(source: AudioSourceRef): Promise<Blob | null> {
    return Promise.resolve(this.fileOf(source));
  }

  /** Where `source` stands; asking starts its read when nothing is held of it. */
  statusOf(source: AudioSourceRef): HeldAudioSourceStatus {
    this.fileOf(source);
    return this.held.get(this.keyOf(source))!.status;
  }

  /** Each distinct file of `sources` that stands at `status`, once, in the order first named. */
  sourcesAt(status: HeldAudioSourceStatus, sources: Iterable<AudioSourceRef>): AudioSourceRef[] {
    const found = new Map<string, AudioSourceRef>();
    for (const source of sources) {
      if (this.statusOf(source) === status) found.set(this.keyOf(source), source);
    }
    return [...found.values()];
  }

  /** Calls `listener` whenever a read lands. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Lets go of every file but those of `sources`; a read under way for one let go is ignored when it lands. */
  retainOnly(sources: Iterable<AudioSourceRef>): void {
    const kept = new Set([...sources].map((source) => this.keyOf(source)));
    for (const key of [...this.held.keys()]) {
      if (!kept.has(key)) this.held.delete(key);
    }
  }

  /** Forgets every file that could not be had, so the next ask reads it again. */
  forgetUnavailable(): void {
    for (const [key, entry] of [...this.held]) {
      if (entry.status === 'unavailable') this.held.delete(key);
    }
  }

  private fileOf(source: AudioSourceRef): Blob | null {
    const key = this.keyOf(source);
    const entry = this.held.get(key);
    if (entry !== undefined) return entry.file;
    const read = Symbol(key);
    this.held.set(key, { status: 'reading', file: null, read });
    void this.files.load(source).then(
      (file) => this.land(key, read, file),
      (error: unknown) => {
        console.error(`[audio-mix] ${key} could not be read`, error);
        this.land(key, read, null);
      },
    );
    return null;
  }

  private land(key: string, read: symbol, file: Blob | null): void {
    if (this.held.get(key)?.read !== read) return;
    this.held.set(key, { status: file === null ? 'unavailable' : 'held', file, read });
    for (const listener of this.listeners) listener();
  }

  private keyOf(source: AudioSourceRef): string {
    return source.kind === 'media' ? `media:${source.mediaId}` : `builtin:${source.soundId}`;
  }
}
