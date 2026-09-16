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
      const res = await agent.post(`/api/tickets/${ticketId}/resolution-signal`).send({ status: 'RESOLVED' });
      expect(res.status).toBe(200); // the request succeeds...
      const ticket = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } });
      expect(ticket.status).not.toBe('RESOLVED'); // ...but status never actually changes
      expect(ticket.status).not.toBe('CLOSED');
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
});
