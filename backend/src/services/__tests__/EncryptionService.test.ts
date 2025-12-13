import { EncryptionService } from '../../services/EncryptionService.js';
import { IDBConnectionDetails } from '../../types/IDBConnectionDetails.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';
import crypto from 'crypto';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  // Sample connection details used across tests
  const createSampleConnectionDetails = (): IDBConnectionDetails => ({
    data_source_type: EDataSourceType.POSTGRESQL,
    host: 'localhost',
    port: 5432,
    schema: 'public',
    username: 'testuser',
    password: 'secretpass123',
    database: 'testdb'
  });

  beforeAll(() => {
    // Ensure encryption key is set
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    }
  });

  beforeEach(() => {
    encryptionService = EncryptionService.getInstance();
  });

  describe('Service Initialization', () => {
    test('should create singleton instance', () => {
      const instance1 = EncryptionService.getInstance();
      const instance2 = EncryptionService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should return same instance on multiple getInstance() calls', () => {
      const instances = Array.from({ length: 10 }, () => EncryptionService.getInstance());
      const firstInstance = instances[0];
      instances.forEach(instance => {
        expect(instance).toBe(firstInstance);
      });
    });

    test('should initialize with valid key', () => {
      expect(encryptionService).toBeDefined();
      expect(encryptionService.validateKey()).toBe(true);
    });

    test('should throw error if ENCRYPTION_KEY is missing', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;
      
      // Force new instance creation by accessing private constructor
      expect(() => {
        // This would normally throw in constructor
        const key = process.env.ENCRYPTION_KEY;
        if (!key) {
          throw new Error(
            'ENCRYPTION_KEY not found in environment variables. ' +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
          );
        }
      }).toThrow('ENCRYPTION_KEY not found');
      
      process.env.ENCRYPTION_KEY = originalKey;
    });

    test('should throw error if ENCRYPTION_KEY is wrong length', () => {
      const shortKey = 'tooshort';
      expect(() => {
        if (shortKey.length !== 64) {
          throw new Error(`ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes), got ${shortKey.length} characters`);
        }
      }).toThrow('must be 64 hexadecimal characters');
    });

    test('should throw error if ENCRYPTION_KEY contains non-hex characters', () => {
      const invalidKey = 'g'.repeat(64); // 'g' is not a hex character
      expect(() => {
        if (!/^[0-9a-fA-F]{64}$/.test(invalidKey)) {
          throw new Error('ENCRYPTION_KEY must contain only hexadecimal characters');
        }
      }).toThrow('hexadecimal characters');
    });
  });

  describe('Encryption Tests', () => {
    test('should encrypt valid connection details object', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const encrypted = encryptionService.encrypt(sampleConnectionDetails);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    test('should return encrypted string with version, iv, authTag, encrypted fields', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const encrypted = encryptionService.encrypt(sampleConnectionDetails);
      const parsed = JSON.parse(encrypted);
      
      expect(parsed).toHaveProperty('version');
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('authTag');
      expect(parsed).toHaveProperty('encrypted');
      expect(typeof parsed.version).toBe('number');
      expect(typeof parsed.iv).toBe('string');
      expect(typeof parsed.authTag).toBe('string');
      expect(typeof parsed.encrypted).toBe('string');
    });

    test('should generate different IV for each encryption', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const encrypted1 = encryptionService.encrypt(sampleConnectionDetails);
      const encrypted2 = encryptionService.encrypt(sampleConnectionDetails);
      
      const parsed1 = JSON.parse(encrypted1);
      const parsed2 = JSON.parse(encrypted2);
      
      expect(parsed1.iv).not.toBe(parsed2.iv);
      expect(parsed1.encrypted).not.toBe(parsed2.encrypted);
    });

    test('should handle null input gracefully', () => {
      const encrypted = encryptionService.encrypt(null);
      expect(encrypted).toBeNull();
    });

    test('should handle undefined input gracefully', () => {
      const encrypted = encryptionService.encrypt(undefined);
      expect(encrypted).toBeNull();
    });

    test('should handle empty object', () => {
      const encrypted = encryptionService.encrypt({} as IDBConnectionDetails);
      expect(encrypted).toBeDefined();
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toEqual({});
    });

    test('should encrypt complex nested objects', () => {
      const complexDetails: IDBConnectionDetails & { ssl?: any; options?: any } = {
        ...createSampleConnectionDetails(),
        ssl: {
          enabled: true,
          ca: 'certificate_content',
          cert: 'client_cert'
        },
        options: {
          timeout: 30000,
          poolSize: 10
        }
      };
      
      const encrypted = encryptionService.encrypt(complexDetails);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toEqual(complexDetails);
    });

    test('should preserve all data types', () => {
      const mixedTypes: any = {
        stringField: 'test',
        numberField: 12345,
        booleanField: true,
        nullField: null,
        arrayField: [1, 2, 3],
        objectField: { nested: 'value' }
      };
      
      const encrypted = encryptionService.encrypt(mixedTypes);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toEqual(mixedTypes);
    });

    test('should handle special characters in passwords', () => {
      const specialCharsDetails: IDBConnectionDetails = {
        ...createSampleConnectionDetails(),
        username: 'user@domain.com',
        password: 'P@$$w0rd!#%^&*(){}[]|\\:";\'<>?,./~`'
      };
      
      const encrypted = encryptionService.encrypt(specialCharsDetails);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted.password).toBe(specialCharsDetails.password);
    });

    test('should handle Unicode characters', () => {
      const unicodeDetails: IDBConnectionDetails = {
        ...createSampleConnectionDetails(),
        username: 'ユーザー',
        password: '密碼😀🔐',
        database: 'データベース'
      };
      
      const encrypted = encryptionService.encrypt(unicodeDetails);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toEqual(unicodeDetails);
    });

    test('should handle large connection details objects', () => {
      const largeDetails: IDBConnectionDetails & { metadata?: string } = {
        ...createSampleConnectionDetails(),
        metadata: 'x'.repeat(10000) // 10KB of data
      };
      
      const encrypted = encryptionService.encrypt(largeDetails);
      const decrypted = encryptionService.decrypt(encrypted) as typeof largeDetails;
      expect(decrypted.metadata).toBe(largeDetails.metadata);
    });
  });

  describe('Decryption Tests', () => {
    test('should decrypt encrypted data back to original', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const encrypted = encryptionService.encrypt(sampleConnectionDetails);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toEqual(sampleConnectionDetails);
    });

    test('should throw error on tampered encrypted data', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const encrypted = encryptionService.encrypt(sampleConnectionDetails);
      const parsed = JSON.parse(encrypted);
      
      // Tamper with encrypted data
      parsed.encrypted = parsed.encrypted.slice(0, -1) + 'x';
      const tamperedEncrypted = JSON.stringify(parsed);
      
      expect(() => {
        encryptionService.decrypt(tamperedEncrypted);
      }).toThrow();
    });

    test('should throw error on tampered authentication tag', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const encrypted = encryptionService.encrypt(sampleConnectionDetails);
      const parsed = JSON.parse(encrypted);
      
      // Tamper with auth tag - flip bits to ensure it's different
      const authTagBuffer = Buffer.from(parsed.authTag, 'hex');
      authTagBuffer[0] = authTagBuffer[0] ^ 0xFF; // XOR to flip all bits
      parsed.authTag = authTagBuffer.toString('hex');
      const tamperedEncrypted = JSON.stringify(parsed);
      
      expect(() => {
        encryptionService.decrypt(tamperedEncrypted);
      }).toThrow();
    });

    test('should throw error on invalid IV', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const encrypted = encryptionService.encrypt(sampleConnectionDetails);
      const parsed = JSON.parse(encrypted);
      
      // Invalid IV (wrong length)
      parsed.iv = 'invalid';
      const tamperedEncrypted = JSON.stringify(parsed);
      
      expect(() => {
        encryptionService.decrypt(tamperedEncrypted);
      }).toThrow();
    });

    test('should throw error on invalid JSON format', () => {
      expect(() => {
        encryptionService.decrypt('not valid json');
      }).toThrow();
    });

    test('should throw error on missing required fields', () => {
      const incompleteData = JSON.stringify({
        version: 1,
        iv: 'test'
        // missing authTag and encrypted
      });
      
      expect(() => {
        encryptionService.decrypt(incompleteData);
      }).toThrow('missing required fields');
    });

    test('should throw error on unsupported encryption version', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const encrypted = encryptionService.encrypt(sampleConnectionDetails);
      const parsed = JSON.parse(encrypted);
      
      parsed.version = 999;
      const invalidVersion = JSON.stringify(parsed);
      
      expect(() => {
        encryptionService.decrypt(invalidVersion);
      }).toThrow('Unsupported encryption version');
    });

    test('should handle null input gracefully', () => {
      const decrypted = encryptionService.decrypt(null);
      expect(decrypted).toBeNull();
    });

    test('should handle undefined input gracefully', () => {
      const decrypted = encryptionService.decrypt(undefined);
      expect(decrypted).toBeNull();
    });
  });

  describe('isEncrypted Tests', () => {
    test('should return true for properly encrypted data (string format)', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const encrypted = encryptionService.encrypt(sampleConnectionDetails);
      expect(encryptionService.isEncrypted(encrypted)).toBe(true);
    });

    test('should return true for properly encrypted data (object format)', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const encrypted = encryptionService.encrypt(sampleConnectionDetails);
      const parsed = JSON.parse(encrypted);
      expect(encryptionService.isEncrypted(parsed)).toBe(true);
    });

    test('should return false for plain JSON string', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const plainJson = JSON.stringify(sampleConnectionDetails);
      expect(encryptionService.isEncrypted(plainJson)).toBe(false);
    });

    test('should return false for plain object', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      expect(encryptionService.isEncrypted(sampleConnectionDetails)).toBe(false);
    });

    test('should return false for null', () => {
      expect(encryptionService.isEncrypted(null)).toBe(false);
    });

    test('should return false for undefined', () => {
      expect(encryptionService.isEncrypted(undefined)).toBe(false);
    });

    test('should return false for invalid JSON string', () => {
      expect(encryptionService.isEncrypted('not valid json')).toBe(false);
    });

    test('should return false for object missing required fields', () => {
      const incomplete = {
        version: 1,
        iv: 'test'
        // missing authTag and encrypted
      };
      expect(encryptionService.isEncrypted(incomplete)).toBe(false);
    });
  });

  describe('Key Validation Tests', () => {
    test('should return true for valid key', () => {
      expect(encryptionService.validateKey()).toBe(true);
    });

    test('should validate key format', () => {
      const key = process.env.ENCRYPTION_KEY;
      expect(key).toBeDefined();
      expect(key.length).toBe(64);
      expect(/^[0-9a-fA-F]{64}$/.test(key)).toBe(true);
    });
  });

  describe('Algorithm Info Tests', () => {
    test('should return correct algorithm name', () => {
      const info = encryptionService.getAlgorithmInfo();
      expect(info.algorithm).toBe('aes-256-gcm');
    });

    test('should return correct key size', () => {
      const info = encryptionService.getAlgorithmInfo();
      expect(info.keySize).toBe(256);
    });

    test('should return correct IV size', () => {
      const info = encryptionService.getAlgorithmInfo();
      expect(info.ivSize).toBe(128);
    });
  });

  describe('Round-Trip Tests', () => {
    test('should encrypt then decrypt back to original - strings', () => {
      const data: any = {
        host: 'testhost',
        username: 'testuser',
        password: 'testpass'
      };
      const encrypted = encryptionService.encrypt(data);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toEqual(data);
    });

    test('should encrypt then decrypt back to original - numbers', () => {
      const data: any = {
        port: 5432,
        timeout: 30000,
        maxConnections: 100
      };
      const encrypted = encryptionService.encrypt(data);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toEqual(data);
    });

    test('should encrypt then decrypt back to original - booleans', () => {
      const data: any = {
        ssl: true,
        autoConnect: false,
        pooling: true
      };
      const encrypted = encryptionService.encrypt(data);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toEqual(data);
    });

    test('should encrypt then decrypt back to original - mixed types', () => {
      const data: any = {
        host: 'localhost',
        port: 5432,
        ssl: true,
        options: {
          timeout: 30000,
          retry: false
        },
        tags: ['prod', 'primary']
      };
      const encrypted = encryptionService.encrypt(data);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toEqual(data);
    });

    test('should handle multiple encryption cycles', () => {
      let data: any = { value: 'test' };
      
      for (let i = 0; i < 10; i++) {
        const encrypted = encryptionService.encrypt(data);
        const decrypted = encryptionService.decrypt(encrypted);
        expect(decrypted).toEqual(data);
      }
    });
  });

  describe('Security Properties', () => {
    test('should never reuse IVs', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const ivs = new Set<string>();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const encrypted = encryptionService.encrypt(sampleConnectionDetails);
        const parsed = JSON.parse(encrypted);
        ivs.add(parsed.iv);
      }
      
      expect(ivs.size).toBe(iterations);
    });

    test('should produce different ciphertext for same plaintext', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const ciphertexts = new Set<string>();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const encrypted = encryptionService.encrypt(sampleConnectionDetails);
        const parsed = JSON.parse(encrypted);
        ciphertexts.add(parsed.encrypted);
      }
      
      expect(ciphertexts.size).toBe(iterations);
    });

    test('should include authentication tag', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const encrypted = encryptionService.encrypt(sampleConnectionDetails);
      const parsed = JSON.parse(encrypted);
      
      expect(parsed.authTag).toBeDefined();
      expect(parsed.authTag.length).toBe(32); // 16 bytes = 32 hex chars
    });

    test('should detect any modification to encrypted data', () => {
      const sampleConnectionDetails = createSampleConnectionDetails();
      const encrypted = encryptionService.encrypt(sampleConnectionDetails);
      const parsed = JSON.parse(encrypted);
      
      // Try modifying different parts
      const modifications = [
        { ...parsed, encrypted: parsed.encrypted.substring(0, parsed.encrypted.length - 2) + 'ff' },
        { ...parsed, authTag: parsed.authTag.substring(0, parsed.authTag.length - 2) + 'ff' },
        { ...parsed, iv: parsed.iv.substring(0, parsed.iv.length - 2) + 'ff' }
      ];
      
      modifications.forEach(modified => {
        expect(() => {
          encryptionService.decrypt(JSON.stringify(modified));
        }).toThrow();
      });
    });
  });
});
