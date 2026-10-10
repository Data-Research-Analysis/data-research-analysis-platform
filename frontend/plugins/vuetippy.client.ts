import type { Directive, DirectiveBinding, VNode } from "vue";

/**
 * vue-tippy Plugin (lazy)
 *
 * Registers the `v-tippy` directive used across the app. vue-tippy, tippy.js and
 * the tooltip stylesheet are code-split and only fetched the first time an
 * element that actually uses `v-tippy` mounts, so pages without tooltips (for
 * example the marketing homepage) never download or parse them.
 */

type VueTippyModule = typeof import("vue-tippy");

let modulePromise: Promise<VueTippyModule> | null = null;

function loadVueTippy(): Promise<VueTippyModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      await import("tippy.js/dist/tippy.css");
      const mod = await import("vue-tippy");
      mod.setDefaultProps({ placement: "auto-end", allowHTML: true });
      return mod;
    })();
  }
  return modulePromise;
}

export default defineNuxtPlugin((nuxtApp) => {
  let directive: Directive | null = null;
  // Elements that mounted before vue-tippy finished loading.
  const pending = new Map<Element, { binding: DirectiveBinding; vnode: VNode }>();

  const ensureDirective = async () => {
    const mod = await loadVueTippy();
    directive = mod.directive as Directive;
    pending.forEach(({ binding, vnode }, el) => {
      (directive!.mounted as any)?.(el, binding, vnode, null);
    });
    pending.clear();
  };

  nuxtApp.vueApp.directive("tippy", {
    mounted(el, binding, vnode) {
      if (directive) {
        (directive.mounted as any)?.(el, binding, vnode, null);
        return;
      }
      pending.set(el, { binding, vnode });
      void ensureDirective();
    },
    updated(el, binding, vnode, prevVnode) {
      (directive?.updated as any)?.(el, binding, vnode, prevVnode);
    },
    unmounted(el, binding, vnode, prevVnode) {
      pending.delete(el);
      (directive?.unmounted as any)?.(el, binding, vnode, prevVnode);
    },
  });
});
