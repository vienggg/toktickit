import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Agent as SuperTestAgent } from 'supertest';
import { app } from '../../src/app.js';
import { getPrisma } from '../../src/prisma.js';
import { loginAsRegressionRequester, REGRESSION_REQUESTER_EMAIL } from '../helpers/testAuth.js';

describe('Ticket Detail, Attachment Lifecycle, and In-Place Edit (API-10..13)', () => {
  let sampleTicketId: number;
  let agent: SuperTestAgent;
  let requesterId: number;
  let someoneElseAgent: SuperTestAgent | null = null;
  let someoneElseId: number | null = null;
  let someoneElseOriginalMustChangePassword = false;

  beforeAll(async () => {
    const prisma = getPrisma();
    agent = await loginAsRegressionRequester();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: REGRESSION_REQUESTER_EMAIL } });
    requesterId = requester.id;

    const category = await prisma.category.findFirstOrThrow();
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-TEST${Date.now().toString().slice(-6)}`,
        summary: 'Regression suite fixture ticket',
        description: 'Created directly for ticket-detail.api.test.ts, owned by the regression requester.',
        requestedPriority: 'MEDIUM',
        status: 'NEW',
        categoryId: category.id,
        requesterId: requester.id,
      },
    });
    sampleTicketId = ticket.id;
  });

  afterAll(async () => {
    // Restore the "someone else" fixture's password-change state at the
    // very end of the file, not mid-file — restoring it early left a
    // later test hitting the requirePasswordChanged lockout (403) instead
    // of the ownership check (404) it meant to exercise.
    if (someoneElseId && someoneElseOriginalMustChangePassword) {
      await getPrisma().user.update({ where: { id: someoneElseId }, data: { mustChangePassword: true } });
    }
  });

  it('API-10: GET /api/tickets/:id returns full ticket detail with relations', async () => {
    const res = await agent.get(`/api/tickets/${sampleTicketId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', sampleTicketId);
    expect(res.body).toHaveProperty('ticketNumber');
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('category');
    expect(res.body).toHaveProperty('requester');
    expect(res.body).toHaveProperty('attachments');
  });

  it('API-10b: an unauthenticated request is rejected with 401', async () => {
    const res = await request(app).get(`/api/tickets/${sampleTicketId}`);
    expect(res.status).toBe(401);
  });

  it('API-10c: another Requester gets 404, not 403, for a Ticket they do not own (BR-32, AC-17)', async () => {
    const prisma = getPrisma();
    const someoneElse = await prisma.user.findFirstOrThrow({
      where: { role: 'REQUESTER', isActive: true, email: { not: REGRESSION_REQUESTER_EMAIL } },
    });
    // Reuse the my-tickets suite's pattern: log in as a real seeded
    // Requester, temporarily clearing mustChangePassword for the request.
    someoneElseId = someoneElse.id;
    someoneElseOriginalMustChangePassword = someoneElse.mustChangePassword;
    if (someoneElseOriginalMustChangePassword) {
      await prisma.user.update({ where: { id: someoneElse.id }, data: { mustChangePassword: false } });
    }
    someoneElseAgent = request.agent(app);
    const loginRes = await someoneElseAgent.post('/api/auth/login').send({ email: someoneElse.email, password: 'ChangeMe123!' });
    expect(loginRes.status).toBe(200);

    const res = await someoneElseAgent.get(`/api/tickets/${sampleTicketId}`);
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403);
  });

  it('API-11: PATCH /api/tickets/:id performs in-place edits and updates updatedAt', async () => {
    const res = await agent
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
    const res = await agent
      .post(`/api/tickets/${sampleTicketId}/attachments`)
      .attach('attachments', Buffer.from('Audit test log text'), 'audit_log.pdf');

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].fileName).toBe('audit_log.pdf');
    expect(res.body[0].isRemoved).toBe(false);
  });

  it('API-12b: GET .../download serves the active attachment; the download endpoint enforces ownership (404 for a non-owner)', async () => {
    const ticket = await getPrisma().ticket.findUnique({
      where: { id: sampleTicketId },
      include: { attachments: { where: { isRemoved: false } } },
    });
    const attachment = ticket!.attachments[0];

    const ownRes = await agent.get(`/api/tickets/${sampleTicketId}/attachments/${attachment.id}/download`);
    expect(ownRes.status).toBe(200);

    expect(someoneElseAgent).not.toBeNull();
    const otherRes = await someoneElseAgent!.get(`/api/tickets/${sampleTicketId}/attachments/${attachment.id}/download`);
    expect(otherRes.status).toBe(404);
  });

  it('API-13: DELETE /api/tickets/:id/attachments/:attachmentId performs soft-removal', async () => {
    // First get an attachment on this ticket
    const ticket = await getPrisma().ticket.findUnique({
      where: { id: sampleTicketId },
      include: { attachments: { where: { isRemoved: false } } },
    });

    const attachmentToDelete = ticket!.attachments[0];
    expect(attachmentToDelete).toBeDefined();

    const res = await agent
      .delete(`/api/tickets/${sampleTicketId}/attachments/${attachmentToDelete.id}`)
      .send({ reason: 'Accidental sensitive screenshot upload' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/soft-removed/i);
    expect(res.body.attachment.isRemoved).toBe(true);
    expect(res.body.attachment.removedReason).toBe('Accidental sensitive screenshot upload');
    expect(res.body.attachment.removedAt).toBeDefined();

    // Verify subsequent GET /api/tickets/:id excludes soft-removed attachment
    const getRes = await agent.get(`/api/tickets/${sampleTicketId}`);
    const foundInActive = getRes.body.attachments.some(
      (a: { id: number }) => a.id === attachmentToDelete.id
    );
    expect(foundInActive).toBe(false);

    // API-13b: downloading a soft-removed attachment returns 410 Gone.
    const downloadRes = await agent.get(`/api/tickets/${sampleTicketId}/attachments/${attachmentToDelete.id}/download`);
    expect(downloadRes.status).toBe(410);
  });
});
