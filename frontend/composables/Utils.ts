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
export async function getGeneratedToken() {
    const url = `${baseUrl()}/generate-token`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });
    return await response.json();

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
            "Authorization-Type": "non-auth",
        },
        body: JSON.stringify({ recaptcha_token: recaptchaToken }),
    });
    return await captchaResponse.json();
}
export function getDataType(dataType: string) {
    if (dataType === "text" || dataType === "varchar" || dataType === "char" || dataType === "character varying") {
        return "TEXT";
    } else if (dataType === "int" || dataType === "integer" || dataType === "bigint" || dataType === "float" || dataType === "double") {
        return "NUMBER";
    } else if (dataType === "date" || dataType.match(/^timestamp/) || dataType === "datetime") {
        return "DATE";
    } else if (dataType === "boolean") {
        return "BOOLEAN";
    }

}