import { marked } from 'marked';

/**
 * DOMPurify (via `isomorphic-dompurify`) is only needed in the browser, but
 * importing it statically drags jsdom — and its html-encoding-sniffer →
 * @exodus/bytes chain — into every page's SSR bundle. html-encoding-sniffer
 * `require()`s @exodus/bytes, which is ESM-only, so the server render crashes
 * on Node versions without require-of-ESM support (verified on production).
 * Load the sanitizer lazily on the client instead; the server path falls back
 * to a small tag scrubber that keeps the SSR HTML safe.
 */
let dompurify: any | null = null;
let dompurifyPromise: Promise<any> | null = null;

function getDOMPurify(): any | null {
    if (typeof window === 'undefined') return null;
    if (!dompurifyPromise) {
        dompurifyPromise = import('isomorphic-dompurify').then((module) => {
            dompurify = module.default ?? module;
            return dompurify;
        });
    }
    return dompurify;
}

/**
 * Server-safe scrub used only when DOMPurify is unavailable (SSR or before the
 * sanitizer finishes loading). Strips executable/embedded elements and inline
 * event handlers so the server-rendered HTML is never raw model output.
 */
function scrubHtml(html: string): string {
    return html
        .replace(/<\s*(script|iframe|object|embed|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
        .replace(/<\s*(script|iframe|object|embed|style)[^>]*\/?>/gi, '')
        .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/javascript\s*:/gi, '');
}

/**
 * Some model responses arrive as a JSON-escaped string, leaving literal `\n`
 * and `\'` sequences instead of real line breaks. Decode them when they
 * clearly dominate, so old artifacts render correctly too.
 */
function normalizeEscapedMarkdown(markdown: string): string {
    const realNewlines = (markdown.match(/\n/g) ?? []).length;
    const literalNewlines = (markdown.match(/\\n/g) ?? []).length;
    if (literalNewlines === 0 || realNewlines > literalNewlines / 2) return markdown;

    return markdown
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"');
}

function splitTableCells(row: string): string[] {
    let stripped = row.trim();
    if (stripped.startsWith('|')) stripped = stripped.slice(1);
    if (stripped.endsWith('|')) stripped = stripped.slice(0, -1);
    return stripped.split('|').map((cell) => cell.trim());
}

/**
 * True when the line is a GFM table separator row (|---|...|).
 * Empty cells are ignored so malformed separators such as `|---|---|---|---||`
 * (four dashes plus an empty cell) are still recognised.
 */
function isSeparatorRow(row: string): boolean {
    if (!row.includes('|')) return false;
    const cells = splitTableCells(row).filter((cell) => cell !== '');
    return cells.length >= 1 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function separatorFor(count: number): string {
    return '|' + Array.from({ length: count }, () => '---').join('|') + '|';
}

function splitMergedSeparator(line: string): string[] {
    const match = line.match(/\|\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/);
    if (!match || match.index === undefined || match.index === 0) return [line];

    const head = line.slice(0, match.index).trim();
    const token = line.slice(match.index).trim();
    if (head.startsWith('|') && splitTableCells(head).length >= 2 && isSeparatorRow(token)) {
        return [head, token];
    }
    return [line];
}

/**
 * Repair common malformed table layouts before rendering.
 *
 * Model outputs often merge the header and the `|---|` separator onto one
 * line, emit separators whose column count does not match the header, or
 * duplicate separators (e.g. `|---|---|---|---||` followed by a proper
 * separator). `marked` then misreads the separator as the header or refuses to
 * render the table. This keeps exactly one separator sized to the header and
 * drops malformed/duplicate separators so tables render consistently with the
 * PDF export.
 */
function repairTables(markdown: string): string {
    const lines: string[] = [];
    for (const line of markdown.split('\n')) lines.push(...splitMergedSeparator(line));

    const repaired: string[] = [];
    let i = 0;
    while (i < lines.length) {
        if (!lines[i].trim().startsWith('|')) {
            repaired.push(lines[i]);
            i += 1;
            continue;
        }

        const block: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
            block.push(lines[i]);
            i += 1;
        }

        if (block.length < 2) {
            repaired.push(...block);
            continue;
        }

        const header = block[0];
        const columnCount = splitTableCells(header).length;
        const body = block.slice(1).filter((row) => !isSeparatorRow(row));

        repaired.push(header);
        repaired.push(separatorFor(columnCount));
        repaired.push(...body);
        if (i < lines.length && lines[i].trim() !== '') repaired.push('');
    }

    return repaired.join('\n');
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

    // Kick off the sanitizer load right away so content rendered shortly after
    // mount is sanitized from the first paint (never loaded during SSR).
    if (import.meta.client) {
        void getDOMPurify();
    }

    /**
     * Convert markdown string to sanitized HTML
     * @param markdown - The markdown string to convert
     * @returns Sanitized HTML string
     */
    function renderMarkdown(markdown: string): string {
        if (!markdown) return '';
        
        try {
            // Convert markdown to HTML
            const html = marked.parse(repairTables(normalizeEscapedMarkdown(markdown)));
            
            // Sanitize HTML to prevent XSS attacks
            const sanitizer = getDOMPurify();
            const cleanHtml = sanitizer
                ? sanitizer.sanitize(html as string, {
                    ALLOWED_TAGS: [
                        'p', 'br', 'strong', 'em', 'u', 'code', 'pre',
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                        'ul', 'ol', 'li',
                        'blockquote',
                        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
                        'a'
                    ],
                    ALLOWED_ATTR: ['href', 'class', 'colspan', 'rowspan', 'align']
                })
                : scrubHtml(html as string);
            
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
            const html = marked.parseInline(normalizeEscapedMarkdown(markdown));

            const sanitizer = getDOMPurify();
            const cleanHtml = sanitizer
                ? sanitizer.sanitize(html as string, {
                    ALLOWED_TAGS: ['strong', 'em', 'u', 'code', 'br', 'a'],
                    ALLOWED_ATTR: ['href', 'class']
                })
                : scrubHtml(html as string);

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
