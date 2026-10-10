/**
 * Ensure every `<img>` in an HTML string has an `alt` attribute.
 *
 * Content authored in the CMS/editor frequently omits `alt`, which fails
 * accessibility and SEO audits ("Image elements do not have [alt] attributes").
 * Images without known descriptive text are given an empty alt so assistive
 * technology and crawlers can skip them instead of announcing the file name.
 *
 * This is intentionally a pure module with no DOM/DOMPurify imports: it runs
 * on the server (SSR) and must never pull jsdom into a page's server bundle.
 */
export function ensureImageAlt(html: string): string {
    if (!html) return html;

    return html.replace(/<img\b[^>]*>/gi, (tag) => {
        if (/\balt\s*=/i.test(tag)) return tag;
        return tag.replace(/<img\b/i, '<img alt=""');
    });
}
