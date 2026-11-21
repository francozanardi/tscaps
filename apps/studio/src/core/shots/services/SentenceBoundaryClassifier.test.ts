import { describe, expect, it } from 'vitest';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';

/**
 * What a word's own punctuation closes — the signal every
 * transcription carries, whichever surface produced it.
 */

const classifier = new SentenceBoundaryClassifier();

describe('SentenceBoundaryClassifier', () => {
  it('reads the marks that end a sentence', () => {
    for (const text of ['done.', 'really?', 'stop!', 'well…', 'そうです。', 'لماذا؟']) {
      expect(classifier.classify(text)).toBe('sentence');
    }
  });

  it('reads the marks that end a clause', () => {
    for (const text of ['first,', 'so;', 'this:', 'wait—']) {
      expect(classifier.classify(text)).toBe('clause');
    }
  });

  it('reaches past a closing quote or bracket', () => {
    expect(classifier.classify('"enough."')).toBe('sentence');
    expect(classifier.classify('(later),')).toBe('clause');
  });

  it('says nothing about a word that closes nothing', () => {
    // Punctuation inside a word is not a boundary: a domain and a
    // clock time end in characters that mean nothing here.
    for (const text of ['plain', 'google.com', '15:30', "rockin'"]) {
      expect(classifier.classify(text)).toBeNull();
    }
  });

  it('says nothing about an empty word', () => {
    expect(classifier.classify('')).toBeNull();
    expect(classifier.classify('""')).toBeNull();
  });
});
