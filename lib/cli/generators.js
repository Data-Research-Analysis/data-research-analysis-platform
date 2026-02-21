/**
 * Random Value Generators
 * 
 * Functions to generate secure random values for encryption keys, secrets, etc.
 */

import crypto from 'crypto';

/**
 * Generate encryption key for AES-256-CBC
 * Returns 64 hexadecimal characters (32 bytes)
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate JWT secret
 * Returns 32+ character random base64 string
 */
function generateJWTSecret() {
  return crypto.randomBytes(32)
    .toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, 32);
}

/**
 * Generate secure password
 * @param {number} length - Password length (default: 16)
 * @returns {string} Secure password with mixed case, digits, and special chars
 */
function generateSecurePassword(length = 16) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each type
  password += 'A'; // Uppercase
  password += 'a'; // Lowercase
  password += '1'; // Digit
  password += '!'; // Special
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Generate database name from project name
 * @param {string} projectName - Base project name
 * @returns {string} Valid database name
 */
function generateDatabaseName(projectName) {
  return projectName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 63); // PostgreSQL limit
}

/**
 * Generate OAuth redirect URI from backend URL
 * @param {string} backendUrl - Backend base URL
 * @returns {string} Complete redirect URI
 */
function generateRedirectURI(backendUrl) {
  // Remove trailing slash if present
  const baseUrl = backendUrl.replace(/\/$/, '');
  return `${baseUrl}/api/oauth/google/callback`;
}

export {
  generateEncryptionKey,
  generateJWTSecret,
  generateSecurePassword,
  generateDatabaseName,
  generateRedirectURI
};
