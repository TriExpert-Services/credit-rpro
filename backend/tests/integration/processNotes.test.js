const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../config/database', () => ({
  pool: { query: jest.fn(), on: jest.fn(), end: jest.fn(), totalCount: 0, idleCount: 0, waitingCount: 0 },
  query: (...args) => mockQuery(...args),
  transaction: (...args) => mockTransaction(...args),
  getPoolStats: jest.fn().mockReturnValue({}),
}));
jest.mock('../../utils/auditLogger', () => ({
  AUDIT_ACTIONS: {},
  recordAudit: jest.fn().mockResolvedValue(undefined),
  auditMiddleware: () => (req, res, next) => next(),
  auditFromRequest: jest.fn().mockResolvedValue(undefined),
  getAuditLogs: jest.fn().mockResolvedValue({ rows: [] }),
}));
jest.mock('../../utils/sentry', () => ({
  initSentry: jest.fn(),
  sentryErrorHandler: () => (err, req, res, next) => next(err),
  captureError: jest.fn(),
  captureMessage: jest.fn(),
  Sentry: {},
}));

// Mock processNotesService
const mockProcessNotesService = {
  getClientNotes: jest.fn(),
  getImportantNotes: jest.fn(),
  getTimeline: jest.fn(),
  getStageSummary: jest.fn(),
  createNote: jest.fn(),
  updateNote: jest.fn(),
  deleteNote: jest.fn(),
  addFollowUp: jest.fn(),
  exportNotes: jest.fn(),
  getActivityReport: jest.fn(),
};
jest.mock('../../utils/processNotesService', () => mockProcessNotesService);

const request = require('supertest');
const app = require('../../server');
const { generateTestToken, testUsers } = require('../helpers/setup');

const CLIENT_ID = testUsers.client.id;

// ---------------------------------------------------------------------------
// GET /api/notes/client/:clientId
// ---------------------------------------------------------------------------
describe('GET /api/notes/client/:clientId', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 401 without a token', async () => {
    const res = await request(app).get(`/api/notes/client/${CLIENT_ID}`);
    expect(res.status).toBe(401);
  });

  it('should return 403 for client role', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get(`/api/notes/client/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return notes for staff', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const notes = [{ id: 'n1', note_text: 'Note 1' }];
    mockProcessNotesService.getClientNotes.mockResolvedValue(notes);

    const res = await request(app)
      .get(`/api/notes/client/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.totalCount).toBe(1);
  });

  it('should pass stage and limit query params to service', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });
    mockProcessNotesService.getClientNotes.mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/notes/client/${CLIENT_ID}?stage=dispute&limit=10`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockProcessNotesService.getClientNotes).toHaveBeenCalledWith(CLIENT_ID, 'dispute', '10');
  });
});

// ---------------------------------------------------------------------------
// GET /api/notes/client/:clientId/important
// ---------------------------------------------------------------------------
describe('GET /api/notes/client/:clientId/important', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 403 for client role', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .get(`/api/notes/client/${CLIENT_ID}/important`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return important notes for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    mockProcessNotesService.getImportantNotes.mockResolvedValue([{ id: 'n2', is_important: true }]);

    const res = await request(app)
      .get(`/api/notes/client/${CLIENT_ID}/important`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.importantCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/notes/client/:clientId/timeline
// ---------------------------------------------------------------------------
describe('GET /api/notes/client/:clientId/timeline', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return timeline for staff', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    mockProcessNotesService.getTimeline.mockResolvedValue([{ date: '2025-01-01', events: [] }]);

    const res = await request(app)
      .get(`/api/notes/client/${CLIENT_ID}/timeline`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.timeline).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/notes/client/:clientId/summary
// ---------------------------------------------------------------------------
describe('GET /api/notes/client/:clientId/summary', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return summary for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    mockProcessNotesService.getStageSummary.mockResolvedValue({ intake: 2, dispute: 5 });

    const res = await request(app)
      .get(`/api/notes/client/${CLIENT_ID}/summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toEqual({ intake: 2, dispute: 5 });
  });
});

// ---------------------------------------------------------------------------
// POST /api/notes
// ---------------------------------------------------------------------------
describe('POST /api/notes', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 400 when required fields missing', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: CLIENT_ID });

    expect(res.status).toBe(400);
  });

  it('should create note for staff', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const note = { id: 'n3', note_text: 'New note' };
    mockProcessNotesService.createNote.mockResolvedValue(note);

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: CLIENT_ID, processStage: 'dispute', noteText: 'New note' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.note.id).toBe('n3');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/notes/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/notes/:id', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 400 when noteText missing', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const res = await request(app)
      .patch('/api/notes/n1')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should update note for staff', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const updated = { id: 'n1', note_text: 'Updated' };
    mockProcessNotesService.updateNote.mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/notes/n1')
      .set('Authorization', `Bearer ${token}`)
      .send({ noteText: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.note.note_text).toBe('Updated');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/notes/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/notes/:id', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 403 for client role', async () => {
    const token = generateTestToken(testUsers.client.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.client], rowCount: 1 });

    const res = await request(app)
      .delete('/api/notes/n1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should delete note for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    mockProcessNotesService.deleteNote.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/notes/n1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/notes/follow-up
// ---------------------------------------------------------------------------
describe('POST /api/notes/follow-up', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return 400 when required fields missing', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const res = await request(app)
      .post('/api/notes/follow-up')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should create follow-up for staff', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    const note = { id: 'fu1', note_text: 'Follow up' };
    mockProcessNotesService.addFollowUp.mockResolvedValue(note);

    const res = await request(app)
      .post('/api/notes/follow-up')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: CLIENT_ID, actionDescription: 'Call client' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/notes/client/:clientId/export
// ---------------------------------------------------------------------------
describe('GET /api/notes/client/:clientId/export', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should export notes for admin', async () => {
    const token = generateTestToken(testUsers.admin.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.admin], rowCount: 1 });

    mockProcessNotesService.exportNotes.mockResolvedValue({ url: '/exports/notes.pdf' });

    const res = await request(app)
      .get(`/api/notes/client/${CLIENT_ID}/export`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.export).toHaveProperty('url');
  });
});

// ---------------------------------------------------------------------------
// GET /api/notes/client/:clientId/activity-report
// ---------------------------------------------------------------------------
describe('GET /api/notes/client/:clientId/activity-report', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should return activity report for staff', async () => {
    const token = generateTestToken(testUsers.staff.id);
    mockQuery.mockResolvedValueOnce({ rows: [testUsers.staff], rowCount: 1 });

    mockProcessNotesService.getActivityReport.mockResolvedValue({ totalNotes: 10 });

    const res = await request(app)
      .get(`/api/notes/client/${CLIENT_ID}/activity-report`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report.totalNotes).toBe(10);
    expect(res.body.period).toHaveProperty('start');
    expect(res.body.period).toHaveProperty('end');
  });
});
