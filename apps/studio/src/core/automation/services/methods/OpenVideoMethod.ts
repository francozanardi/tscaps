import { z } from 'zod';
import { AutomationCallFailedError } from '@core/automation/domain/AutomationCallFailedError';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { RemoteFileReader } from '@core/automation/domain/RemoteFileReader';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { EditorStatusReader } from '@core/automation/services/EditorStatusReader';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PreprocessVideoAction } from '@core/preprocessing/actions/PreprocessVideoAction';
import type { LoadVideoAction } from '@core/videos/actions/LoadVideoAction';

const TEMPLATES_WAIT_MS = 30_000;

const PARAMS = z.object({
  url: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().default(''),
  subtitles: z.object({ name: z.string().min(1), text: z.string().min(1) }).optional(),
  language: z.string().min(2).max(16).optional(),
  model: z.enum(['tiny', 'base', 'small', 'medium']).optional(),
});

/**
 * `open_video`: starts a project from a video the program serves, the
 * way a person dropping the file into the editor does: the video is
 * loaded, then preprocessed (captions from `subtitles` when given, else
 * transcribed in the browser, in `language` when given, with the Whisper
 * `model` when given), and the project is stored. A `model` becomes the
 * editor's transcription model for the rest of the session, as a model
 * picked in the editor would, but is not saved for the next one.
 * Resolves once the captions are ready, with the editor's status;
 * rejects when preprocessing failed, with the editor's error.
 */
export class OpenVideoMethod implements AutomationMethod {
  readonly name = 'open_video';

  constructor(
    private readonly store: EditorStore,
    private readonly files: RemoteFileReader,
    private readonly loadVideo: LoadVideoAction,
    private readonly preprocessVideo: PreprocessVideoAction,
    private readonly status: EditorStatusReader,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { url, fileName, mimeType, subtitles, language, model } = this.params.read(this.name, PARAMS, params);
    const file = await this.files.read(url, fileName, mimeType);
    await this.templatesLoaded();
    if (model !== undefined) this.store.setTranscribePreference({ ...this.store.snapshot().transcribePreference, model });
    this.loadVideo.execute(file);
    await this.preprocessVideo.execute({
      transcriber: language === undefined ? {} : { language },
      multipleSpeakers: false,
      ...(subtitles === undefined ? {} : { subtitleFile: subtitles }),
    });
    const { error } = this.store.snapshot();
    if (error !== null) throw new AutomationCallFailedError(this.name, 'the video could not be prepared', { cause: error });
    return this.status.read();
  }

  /** Preprocessing builds the first caption sheet from a template, so it waits for the catalog. */
  private templatesLoaded(): Promise<void> {
    return new Promise((resolve, reject) => {
      const loaded = () => this.store.snapshot().availableTemplates.length > 0;
      if (loaded()) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        this.store.removeEventListener('change', listener);
        reject(new AutomationCallFailedError(this.name, 'the templates never loaded'));
      }, TEMPLATES_WAIT_MS);
      const listener = () => {
        if (!loaded()) return;
        clearTimeout(timer);
        this.store.removeEventListener('change', listener);
        resolve();
      };
      this.store.addEventListener('change', listener);
    });
  }
}
