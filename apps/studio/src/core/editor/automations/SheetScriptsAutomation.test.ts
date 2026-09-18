import { describe, expect, it } from 'vitest';
import { Document, Section, Segment, Line, Word, TimeFragment } from '@tscaps/engine';
import { SheetScriptsAutomation } from '@core/editor/automations/SheetScriptsAutomation';
import { EditorStore } from '@core/editor/store/EditorStore';
import { Sheet, type SheetProps } from '@core/sheets/domain/Sheet';
import { SheetScriptsSynchronizer } from '@core/sheets/services/SheetScriptsSynchronizer';
import { SheetCaptionTextCollector } from '@core/sheets/services/SheetCaptionTextCollector';
import { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';

function transcript(text: string): Document {
  return new Document({ sections: [new Section({ kind: 'main', segments: [new Segment({
    lines: [new Line({ words: [new Word({ text, time: new TimeFragment(0, 1) })] })],
  })] })] });
}

function editor() {
  const store = new EditorStore();
  store.patch({ sheets: [new Sheet({ id: 'main' } as SheetProps)], document: transcript('مرحبا بالعالم') });
  const automation = new SheetScriptsAutomation(store,
    new SheetScriptsSynchronizer(new FontScriptClassifier(), new SheetCaptionTextCollector()));
  automation.start();
  return { store, automation };
}

describe('font scripts after transcript edits without a reflow', () => {
  it('adds and removes Latin alongside Arabic, including undo and redo', () => {
    const { store, automation } = editor();
    expect(store.snapshot().sheets[0]!.scripts.present).toEqual(new Set(['arabic']));
    store.commit();
    const mixed = transcript('مرحبا بالعالم hey');
    store.patch({ document: mixed });
    expect(store.snapshot().document).toBe(mixed);
    expect(store.snapshot().sheets[0]!.scripts.present).toEqual(new Set(['arabic', 'latin']));
    store.undo();
    expect(store.snapshot().sheets[0]!.scripts.present).toEqual(new Set(['arabic']));
    store.redo();
    expect(store.snapshot().sheets[0]!.scripts.present).toEqual(new Set(['arabic', 'latin']));
    store.patch({ document: transcript('مرحبا بالعالم') });
    expect(store.snapshot().sheets[0]!.scripts.present).toEqual(new Set(['arabic']));
    automation.stop();
  });

  it('keeps sheet identities while typing in the same scripts, and leaves the edited document intact', () => {
    const { store, automation } = editor();
    const sheets = store.snapshot().sheets;
    const edited = transcript('مرحبا بالعالم مرحبا');
    store.patch({ document: edited });
    expect(store.snapshot().document).toBe(edited);
    expect(store.snapshot().sheets).toBe(sheets);
    store.patch({ projectName: 'Renamed' });
    expect(store.snapshot().sheets).toBe(sheets);
    automation.stop();
  });

  it('refreshes the unsupported code points the compiled family must leave to Other', () => {
    const { store, automation } = editor();
    store.patch({ document: transcript('日本') });
    const japanese = store.snapshot().sheets[0]!.scripts;
    expect(japanese.hasOtherLetters).toBe(true);
    expect(japanese.otherLetterCodepoints).toEqual(new Set([0x65E5, 0x672C]));

    store.patch({ document: transcript('한국') });
    const korean = store.snapshot().sheets[0]!.scripts;
    expect(korean.otherLetterCodepoints).toEqual(new Set([0xD55C, 0xAD6D]));
    expect(korean).not.toBe(japanese);
    automation.stop();
  });
});
