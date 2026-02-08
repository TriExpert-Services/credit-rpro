/**
 * Integration test helpers
 *
 * Provides JWT generation and test user fixtures so integration
 * tests can send authenticated requests without touching the DB.
 */

const jwt = require('jsonwebtoken');

// Test secret — used by jest.config.js env setup
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';

/**
 * Generate a signed JWT for an in-memory user.
 */
function generateTestToken(userId, opts = {}) {
  const payload = {
    userId,
    requires2FA: opts.requires2FA || false,
  };
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: opts.expiresIn || '1h' });
}

/** Pre-made user fixtures */
const testUsers = {
  admin: {
    id: 'a0000000-0000-0000-0000-000000000001',
    email: 'admin@test.com',
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin',
    status: 'active',
  },
  staff: {
    id: 'a0000000-0000-0000-0000-000000000002',
    email: 'staff@test.com',
    first_name: 'Staff',
    last_name: 'User',
    role: 'staff',
    status: 'active',
  },
  client: {
    id: 'a0000000-0000-0000-0000-000000000003',
    email: 'client@test.com',
    first_name: 'Client',
    last_name: 'User',
    role: 'client',
    status: 'active',
  },
  inactive: {
    id: 'a0000000-0000-0000-0000-000000000004',
    email: 'inactive@test.com',
    first_name: 'Inactive',
    last_name: 'User',
    role: 'client',
    status: 'inactive',
  },
};

module.exports = {
  TEST_JWT_SECRET,
  generateTestToken,
  testUsers,
};
