<script setup>
    import { useEditor, EditorContent } from '@tiptap/vue-3'
    import Document from '@tiptap/extension-document'
    import Bold from '@tiptap/extension-bold'
    import Italic from '@tiptap/extension-italic'
    import Heading from '@tiptap/extension-heading'
    import Strike from '@tiptap/extension-strike'
    import Underline from '@tiptap/extension-underline'
    import Link from '@tiptap/extension-link'
    import Code from '@tiptap/extension-code'
    import Image from '@tiptap/extension-image'
    import FileHandler from '@tiptap/extension-file-handler'
    import ListItem from '@tiptap/extension-list-item'
    import OrderedList from '@tiptap/extension-ordered-list'
    import BulletList from '@tiptap/extension-bullet-list'
    import Dropcursor from '@tiptap/extension-dropcursor'
    import Placeholder from '@tiptap/extension-placeholder'
    import Text from '@tiptap/extension-text'
    import Paragraph from '@tiptap/extension-paragraph'
    import History from '@tiptap/extension-history'
    import TextAlign from '@tiptap/extension-text-align'
    import Blockquote from '@tiptap/extension-blockquote'
    import { Markdown } from '@tiptap/markdown'

    const emits = defineEmits(['update:content', 'update:markdown']);
    const state = reactive({
        content: null,
    });
    
    // Phase 1: View state management for HTML/Markdown toggle
    const viewMode = ref('wysiwyg'); // 'wysiwyg' or 'markdown'
    
    // Phase 3: Markdown content for raw view
    const markdownContent = ref('');
    
    // Track uploading images
    const uploadingImages = ref(new Set());
    
    // Initialize the editor
    const editor = useEditor({
        content: '',
        extensions: [ 
            Document,
            Text,
            Paragraph,
            // Load Markdown early so other extensions can override its behavior
            Markdown.configure({
                html: true,                 // Allow HTML in markdown (for images)
                tightLists: true,
                tightListClass: 'tight',
                bulletListMarker: '-',
                linkify: false,
                transformPastedText: false,
                transformCopiedText: false,
            }),
            Bold,
            Italic, 
            Heading,
            Strike, 
            Underline,
            Link.configure({
                openOnClick: false,
                protocols: ['https', 'http'],
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
            ListItem,
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
            Blockquote.configure({
                HTMLAttributes: {
                    class: 'border-l-2 border-gray-300 pl-4 italic text-gray-600',
                },
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            History,
            Dropcursor.configure({
                color: '#3c8dbc',
                width: 3,
            }),
            // Image extension - load after Markdown to override image handling
            Image.configure({
                inline: true,
                allowBase64: false,
                HTMLAttributes: {
                    class: 'max-w-full h-auto',
                },
            }),
            FileHandler.configure({
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
                onDrop: (currentEditor, files, pos) =>  {
                    console.log('FileHandler onDrop triggered with files:', files);
                    files.forEach(file => {
                        console.log('Processing file:', file.name, file.type);
                        if (file && file.type.startsWith('image/')) {
                            console.log('Uploading image...');
                            handleImageUpload(file).then(imageUrl => {
                                console.log('Image uploaded successfully, URL:', imageUrl);
                                console.log('Inserting at position:', pos);
                                
                                // Try setting image using setImage command instead of insertContentAt
                                currentEditor
                                    .chain()
                                    .focus()
                                    .setImage({ src: imageUrl })
                                    .run();
                                    
                                console.log('Image insertion command executed');
                            }).catch(error => {
                                console.error('Error uploading image:', error);
                                alert('Failed to upload image. Please try again.');
                            });
                        }
                    });
                },
                onPaste: (currentEditor, files, htmlContent) => {
                    // Only handle if there are actual image files
                    if (files.length === 0) {
                        // No files, let other extensions handle the paste (like Markdown)
                        return false;
                    }
                    
                    files.forEach(file => {
                        if (file && file.type.startsWith('image/')) {
                            handleImageUpload(file).then(imageUrl => {
                                currentEditor.chain().focus().setImage({src: imageUrl}).run();
                            }).catch(error => {
                                console.error('Error uploading image:', error);
                                alert('Failed to upload image. Please try again.');
                            });
                        }
                    });
                    
                    return true; // Indicate that we handled the paste
                },
            }),
        ],
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-2 focus:outline-none',
            },
            handlePaste: (view, event) => {
                // Check if there are files in the clipboard (images)
                const files = Array.from(event.clipboardData?.files || []);
                if (files.length > 0 && files.some(file => file.type.startsWith('image/'))) {
                    // Let FileHandler extension handle image paste
                    return false;
                }
                
                // Get the plain text from clipboard
                const text = event.clipboardData?.getData('text/plain');
                
                // If there's text that looks like markdown, insert it as markdown
                if (text && (
                    text.match(/^#{1,6}\s/) ||           // Headings
                    text.includes('**') ||               // Bold
                    text.includes('__') ||               // Bold alt
                    text.includes('*') && !text.match(/^\*\s/) ||  // Italic (not just list)
                    text.match(/^[-*+]\s/m) ||          // Unordered lists
                    text.match(/^\d+\.\s/m) ||          // Ordered lists
                    text.includes('[') && text.includes('](') ||  // Links
                    text.includes('```') ||             // Code blocks
                    text.includes('`') ||               // Inline code
                    text.match(/^>\s/m)                 // Blockquotes
                )) {
                    // Prevent default paste behavior
                    event.preventDefault();
                    
                    // Insert content as markdown using the editor's markdown manager
                    const { state } = view;
                    const { tr } = state;
                    
                    try {
                        // Use insertContent with contentType='markdown'
                        editor.value?.chain()
                            .focus()
                            .insertContent(text, { contentType: 'markdown' })
                            .run();
                        
                        return true; // Handled
                    } catch (error) {
                        console.error('Error pasting markdown:', error);
                        return false; // Fall back to default
                    }
                }
                
                // For regular text, use default paste behavior
                return false;
            },
        },
        onUpdate: ({ editor }) => {
            // Update the content state whenever the editor content changes
            emits('update:content', editor.getHTML());
            emits('update:markdown', editor.getMarkdown());
        },
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
        },
        inputFormat: {
            type: String,
            default: 'html',  // 'html' or 'markdown'
            validator: (value) => ['html', 'markdown'].includes(value)
        }
    });
    const buttons = computed(() => props.buttons);
    
    // Computed property to detect if current content is markdown format
    const editorFormat = computed(() => {
        const content = props.content || '';
        const isHTML = content.trim().startsWith('<') || content.includes('</');
        return props.inputFormat === 'markdown' && !isHTML ? 'markdown' : 'html';
    });
    
    // Computed property to determine if view toggle should be available
    const canToggleView = computed(() => {
        // Only allow toggle when working with markdown content
        return props.inputFormat === 'markdown';
    });
    
    // Helper methods to get content in different formats
    function getMarkdown() {
        return editor.value?.getMarkdown() || '';
    }
    
    function getHTML() {
        return editor.value?.getHTML() || '';
    }
    
    // Watch for content changes and update editor
    watch([() => props.content, editor], ([newContent, editorInstance]) => {
        // Skip if editor hasn't been created yet or no content
        if (!editorInstance || !newContent) {
            return;
        }
        
        // Get current content to compare
        const currentContent = editorInstance.getHTML();
        
        // Only update if content is different to avoid infinite loops
        if (currentContent === newContent) {
            return;
        }
        
        // Detect if content is HTML or markdown
        const isHTML = newContent.trim().startsWith('<') || newContent.includes('</');
        
        // Handle content based on actual content type and input format
        if (props.inputFormat === 'markdown' && !isHTML) {
            editorInstance.commands.setContent(newContent, { contentType: 'markdown' });
        } else if (props.inputFormat === 'markdown' && isHTML) {
            editorInstance.commands.setContent(newContent, { contentType: 'html' });
        } else {
            editorInstance.commands.setContent(newContent, { contentType: 'html' });
        }
    }, { immediate: true });
    function setLink() {
        // Only use window.prompt on client side for SSR compatibility
        if (!import.meta.client) return;
        
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
        // Only use window.prompt on client side for SSR compatibility
        if (!import.meta.client) return;
        
        const imageUrl = window.prompt('Image URL');
        if (imageUrl) {
            editor.value.chain().focus().setImage({ src: imageUrl }).run();
        }
    }
    function setTextAlign(align) {
        if (editor.value.isActive({ textAlign: align })) {
            editor.value.chain().focus().unsetTextAlign().run();
        } else {
            editor.value.chain().focus().setTextAlign(align).run();
        }
    }
    
    // Phase 2 & 4: Toggle view mode function with enhanced sync
    function toggleViewMode() {
        if (viewMode.value === 'wysiwyg') {
            // Switching to markdown view - get current markdown from editor
            if (editor.value) {
                try {
                    markdownContent.value = editor.value.getMarkdown() || '';
                    viewMode.value = 'markdown';
                } catch (error) {
                    console.error('Error getting markdown content:', error);
                    // Fallback: try to get HTML and show warning
                    markdownContent.value = '<!-- Error: Could not convert to markdown -->\n' + 
                                          (editor.value.getHTML() || '');
                    viewMode.value = 'markdown';
                }
            }
        } else {
            // Switching back to WYSIWYG - parse markdown back to editor
            if (editor.value) {
                try {
                    // Only update if content has changed
                    const currentMarkdown = editor.value.getMarkdown() || '';
                    if (markdownContent.value !== currentMarkdown) {
                        editor.value.commands.setContent(markdownContent.value || '', { 
                            contentType: 'markdown' 
                        });
                    }
                } catch (error) {
                    console.error('Error parsing markdown content:', error);
                    // Try to set as HTML fallback
                    try {
                        editor.value.commands.setContent(markdownContent.value || '', {
                            contentType: 'html'
                        });
                    } catch (htmlError) {
                        console.error('Error setting content:', htmlError);
                    }
                }
            }
            viewMode.value = 'wysiwyg';
        }
    }
    
    // Phase 5: Watch for external content changes when in markdown view
    watch(() => props.content, (newContent) => {
        // If in markdown view and content changes externally, update markdown view
        if (viewMode.value === 'markdown' && editor.value && newContent) {
            try {
                // Temporarily set content in editor (hidden) to get markdown
                const currentHtml = editor.value.getHTML();
                if (currentHtml !== newContent) {
                    editor.value.commands.setContent(newContent, { contentType: 'html' });
                    markdownContent.value = editor.value.getMarkdown() || '';
                }
            } catch (error) {
                console.error('Error syncing markdown view:', error);
            }
        }
    });
    
    // Phase 5: Watch markdown content changes and emit updates
    watch(markdownContent, (newMarkdown) => {
        // When user edits markdown directly, emit the changes
        if (viewMode.value === 'markdown' && editor.value) {
            try {
                // Parse markdown to HTML for the content emit
                const tempDiv = document.createElement('div');
                editor.value.commands.setContent(newMarkdown || '', { contentType: 'markdown' });
                const html = editor.value.getHTML();
                emits('update:content', html);
                emits('update:markdown', newMarkdown);
            } catch (error) {
                console.error('Error emitting markdown changes:', error);
            }
        }
    });
    
    // Phase 6: Handle tab key in markdown textarea for better UX
    function handleTabInMarkdown(event) {
        const textarea = event.target;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        // Insert tab character (2 spaces for markdown)
        const spaces = '  ';
        markdownContent.value = 
            markdownContent.value.substring(0, start) + 
            spaces + 
            markdownContent.value.substring(end);
        
        // Move cursor after inserted spaces
        nextTick(() => {
            textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
        });
    }
    
    async function handleImageUpload(file) {
        const uploadId = Date.now() + Math.random()
        uploadingImages.value.add(uploadId)
        
        try {
            const token = getAuthToken();
            const formData = new FormData();
            formData.append('image', file);
            
            const backendUrl = baseUrl();
            let url = `${backendUrl}/admin/image/upload`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: formData,
            });
            
            if (!response.ok) {
                throw new Error('Image upload failed');
            }
            
            const data = await response.json();
            console.log('Backend response data:', data);
            
            // Extract the image URL from the response
            // Backend returns {urls: [{path: "/backend/public/uploads/filename.png", ...}]}
            let imagePath;
            if (data.url) {
                imagePath = data.url;
            } else if (data.urls && data.urls.length > 0 && data.urls[0].path) {
                // Remove '/backend/public' prefix to get just '/uploads/filename.png'
                imagePath = data.urls[0].path.replace('/backend/public', '');
            } else if (data.path) {
                imagePath = data.path.replace('/backend/public', '');
            }
            
            // Construct the full URL with backend base URL
            const imageUrl = `${backendUrl}${imagePath}`;
            
            console.log('Extracted image path:', imagePath);
            console.log('Full image URL:', imageUrl);
            return imageUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        } finally {
            uploadingImages.value.delete(uploadId)
        }
    }
    onMounted(() => {
        //set the minimum height of the editor
        if (editor.value) {
            const editorPropsAttributesClass = editor.value.options.editorProps.attributes.class;
            editor.value.options.editorProps.attributes.class = `min-h-${props.minHeight} ${editorPropsAttributesClass}`;
        }
    });
    onBeforeUnmount(() => {
        // Clean up the editor instance when the component is unmounted
        if (editor.value) {
            editor.value.destroy();
        }
    });
</script>
<template>
    <div v-if="editor" class="relative">
        <!-- Upload indicator -->
        <div v-if="uploadingImages.size > 0" 
             class="absolute top-2 right-2 z-50 bg-blue-500 text-white px-3 py-1 rounded-lg text-sm shadow-lg flex items-center gap-2">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Uploading image...</span>
        </div>
        
        <div class="flex flex-wrap justify-between items-start">
            <div class="bg-white border border-gray-300 mb-2 rounded-lg p-1">
                <span v-for="button in props.buttons">
                    <button v-if="button === 'bold'" @click="editor.chain().focus().toggleBold().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive('bold') }">
                        <font-awesome icon="fas fa-bold" :v-tippy-content="'Bold'"/>
                    </button>
                    <button v-if="button === 'italic'" @click="editor.chain().focus().toggleItalic().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive('italic') }">
                        <font-awesome icon="fas fa-italic" :v-tippy-content="'Italic'"/>
                    </button>
                    <button v-if="button === 'heading'" >
                        <menu-dropdown class="z-10" direction="right">
                            <template #menuItem="{ onClick }">
                                <div @click="onClick" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded">
                                    <font-awesome icon="fas fa-heading" :v-tippy-content="'Heading'"/>
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
                    <button v-if="button === 'strike'" @click="editor.chain().focus().toggleStrike().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive('strike') }">
                        <font-awesome icon="fas fa-strikethrough" :v-tippy-content="'Strike'"/>
                    </button>
                    <button v-if="button === 'underline'" @click="editor.chain().focus().toggleUnderline().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive('underline') }">
                        <font-awesome icon="fas fa-underline" :v-tippy-content="'Underline'"/>
                    </button>
                    <button v-if="button === 'link'" @click="setLink" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive('link') }">
                        <font-awesome icon="fas fa-link" :v-tippy-content="'Link'"/>
                    </button>
                    <button v-if="button === 'code'" @click="editor.chain().focus().toggleCode().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive('code') }">
                        <font-awesome icon="fas fa-code" :v-tippy-content="'Code'"/>
                    </button>
                    <button v-if="button === 'image'" @click="setImage" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive('image') }">
                        <font-awesome icon="fas fa-image" :v-tippy-content="'Image Link'"/>
                    </button>
                    <button v-if="button === 'ordered-list'" @click="editor.chain().focus().toggleOrderedList().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive('orderedList') }">
                        <font-awesome icon="fas fa-list-ol" :v-tippy-content="'Ordered List'"/>
                    </button>
                    <button v-if="button === 'bullet-list'" @click="editor.chain().focus().toggleBulletList().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive('bulletList') }">
                        <font-awesome icon="fas fa-list" :v-tippy-content="'Bullet List'"/>
                    </button>
                    <button v-if="button === 'undo'" @click="editor.chain().focus().undo().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :disabled="!editor.can().undo()">
                        <font-awesome icon="fas fa-rotate-left" :v-tippy-content="'Undo'"/>
                    </button>
                    <button v-if="button === 'redo'" @click="editor.chain().focus().redo().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :disabled="!editor.can().redo()">
                        <font-awesome icon="fas fa-rotate-right" :v-tippy-content="'Redo'"/>
                    </button>
                    <button v-if="button === 'block-quote'" @click="editor.chain().focus().toggleBlockquote().run()" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive('blockquote') }">
                        <font-awesome icon="fas fa-quote-left" :v-tippy-content="'Quote'"/>
                    </button>
                </span>
                <span class="border-l border-gray-300 pl-1">
                    <button @click="setTextAlign('left')" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive({ textAlign: 'left' }) }">
                        <font-awesome icon="fas fa-align-left" :v-tippy-content="'Left Align'"/>
                    </button>
                    <button @click="setTextAlign('center')" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive({ textAlign: 'center' }) }">
                        <font-awesome icon="fas fa-align-center" :v-tippy-content="'Center Align'"/>
                    </button>
                    <button @click="setTextAlign('right')" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive({ textAlign: 'right' }) }">
                        <font-awesome icon="fas fa-align-right" :v-tippy-content="'Right Align'"/>
                    </button>
                    <button @click="setTextAlign('justify')" class="p-2 m-1 hover:bg-gray-200 cursor-pointer rounded" :class="{ 'bg-gray-200': editor.isActive({ textAlign: 'justify' }) }">
                        <font-awesome icon="fas fa-align-justify" :v-tippy-content="'Justify Align'"/>
                    </button>
                </span>
            </div>
            
            <!-- Phase 2: View Mode Toggle Button -->
            <div v-if="canToggleView" class="bg-white border border-gray-300 mb-2 ml-auto rounded-lg">
                <button 
                    @click="toggleViewMode" 
                    class="p-2 m-1 hover:bg-gray-200 cursor-pointer flex items-center gap-2 rounded"
                    :class="{ 'bg-gray-200': viewMode === 'markdown' }"
                >
                    <font-awesome :icon="viewMode === 'wysiwyg' ? 'fas fa-code' : 'fas fa-eye'" />
                    <span class="text-sm">{{ viewMode === 'wysiwyg' ? 'In Markdown Mode' : 'In Editor Mode' }}</span>
                </button>
            </div>
        </div>
        
        <!-- WYSIWYG Editor View with transition -->
        <transition name="fade" mode="out-in">
            <editor-content
                v-show="viewMode === 'wysiwyg'" 
                :editor="editor"
                key="wysiwyg"
                class="text-block-editor-content bg-white p-2 cursor-text border border-solid border-gray-300 transition-opacity duration-200 rounded-lg" 
            />
        </transition>
        
        <!-- Raw Markdown View with enhanced styling -->
        <transition name="fade" mode="out-in">
            <div v-show="viewMode === 'markdown'" key="markdown" class="relative">
                <textarea
                    v-model="markdownContent"
                    class="w-full bg-white p-4 border border-solid border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y transition-all duration-200 leading-relaxed rounded-lg"
                    :style="{ minHeight: `${props.minHeight}px` }"
                    placeholder="Markdown content will appear here..."
                    spellcheck="false"
                    @keydown.tab.prevent="handleTabInMarkdown"
                ></textarea>
                <!-- Phase 6: Helper text for markdown view -->
                <div class="text-xs text-gray-500 mt-1 px-1">
                    <span class="mr-3">💡 Tip: Edit markdown directly</span>
                    <span class="mr-3">• Tab to indent</span>
                    <span>• Click "Editor" to see formatted view</span>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
/* Phase 6: Smooth transitions */
.fade-enter-active, .fade-leave-active {
    transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
    opacity: 0;
}
</style>