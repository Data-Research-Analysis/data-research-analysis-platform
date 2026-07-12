const DOWNLOADED_COOKIE = 'lg_downloaded';
const SHOWN_PREFIX = 'lg_shown_';

export function useLeadGeneratorCookie() {
    const downloadedCookie = useCookie<string>(DOWNLOADED_COOKIE, {
        default: () => '',
        path: '/',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60,
    });

    const getShownCookie = (placementId: number) =>
        useCookie<string>(`${SHOWN_PREFIX}${placementId}`, {
            default: () => '0',
            path: '/',
            sameSite: 'lax',
            maxAge: 365 * 24 * 60 * 60,
        });

    const getDownloadedIds = (): number[] => {
        if (!downloadedCookie.value) return [];
        return downloadedCookie.value.split(',').map(Number).filter(Boolean);
    };

    const markDownloaded = (id: number): void => {
        const ids = getDownloadedIds();
        if (!ids.includes(id)) {
            ids.push(id);
            downloadedCookie.value = ids.join(',');
        }
    };

    const hasDownloaded = (id: number): boolean => {
        return getDownloadedIds().includes(id);
    };

    const getShownCount = (placementId: number): number => {
        const cookie = getShownCookie(placementId);
        return parseInt(cookie.value, 10) || 0;
    };

    const incrementShownCount = (placementId: number): number => {
        const current = getShownCount(placementId);
        const newCount = current + 1;
        const cookie = getShownCookie(placementId);
        cookie.value = String(newCount);
        return newCount;
    };

    return {
        getDownloadedIds,
        markDownloaded,
        hasDownloaded,
        getShownCount,
        incrementShownCount,
    };
}
