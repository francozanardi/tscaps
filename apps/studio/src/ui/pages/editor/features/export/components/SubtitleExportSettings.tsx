import { useState } from 'react';
import type { ExportSubtitlesOptions } from '@core/export/actions/ExportSubtitlesAction';
import type { SubtitleFileFormat } from '@core/export/domain/SubtitleFileFormat';
import { Toggle } from '@ui/_shared/components/controls/fields/Toggle';
import { DisclosureSection } from '@ui/pages/editor/features/export/components/DisclosureSection';
import { ExportSettingsFooter } from '@ui/pages/editor/features/export/components/ExportSettingsFooter';
import { InfoTip } from '@ui/pages/editor/features/export/components/InfoTip';
import {
  FIELD_HINT,
  FIELD_LABEL,
  FIELD_SELECT,
} from '@ui/_shared/styles/formFields';

interface SubtitleExportSettingsProps {
  onConfirm: (options: ExportSubtitlesOptions) => void;
  onSwitchToVideo: () => void;
  onCancel: () => void;
}

/** Enough for a format that times words on its own terms. */
const NATIVE_WORD_TIMING_INFO =
  'When on, each word keeps its own timing. When off, only the caption as a whole is timed.';

interface WordTimingSupport {
  /**
   * What the switch does in this format, told on its own. A format
   * with no notion of word timing has to say what one looks like in it;
   * a format built around the idea needs a line.
   */
  readonly explanation: string;
  /** On where the format carries word timing at no real cost. */
  readonly enabledByDefault: boolean;
}

interface FormatMeta {
  readonly label: string;
  readonly hint: string;
  /** `null` when the format carries no timing for the switch to refine. */
  readonly wordTiming: WordTimingSupport | null;
}

const FORMAT_OPTIONS: Record<SubtitleFileFormat, FormatMeta> = {
  srt: {
    label: 'SubRip (.srt)',
    hint: 'The safe choice. Every player and editor reads it.',
    wordTiming: {
      explanation:
        'SubRip cannot time words inside an entry. When on, every word becomes an entry of '
        + 'its own, so the timing survives and the caption comes in word by word.',
      enabledByDefault: false,
    },
  },
  vtt: {
    label: 'WebVTT (.vtt)',
    hint: 'The web standard. Browsers and YouTube read it.',
    wordTiming: {
      explanation: NATIVE_WORD_TIMING_INFO,
      enabledByDefault: true,
    },
  },
  ass: {
    label: 'Advanced SubStation Alpha (.ass)',
    hint: 'Karaoke and fansub tooling: Aegisub, ffmpeg. Your caption design is not carried over.',
    wordTiming: {
      explanation: NATIVE_WORD_TIMING_INFO,
      enabledByDefault: true,
    },
  },
  sbv: {
    label: 'SubViewer (.sbv)',
    hint: 'What YouTube hands back when you download captions.',
    wordTiming: {
      explanation:
        'SubViewer cannot time words inside an entry. When on, every word becomes an entry of '
        + 'its own, so the timing survives and the caption comes in word by word.',
      enabledByDefault: false,
    },
  },
  txt: {
    label: 'Plain text (.txt)',
    hint: 'Just the words, no timings. For notes, an article or a translation pass.',
    wordTiming: null,
  },
};

const FORMAT_ORDER: ReadonlyArray<SubtitleFileFormat> = ['srt', 'vtt', 'ass', 'sbv', 'txt'];

/**
 * Settings for writing the captions out as a subtitle file, the errand
 * a minority of people come for.
 */
export function SubtitleExportSettings({
  onConfirm,
  onSwitchToVideo,
  onCancel,
}: SubtitleExportSettingsProps) {
  const [format, setFormat] = useState<SubtitleFileFormat>('srt');
  const [wordTimingChoice, setWordTimingChoice] = useState<boolean | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const meta = FORMAT_OPTIONS[format];
  // Until the reader states a preference, each format answers for
  // itself, so switching format moves the switch with it. Once they
  // have chosen, the choice outlives the format they made it in.
  const wordTiming = wordTimingChoice ?? (meta.wordTiming?.enabledByDefault ?? false);

  return (
    <div className="flex flex-col gap-4">
      <FormatField format={format} hint={meta.hint} onChange={setFormat} />

      {meta.wordTiming !== null && (
        <DisclosureSection
          title="Advanced options"
          open={advancedOpen}
          onToggle={() => setAdvancedOpen((v) => !v)}
        >
          <Toggle
            label="Word-level timing"
            value={wordTiming}
            adornment={
              <InfoTip text={meta.wordTiming.explanation} label="About word-level timing" />
            }
            onChange={setWordTimingChoice}
          />
        </DisclosureSection>
      )}

      <ExportSettingsFooter
        alternateLabel="Export video instead"
        confirmLabel="Download"
        onAlternate={onSwitchToVideo}
        onCancel={onCancel}
        onConfirm={() => onConfirm({
          format,
          granularity: wordTiming && meta.wordTiming !== null ? 'word' : 'segment',
        })}
      />
    </div>
  );
}

function FormatField({
  format,
  hint,
  onChange,
}: {
  format: SubtitleFileFormat;
  hint: string;
  onChange: (next: SubtitleFileFormat) => void;
}) {
  return (
    <div>
      <label className={FIELD_LABEL} htmlFor="export-subtitle-format">Format</label>
      <select
        id="export-subtitle-format"
        className={FIELD_SELECT}
        value={format}
        onChange={(e) => onChange(e.target.value as SubtitleFileFormat)}
      >
        {FORMAT_ORDER.map((value) => (
          <option key={value} value={value}>{FORMAT_OPTIONS[value].label}</option>
        ))}
      </select>
      <p className={FIELD_HINT}>{hint}</p>
    </div>
  );
}
