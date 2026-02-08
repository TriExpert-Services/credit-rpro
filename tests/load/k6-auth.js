/**
 * k6 Load Test — Auth Endpoints
 *
 * Tests the /api/auth/login endpoint under load.
 * Also includes a health check warm-up stage.
 *
 * Usage:
 *   k6 run tests/load/k6-auth.js
 *
 * Environment variables:
 *   K6_BASE_URL  (default: http://localhost:5000)
 *   K6_TEST_EMAIL
 *   K6_TEST_PASSWORD
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Config ──────────────────────────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:5000';
const TEST_EMAIL = __ENV.K6_TEST_EMAIL || 'test@test.com';
const TEST_PASSWORD = __ENV.K6_TEST_PASSWORD || 'Password123!';

// ── Custom Metrics ──────────────────────────────────────────────────────
const loginSuccessRate = new Rate('login_success');
const loginDuration = new Trend('login_duration', true);

// ── Stages ──────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '15s', target: 5 },   // ramp up to 5 VUs
    { duration: '30s', target: 10 },   // ramp up to 10 VUs
    { duration: '30s', target: 10 },   // hold at 10 VUs
    { duration: '15s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],   // 95% of requests under 2s
    http_req_failed: ['rate<0.10'],      // <10% failure rate
    login_success: ['rate>0.80'],        // >80% successful logins
  },
};

// ── Scenarios ───────────────────────────────────────────────────────────
export default function () {
  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health: status 200': (r) => r.status === 200,
    'health: body OK': (r) => JSON.parse(r.body).status === 'OK',
  });

  // 2. Login attempt
  const payload = JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginOk = check(loginRes, {
    'login: status 200 or 401': (r) => r.status === 200 || r.status === 401,
    'login: has body': (r) => r.body.length > 0,
  });
  loginSuccessRate.add(loginRes.status === 200);
  loginDuration.add(loginRes.timings.duration);

  sleep(1);
}
