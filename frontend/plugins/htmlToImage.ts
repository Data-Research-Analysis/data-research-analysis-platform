import * as htmlToImage from 'html-to-image';
import { toPng, toJpeg, toBlob, toPixelData, toSvg } from 'html-to-image';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.provide("htmlToImageToPng", toPng);
  nuxtApp.provide("htmlToImageToJpeg", toJpeg);
  nuxtApp.provide("htmlToImageToBlob", toBlob);
  nuxtApp.provide("htmlToImageToPixelData", toPixelData);
  nuxtApp.provide("htmlToImageToSvg", toSvg);
});
