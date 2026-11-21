import { RenderTimeMap, type Document, type Segment } from '@tscaps/engine';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { OutputLengths } from '@core/shots/domain/OutputLengths';
import type { ShotLengthBudget } from '@core/shots/domain/ShotLengthBudget';
import {
  ShotBoundaryFinder,
  type PlacedSegment,
  type ShotBoundaryCandidate,
} from '@core/shots/services/ShotBoundaryFinder';
import type { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';

/** Narrows one kind of boundary to the ones worth considering. */
type Narrowing = (candidates: ReadonlyArray<ShotBoundaryCandidate>) => ReadonlyArray<ShotBoundaryCandidate>;

/**
 * Proposes where the video should be cut into shots: grow until a shot
 * has run as long as one may, then cut at the best boundary the window
 * offers, and place the cut inside that boundary's silence. Returns the
 * opening time of each shot, the first being zero.
 *
 * `pictureChangesSec` are the times the source's own picture changes
 * abruptly, ascending; empty where nobody looked, which leaves every
 * other signal as it was.
 *
 * The proposal is of the video as it plays once `cuts` collapse: words
 * cut away whole are not there to cut between, and every length — a
 * shot's against the budget, what is left of the video — is measured
 * in output time, so a stretch cut away never fills a shot. Where a
 * cut takes out the silence between two segments the picture jumps
 * there as if the video were edited, and that counts as a picture
 * change: a shot opening on it hides the jump.
 *
 * Boundaries are ranked by kind rather than weighted. The ladder, why
 * it is an order and not a sum, and which rungs a local project
 * reaches, are in `features/shots.md`.
 */
export class ShotPartitioner {
  constructor(
    private readonly boundaryFinder: ShotBoundaryFinder,
    private readonly openingPlacer: ShotOpeningPlacer,
    private readonly cutAwareDocuments: CutAwareDocumentBuilder,
  ) {}

  propose(
    document: Document | null,
    videoDurationSec: number,
    sheets: ReadonlyArray<Sheet>,
    budget: ShotLengthBudget,
    pictureChangesSec: ReadonlyArray<number>,
    cuts: CutRegistry,
  ): number[] {
    if (!document || videoDurationSec <= 0) return [];
    const segments = this.segmentsInTimeOrder(this.cutAwareDocuments.build(document, cuts));
    if (segments.length === 0) return [];

    const timeMap = new RenderTimeMap(cuts.list());
    const output = new OutputLengths(timeMap, timeMap.toOutputTime(videoDurationSec));
    const candidates = this.boundaryFinder.find(segments, sheets, this.withJumpCuts(pictureChangesSec, cuts));
    const openings: number[] = [0];
    let start = 0;
    let startSec = 0;
    while (start < segments.length) {
      const cut = this.pickCut(candidates, start, startSec, output, budget);
      if (!cut) break;
      // An opening that lands inside a cut opens the same moment of the output where the cut ends: there its first frame plays.
      openings.push(cuts.nextUncutTime(this.openingPlacer.place(cut)));
      start = cut.index;
      startSec = cut.timeSec;
    }
    return openings;
  }

  private pickCut(
    candidates: ReadonlyArray<ShotBoundaryCandidate>,
    start: number,
    startSec: number,
    output: OutputLengths,
    budget: ShotLengthBudget,
  ): ShotBoundaryCandidate | null {
    const reachable = candidates.filter((candidate) => candidate.index > start);
    if (reachable.length === 0) return null;

    const lengthTo = (candidate: ShotBoundaryCandidate) => output.between(startSec, candidate.timeSec);
    const withinBudget = reachable.filter((candidate) => lengthTo(candidate) <= budget.maxSec);
    const roleChange = withinBudget.find((candidate) => candidate.isRoleChange);
    if (roleChange) return roleChange;

    const eligible = reachable.filter((candidate) => lengthTo(candidate) >= budget.minSec);
    if (eligible.length === 0) return null;

    const inBudget = eligible.filter((candidate) => lengthTo(candidate) <= budget.maxSec);
    // Past the budget with nowhere legal to have cut: the first place
    // that clears the floor wins, however late it is. The alternative
    // is one shot holding the rest of the video.
    if (inBudget.length === 0) return eligible[0]!;

    return this.bestOf(inBudget, (set) => this.leavingRoom(set, output, budget.minSec));
  }

  /**
   * A boundary where the source's picture already changes outranks
   * every kind the transcript offers: whoever edited the video said
   * there that the picture moves on. Among several, the transcript's
   * own ladder decides.
   */
  private bestOf(candidates: ReadonlyArray<ShotBoundaryCandidate>, narrow: Narrowing): ShotBoundaryCandidate {
    const pictureChanges = candidates.filter((candidate) => candidate.pictureChangeSec !== null);
    if (pictureChanges.length > 0) return this.bestSaidOf(pictureChanges, narrow);
    return this.bestSaidOf(candidates, narrow);
  }

  private bestSaidOf(candidates: ReadonlyArray<ShotBoundaryCandidate>, narrow: Narrowing): ShotBoundaryCandidate {
    const sentenceEnds = candidates.filter((candidate) => candidate.closes === 'sentence');
    if (sentenceEnds.length > 0) return this.bestScoredOrWidest(narrow(sentenceEnds));
    const scored = candidates.filter((candidate) => candidate.boundaryScore !== null);
    if (scored.length > 0) return this.strongestSentenceEnd(narrow(scored));
    const clauseEnds = candidates.filter((candidate) => candidate.closes === 'clause');
    if (clauseEnds.length > 0) return this.bestScoredOrWidest(narrow(clauseEnds));
    return this.longestGap(narrow(candidates));
  }

  /**
   * The boundaries of one kind leaving enough video behind to be a
   * shot, or the ones leaving the most where none of them does. A
   * short tail never costs a better kind of boundary.
   */
  private leavingRoom(
    candidates: ReadonlyArray<ShotBoundaryCandidate>,
    output: OutputLengths,
    minSec: number,
  ): ReadonlyArray<ShotBoundaryCandidate> {
    const roomy = candidates.filter((candidate) => output.after(candidate.timeSec) >= minSec);
    if (roomy.length > 0) return roomy;
    const most = Math.max(...candidates.map((candidate) => output.after(candidate.timeSec)));
    return candidates.filter((candidate) => output.after(candidate.timeSec) === most);
  }

  /** `pictureChangesSec` with where each cut ends added, ascending: where the output jumps, as an edit does. */
  private withJumpCuts(pictureChangesSec: ReadonlyArray<number>, cuts: CutRegistry): number[] {
    return [...pictureChangesSec, ...cuts.list().map((cut) => cut.endSec)].sort((first, second) => first - second);
  }

  private bestScoredOrWidest(candidates: ReadonlyArray<ShotBoundaryCandidate>): ShotBoundaryCandidate {
    const scored = candidates.filter((candidate) => candidate.boundaryScore !== null);
    return scored.length > 0 ? this.strongestSentenceEnd(scored) : this.longestGap(candidates);
  }

  private longestGap(candidates: ReadonlyArray<ShotBoundaryCandidate>): ShotBoundaryCandidate {
    return candidates.reduce((best, candidate) => (candidate.gapSec >= best.gapSec ? candidate : best));
  }

  private strongestSentenceEnd(candidates: ReadonlyArray<ShotBoundaryCandidate>): ShotBoundaryCandidate {
    return candidates.reduce((best, candidate) => (candidate.boundaryScore! >= best.boundaryScore! ? candidate : best));
  }

  private segmentsInTimeOrder(document: Document): PlacedSegment[] {
    return document.sections
      .flatMap((section) => section.segments.map((segment: Segment) => ({ segment, sheetId: section.kind })))
      .sort((a, b) => a.segment.wordTime.start - b.segment.wordTime.start);
  }
}
