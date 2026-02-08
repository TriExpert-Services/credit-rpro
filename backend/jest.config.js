/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
  ],
  collectCoverageFrom: [
    'utils/**/*.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    'config/**/*.js',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'clover'],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
  // Load environment variables before anything else
  setupFiles: ['<rootDir>/tests/helpers/env.js'],
  testTimeout: 15000,
  verbose: true,
  // Group test runs: unit first, then integration
  testSequencer: undefined,
  // Isolate modules to avoid cross-test state leaks
  restoreMocks: true,
};
