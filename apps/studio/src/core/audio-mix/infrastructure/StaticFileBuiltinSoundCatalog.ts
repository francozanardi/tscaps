import type { BuiltinSound } from '@core/audio-mix/domain/BuiltinSound';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import { BUILTIN_SOUND_CATEGORIES } from '@core/audio-mix/domain/BuiltinSoundCategory';
import type { BuiltinSoundEntry } from '@core/audio-mix/infrastructure/BuiltinSoundPack';

/**
 * The bundled sounds, served as static files from the app's `sounds/`
 * folder. Throws on construction when two entries share an id, since a
 * stored clip could no longer say which one it plays.
 */
export class StaticFileBuiltinSoundCatalog implements BuiltinSoundCatalog {
  private readonly sounds: readonly BuiltinSound[];
  private readonly byId: ReadonlyMap<string, BuiltinSound>;

  /**
   * @param baseUrl path the app is served under, trailing slash included
   *   — the app does not always sit at the origin root, so an absolute
   *   path would resolve outside it.
   */
  constructor(entries: readonly BuiltinSoundEntry[], baseUrl: string) {
    this.sounds = this.inOfferedOrder(entries.map((entry) => ({ ...entry, url: `${baseUrl}sounds/${entry.id}.ogg` })));
    this.byId = this.indexById(this.sounds);
  }

  list(): readonly BuiltinSound[] {
    return this.sounds;
  }

  find(soundId: string): BuiltinSound | null {
    return this.byId.get(soundId) ?? null;
  }

  private inOfferedOrder(sounds: readonly BuiltinSound[]): readonly BuiltinSound[] {
    return BUILTIN_SOUND_CATEGORIES.flatMap((category) => sounds.filter((sound) => sound.category === category));
  }

  private indexById(sounds: readonly BuiltinSound[]): ReadonlyMap<string, BuiltinSound> {
    const byId = new Map<string, BuiltinSound>();
    for (const sound of sounds) {
      if (byId.has(sound.id)) throw new Error(`Duplicate built-in sound id: "${sound.id}"`);
      byId.set(sound.id, sound);
    }
    return byId;
  }
}
