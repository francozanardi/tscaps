import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Whether `measureRef`'s text, laid out on one line, is no wider than
 * `boxRef` is now. Measured again whenever the box is resized and
 * whenever `text` changes; `measureRef` is expected to hold `text`
 * whatever is shown in its place. True until the first measurement.
 */
export function useTextFits(
  boxRef: RefObject<HTMLElement | null>,
  measureRef: RefObject<HTMLElement | null>,
  text: string,
): boolean {
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return;
    const check = () => setFits(measure.scrollWidth <= box.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(box);
    return () => observer.disconnect();
  }, [boxRef, measureRef, text]);
  return fits;
}
