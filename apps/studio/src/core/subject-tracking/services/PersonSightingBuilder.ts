import type { NormalizedBbox } from '@core/person-segmentation/domain/NormalizedBbox';
import type { PoseLandmark } from '@core/person-segmentation/domain/PoseLandmark';
import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';
import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';

// MediaPipe's pose landmarks 0 to 10 are the face (nose, eyes, ears, mouth); 11 and 12 the shoulders.
const FACE_LANDMARKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const EYE_LANDMARKS = [1, 2, 3, 4, 5, 6];
const MOUTH_LANDMARKS = [9, 10];
const SHOULDER_LANDMARKS = [11, 12];
const MIN_VISIBILITY = 0.5;
const MIN_FACE_POINTS = 2;
const MIN_BODY_POINTS = 3;
// Where only the shoulders show, the head is taken this far above them, as a share of the distance between them.
const HEAD_ABOVE_SHOULDERS = 0.8;
// A head, crown to chin, is about this many times the drop from the eyes to the mouth, which shows the same from
// the front and from the side.
const HEAD_OF_EYES_TO_MOUTH = 3.4;
// A face detector's box runs from about the brow to the chin: the head is this many times its height.
const HEAD_OF_FACE_BOX = 1.45;

/**
 * Turns what a detector found into sightings of people: a pose's
 * landmarks, or a face's box. Coordinates are shares of the frame.
 */
export class PersonSightingBuilder {
  /**
   * The person a pose shows, the head taken from the face's landmarks,
   * else from above the shoulders. Null where too little of the body
   * was seen to place a head.
   */
  fromPose(landmarks: ReadonlyArray<PoseLandmark>): PersonSighting | null {
    const seen = landmarks.filter((point) => this.isSeen(point));
    if (seen.length < MIN_BODY_POINTS) return null;
    const head = this.headOf(landmarks);
    if (head === null) return null;
    return { box: this.boxAround(seen), head, source: 'pose', headHeight: this.headHeightOf(landmarks) };
  }

  /** The person a face's box shows, the head at its middle. */
  fromFace(box: NormalizedBbox): PersonSighting {
    return {
      box: this.clamped(box),
      head: { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 },
      source: 'face',
      headHeight: Math.min(1, Math.max(0, box.maxY - box.minY) * HEAD_OF_FACE_BOX),
    };
  }

  /** How tall the head is, from how far the mouth is below the eyes; null where either is not seen. */
  private headHeightOf(landmarks: ReadonlyArray<PoseLandmark>): number | null {
    const eyes = this.seenAmong(landmarks, EYE_LANDMARKS);
    const mouth = this.seenAmong(landmarks, MOUTH_LANDMARKS);
    if (eyes.length === 0 || mouth.length === 0) return null;
    const drop = Math.abs(this.middleOf(mouth).y - this.middleOf(eyes).y);
    return drop > 0 ? Math.min(1, drop * HEAD_OF_EYES_TO_MOUTH) : null;
  }

  private headOf(landmarks: ReadonlyArray<PoseLandmark>): PicturePosition | null {
    const face = this.seenAmong(landmarks, FACE_LANDMARKS);
    if (face.length >= MIN_FACE_POINTS) return this.middleOf(face);
    const shoulders = this.seenAmong(landmarks, SHOULDER_LANDMARKS);
    if (shoulders.length < SHOULDER_LANDMARKS.length) return null;
    const [left, right] = shoulders as [PoseLandmark, PoseLandmark];
    const width = Math.hypot(right.x - left.x, right.y - left.y);
    const middle = this.middleOf(shoulders);
    return { x: middle.x, y: Math.max(0, middle.y - width * HEAD_ABOVE_SHOULDERS) };
  }

  private seenAmong(landmarks: ReadonlyArray<PoseLandmark>, indices: ReadonlyArray<number>): PoseLandmark[] {
    return indices.map((index) => landmarks[index]).filter((point): point is PoseLandmark => point !== undefined && this.isSeen(point));
  }

  private isSeen(point: PoseLandmark): boolean {
    return point.visibility >= MIN_VISIBILITY;
  }

  private middleOf(points: ReadonlyArray<PoseLandmark>): PicturePosition {
    const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    return { x: this.share(x), y: this.share(y) };
  }

  private boxAround(points: ReadonlyArray<PoseLandmark>): NormalizedBbox {
    return this.clamped({
      minX: Math.min(...points.map((point) => point.x)),
      minY: Math.min(...points.map((point) => point.y)),
      maxX: Math.max(...points.map((point) => point.x)),
      maxY: Math.max(...points.map((point) => point.y)),
    });
  }

  private clamped(box: NormalizedBbox): NormalizedBbox {
    return { minX: this.share(box.minX), minY: this.share(box.minY), maxX: this.share(box.maxX), maxY: this.share(box.maxY) };
  }

  private share(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
