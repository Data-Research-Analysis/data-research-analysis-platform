export interface IBrandingConfig {
    primaryColor: string | null;
    secondaryColor: string | null;
    logoUrl: string | null;
    enabled: boolean;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    let h = 0;
    let s = 0;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

function derivePalette(hex: string): Record<string, string> {
    const { h, s, l } = hexToHsl(hex);
    return {
        '--brand-primary-100': hex,
        '--brand-primary-200': `hsl(${h}, ${Math.max(0, s - 5)}%, ${Math.min(100, l - 5)}%)`,
        '--brand-primary-300': `hsl(${h}, ${Math.max(0, s - 10)}%, ${Math.min(100, l - 10)}%)`,
        '--brand-primary-400': `hsl(${h}, ${Math.max(0, s - 15)}%, ${Math.min(100, l - 15)}%)`,
        '--brand-primary-500': `hsl(${h}, ${Math.max(0, s - 20)}%, ${Math.min(100, l - 20)}%)`,
    };
}

export function useBranding() {
    const config = useRuntimeConfig();
    const apiUrl = config.public.apiBase;

    function applyBranding(branding: IBrandingConfig | null | undefined): void {
        if (!branding?.enabled) {
            resetBranding();
            return;
        }

        const root = document.documentElement;

        if (branding.primaryColor) {
            root.style.setProperty('--brand-primary', branding.primaryColor);
            const palette = derivePalette(branding.primaryColor);
            Object.entries(palette).forEach(([key, value]) => {
                root.style.setProperty(key, value);
            });
        }

        if (branding.secondaryColor) {
            root.style.setProperty('--brand-secondary', branding.secondaryColor);
        }
    }

    function resetBranding(): void {
        const root = document.documentElement;
        const defaults: Record<string, string> = {
            '--brand-primary': '#3C8DBC',
            '--brand-primary-100': '#3C8DBC',
            '--brand-primary-200': '#367FA9',
            '--brand-primary-300': '#307095',
            '--brand-primary-400': '#296282',
            '--brand-primary-500': '#23536F',
            '--brand-secondary': '#1E3050',
        };
        Object.entries(defaults).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
    }

    async function fetchBranding(orgId: number): Promise<IBrandingConfig | null> {
        try {
            const data = await $fetch<{ success: boolean; data: IBrandingConfig | null }>(
                `${apiUrl}/organizations/${orgId}/branding`
            );
            return data?.data ?? null;
        } catch {
            return null;
        }
    }

    return {
        applyBranding,
        resetBranding,
        fetchBranding,
    };
}
