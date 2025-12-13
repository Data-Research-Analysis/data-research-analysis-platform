/**
 * Global test setup and configuration
 * Runs before all tests
 */

import crypto from 'crypto';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ENCRYPTION_ENABLED = 'true';

// Generate a test encryption key if not already set
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  console.log('Generated test encryption key');
}

// Set test database configuration
process.env.DB_DRIVER = 'postgres';
process.env.POSTGRESQL_HOST = 'localhost';
process.env.POSTGRESQL_PORT = '5434';
process.env.POSTGRESQL_USERNAME = 'postgres';
process.env.POSTGRESQL_PASSWORD = 'postgres';
process.env.POSTGRESQL_DB_NAME = 'test_dra_db';

// Suppress console.warn and console.error during tests to reduce noise
const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args: any[]) => {
  // Only suppress rate limit warnings
  if (args[0]?.includes('[Rate Limit]')) {
    return;
  }
  originalWarn.apply(console, args);
};

console.error = (...args: any[]) => {
  // Suppress IPv6 validation errors from express-rate-limit (expected and non-blocking)
  if (args[0]?.code === 'ERR_ERL_KEY_GEN_IPV6' || args[0]?.message?.includes('ipKeyGenerator')) {
    return;
  }
  // Suppress expected SECURITY decryption errors from EncryptionService tests
  if (args[0] === '[SECURITY] Decryption error:') {
    return;
  }
  originalError.apply(console, args);
};

console.log('Test environment initialized');
