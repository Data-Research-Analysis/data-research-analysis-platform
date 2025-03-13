export function Utils() {
    function openGithub() {
        window.open("https://github.com/Data-Research-Analysis/data-research-analysis-platform", "_blank");
    }
    function openLinkedin() {
        window.open("https://www.linkedin.com/company/data-research-analysis-smc-private-limited", "_blank");
    }
    function baseUrl() {
        const config = useRuntimeConfig();
        return config.public.NUXT_API_URL;
    }

    return { openGithub, openLinkedin, baseUrl };
}