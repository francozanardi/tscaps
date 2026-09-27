import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

/**
 * Re-derives the document each time the page finishes loading fonts, so
 * lines measured while a face was missing are measured again with it.
 *
 * A caption's family compiles to a name with no face behind it, so a
 * derivation that runs before that face is loaded measures the browser's
 * default font instead. That happens whenever the family is new — a
 * template just picked — and whenever its faces are declared again, which
 * leaves them unloaded. The load that repairs it starts later, when
 * something paints the family, so it is answered here rather than
 * predicted at derivation time.
 *
 * A loading cycle that brought no face in, because every face it asked
 * for failed, derives nothing. A face that fails is not fetched again,
 * so a cycle only follows a face declared anew and the re-derivations
 * end when the declarations stop changing.
 */
export class FontArrivalAutomation {

  constructor(
    private readonly fonts: FontFaceSet,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  start(): void {
    this.fonts.addEventListener('loadingdone', this.onLoadingDone);
  }

  stop(): void {
    this.fonts.removeEventListener('loadingdone', this.onLoadingDone);
  }

  private readonly onLoadingDone = (event: FontFaceSetLoadEvent): void => {
    if (event.fontfaces.length === 0) return;
    this.refresh.execute();
  };
}
