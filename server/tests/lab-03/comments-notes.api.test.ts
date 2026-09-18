import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Agent as SuperTestAgent } from 'supertest';
import { app } from '../../src/app.js';
import { getPrisma } from '../../src/prisma.js';
import {
  loginAsRegressionRequester,
  loginAsRegressionOtherRequester,
  loginAsRegressionStaff,
  loginAsRegressionAdmin,
  REGRESSION_REQUESTER_EMAIL,
} from '../helpers/testAuth.js';

// I-5's slice of this file: Public Comments (API-19) and the Requester
// resolution signal (API-18). Internal Notes (API-20, AC-04/BR-24) are
// added in I-7, which extends this same file rather than duplicating it,
// per docs/lab-03/tests.md.
describe('Public Comments and Resolution Signal (API-18, API-19)', () => {
  let agent: SuperTestAgent;
  let someoneElseAgent: SuperTestAgent;
  let ticketId: number;

  beforeAll(async () => {
    const prisma = getPrisma();
    agent = await loginAsRegressionRequester();
    someoneElseAgent = await loginAsRegressionOtherRequester();

    const requester = await prisma.user.findUniqueOrThrow({ where: { email: REGRESSION_REQUESTER_EMAIL } });
    const category = await prisma.category.findFirstOrThrow();
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-CMT${Date.now().toString().slice(-6)}`,
        summary: 'Comments/resolution-signal fixture ticket',
        description: 'Created for comments-notes.api.test.ts.',
        requestedPriority: 'MEDIUM',
        status: 'NEW',
        categoryId: category.id,
        requesterId: requester.id,
      },
    });
    ticketId = ticket.id;
  });

  describe('GET/POST /api/tickets/:id/comments', () => {
    it('API-19a: the owning Requester can post a Public Comment (BR-04)', async () => {
      const res = await agent.post(`/api/tickets/${ticketId}/comments`).send({ body: 'Any update on this ticket?' });
      expect(res.status).toBe(201);
      expect(res.body.body).toBe('Any update on this ticket?');
      expect(res.body.authorId).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
    });

    it('API-19b: the comment appears in the list, in chronological order', async () => {
      await agent.post(`/api/tickets/${ticketId}/comments`).send({ body: 'Second comment' });
      const res = await agent.get(`/api/tickets/${ticketId}/comments`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0].body).toBe('Any update on this ticket?');
    });

    it('API-19c: rejects whitespace-only content (BR-23)', async () => {
      const res = await agent.post(`/api/tickets/${ticketId}/comments`).send({ body: '   ' });
      expect(res.status).toBe(400);
    });

    it('API-19d: rejects content over 2000 characters (BR-23)', async () => {
      const res = await agent.post(`/api/tickets/${ticketId}/comments`).send({ body: 'x'.repeat(2001) });
      expect(res.status).toBe(400);
    });

    it('API-19e: author and timestamp are server-set, not trusted from the client (BR-22)', async () => {
      const res = await agent
        .post(`/api/tickets/${ticketId}/comments`)
        .send({ body: 'Trying to spoof metadata', authorId: 999999, createdAt: '2000-01-01T00:00:00Z' });
      expect(res.status).toBe(201);
      expect(res.body.authorId).not.toBe(999999);
      expect(new Date(res.body.createdAt).getFullYear()).toBeGreaterThan(2000);
    });

    it('API-19f: a non-owning Requester gets 404, not the comment thread (BR-32)', async () => {
      const res = await someoneElseAgent.get(`/api/tickets/${ticketId}/comments`);
      expect(res.status).toBe(404);
    });

    it('API-19g: an unauthenticated request is rejected with 401', async () => {
      const res = await request(app).get(`/api/tickets/${ticketId}/comments`);
      expect(res.status).toBe(401);
    });

    it('API-19h: there is no update or delete endpoint for a comment (append-only, BR-21)', async () => {
      const listRes = await agent.get(`/api/tickets/${ticketId}/comments`);
      const commentId = listRes.body[0].id;
      const patchRes = await agent.patch(`/api/tickets/${ticketId}/comments/${commentId}`).send({ body: 'edited' });
      expect(patchRes.status).toBe(404); // no such route exists at all
      const deleteRes = await agent.delete(`/api/tickets/${ticketId}/comments/${commentId}`);
      expect(deleteRes.status).toBe(404);
    });
  });

  describe('POST /api/tickets/:id/resolution-signal', () => {
    it('API-18a: sets requesterResolvedAt and posts an auto-generated comment without changing status (BR-05, AC-10)', async () => {
      const before = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } });
      expect(before.requesterResolvedAt).toBeNull();

      const res = await agent.post(`/api/tickets/${ticketId}/resolution-signal`);
      expect(res.status).toBe(200);
      expect(res.body.requesterResolvedAt).toBeDefined();

      const after = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } });
      expect(after.requesterResolvedAt).not.toBeNull();
      expect(after.status).toBe(before.status); // unchanged — BR-05

      const comments = await getPrisma().publicComment.findMany({ where: { ticketId } });
      expect(comments.some((c) => c.body.toLowerCase().includes('resolved'))).toBe(true);
    });

    it('API-18b: a Requester cannot set the ticket to RESOLVED or CLOSED directly (BR-05) — no status field is accepted by this route', async () => {
      // A fresh ticket, not the shared one from API-18a (which the
      // idempotency fix in API-18f now correctly blocks a second signal
      // on) -- this test is about the status field having no effect, not
      // about repeat calls.
      const prisma = getPrisma();
      const category = await prisma.category.findFirstOrThrow();
      const requester = await prisma.user.findUniqueOrThrow({ where: { email: REGRESSION_REQUESTER_EMAIL } });
      const freshTicket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-2026-STF${Date.now().toString().slice(-6)}`,
          summary: 'Status-field-spoof fixture',
          description: 'Verifies a status field in the body has no effect.',
          requestedPriority: 'LOW',
          status: 'NEW',
          categoryId: category.id,
          requesterId: requester.id,
        },
      });

      const res = await agent.post(`/api/tickets/${freshTicket.id}/resolution-signal`).send({ status: 'RESOLVED' });
      expect(res.status).toBe(200); // the request succeeds...
      const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: freshTicket.id } });
      expect(ticket.status).not.toBe('RESOLVED'); // ...but status never actually changes
      expect(ticket.status).not.toBe('CLOSED');
      expect(ticket.status).toBe('NEW');
    });

    it('API-18f: a second call on the same still-open ticket is rejected with 409, not overwritten or duplicated (idempotency)', async () => {
      const prisma = getPrisma();
      const category = await prisma.category.findFirstOrThrow();
      const requester = await prisma.user.findUniqueOrThrow({ where: { email: REGRESSION_REQUESTER_EMAIL } });
      const freshTicket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-2026-IDP${Date.now().toString().slice(-6)}`,
          summary: 'Idempotency fixture',
          description: 'Verifies a repeat resolution-signal call is rejected.',
          requestedPriority: 'LOW',
          status: 'NEW',
          categoryId: category.id,
          requesterId: requester.id,
        },
      });

      const first = await agent.post(`/api/tickets/${freshTicket.id}/resolution-signal`);
      expect(first.status).toBe(200);
      const firstResolvedAt = first.body.requesterResolvedAt;

      const second = await agent.post(`/api/tickets/${freshTicket.id}/resolution-signal`);
      expect(second.status).toBe(409);

      const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: freshTicket.id } });
      expect(new Date(ticket.requesterResolvedAt!).toISOString()).toBe(new Date(firstResolvedAt).toISOString());

      const comments = await prisma.publicComment.findMany({
        where: { ticketId: freshTicket.id, body: { contains: 'resolved' } },
      });
      expect(comments).toHaveLength(1); // not duplicated by the rejected second call
    });

    it('API-18c: is rejected with 409 once the ticket is already RESOLVED/CLOSED/CANCELLED', async () => {
      const category = await getPrisma().category.findFirstOrThrow();
      const requester = await getPrisma().user.findUniqueOrThrow({ where: { email: REGRESSION_REQUESTER_EMAIL } });
      const closedTicket = await getPrisma().ticket.create({
        data: {
          ticketNumber: `TKT-2026-CLS${Date.now().toString().slice(-6)}`,
          summary: 'Already closed fixture',
          description: 'Should reject resolution-signal.',
          requestedPriority: 'LOW',
          status: 'CLOSED',
          categoryId: category.id,
          requesterId: requester.id,
        },
      });
      const res = await agent.post(`/api/tickets/${closedTicket.id}/resolution-signal`);
      expect(res.status).toBe(409);
    });

    it('API-18d: a non-owning Requester gets 404 (BR-32)', async () => {
      const res = await someoneElseAgent.post(`/api/tickets/${ticketId}/resolution-signal`);
      expect(res.status).toBe(404);
    });

    it('API-18e: an unauthenticated request is rejected with 401', async () => {
      const res = await request(app).post(`/api/tickets/${ticketId}/resolution-signal`);
      expect(res.status).toBe(401);
    });
  });

  // Internal Notes (API-08, API-20, AC-04/BR-24) are added in I-7 and
  // extend this same file rather than duplicating it, per the header
  // comment above and docs/lab-03/tests.md.
  describe('GET/POST /api/tickets/:id/internal-notes (API-08, API-20)', () => {
    let staffAgent: SuperTestAgent;
    let adminAgent: SuperTestAgent;

    beforeAll(async () => {
      staffAgent = await loginAsRegressionStaff();
      adminAgent = await loginAsRegressionAdmin();
    });

    it('API-20a: IT Staff can create and list Internal Notes', async () => {
      const postRes = await staffAgent.post(`/api/tickets/${ticketId}/internal-notes`).send({ body: 'Checked event logs, nothing unusual.' });
      expect(postRes.status).toBe(201);
      expect(postRes.body.body).toBe('Checked event logs, nothing unusual.');
      expect(postRes.body.authorId).toBeDefined();
      expect(postRes.body.createdAt).toBeDefined();

      const listRes = await staffAgent.get(`/api/tickets/${ticketId}/internal-notes`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((n: { body: string }) => n.body === 'Checked event logs, nothing unusual.')).toBe(true);
    });

    it('API-20b: Administrator can also create and list Internal Notes', async () => {
      const postRes = await adminAgent.post(`/api/tickets/${ticketId}/internal-notes`).send({ body: 'Escalating to vendor support.' });
      expect(postRes.status).toBe(201);

      const listRes = await adminAgent.get(`/api/tickets/${ticketId}/internal-notes`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((n: { body: string }) => n.body === 'Escalating to vendor support.')).toBe(true);
    });

    it('API-08/API-20c: a Requester GET returns 403 with genuinely no note content of any kind (BR-24)', async () => {
      const res = await agent.get(`/api/tickets/${ticketId}/internal-notes`);
      expect(res.status).toBe(403);
      // Not just a particular error code — assert the body has no
      // note-shaped data at all: no array, no count, no "notes" key.
      expect(Array.isArray(res.body)).toBe(false);
      expect(res.body.notes).toBeUndefined();
      expect(res.body.count).toBeUndefined();
      expect(res.body.length).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/vendor support|event logs/i);
    });

    it('API-08/API-20d: a Requester POST also returns 403 with no note content leaked', async () => {
      const res = await agent.post(`/api/tickets/${ticketId}/internal-notes`).send({ body: 'Attempted note from a Requester' });
      expect(res.status).toBe(403);
      expect(Array.isArray(res.body)).toBe(false);
      expect(res.body.body).toBeUndefined();
      expect(res.body.id).toBeUndefined();

      // And it must not actually have been created.
      const staffListRes = await staffAgent.get(`/api/tickets/${ticketId}/internal-notes`);
      expect(staffListRes.body.some((n: { body: string }) => n.body === 'Attempted note from a Requester')).toBe(false);
    });

    it('API-20e: an unauthenticated request is rejected with 401', async () => {
      const getRes = await request(app).get(`/api/tickets/${ticketId}/internal-notes`);
      expect(getRes.status).toBe(401);
      const postRes = await request(app).post(`/api/tickets/${ticketId}/internal-notes`).send({ body: 'x' });
      expect(postRes.status).toBe(401);
    });

    it('API-20f: rejects whitespace-only content (BR-23)', async () => {
      const res = await staffAgent.post(`/api/tickets/${ticketId}/internal-notes`).send({ body: '   ' });
      expect(res.status).toBe(400);
    });

    it('API-20g: rejects content over 2000 characters (BR-23)', async () => {
      const res = await staffAgent.post(`/api/tickets/${ticketId}/internal-notes`).send({ body: 'x'.repeat(2001) });
      expect(res.status).toBe(400);
    });

    it('API-20h: author and timestamp are server-set, not trusted from the client (BR-22)', async () => {
      const res = await staffAgent
        .post(`/api/tickets/${ticketId}/internal-notes`)
        .send({ body: 'Trying to spoof metadata', authorId: 999999, createdAt: '2000-01-01T00:00:00Z' });
      expect(res.status).toBe(201);
      expect(res.body.authorId).not.toBe(999999);
      expect(new Date(res.body.createdAt).getFullYear()).toBeGreaterThan(2000);
    });

    it('API-20i: there is no update or delete endpoint for a note (append-only, BR-21)', async () => {
      const listRes = await staffAgent.get(`/api/tickets/${ticketId}/internal-notes`);
      const noteId = listRes.body[0].id;
      const patchRes = await staffAgent.patch(`/api/tickets/${ticketId}/internal-notes/${noteId}`).send({ body: 'edited' });
      expect(patchRes.status).toBe(404); // no such route exists at all
      const deleteRes = await staffAgent.delete(`/api/tickets/${ticketId}/internal-notes/${noteId}`);
      expect(deleteRes.status).toBe(404);
    });
  });
});
