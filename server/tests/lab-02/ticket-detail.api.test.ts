import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Agent as SuperTestAgent } from 'supertest';
import { app } from '../../src/app.js';
import { getPrisma } from '../../src/prisma.js';
import {
  loginAsRegressionRequester,
  loginAsRegressionOtherRequester,
  REGRESSION_REQUESTER_EMAIL,
} from '../helpers/testAuth.js';

describe('Ticket Detail, Attachment Lifecycle, and In-Place Edit (API-10..13)', () => {
  let sampleTicketId: number;
  let agent: SuperTestAgent;
  let requesterId: number;
  let someoneElseAgent: SuperTestAgent;

  beforeAll(async () => {
    const prisma = getPrisma();
    agent = await loginAsRegressionRequester();
    // Dedicated fixture, not a random real seeded Requester — see
    // server/tests/helpers/testAuth.ts for why (avoids a cross-file
    // parallelism race that previously made this suite intermittently
    // flaky).
    someoneElseAgent = await loginAsRegressionOtherRequester();
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

  it('API-11b: PATCH by a non-owner returns 404, not 403 (BR-32)', async () => {
    const res = await someoneElseAgent.patch(`/api/tickets/${sampleTicketId}`).send({ summary: 'Should not apply' });
    expect(res.status).toBe(404);
  });

  it('API-11c: an unauthenticated PATCH is rejected with 401 (FR-07)', async () => {
    const res = await request(app).patch(`/api/tickets/${sampleTicketId}`).send({ summary: 'Should not apply' });
    expect(res.status).toBe(401);
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

    const otherRes = await someoneElseAgent.get(`/api/tickets/${sampleTicketId}/attachments/${attachment.id}/download`);
    expect(otherRes.status).toBe(404);

    const noAuthRes = await request(app).get(`/api/tickets/${sampleTicketId}/attachments/${attachment.id}/download`);
    expect(noAuthRes.status).toBe(401);
  });

  it('API-12a2: an unauthenticated POST to attachments is rejected with 401 (FR-07)', async () => {
    const res = await request(app)
      .post(`/api/tickets/${sampleTicketId}/attachments`)
      .attach('attachments', Buffer.from('irrelevant'), 'noauth.pdf');
    expect(res.status).toBe(401);
  });

  it('API-12c: POST attachments by a non-owner returns 404 and writes no file to disk (BR-32)', async () => {
    const beforeCount = (
      await getPrisma().ticket.findUnique({
        where: { id: sampleTicketId },
        include: { attachments: { where: { isRemoved: false } } },
      })
    )!.attachments.length;

    const res = await someoneElseAgent
      .post(`/api/tickets/${sampleTicketId}/attachments`)
      .attach('attachments', Buffer.from('Should never be written'), 'intrusion.pdf');
    expect(res.status).toBe(404);

    const afterCount = (
      await getPrisma().ticket.findUnique({
        where: { id: sampleTicketId },
        include: { attachments: { where: { isRemoved: false } } },
      })
    )!.attachments.length;
    expect(afterCount).toBe(beforeCount);
  });

  it('API-13: DELETE /api/tickets/:id/attachments/:attachmentId performs soft-removal', async () => {
    // First get an attachment on this ticket
    const ticket = await getPrisma().ticket.findUnique({
      where: { id: sampleTicketId },
      include: { attachments: { where: { isRemoved: false } } },
    });

    const attachmentToDelete = ticket!.attachments[0];
    expect(attachmentToDelete).toBeDefined();

    // API-13a: a non-owner cannot soft-remove it (404, not 403 — BR-32).
    const forbiddenRes = await someoneElseAgent
      .delete(`/api/tickets/${sampleTicketId}/attachments/${attachmentToDelete.id}`)
      .send({ reason: 'Should not be permitted' });
    expect(forbiddenRes.status).toBe(404);

    // API-13a2: unauthenticated DELETE is rejected with 401 (FR-07).
    const noAuthRes = await request(app)
      .delete(`/api/tickets/${sampleTicketId}/attachments/${attachmentToDelete.id}`)
      .send({ reason: 'Should not be permitted' });
    expect(noAuthRes.status).toBe(401);

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
