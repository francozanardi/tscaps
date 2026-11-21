/** How firmly a word's own punctuation closes what came before it. */
export type SentenceBoundary = 'sentence' | 'clause';

const CLOSERS = new Set(['"', '“', '”', "'", '‘', '’', ')', ']', '}', '»', '›']);

const SENTENCE_MARKS = new Set(['.', '!', '?', '…', '。', '！', '？', '۔', '؟', '।']);

const CLAUSE_MARKS = new Set([',', ';', ':', '—', '–', '，', '、', '；', '：', '،']);

/**
 * Reads a word's trailing punctuation and says what it closes. Coarser
 * than a sentence model, and free wherever the transcription ran.
 *
 * Takes `text`, never `displayText`: hiding punctuation on screen is
 * not a request to cut the video differently.
 */
export class SentenceBoundaryClassifier {
  classify(text: string): SentenceBoundary | null {
    const characters = [...text];
    let index = characters.length - 1;
    while (index >= 0 && CLOSERS.has(characters[index]!)) index -= 1;
    const last = index >= 0 ? characters[index]! : null;
    if (last === null) return null;
    if (SENTENCE_MARKS.has(last)) return 'sentence';
    if (CLAUSE_MARKS.has(last)) return 'clause';
    return null;
  }
}
