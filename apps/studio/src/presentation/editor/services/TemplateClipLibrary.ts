export interface TemplateClipView {
  readonly clipUrl: string;
  readonly posterUrl: string;
  /** `object-position` for both the clip and its poster. */
  readonly objectPosition: string;
}

// Every clip is shot 9:16 and shown in a 4:5 card, which fits 70% of
// its height and can slide over the other 30%. Where that window sits
// is a property of the clip: the caption lands wherever its template
// anchors it, and a centred crop cuts the ones anchored low. Listed
// here are the clips that needed it moved, measured frame by frame
// against the burned captions; everything absent is centred.
const CROP_ANCHOR: Readonly<Record<string, string>> = {
  // Its two registers sit at opposite ends of the frame, so the window
  // has to hold both and the offset it leaves is narrow.
  pastor: 'center 9%',
  luna: 'center 75%',
  // The big word sits high in the frame, and the clip was rendered with the small
  // words raised to 0.7, so the window sits high to hold both.
  suki: 'center 14%',
  selene: 'center 82%',
  sara: 'center 100%',
};

const CENTERED_CROP = 'center 50%';

/**
 * Resolves the sample a template is previewed with. Clips are named
 * after the template they show, so a template that ships one needs no
 * entry anywhere — only the ones whose crop is off-centre are listed.
 */
export class TemplateClipLibrary {

  /**
   * @param baseUrl path the app is served under, trailing slash included
   *   — the editor does not sit at the origin root, so an absolute path
   *   would resolve outside it.
   */
  constructor(private readonly baseUrl: string) {}

  clipFor(templateId: string): TemplateClipView {
    return {
      clipUrl: `${this.baseUrl}templates/${templateId}.mp4`,
      posterUrl: `${this.baseUrl}templates/${templateId}.jpg`,
      objectPosition: CROP_ANCHOR[templateId] ?? CENTERED_CROP,
    };
  }
}
