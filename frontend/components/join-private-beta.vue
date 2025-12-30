<script setup>
import { useReCaptcha } from "vue-recaptcha-v3";
const recaptcha = useReCaptcha();

const state = reactive({
    email: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    businessEmail: "",
    companyName: "",
    phoneCountryCode: countryCodes().find(code => code.name === 'Pakistan')?.code,
    countryCodes: countryCodes(),
    country: countryCodes().find(code => code.name === 'Pakistan')?.name,
    agreeToReceiveUpdates: false,
    firstNameError: false,
    lastNameError: false,
    emailError: false,
    phoneNumberError: false,
    businessEmailError: false,
    companyNameError: false,
    countryError: false,
    errorMessages: [],
    privateBetaSubmissionSuccess: false,
    showAlert: false,

    privateBetaStep: 1,
    subscriptionError: false,
    subscriptionErrorMessage: "*Please enter a valid email address.",
    token: "",
    loading: true,
});

async function getToken() {
    state.loading = true;
    const response = await getGeneratedToken();
    state.token = response.token;
    state.loading = false;
}

async function applyForPrivateBeta() {
    state.loading = true;
    state.showAlert = false;
    state.privateBetaSubmissionSuccess = false;
    state.errorMessages = [];

    if (!validate(state.firstName, "", [validateRequired])) {
        state.firstNameError = true;
        state.errorMessages.push("Please enter your first name.");
    } else {
        state.firstNameError = false;
    }
    if (!validate(state.lastName, "", [validateRequired])) {
        state.lastNameError = true;
        state.errorMessages.push("Please enter your last name.");
    } else {
        state.lastNameError = false;
    }
    if (!validate(state.phoneNumber, "", [validateRequired])) {
        state.phoneNumberError = true;
        state.errorMessages.push("Please enter your phone number.");
    } else {
        state.phoneNumberError = false;
    }
    if (!validate(state.businessEmail, "", [validateEmail, validateRequired])) {
        state.businessEmailError = true;
        state.errorMessages.push("Please enter a valid business email address.");
    } else {
        state.businessEmailError = false;
    }
    if (!validate(state.companyName, "", [validateRequired])) {
        state.companyNameError = true;
        state.errorMessages.push("Please enter your company/business name.");
    } else {
        state.companyNameError = false;
    }
    if (!validate(state.country, "", [validateRequired])) {
        state.countryError = true;
        state.errorMessages.push("Please select your country.");
    } else {
        state.countryError = false;
    }

    if (state.firstNameError || state.lastNameError || state.phoneNumberError || state.businessEmailError || state.companyNameError || state.countryError) {
        state.showAlert = true;
        state.privateBetaSubmissionSuccess = false;
        state.loading = false;
        return;
    }
    const recaptchaToken = await getRecaptchaToken(recaptcha, 'privateBetaForm');
    if (recaptchaToken) {
        state.privateBetaStep = 2;
        const response = await verifyRecaptchaToken(state.token, recaptchaToken);
        if (response.success && response.action === "privateBetaForm" && response.score > 0.8) {
            state.privateBetaStep = 2;
                const url = `${baseUrl()}/private-beta-apply`;
                const privateBetaResponse = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${state.token}`,
                        "Authorization-Type": "non-auth",
                    },
                    body: JSON.stringify({
                        first_name: state.firstName,
                        last_name: state.lastName,
                        phone_number: `${state.phoneCountryCode}${state.phoneNumber}`,
                        business_email: state.businessEmail,
                        company_name: state.companyName,
                        agree_to_receive_updates: state.agreeToReceiveUpdates,
                        country: state.country,
                    }),
                });
                if (privateBetaResponse.status === 200) {
                    state.privateBetaStep = 2;
                } else {
                    const decodedResponse = await privateBetaResponse.json();
                    const message = decodedResponse.message;
                    state.subscriptionError = true;
                    state.subscriptionErrorMessage = message;//"*Oops!! We detected an anomaly. Please wait before you submit again.";
                    state.privateBetaStep = 1;
                }
            } else {
                state.subscriptionError = true;
                state.subscriptionErrorMessage = "*Oops!! We detected an anomaly. Please wait before you submit again.";
                state.privateBetaStep = 1;    
            }
        } else {
            state.subscriptionError = true;
            state.subscriptionErrorMessage = "*Oops!! We detected an anomoly. Please wait before you submit again.";
            state.privateBetaStep = 1;
        }
    
    state.loading = false;
}
defineExpose({
    state,
});

onMounted(async () => {
    await getToken();
});
</script>
<template>
    <div>
        <div class="bg-primary-blue-100 w-full h-full fancy-top pt-15">
            <div class="flex flex-col h-full p-5 lg:hidden">
                <div class="text-3xl font-bold text-white text-center">
                    Join Our Private Beta
                </div>
                <div v-if="state.privateBetaStep && state.privateBetaStep === 1" class="text-xl text-white text-center mt-10">
                    Join our private beta today and our team will get you started with Data Research Analysis.
                </div>
                <spinner v-if="state.loading" :show="true" class="mt-10" data-cy="Loading..."/>
                <div v-else class="flex flex-row justify-center">
                    <div v-if="state.privateBetaStep && state.privateBetaStep === 1" class="w-3/4 flex flex-col mt-10">
                        <div v-if="state.showAlert"
                            class="w-full self-center text-lg p-5 mb-5 font-bold text-black"
                            :class="{ 'bg-green-400': state.privateBetaSubmissionSuccess, 'bg-red-400': !state.privateBetaSubmissionSuccess }">
                            <div v-if="state.privateBetaSubmissionSuccess" class="text-2xl">Success!</div>
                            <div v-else class="text-2xl">Error!</div>
                            <template v-for="message in state.errorMessages">
                                <div>{{ message }}</div>
                            </template>
                        </div>
                        <div class="h-[60px] text-white bg-white border-primary-blue-200 border-5 items-center flex flex-row shadow-lg">
                            <input type="text" v-model="state.firstName" class="w-full h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4" placeholder="Enter your first name" />
                        </div>
                        <div class="h-[60px] text-white bg-white border-primary-blue-200 border-5 items-center flex flex-row shadow-lg mt-4">
                            <input type="text" v-model="state.lastName" class="w-full h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4" placeholder="Enter your last name" />
                        </div>
                        <div class="h-[60px] text-white bg-white border-primary-blue-200 border-5 items-center flex flex-row shadow-lg mt-4">
                            <select v-model="state.phoneCountryCode" class="w-1/4 h-10 bg-white focus:border-white focus:outline-none border-white text-gray-500 font-bold ml-4">
                                <option disabled value="">Select your country</option>
                                <option v-for="code in state.countryCodes" :key="code.code" :value="code.code">
                                    {{ code.iso_3 }} +{{ code.code }}
                                </option>
                            </select>
                            <input type="text" v-model="state.phoneNumber" class="w-full h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4" placeholder="Enter your phone number" />
                        </div>
                        <div class="h-[60px] text-white bg-white border-primary-blue-200 border-5 items-center flex flex-row shadow-lg mt-4">
                            <input type="text" v-model="state.businessEmail" class="w-full h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4" placeholder="Enter your business email address" />
                        </div>
                        <div class="h-[60px] text-white bg-white border-primary-blue-200 border-5 items-center flex flex-row shadow-lg mt-4">
                            <input type="text" v-model="state.companyName" class="w-full h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4" placeholder="Enter your company/business name" />
                        </div>
                        <div class="h-[60px] text-white bg-white border-primary-blue-200 border-5 items-center flex flex-row shadow-lg mt-4">
                            <select v-model="state.country" class="w-full h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4">
                                <option disabled value="">Select your country</option>
                                <option v-for="code in state.countryCodes" :key="code.name" :value="code.name">
                                    {{ code.name }}
                                </option>
                            </select>
                        </div>
                        <div>
                            <input type="checkbox" v-model="state.agreeToReceiveUpdates" class="mt-5 mr-2 scale-150 cursor-pointer" />
                            <label class="text-white">
                                I agree to receive updates and promotional materials from Data Research Analysis (SMC-Private) Limited.
                            </label>
                        </div>
                        <div class="text-md text-white mt-5">
                            In submitting this form, I confirm that I have read and agree to Data Research Analysis (SMC-Private) Limited's <NuxtLink to="/terms-conditions" class="underline">Terms & Conditions</NuxtLink> and <NuxtLink to="/privacy-policy" class="underline">Privacy Policy</NuxtLink>.
                        </div>
                        <div class="lg:flex lg:flex-col w-full lg:w-full m-auto mt-8">
                            <combo-button label="Join Our Private Beta" color="danger" class="w-full h-10 mr-2 shadow-lg cursor-pointer" @click="applyForPrivateBeta()"/>
                        </div>
                    </div>
                    <div v-else-if="state.privateBetaStep && state.privateBetaStep === 2">
                        <div class="text-xl text-white text-center mt-10">
                            Thank you for applying for a place in our private beta. Our sales team will get in touch with you as soon as possible.
                        </div>
                    </div>
                </div>
            </div>
            <div class="hidden lg:flex lg:flex-row justify-center">
                <div class="w-1/2 flex flex-col mb-20">
                    <div class="text-4xl font-bold text-white text-center mt-15">
                        Join Our Private Beta
                    </div>
                    <div v-if="state.privateBetaStep && state.privateBetaStep === 1" class="text-xl text-white mt-10">
                        Join our private beta today and our team will get you started with Data Research Analysis.
                    </div>
                    <spinner v-if="state.loading" :show="true" class="mt-10"/>
                    <div v-else class="flex flex-row justify-center">
                        <div v-if="state.privateBetaStep && state.privateBetaStep === 1" class="w-3/4 flex flex-col mt-10">
                            <div v-if="state.showAlert"
                                class="w-full self-center text-lg p-5 mb-5 font-bold text-black"
                                :class="{ 'bg-green-400': state.privateBetaSubmissionSuccess, 'bg-red-400': !state.privateBetaSubmissionSuccess }">
                                <div v-if="state.privateBetaSubmissionSuccess" class="text-2xl">Success!</div>
                                <div v-else class="text-2xl">Error!</div>
                                <template v-for="message in state.errorMessages">
                                    <div>{{ message }}</div>
                                </template>
                            </div>
                            <div class="h-[60px] text-white bg-white border-primary-blue-200 border-5 items-center flex flex-row shadow-lg">
                                <input type="text" v-model="state.firstName" class="w-full h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4" placeholder="Enter your first name" />
                            </div>
                            <div class="h-[60px] text-white bg-white border-primary-blue-200 border-5 items-center flex flex-row shadow-lg mt-4">
                                <input type="text" v-model="state.lastName" class="w-full h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4" placeholder="Enter your last name" />
                            </div>
                            <div class="h-[60px] text-white bg-white border-primary-blue-200 border-5 items-center flex flex-row shadow-lg mt-4">
                                <select v-model="state.phoneCountryCode" class="w-1/4 h-10 bg-white focus:border-white focus:outline-none border-white text-gray-500 font-bold ml-4">
                                    <option disabled value="">Select your country</option>
                                    <option v-for="code in state.countryCodes" :key="code.code" :value="code.code">
                                        {{ code.iso_3 }} +{{ code.code }}
                                    </option>
                                </select>
                                <input type="text" v-model="state.phoneNumber" class="w-full h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4" placeholder="Enter your phone number" />
                            </div>
                            <div class="h-[60px] text-white bg-white border-primary-blue-200 border-5 items-center flex flex-row shadow-lg mt-4">
                                <input type="text" v-model="state.businessEmail" class="w-full h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4" placeholder="Enter your business email address" />
                            </div>
                            <div class="h-[60px] text-white bg-white border-primary-blue-200 border-5 items-center flex flex-row shadow-lg mt-4">
                                <input type="text" v-model="state.companyName" class="w-full h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4" placeholder="Enter your company/business name" />
                            </div>
                            <div class="h-[60px] text-white bg-white border-primary-blue-200 border-5 items-center flex flex-row shadow-lg mt-4">
                                <select v-model="state.country" class="w-full h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4">
                                    <option disabled value="">Select your country</option>
                                    <option v-for="code in state.countryCodes" :key="code.name" :value="code.name">
                                        {{ code.name }}
                                    </option>
                                </select>
                            </div>
                            <div>
                                <input type="checkbox" v-model="state.agreeToReceiveUpdates" class="mt-5 mr-2 scale-150 cursor-pointer" />
                                <label class="text-white">
                                    I agree to receive updates and promotional materials from Data Research Analysis (SMC-Private) Limited.
                                </label>
                            </div>
                            <div class="text-md text-white mt-5">
                                In submitting this form, I confirm that I have read and agree to Data Research Analysis (SMC-Private) Limited's <NuxtLink to="/terms-conditions" class="underline">Terms & Conditions</NuxtLink> and <NuxtLink to="/privacy-policy" class="underline">Privacy Policy</NuxtLink>.
                            </div>
                            <div class="lg:flex lg:flex-col w-full lg:w-full m-auto mt-8">
                                <combo-button label="Join Our Private Beta" color="danger" class="w-full h-10 mr-2 shadow-lg cursor-pointer" @click="applyForPrivateBeta()"/>
                            </div>
                        </div>
                        <div v-else-if="state.privateBetaStep && state.privateBetaStep === 2">
                            <div class="text-xl text-white text-center mt-10">
                                Thank you for applying for a place in our private beta. Our sales team will get in touch with you as soon as possible.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>