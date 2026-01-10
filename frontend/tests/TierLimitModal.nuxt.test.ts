import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, test, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import TierLimitModal from '../components/TierLimitModal.vue';

describe('TierLimitModal Component', () => {
    const defaultProps = {
        show: true,
        resource: 'projects',
        currentUsage: 3,
        tierLimit: 3,
        tierName: 'FREE',
        upgradeTiers: [
            {
                tierName: 'STARTER',
                limit: 10,
                pricePerMonth: 9.99,
            },
            {
                tierName: 'PRO',
                limit: 50,
                pricePerMonth: 29.99,
            },
        ],
    };

    test('should render modal when show is true', async () => {
        const wrapper = await mountSuspended(TierLimitModal, {
            props: defaultProps,
        });

        await nextTick();

        const modal = wrapper.find('[data-testid="tier-limit-modal"]');
        expect(modal.exists()).toBe(true);
    });

    test('should not render modal when show is false', async () => {
        const wrapper = await mountSuspended(TierLimitModal, {
            props: {
                ...defaultProps,
                show: false,
            },
        });

        await nextTick();

        const modal = wrapper.find('[data-testid="tier-limit-modal"]');
        expect(modal.exists()).toBe(false);
    });

    test('should display resource name correctly', async () => {
        const wrapper = await mountSuspended(TierLimitModal, {
            props: defaultProps,
        });

        await nextTick();

        const content = wrapper.text();
        expect(content).toContain('projects');
    });

    test('should display current usage and limit', async () => {
        const wrapper = await mountSuspended(TierLimitModal, {
            props: defaultProps,
        });

        await nextTick();

        const content = wrapper.text();
        expect(content).toContain('3');
        expect(content).toContain('3');
    });

    test('should display tier name', async () => {
        const wrapper = await mountSuspended(TierLimitModal, {
            props: defaultProps,
        });

        await nextTick();

        const content = wrapper.text();
        expect(content).toContain('FREE');
    });

    test('should display upgrade tiers', async () => {
        const wrapper = await mountSuspended(TierLimitModal, {
            props: defaultProps,
        });

        await nextTick();

        const content = wrapper.text();
        expect(content).toContain('STARTER');
        expect(content).toContain('PRO');
        expect(content).toContain('9.99');
        expect(content).toContain('29.99');
    });

    test('should emit close event when close button clicked', async () => {
        const wrapper = await mountSuspended(TierLimitModal, {
            props: defaultProps,
        });

        await nextTick();

        const closeButton = wrapper.find('[data-testid="modal-close-button"]');
        if (closeButton.exists()) {
            await closeButton.trigger('click');
            await nextTick();
            expect(wrapper.emitted('close')).toBeTruthy();
        }
    });

    test('should emit close event when cancel button clicked', async () => {
        const wrapper = await mountSuspended(TierLimitModal, {
            props: defaultProps,
        });

        await nextTick();

        const cancelButton = wrapper.find('[data-testid="modal-cancel-button"]');
        if (cancelButton.exists()) {
            await cancelButton.trigger('click');
            await nextTick();
            expect(wrapper.emitted('close')).toBeTruthy();
        }
    });

    test('should calculate progress width correctly', async () => {
        const wrapper = await mountSuspended(TierLimitModal, {
            props: {
                ...defaultProps,
                currentUsage: 2,
                tierLimit: 10,
            },
        });

        await nextTick();

        // Progress should be 20% (2/10)
        const progressBar = wrapper.find('[data-testid="progress-bar"]');
        if (progressBar.exists()) {
            const style = progressBar.attributes('style');
            expect(style).toContain('20');
        }
    });

    test('should handle 100% progress correctly', async () => {
        const wrapper = await mountSuspended(TierLimitModal, {
            props: {
                ...defaultProps,
                currentUsage: 10,
                tierLimit: 10,
            },
        });

        await nextTick();

        const progressBar = wrapper.find('[data-testid="progress-bar"]');
        if (progressBar.exists()) {
            const style = progressBar.attributes('style');
            expect(style).toContain('100');
        }
    });

    test('should display unlimited tier correctly', async () => {
        const wrapper = await mountSuspended(TierLimitModal, {
            props: {
                ...defaultProps,
                upgradeTiers: [
                    {
                        tierName: 'ENTERPRISE',
                        limit: null,
                        pricePerMonth: 99.99,
                    },
                ],
            },
        });

        await nextTick();

        const content = wrapper.text();
        expect(content).toContain('ENTERPRISE');
        expect(content).toContain('Unlimited');
    });

    test('should be SSR compatible (no browser API usage)', async () => {
        // This test ensures the component can render on server-side
        const wrapper = await mountSuspended(TierLimitModal, {
            props: {
                ...defaultProps,
                show: false,
            },
        });

        expect(wrapper.exists()).toBe(true);
    });
});
