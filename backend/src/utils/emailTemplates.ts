import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '../templates/emails');

// Cache compiled templates
const templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();

export async function renderEmailTemplate(
    templateName: string,
    data: Record<string, any>
): Promise<{ html: string; text: string }> {
    // Check cache first
    let template = templateCache.get(templateName);
    
    if (!template) {
        // Load and compile template
        const templatePath = path.join(TEMPLATES_DIR, `${templateName}.hbs`);
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        template = Handlebars.compile(templateContent);
        templateCache.set(templateName, template);
    }
    
    // Render template with data
    const html = template({
        ...data,
        year: new Date().getFullYear(),
        dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@dataresearchanalysis.com',
        unsubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/notifications`
    });
    
    // Generate plain text version (strip HTML tags)
    const text = html
        .replace(/<style[^>]*>.*?<\/style>/gs, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    return { html, text };
}

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', (date: Date | string) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date(date));
});

Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
Handlebars.registerHelper('not', (value: any) => !value);
