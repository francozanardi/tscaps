import { useEffect } from 'react';
import type { OutputFormat } from '@tscaps/engine';
import {
  SoundtrackCodecAdvisor,
  type SoundtrackCodecs,
} from '@presentation/export/services/SoundtrackCodecAdvisor';
import { FIELD_HINT } from '@ui/_shared/styles/formFields';
import { useTelemetry } from '@ui/_shared/contexts/modules/TelemetryContext';

const ADVISOR = new SoundtrackCodecAdvisor();

const FORMAT_NAMES: Readonly<Record<OutputFormat, string>> = { mp4: 'MP4', webm: 'WebM' };

interface SoundtrackCodecNoticeProps {
  format: OutputFormat;
  /** Null while not known yet, or when the export carries no sound effects or music. */
  codecs: SoundtrackCodecs | null;
}

/**
 * Says, before the export, how the project's sound effects and music
 * will be saved, only when that is not what a reader expects: Opus
 * inside an MP4 file, or no way to save them at all. Reports each piece
 * of advice it shows (`export_soundtrack_advice_shown`), which is how
 * often a browser cannot write the soundtrack asked for.
 */
export function SoundtrackCodecNotice({ format, codecs }: SoundtrackCodecNoticeProps) {
  const telemetry = useTelemetry();
  const advice = codecs === null ? null : ADVISOR.adviseFor(format, codecs);
  const adviceKind = advice?.kind ?? null;
  useEffect(() => {
    if (adviceKind !== null) telemetry.capture('export_soundtrack_advice_shown', { advice: adviceKind, format });
  }, [telemetry, adviceKind, format]);
  if (advice === null) return null;
  if (advice.kind === 'opus-in-mp4') {
    return (
      <p className={FIELD_HINT}>
        This browser cannot save AAC sound, so the sound in this MP4 file will use the Opus format. Some older
        players and apps cannot play Opus in an MP4 file.
      </p>
    );
  }
  return (
    <div role="status" className="rounded-sm border border-warning/40 bg-warning/10 p-3 flex flex-col gap-1.5">
      <p className="text-xs text-fg-primary leading-snug m-0">
        Your sound effects and music will not be in this export.
      </p>
      <p className="text-xs text-fg-secondary leading-snug m-0">
        This browser cannot save sound in the {FORMAT_NAMES[format]} format.
        {advice.otherFormat !== null && ` To keep them, export as ${FORMAT_NAMES[advice.otherFormat]}.`}
      </p>
    </div>
  );
}
