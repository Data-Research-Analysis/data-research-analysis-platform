/**
 * Composable for managing the sequential multi-source connection queue.
 *
 * When the user selects multiple data sources in the wizard, we store them
 * as a queue in sessionStorage and process them one at a time — each source's
 * existing connect page is loaded in sequence. After each source completes,
 * the composable redirects to the next source's page or back to the data
 * sources list when all are done.
 */

interface QueueItem {
    sourceId: string;
    connectRoute: string;
    status: 'pending' | 'active' | 'completed' | 'failed';
}

interface WizardQueue {
    projectId: string;
    items: QueueItem[];
    currentIndex: number;
}

const QUEUE_KEY = 'wizard_source_queue';

export function useWizardReturn() {
    /**
     * Store the full queue in sessionStorage.
     */
    function setQueue(projectId: string, sourceIds: string[], connectRoutes: string[]) {
        if (!import.meta.client) return;
        const queue: WizardQueue = {
            projectId,
            items: sourceIds.map((id, i) => ({
                sourceId: id,
                connectRoute: connectRoutes[i],
                status: i === 0 ? 'active' as const : 'pending' as const,
            })),
            currentIndex: 0,
        };
        sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }

    /**
     * Read the current queue from sessionStorage.
     */
    function getQueue(): WizardQueue | null {
        if (!import.meta.client) return null;
        const raw = sessionStorage.getItem(QUEUE_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as WizardQueue;
        } catch {
            return null;
        }
    }

    /**
     * Whether there is an active multi-source queue in progress.
     */
    function hasActiveQueue(): boolean {
        const queue = getQueue();
        if (!queue) return false;
        return queue.items.length > 1 && queue.currentIndex < queue.items.length;
    }

    /**
     * Get progress info for the current queue (for display in connect pages).
     * Returns null if no active queue.
     */
    function getQueueProgress(): { current: number; total: number; sourceId: string } | null {
        const queue = getQueue();
        if (!queue || queue.items.length <= 1) return null;
        return {
            current: queue.currentIndex + 1,
            total: queue.items.length,
            sourceId: queue.items[queue.currentIndex]?.sourceId || '',
        };
    }

    /**
     * After a successful connection, advance the queue and navigate to the
     * next source's connect page. If all sources are done, clean up and go
     * to the data sources list.
     */
    function redirectAfterConnect(projectId: string) {
        if (!import.meta.client) {
            navigateTo(`/projects/${projectId}/data-sources`);
            return;
        }

        const queue = getQueue();
        if (queue && queue.items.length > 1) {
            // Mark current as completed
            if (queue.currentIndex < queue.items.length) {
                queue.items[queue.currentIndex].status = 'completed';
            }
            queue.currentIndex++;

            if (queue.currentIndex < queue.items.length) {
                // More sources to connect — redirect to wizard which will auto-redirect
                queue.items[queue.currentIndex].status = 'active';
                sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
                navigateTo(`/projects/${projectId}/data-sources/connect/wizard`);
                return;
            }

            // All done — clear queue
            sessionStorage.removeItem(QUEUE_KEY);
        }

        navigateTo(`/projects/${projectId}/data-sources`);
    }

    /**
     * Mark current source as failed and move to next.
     */
    function skipCurrentSource(projectId: string) {
        if (!import.meta.client) return;
        const queue = getQueue();
        if (!queue) return;

        if (queue.currentIndex < queue.items.length) {
            queue.items[queue.currentIndex].status = 'failed';
        }
        queue.currentIndex++;

        if (queue.currentIndex < queue.items.length) {
            queue.items[queue.currentIndex].status = 'active';
            sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
            navigateTo(`/projects/${projectId}/data-sources/connect/wizard`);
        } else {
            sessionStorage.removeItem(QUEUE_KEY);
            navigateTo(`/projects/${projectId}/data-sources`);
        }
    }

    /**
     * Cancel the entire queue and go back to data sources.
     */
    function cancelQueue(projectId: string) {
        if (!import.meta.client) return;
        sessionStorage.removeItem(QUEUE_KEY);
        navigateTo(`/projects/${projectId}/data-sources`);
    }

    /**
     * Clear remaining sources flag (legacy compat).
     */
    function clearRemainingSources() {
        if (!import.meta.client) return;
        sessionStorage.removeItem(QUEUE_KEY);
        sessionStorage.removeItem('wizard_remaining_sources');
    }

    return {
        setQueue,
        getQueue,
        hasActiveQueue,
        getQueueProgress,
        redirectAfterConnect,
        skipCurrentSource,
        cancelQueue,
        clearRemainingSources,
    };
}