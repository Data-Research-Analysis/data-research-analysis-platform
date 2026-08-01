import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedDefaultEmailFunnels1785000000000 implements MigrationInterface {
    name = 'SeedDefaultEmailFunnels1785000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Funnel A — Post-Download Nurture
        await queryRunner.query(`
            INSERT INTO "dra_email_funnels" ("name", "slug", "trigger_type", "target_user_type", "is_active")
            VALUES ('Post-Download Nurture', 'post-download', 'download', 'anonymous', true)
        `);
        const funnelA = await queryRunner.query(`SELECT id FROM "dra_email_funnels" WHERE slug = 'post-download'`);
        const funnelAId = funnelA[0].id;

        const stepsA = [
            { step_order: 1, delay_hours: 0,   template_file: 'lead-generator-download.html',     subject_template: 'Your Download Is Ready' },
            { step_order: 2, delay_hours: 48,  template_file: 'lead-generator-a2-problem.html',    subject_template: 'The hidden cost of gut-feel reporting' },
            { step_order: 3, delay_hours: 72,  template_file: 'lead-generator-a3-agitate.html',    subject_template: 'What Those Lost Hours Are Costing You' },
            { step_order: 4, delay_hours: 72,  template_file: 'lead-generator-a4-solve.html',      subject_template: 'Your Automated Boardroom Is Ready' },
            { step_order: 5, delay_hours: 96,  template_file: 'lead-generator-a5-social-proof.html', subject_template: 'What Our Customers Are Saying' },
            { step_order: 6, delay_hours: 96,  template_file: 'lead-generator-a6-value.html',      subject_template: '3 Reporting Tactics From Top Teams' },
            { step_order: 7, delay_hours: 120, template_file: 'lead-generator-a7-last-chance.html', subject_template: 'Still Pulling Reports Manually?' },
        ];
        for (const step of stepsA) {
            await queryRunner.query(`
                INSERT INTO "dra_email_funnel_steps" ("funnel_id", "step_order", "delay_hours", "template_file", "subject_template", "is_active")
                VALUES ($1, $2, $3, $4, $5, true)
            `, [funnelAId, step.step_order, step.delay_hours, step.template_file, step.subject_template]);
        }

        // Funnel B — Blog Subscriber
        await queryRunner.query(`
            INSERT INTO "dra_email_funnels" ("name", "slug", "trigger_type", "target_user_type", "is_active")
            VALUES ('Blog Subscriber', 'blog-subscriber', 'blog_subscribe', 'anonymous', true)
        `);
        const funnelB = await queryRunner.query(`SELECT id FROM "dra_email_funnels" WHERE slug = 'blog-subscriber'`);
        const funnelBId = funnelB[0].id;

        const stepsB = [
            { step_order: 1, delay_hours: 0,   template_file: 'blog-subscriber-welcome.html', subject_template: 'Welcome to the Community' },
        ];
        for (const step of stepsB) {
            await queryRunner.query(`
                INSERT INTO "dra_email_funnel_steps" ("funnel_id", "step_order", "delay_hours", "template_file", "subject_template", "is_active")
                VALUES ($1, $2, $3, $4, $5, true)
            `, [funnelBId, step.step_order, step.delay_hours, step.template_file, step.subject_template]);
        }

        // Funnel C — Free User Onboarding
        await queryRunner.query(`
            INSERT INTO "dra_email_funnels" ("name", "slug", "trigger_type", "target_user_type", "is_active")
            VALUES ('Free User Onboarding', 'free-user-onboarding', 'register', 'free', true)
        `);
        const funnelC = await queryRunner.query(`SELECT id FROM "dra_email_funnels" WHERE slug = 'free-user-onboarding'`);
        const funnelCId = funnelC[0].id;

        const stepsC = [
            { step_order: 1, delay_hours: 0,   template_file: 'free-user-welcome.html',  subject_template: 'Welcome — Your 5-Minute Game Plan' },
            { step_order: 2, delay_hours: 48,  template_file: 'free-user-c2.html',        subject_template: 'The 3 Reporting Gaps You Probably Have' },
            { step_order: 3, delay_hours: 72,  template_file: 'free-user-c3.html',        subject_template: 'What DRA Can Do That Spreadsheets Can\'t' },
            { step_order: 4, delay_hours: 96,  template_file: 'free-user-c4.html',        subject_template: 'From 3 Days to 30 Minutes' },
            { step_order: 5, delay_hours: 120, template_file: 'free-user-c5.html',        subject_template: 'What Premium Unlocks' },
            { step_order: 6, delay_hours: 168, template_file: 'free-user-c6.html',        subject_template: 'How\'s It Going? (We Actually Want to Know)' },
            { step_order: 7, delay_hours: 336, template_file: 'free-user-c7.html',        subject_template: '30 Days In — Here\'s What You\'ve Accomplished' },
        ];
        for (const step of stepsC) {
            await queryRunner.query(`
                INSERT INTO "dra_email_funnel_steps" ("funnel_id", "step_order", "delay_hours", "template_file", "subject_template", "is_active")
                VALUES ($1, $2, $3, $4, $5, true)
            `, [funnelCId, step.step_order, step.delay_hours, step.template_file, step.subject_template]);
        }

        // Funnel D — Paid User Retention
        await queryRunner.query(`
            INSERT INTO "dra_email_funnels" ("name", "slug", "trigger_type", "target_user_type", "is_active")
            VALUES ('Paid User Retention', 'paid-user-retention', 'upgrade', 'paid', true)
        `);
        const funnelD = await queryRunner.query(`SELECT id FROM "dra_email_funnels" WHERE slug = 'paid-user-retention'`);
        const funnelDId = funnelD[0].id;

        const stepsD = [
            { step_order: 1, delay_hours: 0,   template_file: 'paid-user-welcome.html',       subject_template: 'Welcome to {{first_name}}' },
            { step_order: 2, delay_hours: 48,  template_file: 'paid-user-d2.html',            subject_template: 'Let the AI Do the Heavy Lifting' },
            { step_order: 3, delay_hours: 72,  template_file: 'paid-user-d3.html',            subject_template: 'Make Every Report Look Like It Came From Your Team' },
            { step_order: 4, delay_hours: 96,  template_file: 'paid-user-d4.html',            subject_template: '3 Premium Features You Probably Haven\'t Tried' },
            { step_order: 5, delay_hours: 168, template_file: 'paid-user-d5.html',            subject_template: 'Anything We Can Help With?' },
            { step_order: 6, delay_hours: 336, template_file: 'paid-user-d6.html',            subject_template: 'Your ROI Snapshot' },
            { step_order: 7, delay_hours: 648, template_file: 'paid-user-d7-pre-renewal.html', subject_template: 'Your Plan Renews Soon' },
        ];
        for (const step of stepsD) {
            await queryRunner.query(`
                INSERT INTO "dra_email_funnel_steps" ("funnel_id", "step_order", "delay_hours", "template_file", "subject_template", "is_active")
                VALUES ($1, $2, $3, $4, $5, true)
            `, [funnelDId, step.step_order, step.delay_hours, step.template_file, step.subject_template]);
        }

        // Funnel E — Cross-Sell
        await queryRunner.query(`
            INSERT INTO "dra_email_funnels" ("name", "slug", "trigger_type", "target_user_type", "is_active")
            VALUES ('Cross-Sell', 'cross-sell', 'download', 'anonymous', true)
        `);
        const funnelE = await queryRunner.query(`SELECT id FROM "dra_email_funnels" WHERE slug = 'cross-sell'`);
        const funnelEId = funnelE[0].id;

        const stepsE = [
            { step_order: 1, delay_hours: 24,  template_file: 'lead-cross-sell-e1.html', subject_template: 'Based on Your Interest in {{first_name}}' },
            { step_order: 2, delay_hours: 72,  template_file: 'lead-cross-sell-e2.html', subject_template: 'You Might Also Like...' },
            { step_order: 3, delay_hours: 120, template_file: 'lead-cross-sell-e3.html', subject_template: 'More Resources Like This' },
        ];
        for (const step of stepsE) {
            await queryRunner.query(`
                INSERT INTO "dra_email_funnel_steps" ("funnel_id", "step_order", "delay_hours", "template_file", "subject_template", "is_active")
                VALUES ($1, $2, $3, $4, $5, true)
            `, [funnelEId, step.step_order, step.delay_hours, step.template_file, step.subject_template]);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "dra_email_funnel_steps" WHERE funnel_id IN (SELECT id FROM "dra_email_funnels" WHERE slug IN ('post-download', 'blog-subscriber', 'free-user-onboarding', 'paid-user-retention', 'cross-sell'))`);
        await queryRunner.query(`DELETE FROM "dra_email_funnels" WHERE slug IN ('post-download', 'blog-subscriber', 'free-user-onboarding', 'paid-user-retention', 'cross-sell')`);
    }
}
