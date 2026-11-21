/**
 * GA4 date-range presets.
 *
 * All boundaries are computed in the GA4 property timezone because the
 * BigQuery export's `event_date` is property-local. Week starts on Monday
 * (ISO-8601).
 */

export type GA4DatePreset =
    | 'today'
    | 'yesterday'
    | 'last_7_days'
    | 'this_week'
    | 'last_week'
    | 'last_week_sun_sat'
    | 'this_month'
    | 'last_month'
    | 'last_90_days'
    | 'last_365_days'
    | 'custom';

export interface IResolvedDateRange {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
    preset: GA4DatePreset;
}

interface Ymd {
    y: number;
    m: number; // 1-12
    d: number;
}

const PRESETS: Array<{ key: GA4DatePreset; label: string }> = [
    { key: 'last_365_days', label: 'Last 365 days' },
    { key: 'last_90_days', label: 'Last 90 days' },
    { key: 'last_month', label: 'Last month' },
    { key: 'this_month', label: 'This month' },
    { key: 'last_week', label: 'Last week (Mon-Sun)' },
    { key: 'last_week_sun_sat', label: 'Last week (Sun-Sat)' },
    { key: 'last_7_days', label: 'Last 7 days' },
    { key: 'this_week', label: 'This week' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'today', label: 'Today' },
    { key: 'custom', label: 'Custom' },
];

export class GA4DateRangeService {
    static presetList(): Array<{ key: GA4DatePreset; label: string }> {
        return [...PRESETS];
    }

    /**
     * Resolve a preset to an inclusive [start, end] ISO date range in the
     * property timezone.
     */
    static resolvePreset(
        preset: GA4DatePreset,
        timeZone: string = 'UTC',
        now: Date = new Date(),
        custom?: { start: string; end: string },
    ): IResolvedDateRange {
        if (preset === 'custom') {
            if (!custom?.start || !custom?.end) {
                throw new Error('Custom date range requires start and end');
            }
            return { start: custom.start, end: custom.end, preset };
        }

        const today = this.todayInTz(now, timeZone);

        switch (preset) {
            case 'today':
                return { start: iso(today), end: iso(today), preset };
            case 'yesterday': {
                const y = addDays(today, -1);
                return { start: iso(y), end: iso(y), preset };
            }
            case 'last_7_days':
                // GA4's "last N days" ranges end yesterday (today is partial).
                return { start: iso(addDays(today, -7)), end: iso(addDays(today, -1)), preset };
            case 'this_week': {
                const start = addDays(today, -weekOffset(today));
                return { start: iso(start), end: iso(today), preset };
            }
            case 'last_week': {
                const thisWeekStart = addDays(today, -weekOffset(today));
                return {
                    start: iso(addDays(thisWeekStart, -7)),
                    end: iso(addDays(thisWeekStart, -1)),
                    preset,
                };
            }
            case 'last_week_sun_sat': {
                // Previous complete week running Sunday through Saturday
                // (the week GA4 counts when "week starts on Sunday").
                const thisSunday = addDays(today, -dayOfWeek(today));
                return {
                    start: iso(addDays(thisSunday, -7)),
                    end: iso(addDays(thisSunday, -1)),
                    preset,
                };
            }
            case 'this_month': {
                const start = { y: today.y, m: today.m, d: 1 };
                return { start: iso(start), end: iso(today), preset };
            }
            case 'last_month': {
                const prevMonth = today.m === 1
                    ? { y: today.y - 1, m: 12 }
                    : { y: today.y, m: today.m - 1 };
                const start = { y: prevMonth.y, m: prevMonth.m, d: 1 };
                const end = { y: prevMonth.y, m: prevMonth.m, d: daysInMonth(prevMonth.y, prevMonth.m) };
                return { start: iso(start), end: iso(end), preset };
            }
            case 'last_90_days':
                return { start: iso(addDays(today, -90)), end: iso(addDays(today, -1)), preset };
            case 'last_365_days':
                return { start: iso(addDays(today, -365)), end: iso(addDays(today, -1)), preset };
            default:
                return { start: iso(today), end: iso(today), preset: 'today' };
        }
    }

    /**
     * Resolve the sync window for a data source. `days` wins when provided;
     * otherwise the preset is used.
     */
    static resolveWindow(
        preset: GA4DatePreset | undefined,
        days: number | undefined,
        timeZone: string,
        now: Date = new Date(),
        custom?: { start: string; end: string },
    ): IResolvedDateRange {
        if (preset === 'custom') {
            return this.resolvePreset('custom', timeZone, now, custom);
        }
        if (days && days > 0) {
            const today = this.todayInTz(now, timeZone);
            return { start: iso(addDays(today, -(days - 1))), end: iso(today), preset: preset ?? 'last_90_days' };
        }
        return this.resolvePreset(preset ?? 'last_90_days', timeZone, now);
    }

    private static todayInTz(now: Date, timeZone: string): Ymd {
        try {
            const fmt = new Intl.DateTimeFormat('en-CA', {
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            });
            const parts = fmt.formatToParts(now);
            const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);
            return { y: get('year'), m: get('month'), d: get('day') };
        } catch {
            return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
        }
    }
}

function iso(d: Ymd): string {
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

function addDays(d: Ymd, delta: number): Ymd {
    const dt = new Date(Date.UTC(d.y, d.m - 1, d.d));
    dt.setUTCDate(dt.getUTCDate() + delta);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Days since Monday (0 = Monday, 6 = Sunday). */
function weekOffset(d: Ymd): number {
    const dow = new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay(); // 0 = Sunday
    return (dow + 6) % 7;
}

/** Day of week, 0 = Sunday through 6 = Saturday. */
function dayOfWeek(d: Ymd): number {
    return new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay();
}

function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export default GA4DateRangeService;
