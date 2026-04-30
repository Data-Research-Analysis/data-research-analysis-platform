import dns from 'dns/promises';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { EntityManager } from 'typeorm';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { EUserType } from '../types/EUserType.js';
import { EOrganizationRole } from '../services/OrganizationService.js';
import { UtilityService } from '../services/UtilityService.js';
import { SSOService } from '../services/SSOService.js';
import { WinstonLoggerService } from '../services/WinstonLoggerService.js';
import { DRASSOConfiguration } from '../models/DRASSOConfiguration.js';
import { DRASSOUserMapping } from '../models/DRASSOUserMapping.js';
import { DRADomainVerification } from '../models/DRADomainVerification.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';

interface ITokenDetails {
    user_id: number;
    email: string;
    user_type: string;
}

interface ISSOConfigInput {
    idp_name: string;
    idp_entity_id: string;
    idp_sso_url: string;
    idp_certificate: string;
    sp_entity_id: string;
    attribute_mapping?: Record<string, string> | null;
    is_enabled?: boolean;
    allow_jit_provisioning?: boolean;
    enforce_sso?: boolean;
}

export class SSOProcessor {
    private static instance: SSOProcessor;
    private readonly ssoService = SSOService.getInstance();
    private readonly logger = WinstonLoggerService.getInstance();

    private constructor() {
        console.log('🔐 SSOProcessor initialized');
    }

    public static getInstance(): SSOProcessor {
        if (!SSOProcessor.instance) {
            SSOProcessor.instance = new SSOProcessor();
        }
        return SSOProcessor.instance;
    }

    private async getEntityManager(): Promise<EntityManager> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver unavailable');
        }
        const concreteDriver = await driver.getConcreteDriver();
        return concreteDriver.manager;
    }

    private async ensureOrgAdminAccess(
        manager: EntityManager,
        organizationId: number,
        tokenDetails: ITokenDetails
    ): Promise<void> {
        if (tokenDetails.user_type === EUserType.ADMIN) {
            return;
        }

        const membership = await manager.findOne(DRAOrganizationMember, {
            where: {
                organization_id: organizationId,
                users_platform_id: tokenDetails.user_id,
                is_active: true
            }
        });

        if (!membership || (membership.role !== EOrganizationRole.OWNER && membership.role !== EOrganizationRole.ADMIN)) {
            throw new Error('Only organization owners and admins can manage SSO settings.');
        }
    }

    private maskCertificate(certificate: string): string {
        if (!certificate) {
            return certificate;
        }
        if (certificate.length <= 12) {
            return '***';
        }
        return `${certificate.slice(0, 8)}...${certificate.slice(-8)}`;
    }

    private logAudit(event: string, payload: Record<string, unknown>): void {
        this.logger.log('info', JSON.stringify({
            type: 'sso_audit',
            event,
            ...payload,
            timestamp: new Date().toISOString()
        }));
    }

    async getConfiguration(organizationId: number, tokenDetails: ITokenDetails): Promise<any> {
        const manager = await this.getEntityManager();
        await this.ensureOrgAdminAccess(manager, organizationId, tokenDetails);

        const configuration = await manager.findOne(DRASSOConfiguration, {
            where: { organization_id: organizationId }
        });

        if (!configuration) {
            return null;
        }

        return {
            ...configuration,
            idp_certificate: this.maskCertificate(configuration.idp_certificate)
        };
    }

    /**
     * Checks that the organization has an Enterprise-tier subscription (tier_rank >= 40).
     * Platform admins bypass this check.
     */
    private async ensureEnterpriseTier(
        manager: EntityManager,
        organizationId: number,
        tokenDetails: ITokenDetails
    ): Promise<void> {
        if (tokenDetails.user_type === EUserType.ADMIN) {
            return;
        }

        const orgSubscription = await manager.findOne(DRAOrganizationSubscription, {
            where: { organization_id: organizationId, is_active: true },
            relations: ['subscription_tier']
        });

        const tierRank = orgSubscription?.subscription_tier?.tier_rank ?? 0;
        if (tierRank < 40) {
            throw new Error(
                'SAML SSO is available on the Enterprise plan only. ' +
                'Please upgrade your organization subscription or contact sales.'
            );
        }
    }

    async upsertConfiguration(
        organizationId: number,
        configInput: ISSOConfigInput,
        tokenDetails: ITokenDetails
    ): Promise<DRASSOConfiguration> {
        const manager = await this.getEntityManager();
        await this.ensureOrgAdminAccess(manager, organizationId, tokenDetails);
        await this.ensureEnterpriseTier(manager, organizationId, tokenDetails);

        return manager.transaction(async (transactionalManager) => {
            const organization = await transactionalManager.findOne(DRAOrganization, {
                where: { id: organizationId }
            });

            if (!organization) {
                throw new Error('Organization not found.');
            }

            const existing = await transactionalManager.findOne(DRASSOConfiguration, {
                where: { organization_id: organizationId }
            });

            const payload = {
                organization_id: organizationId,
                idp_name: configInput.idp_name,
                idp_entity_id: configInput.idp_entity_id,
                idp_sso_url: configInput.idp_sso_url,
                idp_certificate: configInput.idp_certificate,
                sp_entity_id: configInput.sp_entity_id,
                attribute_mapping: configInput.attribute_mapping || null,
                is_enabled: configInput.is_enabled ?? true,
                allow_jit_provisioning: configInput.allow_jit_provisioning ?? true,
                enforce_sso: configInput.enforce_sso ?? false
            };

            let configuration: DRASSOConfiguration;
            if (existing) {
                Object.assign(existing, payload);
                configuration = await transactionalManager.save(existing);
            } else {
                configuration = await transactionalManager.save(
                    transactionalManager.create(DRASSOConfiguration, payload)
                );
            }

            (organization as any).sso_enabled = configuration.is_enabled;
            await transactionalManager.save(organization);

            this.logAudit('sso_configuration_upserted', {
                organizationId,
                idpName: configuration.idp_name,
                enabled: configuration.is_enabled,
                enforceSSO: configuration.enforce_sso,
                actorUserId: tokenDetails.user_id
            });

            return configuration;
        });
    }

    async removeConfiguration(organizationId: number, tokenDetails: ITokenDetails): Promise<void> {
        const manager = await this.getEntityManager();
        await this.ensureOrgAdminAccess(manager, organizationId, tokenDetails);

        await manager.transaction(async (transactionalManager) => {
            await transactionalManager.delete(DRASSOConfiguration, { organization_id: organizationId });
            await transactionalManager.update(DRAOrganization, { id: organizationId }, { sso_enabled: false } as any);
        });

        this.logAudit('sso_configuration_removed', {
            organizationId,
            actorUserId: tokenDetails.user_id
        });
    }

    async initiateDomainVerification(
        organizationId: number,
        domain: string,
        tokenDetails: ITokenDetails
    ): Promise<{ token: string }> {
        const manager = await this.getEntityManager();
        await this.ensureOrgAdminAccess(manager, organizationId, tokenDetails);

        const normalizedDomain = this.ssoService.normalizeDomain(domain);
        const token = this.ssoService.generateDomainVerificationToken();

        const existing = await manager.findOne(DRADomainVerification, {
            where: { organization_id: organizationId, domain: normalizedDomain }
        });

        if (existing) {
            existing.verification_token = token;
            existing.status = 'pending';
            existing.verified_at = null;
            await manager.save(existing);
        } else {
            await manager.save(
                manager.create(DRADomainVerification, {
                    organization_id: organizationId,
                    domain: normalizedDomain,
                    verification_token: token,
                    status: 'pending'
                })
            );
        }

        return { token };
    }

    async verifyDomain(organizationId: number, domain: string, tokenDetails: ITokenDetails): Promise<boolean> {
        const manager = await this.getEntityManager();
        await this.ensureOrgAdminAccess(manager, organizationId, tokenDetails);

        const normalizedDomain = this.ssoService.normalizeDomain(domain);
        const record = await manager.findOne(DRADomainVerification, {
            where: { organization_id: organizationId, domain: normalizedDomain }
        });

        if (!record) {
            throw new Error('Domain verification record not found.');
        }

        const txtRecords = await dns.resolveTxt(normalizedDomain);
        const flattened = txtRecords.flat().join(' ');
        const expected = `dra-verify=${record.verification_token}`;

        const isVerified = flattened.includes(expected);
        if (isVerified) {
            record.status = 'verified';
            record.verified_at = new Date();
            await manager.save(record);

            await manager.update(DRAOrganization, { id: organizationId }, { domain: normalizedDomain } as any);
            this.logAudit('sso_domain_verified', {
                organizationId,
                domain: normalizedDomain,
                actorUserId: tokenDetails.user_id
            });
        } else {
            record.status = 'failed';
            await manager.save(record);
            this.logAudit('sso_domain_verification_failed', {
                organizationId,
                domain: normalizedDomain,
                actorUserId: tokenDetails.user_id
            });
        }

        return isVerified;
    }

    async getMetadata(organizationId: number): Promise<string> {
        const manager = await this.getEntityManager();
        const config = await manager.findOne(DRASSOConfiguration, {
            where: { organization_id: organizationId }
        });

        if (!config) {
            throw new Error('SSO configuration not found.');
        }

        return this.ssoService.generateSPMetadata(config);
    }

    async initiateLogin(email: string): Promise<{ redirectUrl: string; relayState: string } | null> {
        const manager = await this.getEntityManager();
        const domain = this.ssoService.extractDomain(email);
        if (!domain) {
            return null;
        }

        const organization = await manager.findOne(DRAOrganization, {
            where: { domain }
        });
        if (!organization) {
            return null;
        }

        const config = await manager.findOne(DRASSOConfiguration, {
            where: { organization_id: organization.id, is_enabled: true }
        });

        if (!config) {
            return null;
        }

        const relayState = this.ssoService.generateRelayState({
            organizationId: organization.id,
            email
        });

        return {
            relayState,
            redirectUrl: await this.ssoService.buildLoginRedirectUrl(config, relayState, email)
        };
    }

    async processSamlCallback(samlResponse: string, relayState: string): Promise<{ token: string; organizationId: number }> {
        const manager = await this.getEntityManager();
        const relayPayload = this.ssoService.decodeRelayState(relayState);

        const configuration = await manager.findOne(DRASSOConfiguration, {
            where: {
                organization_id: relayPayload.organizationId,
                is_enabled: true
            }
        });

        if (!configuration) {
            throw new Error('SSO configuration not found or disabled.');
        }

        const assertion = await this.ssoService.validateAndParseAssertion(
            samlResponse,
            relayState,
            configuration
        );

        const email = assertion.email || relayPayload.email;
        if (!email) {
            throw new Error('Email is missing from SAML assertion.');
        }

        let user = await manager.findOne(DRAUsersPlatform, {
            where: { email }
        });

        if (!user && !configuration.allow_jit_provisioning) {
            throw new Error('No account found and JIT provisioning is disabled for this organization.');
        }

        if (!user) {
            const randomPassword = await bcrypt.hash(`sso_${Date.now()}_${Math.random()}`, 10);
            user = await manager.save(
                manager.create(DRAUsersPlatform, {
                    email,
                    first_name: assertion.firstName || 'SSO',
                    last_name: assertion.lastName || 'User',
                    password: randomPassword,
                    user_type: EUserType.NORMAL,
                    email_verified_at: new Date()
                })
            );

            const existingMember = await manager.findOne(DRAOrganizationMember, {
                where: {
                    organization_id: relayPayload.organizationId,
                    users_platform_id: user.id
                }
            });
            if (!existingMember) {
                await manager.save(
                    manager.create(DRAOrganizationMember, {
                        organization_id: relayPayload.organizationId,
                        users_platform_id: user.id,
                        role: EOrganizationRole.MEMBER,
                        is_active: true,
                        joined_at: new Date()
                    })
                );
            }
        }

        const existingMapping = await manager.findOne(DRASSOUserMapping, {
            where: {
                organization_id: relayPayload.organizationId,
                user_id: user.id,
                sso_name_id: assertion.nameId
            }
        });

        if (existingMapping) {
            existingMapping.last_sso_login_at = new Date();
            existingMapping.sso_attributes = assertion.attributes;
            await manager.save(existingMapping);
        } else {
            await manager.save(
                manager.create(DRASSOUserMapping, {
                    user_id: user.id,
                    organization_id: relayPayload.organizationId,
                    sso_name_id: assertion.nameId,
                    sso_provider: configuration.idp_name,
                    last_sso_login_at: new Date(),
                    sso_attributes: assertion.attributes
                })
            );
        }

        const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
        const token = jwt.sign({ user_id: user.id, user_type: user.user_type, email: user.email }, secret);

        this.logAudit('sso_login_success', {
            organizationId: relayPayload.organizationId,
            userId: user.id,
            email: user.email,
            provider: configuration.idp_name
        });

        return {
            token,
            organizationId: relayPayload.organizationId
        };
    }

    /**
     * Build an IdP-initiated SLO (logout) redirect URL.
     * Returns null when the org has no SSO config or the config is disabled.
     */
    async initiateLogout(
        tokenDetails: ITokenDetails,
        organizationId: number
    ): Promise<{ logoutUrl: string } | null> {
        const manager = this.getEntityManager();

        const configuration = await manager.findOne(DRASSOConfiguration, {
            where: { organization_id: organizationId, is_enabled: true }
        });
        if (!configuration) {
            return null;
        }

        const mapping = await manager.findOne(DRASSOUserMapping, {
            where: {
                user_id: tokenDetails.user_id,
                organization_id: organizationId
            },
            order: { last_sso_login_at: 'DESC' }
        });
        if (!mapping) {
            return null;
        }

        const logoutUrl = await this.ssoService.buildLogoutUrl(configuration, mapping.sso_name_id);

        this.logAudit('sso_logout_initiated', {
            organizationId,
            userId: tokenDetails.user_id,
            email: tokenDetails.email,
            provider: configuration.idp_name
        });

        return { logoutUrl };
    }
}