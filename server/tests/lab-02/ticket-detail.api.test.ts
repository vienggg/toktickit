import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { getPrisma } from '../../src/prisma.js';

describe('Ticket Detail, Attachment Lifecycle, and In-Place Edit (API-10..13)', () => {
  let sampleTicketId: number;

  beforeAll(async () => {
    const ticket = await getPrisma().ticket.findFirst({
      include: { attachments: true },
    });
    sampleTicketId = ticket!.id;
  });

  it('API-10: GET /api/tickets/:id returns full ticket detail with relations', async () => {
    const res = await request(app).get(`/api/tickets/${sampleTicketId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', sampleTicketId);
    expect(res.body).toHaveProperty('ticketNumber');
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('category');
    expect(res.body).toHaveProperty('requester');
    expect(res.body).toHaveProperty('attachments');
  });

  it('API-11: PATCH /api/tickets/:id performs in-place edits and updates updatedAt', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${sampleTicketId}`)
      .send({
        summary: 'Updated Summary for In-Place Edit Test',
        priority: 'Urgent',
      });

    expect(res.status).toBe(200);
    expect(res.body.summary).toBe('Updated Summary for In-Place Edit Test');
    expect(res.body.priority).toBe('Urgent');
  });

  it('API-12: POST /api/tickets/:id/attachments uploads additional file to ticket', async () => {
    const res = await request(app)
      .post(`/api/tickets/${sampleTicketId}/attachments`)
      .attach('attachments', Buffer.from('Audit test log text'), 'audit_log.pdf');

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].fileName).toBe('audit_log.pdf');
    expect(res.body[0].isRemoved).toBe(false);
  });

  it('API-13: DELETE /api/tickets/:id/attachments/:attachmentId performs soft-removal', async () => {
    // First get an attachment on this ticket
    const ticket = await getPrisma().ticket.findUnique({
      where: { id: sampleTicketId },
      include: { attachments: { where: { isRemoved: false } } },
    });

    const attachmentToDelete = ticket!.attachments[0];
    expect(attachmentToDelete).toBeDefined();

    const res = await request(app)
      .delete(`/api/tickets/${sampleTicketId}/attachments/${attachmentToDelete.id}`)
      .send({ reason: 'Accidental sensitive screenshot upload' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/soft-removed/i);
    expect(res.body.attachment.isRemoved).toBe(true);
    expect(res.body.attachment.removedReason).toBe('Accidental sensitive screenshot upload');
    expect(res.body.attachment.removedAt).toBeDefined();

    // Verify subsequent GET /api/tickets/:id excludes soft-removed attachment
    const getRes = await request(app).get(`/api/tickets/${sampleTicketId}`);
    const foundInActive = getRes.body.attachments.some(
      (a: { id: number }) => a.id === attachmentToDelete.id
    );
    expect(foundInActive).toBe(false);
  });
});
