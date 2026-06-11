const SUPPRESSION_WINDOW_MS = 200;

/**
 * Installs a single capture-phase `click` listener on the window that
 * stops the next click event from reaching downstream handlers. The
 * listener removes itself after consuming one click, or after the
 * suppression window elapses if no click arrives — so a cancelled or
 * unfollowed gesture cannot accidentally eat an unrelated later click.
 */
export class NextClickSuppressor {
  arm(): void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const consume = (event: MouseEvent): void => {
      event.stopPropagation();
      event.preventDefault();
      removeAll();
    };
    const removeAll = (): void => {
      window.removeEventListener('click', consume, true);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
    window.addEventListener('click', consume, true);
    timeoutId = setTimeout(removeAll, SUPPRESSION_WINDOW_MS);
  }
}
