/** Packs codes of varying width into bytes, least significant bit first. */
export class FixtureBitWriter {
  private readonly written: number[] = [];
  private buffer = 0;
  private count = 0;

  write(code: number, width: number): void {
    this.buffer |= code << this.count;
    this.count += width;
    while (this.count >= 8) {
      this.written.push(this.buffer & 0xff);
      this.buffer >>>= 8;
      this.count -= 8;
    }
  }

  bytes(): number[] {
    return this.count > 0 ? [...this.written, this.buffer & 0xff] : [...this.written];
  }
}
