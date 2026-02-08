/**
 * Unit Tests — middleware/auth.js
 *
 * Tests for requireRole, requireStaff, requireAdmin, canAccessClient.
 * authenticateToken is tested via integration (it needs jwt + DB).
 */

const {
  requireRole,
  requireStaff,
  requireAdmin,
  canAccessClient,
} = require('../../middleware/auth');

// ── helpers ──────────────────────────────────────────────────────────────────
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) => ({
  user: null,
  params: {},
  ...overrides,
});

const mockNext = () => jest.fn();

// ═══════════════════════════════════════════════════════════════
// requireRole
// ═══════════════════════════════════════════════════════════════
describe('requireRole', () => {
  it('calls next() when user has one of the required roles', () => {
    const req = mockReq({ user: { role: 'admin' } });
    const res = mockRes();
    const next = mockNext();

    requireRole('admin', 'staff')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user is missing', () => {
    const req = mockReq({ user: null });
    const res = mockRes();
    const next = mockNext();

    requireRole('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Authentication required' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user role is not in allowed list', () => {
    const req = mockReq({ user: { role: 'client' } });
    const res = mockRes();
    const next = mockNext();

    requireRole('admin', 'staff')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Insufficient permissions',
        required: ['admin', 'staff'],
        current: 'client',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('works with a single required role', () => {
    const req = mockReq({ user: { role: 'admin' } });
    const res = mockRes();
    const next = mockNext();

    requireRole('admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// requireStaff (alias for requireRole('admin','staff'))
// ═══════════════════════════════════════════════════════════════
describe('requireStaff', () => {
  it.each(['admin', 'staff'])('allows %s', (role) => {
    const req = mockReq({ user: { role } });
    const res = mockRes();
    const next = mockNext();

    requireStaff(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects client role', () => {
    const req = mockReq({ user: { role: 'client' } });
    const res = mockRes();
    const next = mockNext();

    requireStaff(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ═══════════════════════════════════════════════════════════════
// requireAdmin
// ═══════════════════════════════════════════════════════════════
describe('requireAdmin', () => {
  it('allows admin', () => {
    const req = mockReq({ user: { role: 'admin' } });
    const res = mockRes();
    const next = mockNext();

    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it.each(['staff', 'client'])('rejects %s', (role) => {
    const req = mockReq({ user: { role } });
    const res = mockRes();
    const next = mockNext();

    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ═══════════════════════════════════════════════════════════════
// canAccessClient
// ═══════════════════════════════════════════════════════════════
describe('canAccessClient', () => {
  it('allows admin to access any client', async () => {
    const req = mockReq({
      user: { id: 'user-1', role: 'admin' },
      params: { clientId: 'other-user' },
    });
    const res = mockRes();
    const next = mockNext();

    await canAccessClient(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows staff to access any client', async () => {
    const req = mockReq({
      user: { id: 'user-2', role: 'staff' },
      params: { clientId: 'other-user' },
    });
    const res = mockRes();
    const next = mockNext();

    await canAccessClient(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows client to access own data via :clientId', async () => {
    const req = mockReq({
      user: { id: 'user-3', role: 'client' },
      params: { clientId: 'user-3' },
    });
    const res = mockRes();
    const next = mockNext();

    await canAccessClient(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows client to access own data via :id', async () => {
    const req = mockReq({
      user: { id: 'user-3', role: 'client' },
      params: { id: 'user-3' },
    });
    const res = mockRes();
    const next = mockNext();

    await canAccessClient(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('denies client when accessing another client', async () => {
    const req = mockReq({
      user: { id: 'user-3', role: 'client' },
      params: { clientId: 'user-999' },
    });
    const res = mockRes();
    const next = mockNext();

    await canAccessClient(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied to this client data' });
    expect(next).not.toHaveBeenCalled();
  });

  it('denies client when id types differ (number vs string)', async () => {
    // canAccessClient uses === which is strict equality
    const req = mockReq({
      user: { id: 3, role: 'client' },
      params: { clientId: '3' },
    });
    const res = mockRes();
    const next = mockNext();

    await canAccessClient(req, res, next);

    // Strict equality means number !== string
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
