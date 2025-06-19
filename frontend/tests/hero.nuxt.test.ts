import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe,expect, test } from 'vitest';
import { nextTick } from 'vue'
import hero from '../components/hero.vue'

describe('Checking whether the subscribe me button is showing', () => {
    test( 'Subscribe Me button Should show when loading is false', async () => {
      const wrapper = await mountSuspended(hero)
      wrapper.vm.state.loading = false;
      await nextTick()
      const subscribeMeButton = wrapper.get('[data-cy="Subscribe Me"]')
      expect(subscribeMeButton.text()).toBe('Subscribe Me')
    });
    test('The reactive email state should be updated when the input value changes', async () => {
      const wrapper = await mountSuspended(hero)
      //set loading to false to show the subscrive email input
      wrapper.vm.state.loading = false;
      await nextTick()
      const subscribeEmailInput = wrapper.get('[data-cy="subscribe-email-input"]')
      subscribeEmailInput.setValue('user@test.com');
      await nextTick()
      expect(subscribeEmailInput.element.value).toBe('user@test.com');
      await nextTick()
      expect(wrapper.vm.state.email).toBe('user@test.com');
    });
    test( 'Subscribe Me Button Should not show and instead Loading... be shown when loading is true', async () => {
      const wrapper = await mountSuspended(hero)
      wrapper.vm.state.loading = true;
      await nextTick()
      const subscribeMeButton = wrapper.get('[data-cy="Loading..."]')
      expect(subscribeMeButton.text()).contain('Loading...')
    });

})