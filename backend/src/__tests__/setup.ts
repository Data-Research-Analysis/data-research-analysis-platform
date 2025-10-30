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
  console.log('[TEST] Generated test encryption key');
}

// Set test database configuration
process.env.DB_DRIVER = 'postgres';
process.env.POSTGRESQL_HOST = 'localhost';
process.env.POSTGRESQL_PORT = '5434';
process.env.POSTGRESQL_USERNAME = 'postgres';
process.env.POSTGRESQL_PASSWORD = 'postgres';
process.env.POSTGRESQL_DB_NAME = 'test_dra_db';

console.log('[TEST] Test environment initialized');
