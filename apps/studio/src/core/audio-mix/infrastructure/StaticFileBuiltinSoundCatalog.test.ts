import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BufferSource, Input, OGG } from 'mediabunny';
import { describe, expect, it } from 'vitest';
import { BUILTIN_SOUND_CATEGORIES } from '@core/audio-mix/domain/BuiltinSoundCategory';
import { BUILTIN_SOUND_PACK } from '@core/audio-mix/infrastructure/BuiltinSoundPack';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';

/**
 * The bundled pack is what a stored clip's `builtin` source names, so its
 * ids outlive any build, every sound it lists is a file the app serves,
 * and the length it states is the one a decoder reads from that file.
 */

const PUBLIC_DIR = resolve(import.meta.dirname, '../../../../public');
const BASE_URL = '/app/';

// Every id the pack carries, each since the build that first shipped it.
// A clip saved by any build names one of these or a retired one, so one
// missing here means a project that loses a sound on open.
const SHIPPED_IDS = [
  'whoosh-soft', 'whoosh-fast', 'whoosh-deep', 'swish', 'swish-heavy',
  'pop-mouth', 'pop-bubble',
  'ding-bell', 'ding-glass', 'ding-chime',
  'click',
  'riser-short', 'riser-long',
  'impact-boom', 'impact-hit', 'impact-punch',
  'glitch',
  'click-mouse', 'click-double',
  'typing-key', 'typing-short', 'typing-long',
  'ding-double',
  'whoosh-pass', 'page-turn', 'pop-punchy', 'pop-bloop', 'riser-hit',
  'marker-swipe', 'marker-circle',
  'tap',
];

// Ids the pack dropped. They stay out of it for good: a project saved
// while they shipped still names them, so a new sound under one of them
// would play in place of the one that project chose.
const RETIRED_IDS = [
  'swoosh-up', 'swoosh-down', 'ding-soft',
  'pop-pluck', 'click-tap', 'click-tick', 'click-switch', 'click-shutter',
];

const catalog = new StaticFileBuiltinSoundCatalog(BUILTIN_SOUND_PACK, BASE_URL);

function publicPathOf(url: string): string {
  return resolve(PUBLIC_DIR, url.slice(BASE_URL.length));
}

async function decodedLengthSec(path: string): Promise<number> {
  const input = new Input({ source: new BufferSource(await readFile(path)), formats: [OGG] });
  try {
    return await input.computeDuration();
  } finally {
    input.dispose();
  }
}

describe('the built-in sound pack', () => {
  it('still carries every id it ever shipped', () => {
    for (const id of SHIPPED_IDS) expect(catalog.find(id)?.id, id).toBe(id);
  });

  it('never brings back a retired id', () => {
    for (const id of RETIRED_IDS) expect(catalog.find(id), id).toBeNull();
  });

  it('carries nothing a shipped list does not name', () => {
    expect(new Set(catalog.list().map((sound) => sound.id))).toEqual(new Set(SHIPPED_IDS));
  });

  it('names every sound once', () => {
    const ids = catalog.list().map((sound) => sound.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('refuses two sounds under one id', () => {
    const [first] = BUILTIN_SOUND_PACK;
    expect(() => new StaticFileBuiltinSoundCatalog([first!, { ...first!, name: 'Other' }], BASE_URL)).toThrow();
  });

  it('lists sounds grouped by category, in the order categories are offered', () => {
    const order = catalog.list().map((sound) => BUILTIN_SOUND_CATEGORIES.indexOf(sound.category));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(catalog.list().map((sound) => sound.category))).toEqual(new Set(BUILTIN_SOUND_CATEGORIES));
  });

  it('answers null for a sound it does not carry', () => {
    expect(catalog.find('not-a-sound')).toBeNull();
  });

  it('serves each sound under the path the app is served at', () => {
    expect(catalog.find('click')?.url).toBe('/app/sounds/click.ogg');
  });

  it('has a file for every sound, and no file it does not list', async () => {
    const files = (await readdir(resolve(PUBLIC_DIR, 'sounds'))).filter((file) => file.endsWith('.ogg'));
    expect(files.sort()).toEqual(catalog.list().map((sound) => publicPathOf(sound.url).split('/').pop()).sort());
  });

  it('states the length a decoder reads from each file', async () => {
    for (const sound of catalog.list()) {
      const length = await decodedLengthSec(publicPathOf(sound.url));
      expect(Math.abs(length - sound.lengthSec), sound.id).toBeLessThan(0.001);
    }
  });

  it('carries the licence of its files beside them', async () => {
    const attribution = await readFile(resolve(PUBLIC_DIR, 'sounds/ATTRIBUTION.md'), 'utf8');
    for (const sound of catalog.list()) expect(attribution, sound.id).toContain(`\`${sound.id}.ogg\``);
  });
});
