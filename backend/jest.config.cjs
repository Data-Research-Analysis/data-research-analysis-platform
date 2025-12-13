/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      }
    }]
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  collectCoverageFrom: [
    'src/services/EncryptionService.ts',
    'src/models/DRADataSource.ts',
    'src/middleware/rateLimit.ts',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
  verbose: true,
  maxWorkers: 1,
  testPathIgnorePatterns: [
    '/node_modules/',
    'article-markdown.test.ts' // Skip slow DB-dependent tests
  ],
  silent: false
};
