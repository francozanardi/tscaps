interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
}

/**
 * Tracks in-flight request/response pairs against a Worker. Callers
 * register a request by ID and receive a promise; when the worker
 * replies, the tracker resolves the matching promise and forgets the
 * entry. Unmatched IDs or duplicate registrations throw immediately.
 */
export class PendingWorkerRequests {
  private readonly entries = new Map<number, PendingRequest>();
  private nextId = 0;

  reserveId(): number {
    return this.nextId++;
  }

  register<T>(requestId: number): Promise<T> {
    if (this.entries.has(requestId)) {
      throw new Error(`Duplicate person-segmenter worker request id: ${requestId}`);
    }
    return new Promise<T>((resolve, reject) => {
      this.entries.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });
  }

  resolve(requestId: number, value: unknown): void {
    const entry = this.entries.get(requestId);
    if (entry === undefined) return;
    this.entries.delete(requestId);
    entry.resolve(value);
  }

  reject(requestId: number, error: Error): void {
    const entry = this.entries.get(requestId);
    if (entry === undefined) return;
    this.entries.delete(requestId);
    entry.reject(error);
  }

  rejectAll(error: Error): void {
    for (const entry of this.entries.values()) entry.reject(error);
    this.entries.clear();
  }
}
