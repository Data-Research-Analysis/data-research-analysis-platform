<script setup>
import { useReCaptcha } from "vue-recaptcha-v3";
const recaptcha = useReCaptcha();

const state = reactive({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    rePassword: "",
    firstNameError: false,
    lastNameError: false,
    emailError: false,
    passwordError: false,
    rePasswordError: false,
    errorMessages: [],
    registrationSuccess: false,
    showAlert: false,
    token: "",
    loading: false,
});

async function getToken() {
    state.loading = true;
    const response = await getGeneratedToken();
    state.token = response.token;
    state.loading = false;
}

async function createAccount() {
    state.loading = true;
    state.showAlert = false;
    state.registrationSuccess = false;
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

    if (!validate(state.email, "", [validateEmail, validateRequired])) {
        state.emailError = true;
        state.errorMessages.push("Please enter a valid email address.");
    } else {
        state.emailError = false;
    }

    if (!validate(state.password, "", [validatePassword, validateRequired])) {
        state.passwordError = true;
        state.errorMessages.push("Please enter a valid password.");
    } else {
        state.passwordError = false;
    }

    if (!validate(state.password, state.rePassword, [validateSamePassword])) {
        state.passwordError = true;
        state.rePasswordError = true;
        state.errorMessages.push("Both the passwords must be the same.");
    } else {
        state.rePasswordError = false;
    }

    if (state.firstNameError || state.lastNameError || state.emailError || state.passwordError || state.rePasswordError) {
        state.registrationSuccess = false;
        state.showAlert = true;
    } else {
        const recaptchaToken = await getRecaptchaToken(recaptcha, 'registerForm');
        if (recaptchaToken) {
            const recaptchaResponse = await verifyRecaptchaToken(state.token, recaptchaToken);
            if (recaptchaResponse.success && recaptchaResponse.action === "registerForm" && recaptchaResponse.score > 0.8) {
                const requestOptions = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${state.token}`,
                    "Authorization_Type": "non-auth",
                },
                body: JSON.stringify({
                  first_name: state.firstName,
                  last_name: state.lastName,  
                  email: state.email,
                  password: state.password,
                }),
              };
              const response = await fetch(`${baseUrl()}/auth/register`, requestOptions);
              if (response.status === 200) {
                state.registrationSuccess = true;
                state.showAlert = true;
                const data = await response.json();
                state.errorMessages.push(data.message);
              } else {
                state.registrationSuccess = false;
                state.showAlert = true;
                const data = await response.json();
                state.errorMessages.push(data.message);
              }
            } else {
                state.registrationSuccess = false;
                state.showAlert = true;
                state.errorMessages.push("Recaptcha verification failed. Please refresh the page and try again.");    
            }
        } else {
            state.registrationSuccess = false;
            state.showAlert = true;
            state.errorMessages.push("Recaptcha verification failed. Please refresh the page and try again.");
        }
    }
    state.loading = false;
}

onMounted(async () => {
    await getToken();
})
</script>
<template>
    <div class="mt-10 flex flex-row justify-center w-full">
        <div class="mt-10 flex flex-col justify-center w-1/2 border border-primary-blue-100 border-solid m-10 p-5 shadow-md">
            <div class="self-center font-bold text-2xl mb-5">
                Data Research Analysis Registration
            </div>
            <div class="self-center text-md mb-5">
               Please enter your details to create an account. All of the fields are required to be filled.
            </div>
            <div v-if="state.showAlert"
                class="w-3/4 self-center text-lg p-5 mb-5 font-bold text-black"
                :class="{ 'bg-green-400': state.registrationSuccess, 'bg-red-400': !state.registrationSuccess }">
                <div v-if="state.registrationSuccess" class="text-2xl">Success!</div>
                <div v-else class="text-2xl">Error!</div>
                <template v-for="message in state.errorMessages">
                    <div>{{ message }}</div>
                </template>
            </div>
            <input
                v-model="state.firstName"
                type="text"
                class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
                :class="!state.firstNameError ? '' : 'bg-red-300 text-black'"
                placeholder="First Name"
                :disabled="state.loading"
            />
            <input
                v-model="state.lastName"
                type="text"
                class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
                :class="!state.lastNameError ? '' : 'bg-red-300 text-black'"
                placeholder="Last Name"
                :disabled="state.loading"
            />
            <input
                v-model="state.email"
                type="text"
                class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
                :class="!state.emailError ? '' : 'bg-red-300 text-black'"
                placeholder="Email"
                :disabled="state.loading"
            />
            <input
                v-model="state.password"
                type="password"
                class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
                :class="!state.passwordError ? '' : 'bg-red-300 text-black'"
                placeholder="Password"
                v-tippy="{ content: 'Password should be atleast 8 characters in length, have aleast one lowercase character, atleast one upper case character, atleast a number between 0 and 9 and atleast one special character (#?!@$%^&*-).' }"
                :disabled="state.loading"
            />
            <input
                v-model="state.rePassword"
                type="password"
                class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
                :class="!state.rePasswordError ? '' : 'bg-red-300 text-black'"
                placeholder="Repeat Password"
                v-tippy="{ content: 'Repeast Password should be the same as the Password given above.' }"
                :disabled="state.loading"
            />
            <spinner v-if="state.loading"/>
            <div
                v-else
                class="w-1/4 text-center self-center mb-5 p-2 m-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md"
                @click="createAccount"
            >
                Create Account
            </div>
        </div>
    </div>
</template>