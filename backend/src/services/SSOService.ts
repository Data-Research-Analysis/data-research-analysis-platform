import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { SAML, ValidateInResponseTo } from '@node-saml/passport-saml';
import { UtilityService } from './UtilityService.js';
import { DRASSOConfiguration } from '../models/DRASSOConfiguration.js';
import { getRedisClient } from '../config/redis.config.js';

/** TTL for SAML AuthnRequest IDs in the InResponseTo cache (seconds). */
const SAML_REQUEST_CACHE_TTL_SEC = 300;

/** TTL for SSO one-time codes used to transfer the JWT without leaking it in the URL (seconds). */
const SSO_OTC_TTL_SEC = 60;

/** Redis key prefix for SSO one-time codes. */
const SSO_OTC_KEY_PREFIX = 'sso:otc:';

/**
 * Redis-backed cache provider for @node-saml InResponseTo validation.
 * node-saml calls `saveAsync` when it generates an AuthnRequest ID and
 * `getAsync`/`removeAsync` when validating the InResponseTo field of a response.
 */
const redisSamlCacheProvider = {
    async saveAsync(key: string, value: string): Promise<string | null> {
        try {
            const redis = getRedisClient();
            await redis.set(`sso:saml:req:${key}`, value, 'EX', SAML_REQUEST_CACHE_TTL_SEC);
            return value;
        } catch {
            return null;
        }
    },
    async getAsync(key: string): Promise<string | null> {
        try {
            const redis = getRedisClient();
            return await redis.get(`sso:saml:req:${key}`);
        } catch {
            return null;
        }
    },
    async removeAsync(key: string): Promise<string | null> {
        try {
            const redis = getRedisClient();
            const value = await redis.get(`sso:saml:req:${key}`);
            await redis.del(`sso:saml:req:${key}`);
            return value;
        } catch {
            return null;
        }
    }
};

interface IRelayStatePayload {
    organizationId: number;
    email: string;
}

interface IParsedAssertion {
    nameId: string;
    email: string;
    firstName: string;
    lastName: string;
    attributes: Record<string, any>;
}

export class SSOService {
    private static instance: SSOService;

    private constructor() {
        console.log('🔐 SSOService initialized');
    }

    private ensurePem(cert: string): string {
        const trimmed = cert.trim();
        if (trimmed.includes('BEGIN CERTIFICATE')) {
            return trimmed;
        }

        const wrapped = trimmed.match(/.{1,64}/g)?.join('\n') || trimmed;
        return `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----`;
    }

    private createSamlClient(configuration: DRASSOConfiguration): SAML {
        const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:3002'}/auth/saml/callback`;

        return new SAML({
            issuer: configuration.sp_entity_id,
            callbackUrl,
            entryPoint: configuration.idp_sso_url,
            idpIssuer: configuration.idp_entity_id,
            idpCert: this.ensurePem(configuration.idp_certificate),
            authnRequestBinding: 'HTTP-Redirect',
            disableRequestedAuthnContext: false,
            identifierFormat: null,
            wantAssertionsSigned: true,
            wantAuthnResponseSigned: true,
            validateInResponseTo: ValidateInResponseTo.ifPresent,
            cacheProvider: redisSamlCacheProvider,
            acceptedClockSkewMs: 5000,
            maxAssertionAgeMs: 5 * 60 * 1000,
            requestIdExpirationPeriodMs: SAML_REQUEST_CACHE_TTL_SEC * 1000
        });
    }

    public static getInstance(): SSOService {
        if (!SSOService.instance) {
            SSOService.instance = new SSOService();
        }
        return SSOService.instance;
    }

    generateDomainVerificationToken(): string {
        return crypto.randomBytes(24).toString('hex');
    }

    normalizeDomain(domain: string): string {
        return domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    }

    extractDomain(email: string): string | null {
        const parts = email.toLowerCase().split('@');
        if (parts.length !== 2 || !parts[1]) {
            return null;
        }
        return this.normalizeDomain(parts[1]);
    }

    generateRelayState(payload: IRelayStatePayload): string {
        const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
        return jwt.sign(payload, secret, { expiresIn: '10m' });
    }

    decodeRelayState(token: string): IRelayStatePayload {
        const secret = UtilityService.getInstance().getConstants('JWT_SECRET');
        return jwt.verify(token, secret) as IRelayStatePayload;
    }

    getFrontendUrl(): string {
        return process.env.FRONTEND_URL || process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';
    }

    generateSPMetadata(configuration: DRASSOConfiguration): string {
        const saml = this.createSamlClient(configuration);
        return saml.generateServiceProviderMetadata(null, null);
    }

    async buildLoginRedirectUrl(
        configuration: DRASSOConfiguration,
        relayState: string,
        email: string
    ): Promise<string> {
        const saml = this.createSamlClient(configuration);
        const url = await saml.getAuthorizeUrlAsync(relayState, undefined, {
            additionalParams: {
                login_hint: email
            }
        });
        return url;
    }

    private extractAttributeValue(value: unknown): string | undefined {
        if (typeof value === 'string') {
            return value;
        }
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
            return value[0];
        }
        return undefined;
    }

    private async ensureNotReplay(samlResponse: string): Promise<void> {
        const redis = getRedisClient();
        const digest = crypto.createHash('sha256').update(samlResponse).digest('hex');
        const replayKey = `sso:assertion:replay:${digest}`;

        const setResult = await redis.set(replayKey, '1', 'EX', 300, 'NX');
        if (!setResult) {
            throw new Error('SAML response replay detected.');
        }
    }

    async validateAndParseAssertion(
        samlResponse: string,
        relayState: string,
        configuration: DRASSOConfiguration
    ): Promise<IParsedAssertion> {
        await this.ensureNotReplay(samlResponse);

        const saml = this.createSamlClient(configuration);
        const validation = await saml.validatePostResponseAsync({
            SAMLResponse: samlResponse,
            RelayState: relayState
        });

        const profile = validation.profile;
        if (!profile) {
            throw new Error('Invalid SAML response profile.');
        }

        const mapping = configuration.attribute_mapping || {};

        const mappedEmailKey = mapping.email;
        const mappedFirstNameKey = mapping.firstName || mapping.first_name;
        const mappedLastNameKey = mapping.lastName || mapping.last_name;

        const email =
            (mappedEmailKey ? this.extractAttributeValue(profile[mappedEmailKey]) : undefined) ||
            this.extractAttributeValue(profile.email) ||
            this.extractAttributeValue(profile.mail) ||
            this.extractAttributeValue(profile['urn:oid:0.9.2342.19200300.100.1.3']);

        const firstName =
            (mappedFirstNameKey ? this.extractAttributeValue(profile[mappedFirstNameKey]) : undefined) ||
            this.extractAttributeValue(profile.givenName) ||
            this.extractAttributeValue(profile.first_name) ||
            'SSO';

        const lastName =
            (mappedLastNameKey ? this.extractAttributeValue(profile[mappedLastNameKey]) : undefined) ||
            this.extractAttributeValue(profile.sn) ||
            this.extractAttributeValue(profile.last_name) ||
            'User';

        if (!email) {
            throw new Error('SAML assertion did not include an email attribute.');
        }

        return {
            nameId: profile.nameID || email,
            email,
            firstName,
            lastName,
            attributes: profile as unknown as Record<string, unknown>
        };
    }

    async buildLogoutUrl(
        configuration: DRASSOConfiguration,
        nameId: string,
        sessionIndex?: string
    ): Promise<string> {
        const saml = this.createSamlClient(configuration);
        const logoutUrl = await saml.getLogoutUrlAsync(
            {
                nameID: nameId,
                nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
                sessionIndex: sessionIndex
            } as any,
            '',
            {}
        );
        return logoutUrl;
    }

    /**
     * Creates a short-lived one-time code that can be exchanged for the given
     * JWT token. The code is stored in Redis with a 60-second TTL so the JWT
     * never has to appear in the callback URL.
     */
    async createOneTimeCode(token: string, organizationId: number): Promise<string> {
        const redis = getRedisClient();
        const code = crypto.randomBytes(32).toString('hex');
        const payload = JSON.stringify({ token, organizationId });
        await redis.set(`${SSO_OTC_KEY_PREFIX}${code}`, payload, 'EX', SSO_OTC_TTL_SEC);
        return code;
    }

    /**
     * Exchanges a one-time code for the JWT token. The code is deleted from
     * Redis on first use.
     */
    async exchangeOneTimeCode(code: string): Promise<{ token: string; organizationId: number } | null> {
        const redis = getRedisClient();
        const key = `${SSO_OTC_KEY_PREFIX}${code}`;
        const payload = await redis.get(key);
        if (!payload) {
            return null;
        }
        await redis.del(key);
        try {
            return JSON.parse(payload) as { token: string; organizationId: number };
        } catch {
            return null;
        }
    }
}