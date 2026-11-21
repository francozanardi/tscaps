import { describe, expect, it } from 'vitest';
import type { ExportWriter } from '@core/export/domain/ExportWriter';
import type { ExportWriterFactory } from '@core/export/domain/ExportWriterFactory';
import { RedirectableExportWriterFactory } from '@core/export/services/RedirectableExportWriterFactory';

/** A factory whose writers say which factory built them. */
class NamedWriterFactory implements ExportWriterFactory {
  constructor(private readonly name: string) {}

  create(): ExportWriter {
    return { name: this.name } as unknown as ExportWriter;
  }
}

const nameOf = (writer: ExportWriter): string => (writer as unknown as { name: string }).name;

describe('RedirectableExportWriterFactory', () => {
  it('builds from the redirection while a run lasts, and from the usual factory before and after', async () => {
    const factory = new RedirectableExportWriterFactory(new NamedWriterFactory('usual'));

    const during = await factory.redirectWhile(new NamedWriterFactory('channel'), async () => nameOf(factory.create()));

    expect(during).toBe('channel');
    expect(nameOf(factory.create())).toBe('usual');
  });

  it('goes back to the usual factory when the run fails', async () => {
    const factory = new RedirectableExportWriterFactory(new NamedWriterFactory('usual'));

    await expect(factory.redirectWhile(new NamedWriterFactory('channel'), async () => { throw new Error('export failed'); })).rejects.toThrow('export failed');

    expect(nameOf(factory.create())).toBe('usual');
  });

  it('runs a second redirection only after the first has ended', async () => {
    const factory = new RedirectableExportWriterFactory(new NamedWriterFactory('usual'));
    let releaseFirst = (): void => undefined;
    const first = factory.redirectWhile(new NamedWriterFactory('first'), async () => {
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
      return nameOf(factory.create());
    });
    const second = factory.redirectWhile(new NamedWriterFactory('second'), async () => nameOf(factory.create()));

    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseFirst();

    expect(await first).toBe('first');
    expect(await second).toBe('second');
  });
});
