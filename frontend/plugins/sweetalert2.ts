import type Swal from "sweetalert2";

/**
 * SweetAlert2 Plugin (lazy)
 *
 * Provides a global `$swal` instance for dialogs, alerts, and loading indicators.
 * SweetAlert2 and its stylesheet are code-split and only fetched the first time a
 * dialog is opened, so marketing pages that never open a dialog do not download
 * or parse the library.
 *
 * Usage:
 * const { $swal } = useNuxtApp()
 * await $swal.fire({ title: 'Success!', icon: 'success' })
 */

type SwalInstance = typeof Swal;

let swalPromise: Promise<SwalInstance> | null = null;

function loadSwal(): Promise<SwalInstance> {
  if (!swalPromise) {
    swalPromise = (async () => {
      // Import the stylesheet on demand so it is not shipped to every page.
      if (import.meta.client) {
        await import("sweetalert2/dist/sweetalert2.min.css");
      }

      const { default: SwalLib } = await import("sweetalert2");

      const swalWithDefaults = SwalLib.mixin({
        customClass: {
          popup: "rounded-lg shadow-xl",
          confirmButton: "swal2-styled",
          cancelButton: "swal2-styled",
        },
        buttonsStyling: true,
        heightAuto: false,
      });

      // Override fire to dynamically set z-index above all other modals.
      const originalFire = swalWithDefaults.fire.bind(swalWithDefaults);
      swalWithDefaults.fire = function (...args: any[]) {
        const result = originalFire(...args);

        if (import.meta.client) {
          setTimeout(() => {
            const swalContainer = document.querySelector(".swal2-container");
            if (swalContainer) {
              (swalContainer as HTMLElement).style.zIndex = "9999";
            }
          }, 0);
        }

        return result;
      } as typeof swalWithDefaults.fire;

      return swalWithDefaults;
    })();
  }
  return swalPromise;
}

export default defineNuxtPlugin((nuxtApp) => {
  // A lazy proxy so every `$swal.method(...)` call resolves the real instance on
  // first use while keeping the synchronous `$swal` shape the app already uses.
  const lazySwal = new Proxy({} as SwalInstance, {
    get(_target, prop) {
      // Prevent the proxy from being treated as a thenable by `await`.
      if (prop === "then") return undefined;
      return (...args: any[]) =>
        loadSwal().then((instance) => (instance as any)[prop](...args));
    },
  });

  return {
    provide: {
      swal: lazySwal,
    },
  };
});
