<script setup>
    import { useEditor, EditorContent } from '@tiptap/vue-3'
    import StarterKit from '@tiptap/starter-kit'
    import Bold from '@tiptap/extension-bold'
    import Italic from '@tiptap/extension-italic'
    import Heading from '@tiptap/extension-heading'
    import Strike from '@tiptap/extension-strike'
    import Underline from '@tiptap/extension-underline'
    import Link from '@tiptap/extension-link'
    import Code from '@tiptap/extension-code'
    import Image from '@tiptap/extension-image'
    import FileHandler from '@tiptap/extension-file-handler'
    import OrderedList from '@tiptap/extension-ordered-list'
    import BulletList from '@tiptap/extension-bullet-list'
    import Dropcursor from '@tiptap/extension-dropcursor'
    import Placeholder from '@tiptap/extension-placeholder'

    
    // Initialize the editor
    const editor = useEditor({
        content: '',
        extensions: [ 
            StarterKit, Bold,
            Italic, Heading,
            Strike, Underline,
            Link.configure({
                openOnClick: false,
                defaultProtocol: 'https', 
                HTMLAttributes: {
                    class: 'text-blue-500 hover:text-blue-700 underline cursor-pointer',
                },
            }),
            Code.configure({
                HTMLAttributes: {
                    class: 'bg-gray-200 p-1',
                },
            }),
            Placeholder.configure({
                placeholder: 'Type your text here...',
                emptyEditorClass: "before:content-[attr(data-placeholder)] before:float-left before:text-[#adb5bd] before:h-0 before:pointer-events-none",
            }),
            Image,
            FileHandler.configure({
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
                onDrop: (currentEditor, files, pos) => {
                    files.forEach(file => {
                    const fileReader = new FileReader()

                    fileReader.readAsDataURL(file)
                    fileReader.onload = () => {
                        currentEditor.chain().insertContentAt(pos, {
                        type: 'image',
                        attrs: {
                            src: fileReader.result,
                        },
                        }).focus().run()
                    }
                    })
                },
                onPaste: (currentEditor, files) => {
                    files.forEach(file => {
                    const fileReader = new FileReader()

                    fileReader.readAsDataURL(file)
                    fileReader.onload = () => {
                        currentEditor.chain().insertContentAt(currentEditor.state.selection.anchor, {
                        type: 'image',
                        attrs: {
                            src: fileReader.result,
                        },
                        }).focus().run()
                    }
                    })
                },
            }),
            OrderedList.configure({
                HTMLAttributes: {
                    class: 'list-decimal pl-5',
                },
            }),
            BulletList.configure({
                HTMLAttributes: {
                    class: 'list-disc pl-5',
                },
            }),
            Dropcursor.configure({
                color: '#3c8dbc',
                width: 3,
            }),
        ],
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-2 focus:outline-none',
            },
        }
    });

    const state = reactive({
        editor: null,
        content: null
    });
    const props = defineProps({
        buttons: {
            type: Array,
            default: () => ['bold', 'italic', 'heading', 'undo', 'redo']
        },
        content: {
            type: String,
            default: ''
        },
        minHeight: {
            type: String,
            default: '200'
        }
    });
    const buttons = computed(() => props.buttons);
    watch(() => props.content, (newContent) => {
        if (editor.value) {
            editor.value.commands.setContent(newContent);
        }
    }, { immediate: true });
    function setLink() {
        if (!editor.value.isActive('link')) {
            const previousUrl = editor.value.getAttributes('link').href;
            const url = window.prompt('URL', previousUrl);
            // cancelled
            if (url === null) {
                return
            }
    
            // empty
            if (url === '') {
                editor
                .value
                .chain()
                .focus()
                .extendMarkRange('link')
                .unsetLink()
                .run()
        
                return
            }
        
            // update link
            editor
                .value  
                .chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href: url })
                .run()

        } else {
            editor.value.chain().focus().unsetLink().run();
        }
    }
    function setImage() {
        const imageUrl = window.prompt('Image URL');
        if (imageUrl) {
            editor.value.chain().focus().setImage({ src: imageUrl }).run();
        }
    }
    onMounted(() => {
        //set the minimum height of the editor
        const editorPropsAttributesClass = editor.value.extensionManager.editor.options.editorProps.attributes.class;
        editor.value.extensionManager.editor.options.editorProps.attributes.class = `min-h-${props.minHeight} ${editorPropsAttributesClass}`;
        editor.value.commands.setContent(props.content);

    });
    onBeforeUnmount(() => {
        // Clean up the editor instance when the component is unmounted
        if (editor.value) {
            editor.value.destroy();
        }
    });
</script>
<template>
    <div v-if="editor">
        <div class="flex flex-wrap justify-start">
            <div class="bg-white border border-gray-300 mb-2">
                <span v-for="button in props.buttons">
                    <button v-if="button === 'bold'" @click="editor.chain().focus().toggleBold().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer" :class="{ 'bg-gray-200': editor.isActive('bold') }">
                        <font-awesome icon="fas fa-bold"/>
                    </button>
                    <button v-if="button === 'italic'" @click="editor.chain().focus().toggleItalic().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer" :class="{ 'bg-gray-200': editor.isActive('italic') }">
                        <font-awesome icon="fas fa-italic"/>
                    </button>
                    <button v-if="button === 'heading'" >
                        <menu-dropdown class="z-10" direction="right">
                            <template #menuItem="{ onClick }">
                                <div @click="onClick" class="p-2 m-1 hover:bg-gray-200 cursor-pointer">
                                    <font-awesome icon="fas fa-heading" />
                                </div>
                            </template>
                            <template #dropdownMenu="{ onClick }">
                                <div class="flex flex-col w-40 text-center">
                                    <div @click="() => {onClick(); editor.chain().focus().toggleHeading({ level: 1 }).run();}" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer border-b-1 border-primary-blue-100 border-solid pt-1 pb-1" :class="{ 'bg-gray-200': editor.isActive('heading', { level: 1 }) }">H1</div>
                                    <div @click="() => {onClick(); editor.chain().focus().toggleHeading({ level: 2 }).run();}" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer border-b-1 border-primary-blue-100 border-solid pt-1 pb-1" :class="{ 'bg-gray-200': editor.isActive('heading', { level: 2 }) }">H2</div>
                                    <div @click="() => {onClick(); editor.chain().focus().toggleHeading({ level: 3 }).run();}" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer border-b-1 border-primary-blue-100 border-solid pt-1 pb-1" :class="{ 'bg-gray-200': editor.isActive('heading', { level: 3 }) }">H3</div>
                                    <div @click="() => {onClick(); editor.chain().focus().toggleHeading({ level: 4 }).run();}" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer border-b-1 border-primary-blue-100 border-solid pt-1 pb-1" :class="{ 'bg-gray-200': editor.isActive('heading', { level: 4 }) }">H4</div>
                                    <div @click="() => {onClick(); editor.chain().focus().toggleHeading({ level: 5 }).run();}" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer border-b-1 border-primary-blue-100 border-solid pt-1 pb-1" :class="{ 'bg-gray-200': editor.isActive('heading', { level: 5 }) }">H5</div>
                                    <div @click="() => {onClick(); editor.chain().focus().toggleHeading({ level: 6 }).run();}" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer border-b-1 border-primary-blue-100 border-solid pt-1 pb-1" :class="{ 'bg-gray-200': editor.isActive('heading', { level: 6 }) }">H6</div>
                                </div>
                            </template>
                        </menu-dropdown>
                    </button>
                    <button v-if="button === 'strike'" @click="editor.chain().focus().toggleStrike().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer" :class="{ 'bg-gray-200': editor.isActive('strike') }">
                        <font-awesome icon="fas fa-strikethrough"/>
                    </button>
                    <button v-if="button === 'underline'" @click="editor.chain().focus().toggleUnderline().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer" :class="{ 'bg-gray-200': editor.isActive('underline') }">
                        <font-awesome icon="fas fa-underline"/>
                    </button>
                    <button v-if="button === 'link'" @click="setLink" class="p-2 m-1 hover:bg-gray-200 cursor-pointer" :class="{ 'bg-gray-200': editor.isActive('link') }">
                        <font-awesome icon="fas fa-link"/>
                    </button>
                    <button v-if="button === 'code'" @click="editor.chain().focus().toggleCode().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer" :class="{ 'bg-gray-200': editor.isActive('code') }">
                        <font-awesome icon="fas fa-code"/>
                    </button>
                    <button v-if="button === 'image'" @click="setImage" class="p-2 m-1 hover:bg-gray-200 cursor-pointer" :class="{ 'bg-gray-200': editor.isActive('image') }">
                        <font-awesome icon="fas fa-image"/>
                    </button>
                    <button v-if="button === 'ordered-list'" @click="editor.chain().focus().toggleOrderedList().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer" :class="{ 'bg-gray-200': editor.isActive('orderedList') }">
                        <font-awesome icon="fas fa-list-ol"/>
                    </button>
                    <button v-if="button === 'bullet-list'" @click="editor.chain().focus().toggleBulletList().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer" :class="{ 'bg-gray-200': editor.isActive('bulletList') }">
                        <font-awesome icon="fas fa-list"/>
                    </button>
                    <button v-if="button === 'undo'" @click="editor.chain().focus().undo().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer" :disabled="!editor.can().undo()">
                        <font-awesome icon="fas fa-rotate-left"/>
                    </button>
                    <button v-if="button === 'redo'" @click="editor.chain().focus().redo().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer" :disabled="!editor.can().redo()">
                        <font-awesome icon="fas fa-rotate-right"/>
                    </button>
                </span>
            </div>
        </div>
        <editor-content v-model="state.content" :editor="editor" class="text-block-editor-content bg-white p-2 cursor-text border border-2 solid border-gray-200" />
    </div>
</template>
