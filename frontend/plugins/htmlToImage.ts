type HtmlToImageModule = typeof import("html-to-image");

/**
 * html-to-image Plugin (lazy)
 *
 * Exposes the html-to-image capture helpers used by dashboard/report export.
 * The library is code-split and only fetched the first time an export runs, so
 * it never ships to pages that do not export dashboards.
 */

let modulePromise: Promise<HtmlToImageModule> | null = null;

function loadHtmlToImage(): Promise<HtmlToImageModule> {
  if (!modulePromise) {
    modulePromise = import("html-to-image");
  }
  return modulePromise;
}

function lazyCapture(name: keyof HtmlToImageModule) {
  return async (...args: any[]) => {
    const mod = await loadHtmlToImage();
    return (mod[name] as (...a: any[]) => any)(...args);
  };
}

export default defineNuxtPlugin((nuxtApp) => {
  return {
    provide: {
      htmlToImageToPng: lazyCapture("toPng"),
      htmlToImageToJpeg: lazyCapture("toJpeg"),
      htmlToImageToBlob: lazyCapture("toBlob"),
      htmlToImageToPixelData: lazyCapture("toPixelData"),
      htmlToImageToSvg: lazyCapture("toSvg"),
    },
  };
});
