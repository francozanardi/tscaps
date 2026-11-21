// Heights read off the layout this close are one height, read at another subpixel offset.
const SAME_HEIGHT_PX = 0.5;

/** Where a view is kept: the room left empty at the end of its content, and where it is scrolled to. */
export interface ScrollSlackPlace {
  readonly slackPx: number;
  readonly scrollTop: number;
}

/**
 * Keeps a scroll view where it was when its content shrinks under it.
 *
 * Content that shrinks below the view — a choice hiding the fields that
 * depended on it — lowers how far the view can scroll, and a view
 * scrolled that far is pulled back: everything above the change slides
 * down and the control just used leaves the pointer. Here the view keeps
 * its place over room left empty at the end of the content, its
 * *slack*, which only ever makes up what the content lost: it is given
 * back as the view is scrolled up into the content, and as the content
 * grows again.
 *
 * A scroll the content's own change caused (the browser pulling the
 * view back, before or after the change is reported) is told from one
 * the user made by the content's height: a scroll that comes with a new
 * height is the change's, and the view is put back where it was.
 *
 * A place is held only for a change that keeps what was just used on
 * screen (`holdsPlace`): a choice that hid the fields below it. Content
 * that replaced what was used (a page opening, an item removed) lets
 * the view go where the browser puts it, with no slack, as a view with
 * no slack at all would.
 *
 * Lengths are in pixels, the content's always without the slack. An
 * instance serves one view.
 */
export class ScrollSlack {
  private heldScrollTop = 0;
  private slackPx = 0;
  private contentHeight: number | null = null;

  /**
   * The view is now scrolled to `scrollTop`, over content `contentHeight` tall in a view `viewportHeight` tall;
   * `holdsPlace` says whether a change of the content's height keeps the view where it was.
   */
  scrolled(scrollTop: number, contentHeight: number, viewportHeight: number, holdsPlace: boolean): ScrollSlackPlace {
    if (this.contentHeight !== null && Math.abs(contentHeight - this.contentHeight) > SAME_HEIGHT_PX) {
      return this.resized(contentHeight, viewportHeight, holdsPlace, scrollTop);
    }
    this.contentHeight = contentHeight;
    this.heldScrollTop = scrollTop;
    // At the top there is nothing above the view to hold in place.
    this.slackPx = scrollTop <= 0 ? 0 : Math.min(this.slackPx, Math.max(0, scrollTop - this.reachOf(contentHeight, viewportHeight)));
    return { slackPx: this.slackPx, scrollTop };
  }

  /**
   * The content is now `contentHeight` tall: the view kept where it was last left when `holdsPlace`, or else
   * left at `scrollTop`, where it is now, with no slack.
   */
  resized(contentHeight: number, viewportHeight: number, holdsPlace: boolean, scrollTop: number): ScrollSlackPlace {
    this.contentHeight = contentHeight;
    if (!holdsPlace) {
      this.heldScrollTop = scrollTop;
      this.slackPx = 0;
      return { slackPx: 0, scrollTop };
    }
    this.slackPx = this.heldScrollTop <= 0 ? 0 : Math.max(0, this.heldScrollTop - this.reachOf(contentHeight, viewportHeight));
    return { slackPx: this.slackPx, scrollTop: this.heldScrollTop };
  }

  /**
   * The view starts again at its top, over content that replaced what it
   * showed: nothing is held, and no slack is kept. The next height or
   * scroll reported is taken as the new content's.
   */
  restart(): ScrollSlackPlace {
    this.heldScrollTop = 0;
    this.slackPx = 0;
    this.contentHeight = null;
    return { slackPx: 0, scrollTop: 0 };
  }

  /**
   * How far a view can scroll over content of that height, with no
   * slack: negative for content shorter than the view, which the slack
   * then has to make up too before the view can scroll at all.
   */
  private reachOf(contentHeight: number, viewportHeight: number): number {
    return contentHeight - viewportHeight;
  }
}
