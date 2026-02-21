/**
 * Input Validators
 * 
 * Validation functions for user input in interactive prompts.
 * All validators return true for valid input, or an error message string for invalid input.
 */

/**
 * Validate password strength
 * Requires: min 12 chars, uppercase, lowercase, digit, special char
 */
function validatePassword(password) {
  if (!password) {
    return 'Password is required';
  }
  
  if (password.length < 12) {
    return 'Password must be at least 12 characters';
  }
  
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  
  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return 'Password must contain uppercase, lowercase, digit, and special character';
  }
  
  return true;
}

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email) {
    return 'Email is required';
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) || 'Invalid email format';
}

/**
 * Validate port number
 */
function validatePort(port) {
  const portNum = parseInt(port);
  
  if (isNaN(portNum)) {
    return 'Port must be a number';
  }
  
  if (portNum < 1 || portNum > 65535) {
    return 'Port must be between 1 and 65535';
  }
  
  return true;
}

/**
 * Validate URL format
 */
function validateURL(url) {
  if (!url) {
    return 'URL is required';
  }
  
  try {
    new URL(url);
    return true;
  } catch {
    return 'Invalid URL format (must include http:// or https://)';
  }
}

/**
 * Validate encryption key format
 * Must be exactly 64 hexadecimal characters
 */
function validateEncryptionKey(key) {
  if (!key) {
    return 'Encryption key is required';
  }
  
  if (key.length !== 64) {
    return 'Encryption key must be exactly 64 hexadecimal characters';
  }
  
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    return 'Encryption key must contain only hexadecimal characters (0-9, a-f)';
  }
  
  return true;
}

/**
 * Validate JWT secret
 * Must be at least 32 characters
 */
function validateJWTSecret(secret) {
  if (!secret) {
    return 'JWT secret is required';
  }
  
  if (secret.length < 32) {
    return 'JWT secret must be at least 32 characters';
  }
  
  return true;
}

/**
 * Validate cron expression format
 */
function validateCronExpression(cron) {
  if (!cron) {
    return 'Cron expression is required';
  }
  
  // Basic cron validation (5 or 6 fields)
  const cronParts = cron.trim().split(/\s+/);
  
  if (cronParts.length !== 5 && cronParts.length !== 6) {
    return 'Invalid cron expression format (expected 5 or 6 fields)';
  }
  
  return true;
}

/**
 * Validate API key (non-empty, min length)
 */
function validateAPIKey(key, minLength = 8) {
  if (!key) {
    return 'API key is required';
  }
  
  if (key.length < minLength) {
    return `API key must be at least ${minLength} characters`;
  }
  
  return true;
}

/**
 * Validate database name
 * Alphanumeric and underscores only
 */
function validateDatabaseName(name) {
  if (!name) {
    return 'Database name is required';
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    return 'Database name can only contain letters, numbers, and underscores';
  }
  
  if (name.length > 63) {
    return 'Database name must be 63 characters or less';
  }
  
  return true;
}

/**
 * Validate username
 * Alphanumeric, underscores, and hyphens
 */
function validateUsername(username) {
  if (!username) {
    return 'Username is required';
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, underscores, and hyphens';
  }
  
  if (username.length > 63) {
    return 'Username must be 63 characters or less';
  }
  
  return true;
}

/**
 * Validate non-empty string
 */
function validateRequired(value, fieldName = 'This field') {
  if (!value || value.trim().length === 0) {
    return `${fieldName} is required`;
  }
  return true;
}

export {
  validatePassword,
  validateEmail,
  validatePort,
  validateURL,
  validateEncryptionKey,
  validateJWTSecret,
  validateCronExpression,
  validateAPIKey,
  validateDatabaseName,
  validateUsername,
  validateRequired
};
