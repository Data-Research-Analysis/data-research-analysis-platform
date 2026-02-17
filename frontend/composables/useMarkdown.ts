import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Render markdown to sanitized HTML
 */
export function useMarkdown() {
    // Configure marked options
    marked.setOptions({
        breaks: true, // Convert \n to <br>
        gfm: true, // GitHub Flavored Markdown
    });

    /**
     * Convert markdown string to sanitized HTML
     * @param markdown - The markdown string to convert
     * @returns Sanitized HTML string
     */
    function renderMarkdown(markdown: string): string {
        if (!markdown) return '';
        
        try {
            // Convert markdown to HTML
            const html = marked.parse(markdown);
            
            // Sanitize HTML to prevent XSS attacks
            const cleanHtml = DOMPurify.sanitize(html as string, {
                ALLOWED_TAGS: [
                    'p', 'br', 'strong', 'em', 'u', 'code', 'pre',
                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'ul', 'ol', 'li',
                    'blockquote',
                    'a'
                ],
                ALLOWED_ATTR: ['href', 'class']
            });
            
            return cleanHtml;
        } catch (error) {
            console.error('Error rendering markdown:', error);
            return markdown; // Fallback to plain text
        }
    }

    return {
        renderMarkdown
    };
}
