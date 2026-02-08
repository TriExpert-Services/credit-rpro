/**
 * k6 Load Test — API Endpoints
 *
 * Simulates typical API usage patterns:
 *  - Dashboard reads (most frequent)
 *  - Credit score reads
 *  - Dispute list reads
 *
 * Usage:
 *   k6 run tests/load/k6-api.js
 *
 * Environment variables:
 *   K6_BASE_URL      (default: http://localhost:5000)
 *   K6_AUTH_TOKEN     A valid JWT to use for authenticated requests
 *   K6_CLIENT_ID      UUID of a test client
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

// ── Config ──────────────────────────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || '';
const CLIENT_ID = __ENV.K6_CLIENT_ID || '00000000-0000-0000-0000-000000000001';

const headers = {
  'Content-Type': 'application/json',
  Authorization: AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : '',
};

// ── Custom Metrics ──────────────────────────────────────────────────────
const apiErrors = new Rate('api_errors');

// ── Options ─────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '10s', target: 5 },    // warm-up
    { duration: '30s', target: 15 },   // ramp to 15 VUs
    { duration: '1m', target: 15 },    // sustained load
    { duration: '10s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // 95th percentile under 3s
    http_req_failed: ['rate<0.15'],     // <15% failure rate
    api_errors: ['rate<0.20'],
  },
};

// ── Scenarios ───────────────────────────────────────────────────────────
export default function () {
  group('Health', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, { 'health 200': (r) => r.status === 200 });
    apiErrors.add(res.status >= 400);
  });

  if (AUTH_TOKEN) {
    group('Dashboard', () => {
      const res = http.get(`${BASE_URL}/api/dashboard/client/${CLIENT_ID}`, { headers });
      check(res, {
        'dashboard 200': (r) => r.status === 200,
        'dashboard has body': (r) => r.body.length > 2,
      });
      apiErrors.add(res.status >= 400);
    });

    group('Credit Scores', () => {
      const res = http.get(`${BASE_URL}/api/credit-scores/${CLIENT_ID}/latest`, { headers });
      check(res, {
        'scores 200': (r) => r.status === 200,
      });
      apiErrors.add(res.status >= 400);
    });

    group('Disputes', () => {
      const res = http.get(`${BASE_URL}/api/disputes`, { headers });
      check(res, {
        'disputes 200 or 403': (r) => r.status === 200 || r.status === 403,
      });
      apiErrors.add(res.status >= 500);
    });
  }

  sleep(0.5 + Math.random());
}
