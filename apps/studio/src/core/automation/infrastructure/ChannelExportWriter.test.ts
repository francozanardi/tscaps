import { describe, expect, it } from 'vitest';
import type { RenderOutputChunk } from '@tscaps/engine';
import { ChannelExportWriter } from '@core/automation/infrastructure/ChannelExportWriter';
import { InMemoryAutomationChannel } from '@core/automation/testing/InMemoryAutomationChannel';

function chunk(position: number, values: ReadonlyArray<number>): RenderOutputChunk {
  return { type: 'write', position, data: Uint8Array.from(values) };
}

async function writeAll(writer: ChannelExportWriter, chunks: ReadonlyArray<RenderOutputChunk>): Promise<void> {
  await writer.open('mp4');
  const stream = writer.stream().getWriter();
  for (const each of chunks) await stream.write(each);
  await stream.close();
}

describe('ChannelExportWriter', () => {
  it('rebuilds the file the renderer wrote, including a piece written back at the start', async () => {
    const channel = new InMemoryAutomationChannel();
    const writer = new ChannelExportWriter(channel, 'out');

    // A muxer writes the body in order, then goes back to fill in the header.
    await writeAll(writer, [chunk(0, [0, 0, 0, 0]), chunk(4, [5, 6]), chunk(6, [7, 8, 9]), chunk(0, [1, 2, 3, 4])]);

    expect(await writer.finalize()).toBeNull();
    expect([...channel.file('out')]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(writer.outcome()).toEqual({ kind: 'written', bytes: 9 });
  });

  it('sends pieces that follow on from each other together', async () => {
    const channel = new InMemoryAutomationChannel();
    const writer = new ChannelExportWriter(channel, 'out');

    await writeAll(writer, [chunk(0, [1]), chunk(1, [2]), chunk(2, [3])]);
    await writer.finalize();

    expect(channel.writes).toEqual([{ fileId: 'out', position: 0, length: 3 }]);
  });

  it('keeps its own copy of each piece, since the renderer may reuse its buffer', async () => {
    const channel = new InMemoryAutomationChannel();
    const writer = new ChannelExportWriter(channel, 'out');
    await writer.open('mp4');
    const stream = writer.stream().getWriter();
    const reused = Uint8Array.from([1, 2]);

    await stream.write({ type: 'write', position: 0, data: reused });
    reused.set([9, 9]);
    await stream.write({ type: 'write', position: 2, data: reused });
    await stream.close();
    await writer.finalize();

    expect([...channel.file('out')]).toEqual([1, 2, 9, 9]);
  });

  it('says an export that was aborted did not finish, and one never opened did not start', async () => {
    const channel = new InMemoryAutomationChannel();
    const aborted = new ChannelExportWriter(channel, 'a');
    await writeAll(aborted, [chunk(0, [1])]);
    await aborted.abort();

    expect(aborted.outcome()).toEqual({ kind: 'aborted' });
    expect(new ChannelExportWriter(channel, 'b').outcome()).toEqual({ kind: 'not-started' });
  });
});
