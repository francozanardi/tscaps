export class TimeFragment {
  constructor(
    readonly start: number,
    readonly end: number,
  ) {}

  // Interval is half-open: [start, end).
  // A word "contains" the current time only while start <= t < end.
  // This ensures that at the exact shared boundary between two adjacent words
  // (wordA.end === wordB.start), wordA is already ALREADY_NARRATED and wordB
  // becomes BEING_NARRATED — never both at once.
  contains(time: number): boolean {
    return time >= this.start && time < this.end;
  }

  isAfter(time: number): boolean {
    return time < this.start;
  }

  isBefore(time: number): boolean {
    return time >= this.end;
  }

  get duration(): number {
    return this.end - this.start;
  }

  get midpoint(): number {
    return (this.start + this.end) / 2;
  }
}
