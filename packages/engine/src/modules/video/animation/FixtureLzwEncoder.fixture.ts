import { FixtureBitWriter } from '@modules/video/animation/FixtureBitWriter.fixture';

const MAX_CODE_BITS = 12;
const TABLE_SIZE = 1 << MAX_CODE_BITS;

/**
 * GIF's LZW, the encoding side, for fixtures: codes grow as the table
 * fills, and a clear code is written when the table is full (or not,
 * `fullTable: 'keep'`) and after every `clearEvery` codes.
 *
 * The widths it writes follow the decoder's view of the table, which
 * trails the encoder's by one entry — the reason the format's width
 * changes are easy to get wrong, and why this encoder tracks that view
 * rather than its own.
 */
export class FixtureLzwEncoder {
  private readonly clearCode: number;
  private readonly endCode: number;
  private readonly out = new FixtureBitWriter();
  private readonly table = new Map<number, number>();
  private encoderNext = 0;
  private decoderNext = 0;
  private decoderWidth: number;
  private firstAfterClear = true;
  private codesSinceClear = 0;

  constructor(
    private readonly minCodeSize: number,
    private readonly fullTable: 'clear' | 'keep',
    private readonly clearEvery: number,
  ) {
    this.clearCode = 1 << minCodeSize;
    this.endCode = this.clearCode + 1;
    this.decoderWidth = minCodeSize + 1;
  }

  /** The LZW data for `indices`, as bytes ready to be cut into sub-blocks. */
  encode(indices: ReadonlyArray<number>): number[] {
    this.clear();
    let prefix = indices[0]!;
    for (const index of indices.slice(1)) {
      const key = (prefix << 8) | index;
      const known = this.table.get(key);
      if (known !== undefined) {
        prefix = known;
        continue;
      }
      this.emit(prefix);
      prefix = index;
      if (this.encoderNext < TABLE_SIZE) this.table.set(key, this.encoderNext++);
      if ((this.encoderNext === TABLE_SIZE && this.fullTable === 'clear') || this.codesSinceClear >= this.clearEvery) this.clear();
    }
    this.emit(prefix);
    this.out.write(this.endCode, this.decoderWidth);
    return this.out.bytes();
  }

  private emit(code: number): void {
    this.out.write(code, this.decoderWidth);
    this.codesSinceClear++;
    if (!this.firstAfterClear && this.decoderNext < TABLE_SIZE) {
      this.decoderNext++;
      if (this.decoderNext === 1 << this.decoderWidth && this.decoderWidth < MAX_CODE_BITS) this.decoderWidth++;
    }
    this.firstAfterClear = false;
  }

  private clear(): void {
    this.out.write(this.clearCode, this.decoderWidth);
    this.table.clear();
    this.encoderNext = this.endCode + 1;
    this.decoderNext = this.endCode + 1;
    this.decoderWidth = this.minCodeSize + 1;
    this.firstAfterClear = true;
    this.codesSinceClear = 0;
  }
}
