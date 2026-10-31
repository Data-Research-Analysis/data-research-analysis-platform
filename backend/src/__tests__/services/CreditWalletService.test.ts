import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DRACreditWallet } from '../../models/DRACreditWallet.js';
import { DRACreditTransaction } from '../../models/DRACreditTransaction.js';
import { DRAActionPrice } from '../../models/DRAActionPrice.js';
import { DRACreditPack } from '../../models/DRACreditPack.js';
import { DRAOrganization } from '../../models/DRAOrganization.js';

jest.unstable_mockModule('../../datasources/PostgresDS.js', () => ({
    getAppDataSource: jest.fn(),
}));

const { getAppDataSource } = await import('../../datasources/PostgresDS.js');
const { CreditWalletService } = await import('../../services/CreditWalletService.js');

interface MockWallet {
    org_id: number;
    balance_credits: number;
    monthly_credits_remaining: number;
    monthly_grant_amount: number;
    monthly_credits_granted_at: Date | null;
    auto_recharge_threshold: number | null;
    auto_recharge_pack_id: number | null;
}

describe('CreditWalletService', () => {
    let wallets: MockWallet[];
    let transactions: any[];
    let orgRow: any;
    let actionRows: any[];
    let walletRepo: any;
    let orgRepo: any;
    let txRepo: any;
    let actionRepo: any;
    let packRepo: any;
    let dataSource: any;

    const makeWallet = (overrides: Partial<MockWallet> = {}): MockWallet => ({
        org_id: 1,
        balance_credits: 0,
        monthly_credits_remaining: 0,
        monthly_grant_amount: 500,
        monthly_credits_granted_at: null,
        auto_recharge_threshold: null,
        auto_recharge_pack_id: null,
        ...overrides,
    });

    beforeEach(() => {
        wallets = [];
        transactions = [];
        orgRow = null;
        actionRows = [];

        walletRepo = {
            findOne: jest.fn(async ({ where }: any) =>
                wallets.find((w) => w.org_id === where.org_id) ?? null
            ),
            create: jest.fn((data: any) => makeWallet(data)),
            save: jest.fn(async (wallet: any) => {
                if (!wallets.includes(wallet)) wallets.push(wallet);
                return wallet;
            }),
        };
        orgRepo = {
            findOne: jest.fn(async () => orgRow),
        };
        txRepo = {
            findOne: jest.fn(async ({ where }: any) =>
                [...transactions]
                    .reverse()
                    .find(
                        (t) =>
                            (where.action_key === undefined || t.action_key === where.action_key) &&
                            (where.action_ref_id === undefined || t.action_ref_id === where.action_ref_id) &&
                            (where.status === undefined || t.status === where.status)
                    ) ?? null
            ),
            find: jest.fn(async () => transactions),
            save: jest.fn(async (tx: any) => tx),
        };
        actionRepo = {
            findOne: jest.fn(async ({ where }: any) =>
                actionRows.find((a) => a.action_key === where.action_key && a.is_active) ?? null
            ),
        };
        packRepo = {
            findOne: jest.fn(async ({ where }: any) => ({ id: where.id, name: 'Pack', credits: 1000 })),
        };

        const manager = {
            createQueryBuilder: jest.fn(() => {
                let orgId: number;
                const qb: any = {
                    setLock: () => qb,
                    where: (_sql: string, params: any) => {
                        orgId = params.orgId;
                        return qb;
                    },
                    getOne: async () => wallets.find((w) => w.org_id === orgId) ?? null,
                };
                return qb;
            }),
            create: jest.fn((_entity: any, data: any) => ({ id: transactions.length + 1, ...data })),
            save: jest.fn(async (entity: any) => {
                const isTransaction =
                    entity && entity.type !== undefined && entity.amount !== undefined &&
                    entity.balance_credits === undefined;
                if (isTransaction) {
                    transactions.push(entity);
                } else if (entity && entity.org_id !== undefined && !wallets.includes(entity)) {
                    wallets.push(entity);
                }
                return entity;
            }),
        };

        dataSource = {
            getRepository: jest.fn((entity: any) => {
                if (entity === DRACreditWallet) return walletRepo;
                if (entity === DRAOrganization) return orgRepo;
                if (entity === DRACreditTransaction) return txRepo;
                if (entity === DRAActionPrice) return actionRepo;
                if (entity === DRACreditPack) return packRepo;
                throw new Error(`Unexpected repository: ${entity?.name}`);
            }),
            createQueryRunner: jest.fn(() => ({
                connect: jest.fn(async () => undefined),
                startTransaction: jest.fn(async () => undefined),
                commitTransaction: jest.fn(async () => undefined),
                rollbackTransaction: jest.fn(async () => undefined),
                release: jest.fn(async () => undefined),
                manager,
            })),
        };

        (getAppDataSource as any).mockResolvedValue(dataSource);
        CreditWalletService.resetInstance();
        CreditWalletService.getInstance().setAutoRechargeTrigger(null);
        delete process.env.CREDITS_ENABLED;
    });

    afterEach(() => {
        delete process.env.CREDITS_ENABLED;
        jest.clearAllMocks();
    });

    describe('grantMonthly', () => {
        it('uses the per-subscription override for variable-credit Pro', async () => {
            orgRow = {
                subscription: {
                    is_active: true,
                    credits_per_month_override: 25000,
                    subscription_tier: { credits_per_month: 0, credits_rollover: true },
                },
            };
            wallets.push(makeWallet());

            const balance = await CreditWalletService.getInstance().grantMonthly(1);

            expect(balance).toBe(25000);
            expect(wallets[0].balance_credits).toBe(25000);
            expect(wallets[0].monthly_credits_remaining).toBe(25000);
            expect(wallets[0].monthly_grant_amount).toBe(25000);
            expect(wallets[0].monthly_credits_granted_at).not.toBeNull();
            expect(transactions).toHaveLength(1);
            expect(transactions[0]).toMatchObject({ type: 'grant', amount: 25000 });
        });

        it('expires only unused monthly credits and preserves pack credits', async () => {
            orgRow = {
                subscription: {
                    is_active: true,
                    credits_per_month_override: null,
                    subscription_tier: { credits_per_month: 500, credits_rollover: false },
                },
            };
            wallets.push(
                makeWallet({
                    balance_credits: 2000,
                    monthly_credits_remaining: 500,
                    monthly_credits_granted_at: new Date('2026-09-15T00:00:00Z'),
                })
            );

            const balance = await CreditWalletService.getInstance().grantMonthly(1);

            expect(balance).toBe(2000);
            expect(transactions.map((t) => [t.type, t.amount])).toEqual([
                ['expire', -500],
                ['grant', 500],
            ]);
            expect(wallets[0].monthly_credits_remaining).toBe(500);
        });

        it('is idempotent within the same UTC month', async () => {
            wallets.push(
                makeWallet({
                    balance_credits: 750,
                    monthly_credits_remaining: 250,
                    monthly_credits_granted_at: new Date(),
                })
            );

            const balance = await CreditWalletService.getInstance().grantMonthly(1);

            expect(balance).toBe(750);
            expect(transactions).toHaveLength(0);
            expect(wallets[0].balance_credits).toBe(750);
        });

        it('re-grants when the allowance changes mid-month (upgrade)', async () => {
            orgRow = {
                subscription: {
                    is_active: true,
                    credits_per_month_override: 5000,
                    subscription_tier: { credits_per_month: 0, credits_rollover: true },
                },
            };
            wallets.push(
                makeWallet({
                    balance_credits: 500,
                    monthly_credits_remaining: 500,
                    monthly_grant_amount: 500,
                    monthly_credits_granted_at: new Date(),
                })
            );

            const balance = await CreditWalletService.getInstance().grantMonthly(1, 5000);

            expect(balance).toBe(5000);
            expect(transactions).toEqual([
                expect.objectContaining({ type: 'expire', amount: -500 }),
                expect.objectContaining({ type: 'grant', amount: 5000 }),
            ]);
            expect(wallets[0].monthly_grant_amount).toBe(5000);
        });

        it('resets the monthly pool when the allowance decreases mid-month', async () => {
            orgRow = {
                subscription: {
                    is_active: true,
                    credits_per_month_override: 25000,
                    subscription_tier: { credits_per_month: 0, credits_rollover: true },
                },
            };
            wallets.push(
                makeWallet({
                    balance_credits: 25000,
                    monthly_credits_remaining: 25000,
                    monthly_grant_amount: 25000,
                    monthly_credits_granted_at: new Date(),
                })
            );

            const balance = await CreditWalletService.getInstance().grantMonthly(1, 10000);

            expect(balance).toBe(10000);
            expect(transactions).toEqual([
                expect.objectContaining({ type: 'expire', amount: -25000 }),
                expect.objectContaining({ type: 'grant', amount: 10000 }),
            ]);
            expect(wallets[0].monthly_grant_amount).toBe(10000);
        });

        it('does not double-grant a duplicate webhook for the same allowance', async () => {
            orgRow = {
                subscription: {
                    is_active: true,
                    credits_per_month_override: 5000,
                    subscription_tier: { credits_per_month: 0, credits_rollover: true },
                },
            };
            wallets.push(
                makeWallet({
                    balance_credits: 5500,
                    monthly_credits_remaining: 5500,
                    monthly_grant_amount: 5000,
                    monthly_credits_granted_at: new Date(),
                })
            );

            const balance = await CreditWalletService.getInstance().grantMonthly(1, 5000);

            expect(balance).toBe(5500);
            expect(transactions).toHaveLength(0);
        });

        it('does not grant for a custom tier with no allowance', async () => {            orgRow = {
                subscription: {
                    is_active: true,
                    credits_per_month_override: null,
                    subscription_tier: { credits_per_month: 0, credits_rollover: true },
                },
            };
            wallets.push(makeWallet({ balance_credits: 42 }));

            const balance = await CreditWalletService.getInstance().grantMonthly(1);

            expect(balance).toBe(42);
            expect(transactions).toHaveLength(0);
        });

        it('treats an inactive subscription as Free', async () => {
            orgRow = {
                subscription: {
                    is_active: false,
                    credits_per_month_override: 25000,
                    subscription_tier: { credits_per_month: 25000, credits_rollover: true },
                },
            };
            wallets.push(makeWallet());

            const balance = await CreditWalletService.getInstance().grantMonthly(1);

            expect(balance).toBe(500);
            expect(transactions[0]).toMatchObject({ type: 'grant', amount: 500 });
        });
    });

    describe('consume', () => {
        it('draws down monthly credits and triggers auto-recharge below threshold', async () => {
            process.env.CREDITS_ENABLED = 'true';
            actionRows.push({ action_key: 'plan_build', credits: 500, is_active: true, band_multipliers: null });
            wallets.push(
                makeWallet({
                    balance_credits: 600,
                    monthly_credits_remaining: 600,
                    auto_recharge_threshold: 1000,
                    auto_recharge_pack_id: 1,
                })
            );
            const trigger = jest.fn(async (_orgId: number) => undefined);
            CreditWalletService.getInstance().setAutoRechargeTrigger(trigger);

            const result = await CreditWalletService.getInstance().consume(1, 'plan_build');

            expect(result.credits).toBe(500);
            expect(result.balance).toBe(100);
            expect(wallets[0].monthly_credits_remaining).toBe(100);
            expect(trigger).toHaveBeenCalledWith(1);
        });

        it('does not trigger auto-recharge when the balance stays above the threshold', async () => {
            process.env.CREDITS_ENABLED = 'true';
            actionRows.push({ action_key: 'plan_chat', credits: 2, is_active: true, band_multipliers: null });
            wallets.push(makeWallet({ balance_credits: 600, auto_recharge_threshold: 100 }));
            const trigger = jest.fn(async (_orgId: number) => undefined);
            CreditWalletService.getInstance().setAutoRechargeTrigger(trigger);

            await CreditWalletService.getInstance().consume(1, 'plan_chat');

            expect(trigger).not.toHaveBeenCalled();
        });
    });

    describe('creditsFor', () => {
        it('applies the band multiplier', async () => {
            actionRows.push({
                action_key: 'data_model_analysis',
                credits: 15,
                is_active: true,
                band_multipliers: [1, 2, 3],
            });

            const service = CreditWalletService.getInstance();
            expect(await service.creditsFor('data_model_analysis', 0)).toBe(15);
            expect(await service.creditsFor('data_model_analysis', 1)).toBe(30);
            expect(await service.creditsFor('data_model_analysis', 2)).toBe(45);
        });
    });
});
