import type { IReCaptchaComposition } from "vue-recaptcha-v3";
export function openGithub() {
    window.open("https://github.com/Data-Research-Analysis/data-research-analysis-platform", "_blank");
}
export function openLinkedin() {
    window.open("https://www.linkedin.com/company/data-research-analysis-smc-private-limited", "_blank");
}
export function gotoJoinPrivateBeta() {
    const router = useRouter();
    router.push("/#join-private-beta");
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
    if (dataType === "text" || dataType === "bpchar" || dataType === "char" || dataType === "varchar" || dataType === "character varying" || dataType === "character" || dataType === "USER-DEFINED") {
        return "TEXT";
    } else if (dataType === "int" || dataType === "integer" || dataType === "bigint" || dataType === "float" || dataType === "double" || dataType === "decimal" || dataType === "numeric" || dataType === "real" || dataType === "smallint" || dataType === "double precision" || dataType === "bigserial" || dataType === "serial") {
        return "NUMBER";
    } else if (dataType === "date" || dataType.match(/^timestamp/) || dataType === "datetime") {
        return "DATE";
    } else if (dataType === "boolean") {
        return "BOOLEAN";
    }
}
export function isPlatformEnabled() {
    const config = useRuntimeConfig();
    return config.public.NUXT_PLATFORM_ENABLED === "true";
}
export function isPlatformRegistrationEnabled() {
    const config = useRuntimeConfig();
    return config.public.NUXT_PLATFORM_REGISTRATION_ENABLED === "true";
}
export function isPlatformLoginEnabled() {
    const config = useRuntimeConfig();
    return config.public.NUXT_PLATFORM_LOGIN_ENABLED === "true";
}
export function cleanString(str: string) {
    return str.replace(/[^a-zA-Z0-9]/g, "");
}
export function joinWaitList() {
 
}
export function countryCodes() {
    return [
            {"name":"Afghanistan","iso_2":"AF","iso_3":"AFG","code":"93"},
            {"name":"Albania","iso_2":"AL","iso_3":"ALB","code":"355"},
            {"name":"Algeria","iso_2":"DZ","iso_3":"DZA","code":"213"},
            {"name":"American Samoa","iso_2":"AS","iso_3":"ASM","code":"-683"},
            {"name":"Andorra","iso_2":"AD","iso_3":"AND","code":"376"},
            {"name":"Angola","iso_2":"AO","iso_3":"AGO","code":"244"},
            {"name":"Anguilla","iso_2":"AI","iso_3":"AIA","code":"-263"},
            {"name":"Antigua and Barbuda","iso_2":"AG","iso_3":"ATG","code":"-267"},
            {"name":"Argentina","iso_2":"AR","iso_3":"ARG","code":"54"},
            {"name":"Armenia","iso_2":"AM","iso_3":"ARM","code":"374"},
            {"name":"Aruba","iso_2":"AW","iso_3":"ABW","code":"297"},
            {"name":"Australia","iso_2":"AU","iso_3":"AUS","code":"61"},
            {"name":"Austria","iso_2":"AT","iso_3":"AUT","code":"43"},
            {"name":"Azerbaijan","iso_2":"AZ","iso_3":"AZE","code":"994"},
            {"name":"Bahamas","iso_2":"BS","iso_3":"BHS","code":"-241"},
            {"name":"Bahrain","iso_2":"BH","iso_3":"BHR","code":"973"},
            {"name":"Bangladesh","iso_2":"BD","iso_3":"BGD","code":"880"},
            {"name":"Barbados","iso_2":"BB","iso_3":"BRB","code":"-245"},
            {"name":"Belarus","iso_2":"BY","iso_3":"BLR","code":"375"},
            {"name":"Belgium","iso_2":"BE","iso_3":"BEL","code":"32"},
            {"name":"Belize","iso_2":"BZ","iso_3":"BLZ","code":"501"},
            {"name":"Benin","iso_2":"BJ","iso_3":"BEN","code":"229"},
            {"name":"Bermuda","iso_2":"BM","iso_3":"BMU","code":"-440"},
            {"name":"Bhutan","iso_2":"BT","iso_3":"BTN","code":"975"},
            {"name":"Bolivia","iso_2":"BO","iso_3":"BOL","code":"591"},
            {"name":"Bosnia and Herzegovina","iso_2":"BA","iso_3":"BIH","code":"387"},
            {"name":"Botswana","iso_2":"BW","iso_3":"BWA","code":"267"},
            {"name":"Brazil","iso_2":"BR","iso_3":"BRA","code":"55"},
            {"name":"British Virgin Islands","iso_2":"VG","iso_3":"VGB","code":"-283"},
            {"name":"Brunei Darussalam","iso_2":"BN","iso_3":"BRN","code":"673"},
            {"name":"Bulgaria","iso_2":"BG","iso_3":"BGR","code":"359"},
            {"name":"Burkina Faso","iso_2":"BF","iso_3":"BFA","code":"226"},
            {"name":"Burundi","iso_2":"BI","iso_3":"BDI","code":"257"},
            {"name":"Cabo Verde","iso_2":"CV","iso_3":"CPV","code":"238"},
            {"name":"Cambodia","iso_2":"KH","iso_3":"KHM","code":"855"},
            {"name":"Cameroon","iso_2":"CM","iso_3":"CMR","code":"237"},
            {"name":"Canada","iso_2":"CA","iso_3":"CAN","code":"1"},
            {"name":"Cayman Islands","iso_2":"KY","iso_3":"CYM","code":"-344"},
            {"name":"Central African Rep.","iso_2":"CF","iso_3":"CAF","code":"236"},
            {"name":"Chad","iso_2":"TD","iso_3":"TCD","code":"235"},
            {"name":"Chile","iso_2":"CL","iso_3":"CHL","code":"56"},
            {"name":"China","iso_2":"CN","iso_3":"CHN","code":"86"},
            {"name":"Colombia","iso_2":"CO","iso_3":"COL","code":"57"},
            {"name":"Comoros","iso_2":"KM","iso_3":"COM","code":"269"},
            {"name":"Congo (Rep. of)","iso_2":"CG","iso_3":"COG","code":"242"},
            {"name":"Congo (Dem. Rep. of)","iso_2":"CD","iso_3":"COD","code":"243"},
            {"name":"Costa Rica","iso_2":"CR","iso_3":"CRI","code":"506"},
            {"name":"Côte d'Ivoire","iso_2":"CI","iso_3":"CIV","code":"225"},
            {"name":"Croatia","iso_2":"HR","iso_3":"HRV","code":"385"},
            {"name":"Cuba","iso_2":"CU","iso_3":"CUB","code":"53"},
            {"name":"Cyprus","iso_2":"CY","iso_3":"CYP","code":"357"},
            {"name":"Czechia","iso_2":"CZ","iso_3":"CZE","code":"420"},
            {"name":"Denmark","iso_2":"DK","iso_3":"DNK","code":"45"},
            {"name":"Djibouti","iso_2":"DJ","iso_3":"DJI","code":"253"},
            {"name":"Dominica","iso_2":"DM","iso_3":"DMA","code":"-766"},
            {"name":"Dominican Republic","iso_2":"DO","iso_3":"DOM","code":"+1-809, +1-829, +1-849"},
            {"name":"Ecuador","iso_2":"EC","iso_3":"ECU","code":"593"},
            {"name":"Egypt","iso_2":"EG","iso_3":"EGY","code":"20"},
            {"name":"El Salvador","iso_2":"SV","iso_3":"SLV","code":"503"},
            {"name":"Equatorial Guinea","iso_2":"GQ","iso_3":"GNQ","code":"240"},
            {"name":"Eritrea","iso_2":"ER","iso_3":"ERI","code":"291"},
            {"name":"Estonia","iso_2":"EE","iso_3":"EST","code":"372"},
            {"name":"Eswatini","iso_2":"SZ","iso_3":"SWZ","code":"268"},
            {"name":"Ethiopia","iso_2":"ET","iso_3":"ETH","code":"251"},
            {"name":"Fiji","iso_2":"FJ","iso_3":"FJI","code":"679"},
            {"name":"Finland","iso_2":"FI","iso_3":"FIN","code":"358"},
            {"name":"France","iso_2":"FR","iso_3":"FRA","code":"33"},
            {"name":"Gabon","iso_2":"GA","iso_3":"GAB","code":"241"},
            {"name":"Gambia","iso_2":"GM","iso_3":"GMB","code":"220"},
            {"name":"Georgia","iso_2":"GE","iso_3":"GEO","code":"995"},
            {"name":"Germany","iso_2":"DE","iso_3":"DEU","code":"49"},
            {"name":"Ghana","iso_2":"GH","iso_3":"GHA","code":"233"},
            {"name":"Greece","iso_2":"GR","iso_3":"GRC","code":"30"},
            {"name":"Greenland","iso_2":"GL","iso_3":"GRL","code":"299"},
            {"name":"Grenada","iso_2":"GD","iso_3":"GRD","code":"-472"},
            {"name":"Guam","iso_2":"GU","iso_3":"GUM","code":"-670"},
            {"name":"Guatemala","iso_2":"GT","iso_3":"GTM","code":"502"},
            {"name":"Guinea","iso_2":"GN","iso_3":"GIN","code":"224"},
            {"name":"Guyana","iso_2":"GY","iso_3":"GUY","code":"592"},
            {"name":"Haiti","iso_2":"HT","iso_3":"HTI","code":"509"},
            {"name":"Honduras","iso_2":"HN","iso_3":"HND","code":"504"},
            {"name":"Hong Kong","iso_2":"HK","iso_3":"HKG","code":"852"},
            {"name":"Hungary","iso_2":"HU","iso_3":"HUN","code":"36"},
            {"name":"Iceland","iso_2":"IS","iso_3":"ISL","code":"354"},
            {"name":"India","iso_2":"IN","iso_3":"IND","code":"91"},
            {"name":"Indonesia","iso_2":"ID","iso_3":"IDN","code":"62"},
            {"name":"Iran","iso_2":"IR","iso_3":"IRN","code":"98"},
            {"name":"Iraq","iso_2":"IQ","iso_3":"IRQ","code":"964"},
            {"name":"Ireland","iso_2":"IE","iso_3":"IRL","code":"353"},
            {"name":"Israel","iso_2":"IL","iso_3":"ISR","code":"972"},
            {"name":"Italy","iso_2":"IT","iso_3":"ITA","code":"39"},
            {"name":"Jamaica","iso_2":"JM","iso_3":"JAM","code":"+1-876, +1-658"},
            {"name":"Japan","iso_2":"JP","iso_3":"JPN","code":"81"},
            {"name":"Jordan","iso_2":"JO","iso_3":"JOR","code":"962"},
            {"name":"Kazakhstan","iso_2":"KZ","iso_3":"KAZ","code":"7"},
            {"name":"Kenya","iso_2":"KE","iso_3":"KEN","code":"254"},
            {"name":"Kuwait","iso_2":"KW","iso_3":"KWT","code":"965"},
            {"name":"Kyrgyzstan","iso_2":"KG","iso_3":"KGZ","code":"996"},
            {"name":"Laos","iso_2":"LA","iso_3":"LAO","code":"856"},
            {"name":"Latvia","iso_2":"LV","iso_3":"LVA","code":"371"},
            {"name":"Lebanon","iso_2":"LB","iso_3":"LBN","code":"961"},
            {"name":"Liberia","iso_2":"LR","iso_3":"LBR","code":"231"},
            {"name":"Libya","iso_2":"LY","iso_3":"LBY","code":"218"},
            {"name":"Lithuania","iso_2":"LT","iso_3":"LTU","code":"370"},
            {"name":"Luxembourg","iso_2":"LU","iso_3":"LUX","code":"352"},
            {"name":"Macao","iso_2":"MO","iso_3":"MAC","code":"853"},
            {"name":"Madagascar","iso_2":"MG","iso_3":"MDG","code":"261"},
            {"name":"Malaysia","iso_2":"MY","iso_3":"MYS","code":"60"},
            {"name":"Maldives","iso_2":"MV","iso_3":"MDV","code":"960"},
            {"name":"Mali","iso_2":"ML","iso_3":"MLI","code":"223"},
            {"name":"Malta","iso_2":"MT","iso_3":"MLT","code":"356"},
            {"name":"Mauritius","iso_2":"MU","iso_3":"MUS","code":"230"},
            {"name":"Mexico","iso_2":"MX","iso_3":"MEX","code":"52"},
            {"name":"Moldova","iso_2":"MD","iso_3":"MDA","code":"373"},
            {"name":"Monaco","iso_2":"MC","iso_3":"MCO","code":"377"},
            {"name":"Mongolia","iso_2":"MN","iso_3":"MNG","code":"976"},
            {"name":"Morocco","iso_2":"MA","iso_3":"MAR","code":"212"},
            {"name":"Myanmar","iso_2":"MM","iso_3":"MMR","code":"95"},
            {"name":"Nepal","iso_2":"NP","iso_3":"NPL","code":"977"},
            {"name":"Netherlands","iso_2":"NL","iso_3":"NLD","code":"31"},
            {"name":"New Zealand","iso_2":"NZ","iso_3":"NZL","code":"64"},
            {"name":"Nicaragua","iso_2":"NI","iso_3":"NIC","code":"505"},
            {"name":"Nigeria","iso_2":"NG","iso_3":"NGA","code":"234"},
            {"name":"Norway","iso_2":"NO","iso_3":"NOR","code":"47"},
            {"name":"Oman","iso_2":"OM","iso_3":"OMN","code":"968"},
            {"name":"Pakistan","iso_2":"PK","iso_3":"PAK","code":"92"},
            {"name":"Palestine","iso_2":"PS","iso_3":"PSE","code":"970"},
            {"name":"Panama","iso_2":"PA","iso_3":"PAN","code":"507"},
            {"name":"Paraguay","iso_2":"PY","iso_3":"PRY","code":"595"},
            {"name":"Peru","iso_2":"PE","iso_3":"PER","code":"51"},
            {"name":"Philippines","iso_2":"PH","iso_3":"PHL","code":"63"},
            {"name":"Poland","iso_2":"PL","iso_3":"POL","code":"48"},
            {"name":"Portugal","iso_2":"PT","iso_3":"PRT","code":"351"},
            {"name":"Puerto Rico","iso_2":"PR","iso_3":"PRI","code":"+1-787, +1-939"},
            {"name":"Qatar","iso_2":"QA","iso_3":"QAT","code":"974"},
            {"name":"Romania","iso_2":"RO","iso_3":"ROU","code":"40"},
            {"name":"Russia","iso_2":"RU","iso_3":"RUS","code":"7"},
            {"name":"Rwanda","iso_2":"RW","iso_3":"RWA","code":"250"},
            {"name":"Saudi Arabia","iso_2":"SA","iso_3":"SAU","code":"966"},
            {"name":"Senegal","iso_2":"SN","iso_3":"SEN","code":"221"},
            {"name":"Serbia","iso_2":"RS","iso_3":"SRB","code":"381"},
            {"name":"Singapore","iso_2":"SG","iso_3":"SGP","code":"65"},
            {"name":"Slovakia","iso_2":"SK","iso_3":"SVK","code":"421"},
            {"name":"Slovenia","iso_2":"SI","iso_3":"SVN","code":"386"},
            {"name":"South Africa","iso_2":"ZA","iso_3":"ZAF","code":"27"},
            {"name":"South Korea","iso_2":"KR","iso_3":"KOR","code":"82"},
            {"name":"Spain","iso_2":"ES","iso_3":"ESP","code":"34"},
            {"name":"Sri Lanka","iso_2":"LK","iso_3":"LKA","code":"94"},
            {"name":"Sweden","iso_2":"SE","iso_3":"SWE","code":"46"},
            {"name":"Switzerland","iso_2":"CH","iso_3":"CHE","code":"41"},
            {"name":"Syria","iso_2":"SY","iso_3":"SYR","code":"963"},
            {"name":"Taiwan","iso_2":"TW","iso_3":"TWN","code":"886"},
            {"name":"Tajikistan","iso_2":"TJ","iso_3":"TJK","code":"992"},
            {"name":"Tanzania","iso_2":"TZ","iso_3":"TZA","code":"255"},
            {"name":"Thailand","iso_2":"TH","iso_3":"THA","code":"66"},
            {"name":"Tunisia","iso_2":"TN","iso_3":"TUN","code":"216"},
            {"name":"Turkey","iso_2":"TR","iso_3":"TUR","code":"90"},
            {"name":"Turkmenistan","iso_2":"TM","iso_3":"TKM","code":"993"},
            {"name":"Uganda","iso_2":"UG","iso_3":"UGA","code":"256"},
            {"name":"Ukraine","iso_2":"UA","iso_3":"UKR","code":"380"},
            {"name":"United Arab Emirates","iso_2":"AE","iso_3":"ARE","code":"971"},
            {"name":"United Kingdom","iso_2":"GB","iso_3":"GBR","code":"44"},
            {"name":"United States","iso_2":"US","iso_3":"USA","code":"1"},
            {"name":"Uruguay","iso_2":"UY","iso_3":"URY","code":"598"},
            {"name":"Uzbekistan","iso_2":"UZ","iso_3":"UZB","code":"998"},
            {"name":"Venezuela","iso_2":"VE","iso_3":"VEN","code":"58"},
            {"name":"Vietnam","iso_2":"VN","iso_3":"VNM","code":"84"},
            {"name":"Yemen","iso_2":"YE","iso_3":"YEM","code":"967"},
            {"name":"Zambia","iso_2":"ZM","iso_3":"ZMB","code":"260"},
            {"name":"Zimbabwe","iso_2":"ZW","iso_3":"ZWE","code":"263"}
        ];
}