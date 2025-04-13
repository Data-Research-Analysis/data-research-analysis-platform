<script setup>
import { useReCaptcha } from "vue-recaptcha-v3";
const router = useRouter();
const route = useRoute();
const recaptcha = useReCaptcha();

const state = reactive({
    unsubscribeSuccess: false,
    token: "",
    code: "",
    codeError: false,
});

async function getToken() {
    state.loading = true;
    const response = await getGeneratedToken();
    state.token = response.token;
    state.loading = false;
}

async function unsubscribe() {
    state.unsubscribeSuccess = false;
  
    if (!validate(state.code, "", [validateRequired])) {
        state.codeError = true;
    } else {
        state.codeError = false;
    }

    if (state.codeError) {
        state.unsubscribeSuccess = false;
    } else {
        const requestOptions = {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.token}`,
                "Authorization-Type": "non-auth",
            },
        };
        const response = await fetch(`${baseUrl()}/auth/unsubscribe/${encodeURIComponent(state.code)}`, requestOptions);
        if (response.status === 200) {
            state.unsubscribeSuccess = true;
        } else {
            state.unsubscribeSuccess = false;
        }
    }
}

onMounted(async () => {
    await getToken();
    state.code = route.params.code;
    await unsubscribe();
})
</script>
<template>
    <div class="min-h-100 mt-10 flex flex-row justify-center w-full">
        <div class="flex flex-col justify-center w-1/2 border border-primary-blue-100 border-solid p-10 shadow-md">
            <div v-if="state.unsubscribeSuccess" class="self-center font-bold text-2xl mb-5">
			  Unsubscribed From Our Emails!
            </div>
            <div v-else class="self-center font-bold text-2xl mb-5">
                Unsubscribing Failed!
            </div>
            <div v-if="state.unsubscribeSuccess" class="self-center text-md mb-5">
               We are sorry to see you go, but we understand that you may not want to receive our emails anymore.
               If you want to subscribe to our emails again, then please send us an email at <a href="mailto:mustafa.neguib@dataresearchanalysis.com" class="hover:text-gray-500">mustafa.neguib@dataresearchanalysis.com</a>.
               Please note that you will not be receiving any emails even if they are extremely critical and are related your account.
            </div>
            <div v-else class="self-center text-md mb-5">
               We could not unsubscribe you from our emails due to the incorrect verification code provided. Please try again from a more recent email that you may have received from us.
            </div>
        </div>
    </div>
</template>