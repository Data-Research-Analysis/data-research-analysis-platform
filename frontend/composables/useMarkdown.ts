import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Ensure every `<img>` in an HTML string has an `alt` attribute.
 *
 * Content authored in the CMS/editor frequently omits `alt`, which fails
 * accessibility and SEO audits ("Image elements do not have [alt] attributes").
 * Images without known descriptive text are given an empty alt so assistive
 * technology and crawlers can skip them instead of announcing the file name.
 */
export function ensureImageAlt(html: string): string {
    if (!html) return html;

    return html.replace(/<img\b[^>]*>/gi, (tag) => {
        if (/\balt\s*=/i.test(tag)) return tag;
        return tag.replace(/<img\b/i, '<img alt=""');
    });
}

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

    /**
     * Convert inline markdown (bold/italic/code/links) to sanitized HTML
     * without wrapping block elements, for use inside list items and labels.
     * @param markdown - The markdown string to convert
     * @returns Sanitized inline HTML string
     */
    function renderInlineMarkdown(markdown: string): string {
        if (!markdown) return '';

        try {
            const html = marked.parseInline(markdown);

            const cleanHtml = DOMPurify.sanitize(html as string, {
                ALLOWED_TAGS: ['strong', 'em', 'u', 'code', 'br', 'a'],
                ALLOWED_ATTR: ['href', 'class']
            });

            return cleanHtml;
        } catch (error) {
            console.error('Error rendering inline markdown:', error);
            return markdown; // Fallback to plain text
        }
    }

    return {
        renderMarkdown,
        renderInlineMarkdown
    };
}
