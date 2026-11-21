import type { FootagePicture } from '@modules/video/FootagePicture';
import type { OpenedFootage } from '@modules/video/mediabunny/footage/OpenedFootage';

/**
 * Footage that is its own picture: drawing it draws the picture of the
 * moment asked last, so a holder can draw it again at any time without
 * asking for that moment again. Draws nothing before the first picture
 * is had.
 */
export interface DrawableFootage extends OpenedFootage, FootagePicture {}
