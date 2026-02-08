/**
 * Unit Tests — responseHelpers.js
 *
 * Tests for HTTP response helpers, case-conversion utilities,
 * and response sanitization.
 */

const {
  HTTP_STATUS,
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendInternalError,
  handleValidationErrors,
  asyncHandler,
  toCamelCase,
  toSnakeCase,
  sanitizeResponse,
} = require('../../utils/responseHelpers');

// ─── Mock res object factory ───────────────────────────────────
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ═══════════════════════════════════════════════════════════════
// HTTP_STATUS constants
// ═══════════════════════════════════════════════════════════════
describe('HTTP_STATUS', () => {
  it('contains all standard status codes', () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.CREATED).toBe(201);
    expect(HTTP_STATUS.NO_CONTENT).toBe(204);
    expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
    expect(HTTP_STATUS.FORBIDDEN).toBe(403);
    expect(HTTP_STATUS.NOT_FOUND).toBe(404);
    expect(HTTP_STATUS.CONFLICT).toBe(409);
    expect(HTTP_STATUS.UNPROCESSABLE_ENTITY).toBe(422);
    expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// Response senders
// ═══════════════════════════════════════════════════════════════
describe('sendSuccess', () => {
  it('sends 200 with data', () => {
    const res = mockRes();
    sendSuccess(res, { id: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: { id: 1 } });
  });

  it('includes message when provided', () => {
    const res = mockRes();
    sendSuccess(res, { id: 1 }, 'OK');
    expect(res.json).toHaveBeenCalledWith({ data: { id: 1 }, message: 'OK' });
  });

  it('uses custom status code', () => {
    const res = mockRes();
    sendSuccess(res, {}, null, 202);
    expect(res.status).toHaveBeenCalledWith(202);
  });
});

describe('sendCreated', () => {
  it('sends 201 with default message', () => {
    const res = mockRes();
    sendCreated(res, { id: 42 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      data: { id: 42 },
      message: 'Created successfully',
    });
  });

  it('accepts custom message', () => {
    const res = mockRes();
    sendCreated(res, {}, 'Item added');
    expect(res.json).toHaveBeenCalledWith({
      data: {},
      message: 'Item added',
    });
  });
});

describe('sendError', () => {
  it('sends 400 by default', () => {
    const res = mockRes();
    sendError(res, 'Bad input');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Bad input' });
  });

  it('accepts custom status code', () => {
    const res = mockRes();
    sendError(res, 'Oops', 422);
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('includes details when provided', () => {
    const res = mockRes();
    sendError(res, 'Invalid', 400, { field: 'email' });
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid',
      details: { field: 'email' },
    });
  });
});

describe('sendValidationError', () => {
  it('sends 400 with error array', () => {
    const res = mockRes();
    const errors = [{ field: 'email', msg: 'required' }];
    sendValidationError(res, errors);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      errors,
    });
  });
});

describe('sendUnauthorized', () => {
  it('sends 401 with default message', () => {
    const res = mockRes();
    sendUnauthorized(res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('accepts custom message', () => {
    const res = mockRes();
    sendUnauthorized(res, 'Token expired');
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
  });
});

describe('sendForbidden', () => {
  it('sends 403 with default message', () => {
    const res = mockRes();
    sendForbidden(res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
  });
});

describe('sendNotFound', () => {
  it('sends 404 with generic message', () => {
    const res = mockRes();
    sendNotFound(res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Resource not found' });
  });

  it('uses resource name', () => {
    const res = mockRes();
    sendNotFound(res, 'Client');
    expect(res.json).toHaveBeenCalledWith({ error: 'Client not found' });
  });
});

describe('sendConflict', () => {
  it('sends 409 with default message', () => {
    const res = mockRes();
    sendConflict(res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Resource already exists' });
  });
});

describe('sendInternalError', () => {
  it('sends 500 with default message', () => {
    const res = mockRes();
    const spy = jest.spyOn(console, 'error').mockImplementation();
    sendInternalError(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    spy.mockRestore();
  });

  it('logs original error', () => {
    const res = mockRes();
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const originalError = new Error('DB crash');
    sendInternalError(res, originalError);
    expect(spy).toHaveBeenCalledWith('Internal server error:', originalError);
    spy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════
// handleValidationErrors
// ═══════════════════════════════════════════════════════════════
describe('handleValidationErrors', () => {
  it('returns false when there are no errors', () => {
    const res = mockRes();
    const result = handleValidationErrors({ isEmpty: () => true, array: () => [] }, res);
    expect(result).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sends validation error and returns true when errors exist', () => {
    const res = mockRes();
    const errors = [{ msg: 'email required' }];
    const result = handleValidationErrors({ isEmpty: () => false, array: () => errors }, res);
    expect(result).toBe(true);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// asyncHandler
// ═══════════════════════════════════════════════════════════════
describe('asyncHandler', () => {
  it('passes through when async function succeeds', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(fn);
    const req = {}, res = mockRes(), next = jest.fn();
    await wrapped(req, res, next);
    expect(fn).toHaveBeenCalledWith(req, res, next);
  });

  it('catches errors and sends 500', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const wrapped = asyncHandler(fn);
    const req = {}, res = mockRes(), next = jest.fn();
    await wrapped(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    spy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════
// toCamelCase
// ═══════════════════════════════════════════════════════════════
describe('toCamelCase', () => {
  it('converts snake_case keys to camelCase', () => {
    expect(toCamelCase({ first_name: 'Ana', last_name: 'García' }))
      .toEqual({ firstName: 'Ana', lastName: 'García' });
  });

  it('handles nested objects', () => {
    expect(toCamelCase({ user_info: { zip_code: '33617' } }))
      .toEqual({ userInfo: { zipCode: '33617' } });
  });

  it('handles arrays', () => {
    expect(toCamelCase([{ first_name: 'A' }, { first_name: 'B' }]))
      .toEqual([{ firstName: 'A' }, { firstName: 'B' }]);
  });

  it('returns primitives as-is', () => {
    expect(toCamelCase(null)).toBeNull();
    expect(toCamelCase(undefined)).toBeUndefined();
    expect(toCamelCase('hello')).toBe('hello');
    expect(toCamelCase(42)).toBe(42);
  });

  it('handles empty object', () => {
    expect(toCamelCase({})).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════
// toSnakeCase
// ═══════════════════════════════════════════════════════════════
describe('toSnakeCase', () => {
  it('converts camelCase keys to snake_case', () => {
    expect(toSnakeCase({ firstName: 'Ana', lastName: 'García' }))
      .toEqual({ first_name: 'Ana', last_name: 'García' });
  });

  it('handles nested objects', () => {
    expect(toSnakeCase({ userInfo: { zipCode: '33617' } }))
      .toEqual({ user_info: { zip_code: '33617' } });
  });

  it('handles arrays', () => {
    expect(toSnakeCase([{ firstName: 'A' }]))
      .toEqual([{ first_name: 'A' }]);
  });

  it('returns primitives as-is', () => {
    expect(toSnakeCase(null)).toBeNull();
    expect(toSnakeCase(42)).toBe(42);
  });
});

// ═══════════════════════════════════════════════════════════════
// sanitizeResponse
// ═══════════════════════════════════════════════════════════════
describe('sanitizeResponse', () => {
  it('removes password_hash by default', () => {
    const input = { id: 1, email: 'a@b.com', password_hash: 'secret' };
    expect(sanitizeResponse(input)).toEqual({ id: 1, email: 'a@b.com' });
  });

  it('removes passwordHash by default', () => {
    const input = { id: 1, passwordHash: 'secret' };
    expect(sanitizeResponse(input)).toEqual({ id: 1 });
  });

  it('removes custom fields', () => {
    const input = { id: 1, ssn: '123-45-6789', name: 'Ana' };
    expect(sanitizeResponse(input, ['ssn'])).toEqual({ id: 1, name: 'Ana' });
  });

  it('handles arrays', () => {
    const input = [
      { id: 1, password_hash: 'x' },
      { id: 2, password_hash: 'y' },
    ];
    expect(sanitizeResponse(input)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('returns primitives and null as-is', () => {
    expect(sanitizeResponse(null)).toBeNull();
    expect(sanitizeResponse(undefined)).toBeUndefined();
    expect(sanitizeResponse('string')).toBe('string');
  });
});
