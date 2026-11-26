<script setup lang="ts">
const router = useRouter();
const route = useRoute();
const { $swal } = useNuxtApp();

const authorId = computed(() => Number(route.params.authorid));
const { author, pending, error } = useAuthor(authorId.value);

interface State {
    name: string;
    slug: string;
    slugManuallyEdited: boolean;
    picture: string;
    linkedin_url: string;
    website_url: string;
    bio: string;
    uploading: boolean;
    submitting: boolean;
}

const state = reactive<State>({
    name: '',
    slug: '',
    slugManuallyEdited: false,
    picture: '',
    linkedin_url: '',
    website_url: '',
    bio: '',
    uploading: false,
    submitting: false,
});

const initialized = ref(false);

watchEffect(() => {
    if (author.value && !initialized.value) {
        // Treat the loaded slug as manually set so the name watcher does not
        // override it during initialization, then re-enable auto-generation.
        state.slugManuallyEdited = true;
        state.name = author.value.name || '';
        state.slug = author.value.slug || '';
        state.picture = author.value.picture || '';
        state.linkedin_url = author.value.linkedin_url || '';
        state.website_url = author.value.website_url || '';
        state.bio = author.value.bio || '';
        initialized.value = true;
        nextTick(() => {
            state.slugManuallyEdited = false;
        });
    }
});

useHead({
    title: 'Edit Author - Admin | Data Research Analysis',
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

const generateSlug = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '');
};

watch(() => state.name, (newName) => {
    if (!state.slugManuallyEdited) {
        state.slug = generateSlug(newName);
    }
});

function onSlugInput(e: Event): void {
    state.slugManuallyEdited = true;
    state.slug = generateSlug((e.target as HTMLInputElement).value);
}

async function onPictureSelected(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) {
        return;
    }
    if (!file.type.startsWith('image/')) {
        $swal.fire({ icon: 'error', title: 'Invalid file', text: 'Please select an image file.' });
        return;
    }

    state.uploading = true;
    try {
        const token = getAuthToken();
        const formData = new FormData();
        formData.append('image', file);
        const response = await $fetch<any>(`${baseUrl()}/admin/image/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
            body: formData,
        });
        const url = response?.urls?.[0]?.url;
        if (!url) {
            throw new Error('No image URL returned');
        }
        state.picture = url;
    } catch (e) {
        $swal.fire({ icon: 'error', title: 'Error!', text: 'The picture could not be uploaded.' });
    } finally {
        state.uploading = false;
    }
}

async function submitForm(): Promise<void> {
    if (!state.name.trim()) {
        $swal.fire({ icon: 'warning', title: 'Required', text: 'Author name is required.' });
        return;
    }
    if (state.bio.length > 512) {
        $swal.fire({ icon: 'warning', title: 'Bio too long', text: 'The bio must be 512 characters or fewer.' });
        return;
    }

    state.submitting = true;
    try {
        const token = getAuthToken();
        await $fetch(`${baseUrl()}/admin/author/edit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
            body: {
                author_id: authorId.value,
                name: state.name.trim(),
                slug: state.slug || null,
                picture: state.picture || null,
                linkedin_url: state.linkedin_url.trim() || null,
                website_url: state.website_url.trim() || null,
                bio: state.bio.trim() || null,
            },
        });
        await $swal.fire({ icon: 'success', title: 'Success!', text: 'The author has been updated.' });
        router.push('/admin/authors');
    } catch (e) {
        $swal.fire({ icon: 'error', title: 'Error!', text: 'The author could not be updated.' });
    } finally {
        state.submitting = false;
    }
}
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="font-bold text-2xl mb-5">
                    Edit Author
                </div>

                <div v-if="pending" class="p-10 text-center text-gray-500">
                    Loading author...
                </div>
                <div v-else-if="error || !author" class="p-10 text-center text-red-500">
                    Author not found.
                </div>

                <form v-else class="max-w-3xl" @submit.prevent="submitForm">
                    <BaseFormField label="Name" required>
                        <BaseInput id="name" v-model="state.name" placeholder="Author name" required />
                    </BaseFormField>

                    <BaseFormField label="Slug" hint="Auto-generated from the name. You can edit it.">
                        <BaseInput id="slug" v-model="state.slug" placeholder="author-slug" @input="onSlugInput" />
                    </BaseFormField>

                    <BaseFormField label="Picture" hint="Upload a square profile photo for the author.">
                        <div class="flex items-center gap-4">
                            <img
                                v-if="state.picture"
                                :src="state.picture"
                                alt="Author picture preview"
                                class="w-20 h-20 rounded-full object-cover border border-gray-200"
                            />
                            <div v-else class="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                <font-awesome icon="fas fa-user" class="text-2xl" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <BaseFileInput
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    :drag-and-drop="false"
                                    :disabled="state.uploading"
                                    @update:files="onPictureSelected"
                                />
                                <span v-if="state.uploading" class="text-sm text-gray-500">Uploading...</span>
                                <button
                                    v-if="state.picture"
                                    type="button"
                                    class="text-sm text-red-600 hover:underline self-start"
                                    @click="state.picture = ''"
                                >
                                    Remove picture
                                </button>
                            </div>
                        </div>
                    </BaseFormField>

                    <BaseFormField label="LinkedIn URL">
                        <BaseInput id="linkedin_url" v-model="state.linkedin_url" type="url" placeholder="https://www.linkedin.com/in/..." />
                    </BaseFormField>

                    <BaseFormField label="Website URL">
                        <BaseInput id="website_url" v-model="state.website_url" type="url" placeholder="https://example.com" />
                    </BaseFormField>

                    <BaseFormField label="Short Bio" hint="Shown at the bottom of each article written by this author.">
                        <BaseTextarea
                            id="bio"
                            v-model="state.bio"
                            :maxlength="512"
                            :rows="4"
                            show-counter
                            placeholder="A short bio (max 512 characters)"
                        />
                    </BaseFormField>

                    <div class="flex gap-3 mt-6">
                        <button
                            type="submit"
                            :disabled="state.submitting || state.uploading"
                            class="px-6 py-2 text-sm bg-primary-blue-100 text-white hover:bg-primary-blue-300 font-bold shadow-md rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {{ state.submitting ? 'Saving...' : 'Update Author' }}
                        </button>
                        <button
                            type="button"
                            class="px-6 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold shadow-md rounded-lg cursor-pointer"
                            @click="router.push('/admin/authors')"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
