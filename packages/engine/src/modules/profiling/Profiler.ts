/**
 * A method-level profiler that records call count, timing distribution, and
 * (optionally) heap delta per method, without requiring the instrumented
 * classes to be modified.
 *
 * Three ways to attach it, from least to most invasive:
 *
 *  - {@link wrap}: takes an instance, returns a `Proxy` that times every method
 *    call. The original instance is untouched and unaware. Best for ad-hoc
 *    instrumentation at the composition root.
 *  - {@link wrapClass}: mutates the class prototype so every existing and
 *    future instance is instrumented. Reversible via {@link restoreClass}.
 *  - {@link wrapNamespace}: takes a module namespace import and mutates the
 *    prototype of every class found in it. The fastest way to blanket-cover
 *    a whole module without touching its sources.
 *
 * Methods defined as arrow-function class fields are NOT visible via the
 * prototype and will be missed by {@link wrapClass} / {@link wrapNamespace};
 * use {@link wrap} on those instances.
 *
 * Memory measurement uses `performance.memory.usedJSHeapSize` (Chrome only)
 * and is best paired with `--js-flags="--expose-gc"` plus a manual `gc()`
 * call before the run; without that, deltas include GC noise.
 */
type AnyFn = (...args: unknown[]) => unknown;
type AnyCtor = abstract new (...args: never[]) => unknown;

export class Profiler {
  /**
   * Master switch. While `false`, {@link record} and {@link time} are no-ops
   * (timing source is not even read), so manual `profiler.time(...)` calls
   * can be left in production code at zero cost. The various `wrap` methods
   * flip this to `true` automatically.
   */
  enabled = false;
  /** Sample `performance.memory.usedJSHeapSize` around each call. Chrome-only. */
  measureMemory: boolean;

  private readonly samples = new Map<string, number[]>();
  private readonly memDeltas = new Map<string, number>();
  private readonly memSamples = new Map<string, number>();
  private readonly originals = new WeakMap<object, Map<string, PropertyDescriptor>>();
  private readonly warnOverMs: number;
  private readonly maxSamplesPerLabel: number;

  constructor(opts: ProfilerOptions = {}) {
    this.measureMemory = opts.measureMemory ?? false;
    this.warnOverMs = opts.warnOverMs ?? Infinity;
    this.maxSamplesPerLabel = opts.maxSamplesPerLabel ?? 10000;
  }

  /**
   * Wraps `target` in a `Proxy` that times every method call. The returned
   * value is a stand-in for `target`: pass it where you would have passed
   * the original. The original instance keeps working unchanged.
   */
  wrap<T extends object>(target: T, opts: WrapOptions = {}): T {
    this.enabled = true;
    const className = opts.name ?? target.constructor?.name ?? 'anonymous';
    const include = toPredicate(opts.include);
    const exclude = toPredicate(opts.exclude);
    const wrapped = new Map<string, AnyFn>();

    const get = (obj: T, prop: string | symbol, receiver: unknown): unknown => {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof prop !== 'string' || typeof value !== 'function' || prop === 'constructor') {
        return value;
      }
      const fn = value as AnyFn;
      if (include && !include(prop)) return fn.bind(obj);
      if (exclude && exclude(prop)) return fn.bind(obj);

      let cached = wrapped.get(prop);
      if (!cached) {
        const label = `${className}.${prop}`;
        cached = this.wrapMethod(fn.bind(obj) as AnyFn, label);
        wrapped.set(prop, cached);
      }
      return cached;
    };

    return new Proxy(target, { get });
  }

  /**
   * Replaces every method on `Klass.prototype` with a timed version. All
   * instances — past and future — pick up the instrumentation, because the
   * prototype lookup is dynamic. Use {@link restoreClass} to undo.
   */
  wrapClass(Klass: AnyCtor, opts: WrapOptions = {}): void {
    this.enabled = true;
    const proto = (Klass as { prototype?: object }).prototype;
    if (!proto) return;
    const className = opts.name ?? Klass.name ?? 'anonymous';
    const include = toPredicate(opts.include);
    const exclude = toPredicate(opts.exclude);

    let saved = this.originals.get(proto);
    if (!saved) {
      saved = new Map();
      this.originals.set(proto, saved);
    }

    const chain: object[] = [proto];
    if (opts.includeInherited) {
      let p = Object.getPrototypeOf(proto);
      while (p && p !== Object.prototype) {
        chain.push(p);
        p = Object.getPrototypeOf(p);
      }
    }

    for (const target of chain) {
      for (const key of Object.getOwnPropertyNames(target)) {
        if (key === 'constructor') continue;
        if (include && !include(key)) continue;
        if (exclude && exclude(key)) continue;

        const descriptor = Object.getOwnPropertyDescriptor(target, key);
        if (!descriptor || typeof descriptor.value !== 'function') continue;
        if (saved.has(key)) continue;

        saved.set(key, descriptor);
        const original = descriptor.value as AnyFn;
        const label = `${className}.${key}`;
        const wrappedFn = this.wrapMethod(original, label);
        Object.defineProperty(target, key, {
          ...descriptor,
          value: wrappedFn,
        });
      }
    }
  }

  /**
   * Restores a class previously instrumented via {@link wrapClass} to its
   * original prototype methods.
   */
  restoreClass(Klass: AnyCtor): void {
    const proto = (Klass as { prototype?: object }).prototype;
    if (!proto) return;
    const saved = this.originals.get(proto);
    if (!saved) return;
    for (const [key, descriptor] of saved) {
      Object.defineProperty(proto, key, descriptor);
    }
    this.originals.delete(proto);
  }

  /**
   * Wraps every class exported by a module namespace (`import * as M from '...'`).
   * Returns the list of class names that were instrumented, for quick sanity
   * checks. The namespace object itself is not mutated — only the prototypes
   * of the classes it references.
   */
  wrapNamespace(ns: Record<string, unknown>, opts: NamespaceWrapOptions = {}): string[] {
    const classFilter = toPredicate(opts.classFilter);
    const touched: string[] = [];
    for (const key of Object.keys(ns)) {
      const value = ns[key];
      if (!isClass(value)) continue;
      if (classFilter && !classFilter(key)) continue;
      this.wrapClass(value, { ...opts, name: opts.name ?? key });
      touched.push(key);
    }
    return touched;
  }

  /** Times an arbitrary function — sync or async. Escape hatch for non-method code. */
  time<T>(label: string, fn: () => T): T {
    if (!this.enabled) return fn();
    const start = performance.now();
    const startMem = this.startMem();
    try {
      const result = fn();
      if (isPromiseLike(result)) {
        return Promise.resolve(result).finally(() => {
          this.record(label, performance.now() - start, this.endMem(startMem));
        }) as T;
      }
      this.record(label, performance.now() - start, this.endMem(startMem));
      return result;
    } catch (e) {
      this.record(label, performance.now() - start, this.endMem(startMem));
      throw e;
    }
  }

  /** Records a manual measurement. Useful for instrumenting points that aren't whole methods. */
  record(label: string, durationMs: number, deltaBytes: number | null = null): void {
    if (!this.enabled) return;
    let arr = this.samples.get(label);
    if (!arr) {
      arr = [];
      this.samples.set(label, arr);
    }
    if (arr.length < this.maxSamplesPerLabel) arr.push(durationMs);

    if (deltaBytes !== null && this.measureMemory) {
      this.memDeltas.set(label, (this.memDeltas.get(label) ?? 0) + deltaBytes);
      this.memSamples.set(label, (this.memSamples.get(label) ?? 0) + 1);
    }

    if (durationMs >= this.warnOverMs) {
      console.warn(`[profiler] slow call: ${label} took ${durationMs.toFixed(2)}ms`);
    }
  }

  /** Builds an aggregated report from the samples collected so far. */
  report(): ProfilerReport {
    const stats: MethodStat[] = [];
    let totalCalls = 0;
    let totalMs = 0;

    for (const [label, samples] of this.samples) {
      if (samples.length === 0) continue;
      const sorted = [...samples].sort((a, b) => a - b);
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      const memTotal = this.memDeltas.get(label);

      stats.push({
        label,
        count: sorted.length,
        totalMs: sum,
        meanMs: sum / sorted.length,
        minMs: sorted[0]!,
        maxMs: sorted[sorted.length - 1]!,
        p50Ms: percentile(sorted, 0.5),
        p95Ms: percentile(sorted, 0.95),
        p99Ms: percentile(sorted, 0.99),
        totalDeltaBytes: memTotal ?? null,
      });

      totalCalls += sorted.length;
      totalMs += sum;
    }

    return { stats, totalCalls, totalMs };
  }

  /** Pretty-prints the report as a sortable `console.table`. */
  printReport(opts: PrintOptions = {}): void {
    const report = this.report();
    const sortBy = opts.sortBy ?? 'totalMs';
    const top = opts.top ?? report.stats.length;

    const sorted = [...report.stats].sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));
    const rows = sorted.slice(0, top).map((s) => ({
      label: s.label,
      count: s.count,
      totalMs: round(s.totalMs),
      meanMs: round(s.meanMs),
      p50: round(s.p50Ms),
      p95: round(s.p95Ms),
      p99: round(s.p99Ms),
      maxMs: round(s.maxMs),
      memMB: s.totalDeltaBytes !== null ? round(s.totalDeltaBytes / 1024 / 1024) : '—',
    }));

    console.groupCollapsed(`[profiler] ${report.totalCalls} calls, ${round(report.totalMs)}ms total`);
    console.table(rows);
    console.groupEnd();
  }

  reset(): void {
    this.samples.clear();
    this.memDeltas.clear();
    this.memSamples.clear();
  }

  /**
   * Returns the V8 JS heap size in bytes (Chrome only). Note: this is the JS
   * isolate's used heap only — it excludes WebCodecs buffers, decoded bitmap
   * caches, and other native memory held by the renderer process.
   *
   * When the runtime was started with `--js-flags="--expose-gc"`, this forces
   * a synchronous full GC before reading so what's left is the actually-retained
   * portion. Without that flag, returns the heap as-is.
   */
  snapshotHeap(): number | null {
    const w = globalThis as { gc?: () => void };
    w.gc?.();
    return readHeapBytes();
  }

  private wrapMethod(fn: AnyFn, label: string): AnyFn {
    const record = (durationMs: number, delta: number | null) => this.record(label, durationMs, delta);
    const startMem = () => this.startMem();
    const endMem = (start: number | null) => this.endMem(start);
    return function wrappedMethod(this: unknown, ...args: unknown[]) {
      const start = performance.now();
      const mStart = startMem();
      try {
        const result = fn.apply(this, args);
        if (isPromiseLike(result)) {
          return Promise.resolve(result).finally(() => {
            record(performance.now() - start, endMem(mStart));
          });
        }
        record(performance.now() - start, endMem(mStart));
        return result;
      } catch (e) {
        record(performance.now() - start, endMem(mStart));
        throw e;
      }
    };
  }

  private startMem(): number | null {
    if (!this.measureMemory) return null;
    return readHeapBytes();
  }

  private endMem(start: number | null): number | null {
    if (start === null) return null;
    const end = readHeapBytes();
    return end === null ? null : end - start;
  }
}

export interface ProfilerOptions {
  /** Sample `performance.memory.usedJSHeapSize` around each call. Chrome-only, noisy without `--expose-gc`. */
  measureMemory?: boolean;
  /** Log a console warning when a single call exceeds this duration. */
  warnOverMs?: number;
  /** Keep at most this many duration samples per label, to bound memory of the profiler itself. */
  maxSamplesPerLabel?: number;
}

export interface WrapOptions {
  /** Label prefix used in the report. Defaults to the class or constructor name. */
  name?: string;
  /** Only instrument method names matching the regex / predicate. */
  include?: RegExp | ((methodName: string) => boolean);
  /** Skip method names matching the regex / predicate. Evaluated after `include`. */
  exclude?: RegExp | ((methodName: string) => boolean);
  /** Walk the prototype chain past `Klass.prototype` and instrument inherited methods too. */
  includeInherited?: boolean;
}

export interface NamespaceWrapOptions extends WrapOptions {
  /** Restrict which exported names to treat as instrumentable classes. */
  classFilter?: RegExp | ((className: string) => boolean);
}

export interface MethodStat {
  label: string;
  count: number;
  totalMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  /** Sum over all calls of (heapAfter - heapBefore). `null` when memory measurement is off or unavailable. */
  totalDeltaBytes: number | null;
}

export interface ProfilerReport {
  stats: MethodStat[];
  totalCalls: number;
  totalMs: number;
}

export interface PrintOptions {
  /** Column to sort rows by, descending. Defaults to `totalMs`. */
  sortBy?: 'totalMs' | 'meanMs' | 'count' | 'maxMs' | 'p95Ms' | 'p99Ms';
  /** Show only the first N rows after sorting. */
  top?: number;
}

function toPredicate(filter: RegExp | ((s: string) => boolean) | undefined): ((s: string) => boolean) | null {
  if (!filter) return null;
  if (filter instanceof RegExp) return (s) => filter.test(s);
  return filter;
}

function isClass(value: unknown): value is AnyCtor {
  if (typeof value !== 'function') return false;
  const candidate = value as { prototype?: object; name?: string };
  if (!candidate.prototype) return false;
  const name = candidate.name;
  return !!name && /^[A-Z]/.test(name);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return !!value && typeof (value as { then?: unknown }).then === 'function';
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[idx]!;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function readHeapBytes(): number | null {
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
  return perf.memory ? perf.memory.usedJSHeapSize : null;
}

/** Default instance — share across modules to aggregate a single report. */
export const profiler = new Profiler();
