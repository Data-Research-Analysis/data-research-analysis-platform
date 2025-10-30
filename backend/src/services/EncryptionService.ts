import crypto from 'crypto';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails.js';

interface EncryptedData {
    version: number;
    iv: string;
    authTag: string;
    encrypted: string;
}

/**
 * Service for encrypting and decrypting sensitive data using AES-256-GCM
 * Provides authenticated encryption with additional data integrity protection
 */
export class EncryptionService {
    private static instance: EncryptionService;
    private encryptionKey: Buffer;
    private readonly algorithm = 'aes-256-gcm';
    private readonly ivLength = 16; // 128 bits for GCM
    private readonly authTagLength = 16; // 128 bits
    private readonly currentVersion = 1;

    private constructor() {
        this.initializeKey();
    }

    public static getInstance(): EncryptionService {
        if (!EncryptionService.instance) {
            EncryptionService.instance = new EncryptionService();
        }
        return EncryptionService.instance;
    }

    /**
     * Initialize and validate the encryption key from environment variables
     * @throws Error if encryption key is missing or invalid
     */
    private initializeKey(): void {
        const keyHex = process.env.ENCRYPTION_KEY;

        if (!keyHex) {
            throw new Error(
                'ENCRYPTION_KEY not found in environment variables. ' +
                'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
            );
        }

        if (keyHex.length !== 64) {
            throw new Error(
                `ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes), got ${keyHex.length} characters`
            );
        }

        // Validate hex format
        if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
            throw new Error('ENCRYPTION_KEY must contain only hexadecimal characters (0-9, a-f, A-F)');
        }

        this.encryptionKey = Buffer.from(keyHex, 'hex');
        console.log('[SECURITY] Encryption service initialized successfully');
    }

    /**
     * Encrypt connection details using AES-256-GCM
     * @param data - Connection details object to encrypt
     * @returns Encrypted data as JSON string with metadata
     * @throws Error if encryption fails
     */
    public encrypt(data: IDBConnectionDetails): string {
        try {
            if (!data) {
                return null;
            }

            // Generate random IV for each encryption (critical for security)
            const iv = crypto.randomBytes(this.ivLength);

            // Create cipher with algorithm, key, and IV
            const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

            // Convert data to JSON and encrypt
            const jsonData = JSON.stringify(data);
            let encrypted = cipher.update(jsonData, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            // Get authentication tag (provides data integrity verification)
            const authTag = cipher.getAuthTag();

            // Create encrypted data object with metadata
            const encryptedData: EncryptedData = {
                version: this.currentVersion,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                encrypted: encrypted
            };

            // Return as JSON string to store in database
            return JSON.stringify(encryptedData);

        } catch (error) {
            console.error('[SECURITY] Encryption error:', error.message);
            throw new Error('Failed to encrypt connection details');
        }
    }

    /**
     * Decrypt connection details using AES-256-GCM
     * @param encryptedDataString - Encrypted data string from database
     * @returns Decrypted connection details object
     * @throws Error if decryption fails or data is tampered
     */
    public decrypt(encryptedDataString: string): IDBConnectionDetails {
        try {
            if (!encryptedDataString) {
                return null;
            }

            // Parse encrypted data
            const encryptedData: EncryptedData = JSON.parse(encryptedDataString);

            // Validate version for future key rotation support
            if (encryptedData.version !== this.currentVersion) {
                throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
            }

            // Validate required fields
            if (!encryptedData.iv || !encryptedData.authTag || !encryptedData.encrypted) {
                throw new Error('Invalid encrypted data format: missing required fields');
            }

            // Convert hex strings back to buffers
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const authTag = Buffer.from(encryptedData.authTag, 'hex');
            const encrypted = encryptedData.encrypted;

            // Create decipher with algorithm, key, and IV
            const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
            
            // Set authentication tag (will throw if data was tampered)
            decipher.setAuthTag(authTag);

            // Decrypt the data
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            // Parse and return connection details
            return JSON.parse(decrypted);

        } catch (error) {
            // Log error without exposing sensitive data
            console.error('[SECURITY] Decryption error:', error.message);
            
            // Re-throw specific errors without wrapping
            if (error.message.includes('Unsupported encryption version')) {
                throw error;
            }
            
            if (error.message.includes('missing required fields')) {
                throw error;
            }
            
            if (error.message.includes('Unsupported mac')) {
                throw new Error('Failed to decrypt: data may have been tampered with');
            }
            
            throw new Error('Failed to decrypt connection details');
        }
    }

    /**
     * Check if data is encrypted (has encryption metadata)
     * @param data - Data to check (string or object)
     * @returns true if data appears to be encrypted
     */
    public isEncrypted(data: any): boolean {
        if (!data) {
            return false;
        }

        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                return !!(
                    parsed.version &&
                    parsed.iv &&
                    parsed.authTag &&
                    parsed.encrypted
                );
            } catch {
                return false;
            }
        }

        // Check if object has encryption metadata
        if (typeof data === 'object') {
            return !!(
                data.version &&
                data.iv &&
                data.authTag &&
                data.encrypted
            );
        }

        return false;
    }

    /**
     * Validate encryption key format without exposing the key
     * @returns true if key is valid
     */
    public validateKey(): boolean {
        return this.encryptionKey && this.encryptionKey.length === 32;
    }

    /**
     * Get encryption algorithm info (for logging/monitoring)
     * @returns Object with algorithm details
     */
    public getAlgorithmInfo(): { algorithm: string; keySize: number; ivSize: number } {
        return {
            algorithm: this.algorithm,
            keySize: 256,
            ivSize: this.ivLength * 8
        };
    }
}
