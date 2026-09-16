import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Agent as SuperTestAgent } from 'supertest';
import { app } from '../../src/app.js';
import { getPrisma } from '../../src/prisma.js';
import { loginAsRegressionRequester, REGRESSION_REQUESTER_EMAIL } from '../helpers/testAuth.js';

describe('POST /api/tickets (API-03, API-04, API-05)', () => {
  let validCategoryId: number;
  let agent: SuperTestAgent;
  let requesterId: number;

  beforeAll(async () => {
    const category = await getPrisma().category.findFirst();
    validCategoryId = category!.id;
    agent = await loginAsRegressionRequester();
    const requester = await getPrisma().user.findUniqueOrThrow({ where: { email: REGRESSION_REQUESTER_EMAIL } });
    requesterId = requester.id;
  });

  it('API-03: creates a ticket with valid fields and attachments, returning 201 and TKT-YYYY-XXXXXX', async () => {
    const res = await agent
      .post('/api/tickets')
      .field('summary', 'Automated Test Ticket Submission')
      .field('description', 'Detailed description of the hardware fault for unit test.')
      .field('priority', 'High')
      .field('categoryId', validCategoryId)
      .attach('attachments', Buffer.from('Mock screenshot content'), 'test_screenshot.png');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('ticketNumber');
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.summary).toBe('Automated Test Ticket Submission');
    expect(res.body.status).toBe('New');
    expect(res.body.priority).toBe('High');
    // BR-03: ownership is the authenticated identity, not a client-supplied
    // field — there is no requesterId in the request at all any more.
    expect(res.body.requesterId).toBe(requesterId);
    expect(res.body.attachments).toHaveLength(1);
    expect(res.body.attachments[0].fileName).toBe('test_screenshot.png');
    expect(res.body.attachments[0].isRemoved).toBe(false);
  });

  it('API-03b: a requesterId in the request body is ignored — ownership always comes from the session (AC-03, BR-03)', async () => {
    const someoneElse = await getPrisma().user.findFirst({ where: { email: { not: REGRESSION_REQUESTER_EMAIL } } });
    const res = await agent
      .post('/api/tickets')
      .field('summary', 'Ownership Override Attempt')
      .field('description', 'This request tries to claim ownership for a different user.')
      .field('categoryId', validCategoryId)
      .field('requesterId', String(someoneElse!.id));

    expect(res.status).toBe(201);
    expect(res.body.requesterId).toBe(requesterId);
    expect(res.body.requesterId).not.toBe(someoneElse!.id);
  });

  it('API-04: rejects submission with missing summary or description with HTTP 400', async () => {
    const res = await agent
      .post('/api/tickets')
      .field('summary', '') // Empty summary
      .field('description', '') // Empty description
      .field('categoryId', validCategoryId);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'summary' }),
        expect.objectContaining({ field: 'description' }),
      ])
    );
  });

  it('API-05: rejects invalid attachment MIME types (.url / .exe) with HTTP 400', async () => {
    const res = await agent
      .post('/api/tickets')
      .field('summary', 'Test with Invalid File')
      .field('description', 'Attempting to upload an unsupported file extension.')
      .field('categoryId', validCategoryId)
      .attach('attachments', Buffer.from('malicious script'), 'payload.exe');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Invalid file type/i);
  });

  it('API-06: rejects an unauthenticated request with 401 (FR-07)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .field('summary', 'Should Never Be Created')
      .field('description', 'No session cookie is attached to this request.')
      .field('categoryId', validCategoryId);

    expect(res.status).toBe(401);
  });
});
