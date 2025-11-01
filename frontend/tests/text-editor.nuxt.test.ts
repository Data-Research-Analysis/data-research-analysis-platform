import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, test, beforeEach } from 'vitest';
import { nextTick } from 'vue'
import TextEditor from '../components/text-editor.vue'

describe('Text Editor Component - Markdown Support', () => {
    
    describe('Props and Initialization', () => {
        test('should accept inputFormat prop with default value "html"', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                }
            });
            
            // Check default inputFormat is 'html'
            expect(wrapper.props('inputFormat')).toBe('html');
        });

        test('should accept inputFormat prop with value "markdown"', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                    inputFormat: 'markdown'
                }
            });
            
            expect(wrapper.props('inputFormat')).toBe('markdown');
        });

        test('should validate inputFormat prop to only accept "html" or "markdown"', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                    inputFormat: 'html'
                }
            });
            
            const validator = wrapper.vm.$options.props.inputFormat.validator;
            expect(validator('html')).toBe(true);
            expect(validator('markdown')).toBe(true);
            expect(validator('invalid')).toBe(false);
        });

        test('should initialize with Markdown extension', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                }
            });
            
            await nextTick();
            
            // Check if editor exists
            expect(wrapper.vm.editor).toBeDefined();
            
            // Check if Markdown extension is loaded
            const extensions = wrapper.vm.editor?.extensionManager.extensions;
            const hasMarkdown = extensions?.some((ext: any) => ext.name === 'markdown');
            expect(hasMarkdown).toBe(true);
        });
    });

    describe('Content Emission', () => {
        test('should emit both update:content and update:markdown events on content change', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                }
            });
            
            await nextTick();
            
            // Simulate content update
            if (wrapper.vm.editor) {
                wrapper.vm.editor.commands.setContent('<p>Test content</p>');
                await nextTick();
                
                // Check if both events were emitted
                expect(wrapper.emitted('update:content')).toBeTruthy();
                expect(wrapper.emitted('update:markdown')).toBeTruthy();
            }
        });

        test('should emit HTML content via update:content event', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                wrapper.vm.editor.commands.setContent('<p><strong>Bold text</strong></p>');
                await nextTick();
                
                const emittedContent = wrapper.emitted('update:content');
                expect(emittedContent).toBeTruthy();
                if (emittedContent) {
                    const lastEmit = emittedContent[emittedContent.length - 1][0];
                    expect(lastEmit).toContain('<strong>Bold text</strong>');
                }
            }
        });

        test('should emit markdown content via update:markdown event', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                wrapper.vm.editor.commands.setContent('<p><strong>Bold text</strong></p>');
                await nextTick();
                
                const emittedMarkdown = wrapper.emitted('update:markdown');
                expect(emittedMarkdown).toBeTruthy();
                if (emittedMarkdown) {
                    const lastEmit = emittedMarkdown[emittedMarkdown.length - 1][0];
                    expect(lastEmit).toContain('**Bold text**');
                }
            }
        });
    });

    describe('Helper Methods', () => {
        test('should have getMarkdown method that returns markdown content', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                }
            });
            
            await nextTick();
            
            expect(wrapper.vm.getMarkdown).toBeDefined();
            expect(typeof wrapper.vm.getMarkdown).toBe('function');
        });

        test('should have getHTML method that returns HTML content', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                }
            });
            
            await nextTick();
            
            expect(wrapper.vm.getHTML).toBeDefined();
            expect(typeof wrapper.vm.getHTML).toBe('function');
        });

        test('getMarkdown should return current editor content as markdown', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                wrapper.vm.editor.commands.setContent('<h1>Heading</h1><p>Paragraph</p>');
                await nextTick();
                
                const markdown = wrapper.vm.getMarkdown();
                expect(markdown).toContain('# Heading');
                expect(markdown).toContain('Paragraph');
            }
        });

        test('getHTML should return current editor content as HTML', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                wrapper.vm.editor.commands.setContent('<p>Test</p>');
                await nextTick();
                
                const html = wrapper.vm.getHTML();
                expect(html).toContain('<p>Test</p>');
            }
        });
    });

    describe('Content Loading - HTML Mode', () => {
        test('should load HTML content when inputFormat is "html"', async () => {
            const htmlContent = '<p><strong>Bold</strong> and <em>italic</em></p>';
            
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                    inputFormat: 'html',
                    content: htmlContent
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                const editorHTML = wrapper.vm.getHTML();
                expect(editorHTML).toContain('<strong>Bold</strong>');
                expect(editorHTML).toContain('<em>italic</em>');
            }
        });
    });

    describe('Content Loading - Markdown Mode', () => {
        test('should load and parse markdown content when inputFormat is "markdown"', async () => {
            const markdownContent = '# Heading\n\n**Bold text** and *italic text*';
            
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic', 'heading'],
                    inputFormat: 'markdown',
                    content: markdownContent
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                const editorHTML = wrapper.vm.getHTML();
                // Markdown should be parsed to HTML
                expect(editorHTML).toContain('<h1>');
                expect(editorHTML).toContain('<strong>Bold text</strong>');
                expect(editorHTML).toContain('<em>italic text</em>');
            }
        });

        test('should handle markdown lists', async () => {
            const markdownContent = '- Item 1\n- Item 2\n- Item 3';
            
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bullet-list'],
                    inputFormat: 'markdown',
                    content: markdownContent
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                const editorHTML = wrapper.vm.getHTML();
                expect(editorHTML).toContain('<ul');
                expect(editorHTML).toContain('<li');
            }
        });

        test('should handle markdown links', async () => {
            const markdownContent = '[Link Text](https://example.com)';
            
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['link'],
                    inputFormat: 'markdown',
                    content: markdownContent
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                const editorHTML = wrapper.vm.getHTML();
                expect(editorHTML).toContain('<a');
                expect(editorHTML).toContain('href="https://example.com"');
                expect(editorHTML).toContain('Link Text');
            }
        });

        test('should handle markdown code blocks', async () => {
            const markdownContent = '`inline code`';
            
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['code'],
                    inputFormat: 'markdown',
                    content: markdownContent
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                const editorHTML = wrapper.vm.getHTML();
                expect(editorHTML).toContain('<code');
                expect(editorHTML).toContain('inline code');
            }
        });

        test('should handle markdown blockquotes', async () => {
            const markdownContent = '> This is a quote';
            
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['block-quote'],
                    inputFormat: 'markdown',
                    content: markdownContent
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                const editorHTML = wrapper.vm.getHTML();
                expect(editorHTML).toContain('<blockquote');
                expect(editorHTML).toContain('This is a quote');
            }
        });
    });

    describe('Bidirectional Conversion', () => {
        test('should maintain content integrity during HTML -> Markdown conversion', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic', 'heading'],
                    inputFormat: 'html'
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                // Set HTML content
                const htmlContent = '<h1>Title</h1><p><strong>Bold</strong> and <em>italic</em></p>';
                wrapper.vm.editor.commands.setContent(htmlContent);
                await nextTick();
                
                // Get markdown
                const markdown = wrapper.vm.getMarkdown();
                
                // Verify markdown contains expected syntax
                expect(markdown).toContain('# Title');
                expect(markdown).toContain('**Bold**');
                expect(markdown).toContain('*italic*');
            }
        });

        test('should maintain content integrity during Markdown -> HTML conversion', async () => {
            const markdownContent = '# Title\n\n**Bold** and *italic*\n\n- List item';
            
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic', 'heading', 'bullet-list'],
                    inputFormat: 'markdown',
                    content: markdownContent
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                const html = wrapper.vm.getHTML();
                
                // Verify HTML contains expected elements
                expect(html).toContain('<h1>');
                expect(html).toContain('<strong>Bold</strong>');
                expect(html).toContain('<em>italic</em>');
                expect(html).toContain('<ul');
                expect(html).toContain('<li>');
            }
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty content', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                    content: ''
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                const html = wrapper.vm.getHTML();
                const markdown = wrapper.vm.getMarkdown();
                
                expect(html).toBeDefined();
                expect(markdown).toBeDefined();
            }
        });

        test('should handle special characters in markdown', async () => {
            const markdownContent = 'Text with *asterisks* and _underscores_ and `backticks`';
            
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic', 'code'],
                    inputFormat: 'markdown',
                    content: markdownContent
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                const html = wrapper.vm.getHTML();
                expect(html).toBeDefined();
                // Should parse markdown correctly
                expect(html).toContain('<em>asterisks</em>');
                expect(html).toContain('<code>backticks</code>');
            }
        });

        test('should handle HTML entities in markdown', async () => {
            const markdownContent = 'Text with &amp; and &lt; and &gt;';
            
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold'],
                    inputFormat: 'markdown',
                    content: markdownContent
                }
            });
            
            await nextTick();
            
            expect(wrapper.vm.editor).toBeDefined();
        });
    });

    describe('Markdown Configuration', () => {
        test('should have markdown extension configured with correct options', async () => {
            const wrapper = await mountSuspended(TextEditor, {
                props: {
                    buttons: ['bold', 'italic'],
                }
            });
            
            await nextTick();
            
            if (wrapper.vm.editor) {
                const markdownExt = wrapper.vm.editor.extensionManager.extensions.find(
                    (ext: any) => ext.name === 'markdown'
                );
                
                expect(markdownExt).toBeDefined();
                if (markdownExt) {
                    // Check that extension exists and is configured
                    expect(markdownExt.options).toBeDefined();
                }
            }
        });
    });
});
