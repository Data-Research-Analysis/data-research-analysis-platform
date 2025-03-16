import type { IReCaptchaComposition } from "vue-recaptcha-v3";

export function openGithub() {
    window.open("https://github.com/Data-Research-Analysis/data-research-analysis-platform", "_blank");
}
export function openLinkedin() {
    window.open("https://www.linkedin.com/company/data-research-analysis-smc-private-limited", "_blank");
}
export function baseUrl() {
    const config = useRuntimeConfig();
    return config.public.NUXT_API_URL;
}
export async function getRecaptchaToken (recaptcha:IReCaptchaComposition, type: string) {
    const { executeRecaptcha, recaptchaLoaded } = recaptcha;
    await recaptchaLoaded();
    const token = await executeRecaptcha(type)
    return token;
}
export async function verifyRecaptchaToken (authToken: string, recaptchaToken: string) {
    const url = `${baseUrl()}/verify-recaptcha`;
    const captchaResponse = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({ recaptcha_token: recaptchaToken }),
    });
    return await captchaResponse.json();

}