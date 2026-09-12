import { renderImage, type LabelBitmap, type RawImageData } from '@mbtech-nl/bitmap';
import type {
  MediaDescriptor,
  PreviewOptions,
  PreviewPlane,
  PreviewResult,
} from '@thermal-label/contracts';
import { DEFAULT_MEDIA } from './media.js';

/**
 * Offline preview — render the user image with the same dither the
 * print path uses, into a single black-on-white plane.
 */
export function createPreviewOffline(
  image: RawImageData,
  options: PreviewOptions = {},
): PreviewResult {
  const media: MediaDescriptor = options.media ?? DEFAULT_MEDIA;
  const bitmap: LabelBitmap = renderImage(image, { dither: true, threshold: 175 });
  const plane: PreviewPlane = {
    name: 'main',
    bitmap,
    displayColor: '#000000',
  };
  return {
    planes: [plane],
    media,
    assumed: options.media === undefined,
  };
}
