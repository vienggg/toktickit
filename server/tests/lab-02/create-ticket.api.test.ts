import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { getPrisma } from '../../src/prisma.js';

describe('POST /api/tickets (API-03, API-04, API-05)', () => {
  let validCategoryId: number;
  let validRequesterId: number;

  beforeAll(async () => {
    const category = await getPrisma().category.findFirst();
    const requester = await getPrisma().requesterUser.findFirst({ where: { isActive: true } });
    validCategoryId = category!.id;
    validRequesterId = requester!.id;
  });

  it('API-03: creates a ticket with valid fields and attachments, returning 201 and TKT-YYYY-XXXXXX', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .field('summary', 'Automated Test Ticket Submission')
      .field('description', 'Detailed description of the hardware fault for unit test.')
      .field('priority', 'High')
      .field('categoryId', validCategoryId)
      .field('requesterId', validRequesterId)
      .attach('attachments', Buffer.from('Mock screenshot content'), 'test_screenshot.png');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('ticketNumber');
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.summary).toBe('Automated Test Ticket Submission');
    expect(res.body.status).toBe('New');
    expect(res.body.priority).toBe('High');
    expect(res.body.requesterId).toBe(validRequesterId);
    expect(res.body.attachments).toHaveLength(1);
    expect(res.body.attachments[0].fileName).toBe('test_screenshot.png');
    expect(res.body.attachments[0].isRemoved).toBe(false);
  });

  it('API-04: rejects submission with missing summary or description with HTTP 400', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .field('summary', '') // Empty summary
      .field('description', '') // Empty description
      .field('categoryId', validCategoryId)
      .field('requesterId', validRequesterId);

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
    const res = await request(app)
      .post('/api/tickets')
      .field('summary', 'Test with Invalid File')
      .field('description', 'Attempting to upload an unsupported file extension.')
      .field('categoryId', validCategoryId)
      .field('requesterId', validRequesterId)
      .attach('attachments', Buffer.from('malicious script'), 'payload.exe');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Invalid file type/i);
  });
});
