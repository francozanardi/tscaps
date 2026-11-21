import { describe, expect, it } from 'vitest';
import { ScrollSlack } from '@presentation/editor/services/ScrollSlack';

/**
 * A view scrolled to the end of its content keeps its place when the
 * content shrinks, over room left empty at the end, which it gives back
 * as it is scrolled up and as the content grows again.
 */
const VIEW = 500;
const HOLDS = true;

describe('ScrollSlack', () => {
  it('keeps a view scrolled to the end where it was when the content shrinks under it', () => {
    const slack = new ScrollSlack();
    slack.scrolled(700, 1200, VIEW, HOLDS);

    expect(slack.resized(900, VIEW, HOLDS, 0)).toEqual({ slackPx: 300, scrollTop: 700 });
  });

  it('adds nothing where the view still reaches where it was', () => {
    const slack = new ScrollSlack();
    slack.scrolled(100, 1200, VIEW, HOLDS);

    expect(slack.resized(900, VIEW, HOLDS, 0)).toEqual({ slackPx: 0, scrollTop: 100 });
  });

  it('gives the room back as the view is scrolled up into the content, and keeps none once it is', () => {
    const slack = new ScrollSlack();
    slack.scrolled(700, 1200, VIEW, HOLDS);
    slack.resized(900, VIEW, HOLDS, 0);

    expect(slack.scrolled(550, 900, VIEW, HOLDS).slackPx).toBe(150);
    expect(slack.scrolled(300, 900, VIEW, HOLDS).slackPx).toBe(0);
    expect(slack.scrolled(400, 900, VIEW, HOLDS).slackPx).toBe(0);
  });

  it('gives the room back as the content grows again', () => {
    const slack = new ScrollSlack();
    slack.scrolled(700, 1200, VIEW, HOLDS);
    slack.resized(900, VIEW, HOLDS, 0);

    expect(slack.resized(1200, VIEW, HOLDS, 0).slackPx).toBe(0);
  });

  it('takes a scroll that comes with the content\'s change for the browser pulling the view back, and puts it back', () => {
    const slack = new ScrollSlack();
    slack.scrolled(700, 1200, VIEW, HOLDS);

    expect(slack.scrolled(400, 900, VIEW, HOLDS)).toEqual({ slackPx: 300, scrollTop: 700 });
    expect(slack.scrolled(650, 900, VIEW, HOLDS)).toEqual({ slackPx: 250, scrollTop: 650 });
  });

  it('makes up a content now shorter than the view, too', () => {
    const slack = new ScrollSlack();
    slack.scrolled(155, 614, 459, HOLDS);

    expect(slack.resized(405, 459, HOLDS, 0)).toEqual({ slackPx: 209, scrollTop: 155 });
    expect(slack.scrolled(0, 405, 459, HOLDS).slackPx).toBe(0);
    expect(slack.resized(405, 459, HOLDS, 0).slackPx).toBe(0);
  });

  it('starts again at the top over content that replaced the old, holding nothing of where the view was', () => {
    const slack = new ScrollSlack();
    slack.scrolled(1400, 2400, VIEW, HOLDS);

    expect(slack.restart()).toEqual({ slackPx: 0, scrollTop: 0 });
    expect(slack.resized(900, VIEW, HOLDS, 0)).toEqual({ slackPx: 0, scrollTop: 0 });
    expect(slack.scrolled(0, 900, VIEW, HOLDS)).toEqual({ slackPx: 0, scrollTop: 0 });
  });

  it('lets the view go where the browser put it, with no slack, when the change did not keep what was used', () => {
    const slack = new ScrollSlack();
    slack.scrolled(1400, 2400, VIEW, HOLDS);

    expect(slack.resized(900, VIEW, false, 400)).toEqual({ slackPx: 0, scrollTop: 400 });
    expect(slack.scrolled(400, 900, VIEW, HOLDS)).toEqual({ slackPx: 0, scrollTop: 400 });
  });

  it('takes a pull-back that comes with a change not kept as where the view now is', () => {
    const slack = new ScrollSlack();
    slack.scrolled(700, 1200, VIEW, HOLDS);

    expect(slack.scrolled(400, 900, VIEW, false)).toEqual({ slackPx: 0, scrollTop: 400 });
  });
});
