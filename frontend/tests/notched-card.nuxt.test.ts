import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, test } from "vitest";
import notchedCard from "../components/notched-card.vue";

describe("Checking whether the slot is loading content", () => {
  test("Notched Card should show with a body slot", async () => {
    const wrapper = await mountSuspended(notchedCard, {
        slots: {
            body: '<div>This is the body of the notched card</div>'
        }
    })
    expect(wrapper.html()).toContain('This is the body of the notched card')
  });
});