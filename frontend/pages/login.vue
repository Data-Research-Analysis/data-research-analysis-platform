<script setup>
import { onMounted, reactive } from "vue";
import { useReCaptcha } from "vue-recaptcha-v3";
const router = useRouter();
const recaptcha = useReCaptcha();

const state = reactive({
    email: "",
    password: "",
    emailError: false,
    passwordError: false,
    errorMessages: [],
    loginSuccess: false,
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

async function loginUser() {
    state.loading = true;
    state.showAlert = false;
    state.loginSuccess = false;
    state.errorMessages = [];
  
    if (!validate(state.email, "", [validateEmail, validateRequired])) {
        state.emailError = true;
        state.errorMessages.push("Please enter a valid email address.");
    } else {
        state.emailError = false;
    }

    if (!validate(state.password, "", [validateRequired])) {
        state.passwordError = true;
        state.errorMessages.push("Please enter a valid password.");
    } else {
        state.passwordError = false;
    }

    if (state.emailError || state.passwordError) {
        state.loginSuccess = false;
        state.showAlert = true;
    } else {
        const recaptchaToken = await getRecaptchaToken(recaptcha, 'loginForm');
        if (recaptchaToken) {
            const recaptchaResponse = await verifyRecaptchaToken(state.token, recaptchaToken);
            if (recaptchaResponse.success && recaptchaResponse.action === "loginForm" && recaptchaResponse.score > 0.8) {
                const requestOptions = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${state.token}`,
                },
                body: JSON.stringify({
                  email: state.email,
                  password: state.password,
                }),
              };
              const response = await fetch(`${baseUrl()}/auth/login`, requestOptions);
              if (response.status === 200) {
                state.loginSuccess = true;
                state.showAlert = true;
                const data = await response.json();
                // state.errorMessages.push(data.message);
                setAuthToken(data.token);
                router.push('/projects');
              } else {
                state.loginSuccess = false;
                state.showAlert = true;
                const data = await response.json();
                state.errorMessages.push(data.message);
              }
            } else {
                state.loginSuccess = false;
                state.showAlert = true;
                state.errorMessages.push("Recaptcha verification failed. Please refresh the page and try again.");
            }         
        } else {
            state.loginSuccess = false;
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
                Data Research Analysis Login
            </div>
            <div class="self-center text-md mb-5">
               Please enter your details to login in your account. All of the fields are required to be filled.
            </div>
            <div v-if="state.showAlert"
                class="w-3/4 self-center text-lg p-5 mb-5 font-bold text-black"
                :class="{ 'bg-green-400': state.loginSuccess, 'bg-red-400': !state.loginSuccess }">
                <div v-if="state.loginSuccess" class="text-2xl">Success!</div>
                <div v-else class="text-2xl">Error!</div>
                <template v-for="message in state.errorMessages">
                    <div>{{ message }}</div>
                </template>
            </div>
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
                :disabled="state.loading"
            />
            <spinner v-if="state.loading"/>
            <div
                v-else
                class="w-1/4 text-center self-center mb-5 p-2 m-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md"
                @click="loginUser"
            >
                Login
            </div>
        </div>
    </div>
</template>