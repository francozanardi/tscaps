import type { FootageGrade } from '@modules/video/grade/FootageGrade';

/**
 * Grades what a 2D context already holds, in place: every pixel of its
 * canvas, which is `width × height`, is replaced by itself graded. A
 * grade that changes nothing leaves the context as it is.
 *
 * The preview and the export grade through the same implementation in
 * the same browser, so they agree there.
 */
export interface FootageGrader {
  grade(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    width: number,
    height: number,
    grade: FootageGrade,
  ): void;
}
