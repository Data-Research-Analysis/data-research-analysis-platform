import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentTransactionsTable1775820000000 implements MigrationInterface {
    name = 'CreatePaymentTransactionsTable1775820000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS dra_payment_transactions (
                id                     SERIAL PRIMARY KEY,
                organization_id        INT          NOT NULL,
                subscription_id        INT          NULL,
                paddle_transaction_id  VARCHAR(100) NULL UNIQUE,
                transaction_type       VARCHAR(20)  NOT NULL
                                         CHECK (transaction_type IN ('charge','refund','credit','adjustment')),
                amount                 DECIMAL(10,2) NOT NULL,
                currency               VARCHAR(3)   NOT NULL DEFAULT 'USD',
                description            TEXT         NULL,
                paddle_invoice_url     TEXT         NULL,
                status                 VARCHAR(20)  NOT NULL DEFAULT 'completed'
                                         CHECK (status IN ('completed','failed','pending','reversed')),
                tier_name              VARCHAR(50)  NULL,
                billing_cycle          VARCHAR(10)  NULL,
                processed_at           TIMESTAMP    NULL,
                created_at             TIMESTAMP    NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_payment_tx_org
                    FOREIGN KEY (organization_id)
                    REFERENCES dra_organizations (id)
                    ON DELETE CASCADE,
                CONSTRAINT fk_payment_tx_sub
                    FOREIGN KEY (subscription_id)
                    REFERENCES dra_organization_subscriptions (id)
                    ON DELETE SET NULL
            )
        `);

        // Index for per-org lookup (billing history page)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_payment_tx_org_id
                ON dra_payment_transactions (organization_id, created_at DESC)
        `);

        // Index for reconciliation queries by Paddle transaction ID
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_payment_tx_paddle_id
                ON dra_payment_transactions (paddle_transaction_id)
                WHERE paddle_transaction_id IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS dra_payment_transactions`);
    }
}
