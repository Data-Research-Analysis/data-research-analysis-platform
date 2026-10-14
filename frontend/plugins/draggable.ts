import { defineAsyncComponent } from "vue";

/**
 * vuedraggable Plugin (lazy)
 *
 * Registers the `<draggable>` component used by the dashboard/report editors.
 * The async component keeps vuedraggable (and sortablejs) out of the entry
 * bundle; the library is only fetched when a `<draggable>` actually renders.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component(
    "draggable",
    defineAsyncComponent(() =>
      import("vuedraggable").then((m: any) => m.default || m),
    ),
  );
});
