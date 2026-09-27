import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Agent as SuperTestAgent } from 'supertest';
import { app } from '../../src/app.js';
import { getPrisma } from '../../src/prisma.js';

// This suite specifically needs Jennifer's real seeded ticket history
// (>=12 tickets across a spread of statuses/priorities), so it logs in as
// her rather than using the shared regression-fixture account. Her
// mustChangePassword flag is temporarily cleared for the run and restored
// afterward so the seed's own BR-02 guarantee (every seeded account starts
// mustChangePassword=true) is left exactly as this suite found it.
const JENNIFER_EMAIL = 'jennifer.anderson@toktick.internal';
const JENNIFER_SEED_PASSWORD = 'ChangeMe123!'; // matches prisma/seed.ts SEED_INITIAL_PASSWORD

describe('GET /api/tickets (API-06, API-07, API-08, API-09)', () => {
  let jenniferId: number;
  let sampleTicketNumber: string;
  let agent: SuperTestAgent;
  let originalMustChangePassword: boolean;

  beforeAll(async () => {
    const prisma = getPrisma();
    const jennifer = await prisma.user.findFirstOrThrow({ where: { email: JENNIFER_EMAIL } });
    jenniferId = jennifer.id;
    originalMustChangePassword = jennifer.mustChangePassword;

    if (originalMustChangePassword) {
      await prisma.user.update({ where: { id: jenniferId }, data: { mustChangePassword: false } });
    }

    agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({ email: JENNIFER_EMAIL, password: JENNIFER_SEED_PASSWORD });
    if (loginRes.status !== 200) {
      throw new Error(`Failed to log in as Jennifer for regression tests: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
    }

    const sampleTicket = await prisma.ticket.findFirst({ where: { requesterId: jenniferId } });
    sampleTicketNumber = sampleTicket!.ticketNumber;
  });

  afterAll(async () => {
    if (originalMustChangePassword) {
      await getPrisma().user.update({ where: { id: jenniferId }, data: { mustChangePassword: true } });
    }
  });

  it('API-06: returns paginated tickets strictly scoped to the authenticated session (BR-03)', async () => {
    const res = await agent.get('/api/tickets?page=1&limit=5');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tickets');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.tickets.length).toBeLessThanOrEqual(5);
    expect(res.body.pagination.totalItems).toBeGreaterThanOrEqual(12);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(3);
    expect(res.body.pagination.hasNext).toBe(true);

    const allBelongToJennifer = res.body.tickets.every(
      (t: { requesterId: number }) => t.requesterId === jenniferId
    );
    expect(allBelongToJennifer).toBe(true);
  });

  it('API-06b: an unauthenticated request is rejected with 401, not given an empty list (FR-07)', async () => {
    const res = await request(app).get('/api/tickets?page=1&limit=5');
    expect(res.status).toBe(401);
  });

  it('API-07: searches tickets by summary and ticketNumber', async () => {
    const res = await agent.get(`/api/tickets?search=${sampleTicketNumber}`);

    expect(res.status).toBe(200);
    expect(res.body.tickets.length).toBeGreaterThan(0);
    expect(res.body.tickets[0].ticketNumber).toBe(sampleTicketNumber);
  });

  it('API-08: filters tickets by status and priority', async () => {
    const res = await agent.get('/api/tickets?status=New&priority=High');

    expect(res.status).toBe(200);
    const matchesFilter = res.body.tickets.every(
      (t: { status: string; priority: string }) =>
        t.status === 'New' && t.priority === 'High'
    );
    expect(matchesFilter).toBe(true);
  });

  it('API-09: sorts tickets by createdAt ascending and descending', async () => {
    const resDesc = await agent.get('/api/tickets?sort=createdAt:desc');
    expect(resDesc.status).toBe(200);

    const resAsc = await agent.get('/api/tickets?sort=createdAt:asc');
    expect(resAsc.status).toBe(200);

    if (resDesc.body.tickets.length >= 2 && resAsc.body.tickets.length >= 2) {
      const firstDesc = new Date(resDesc.body.tickets[0].createdAt).getTime();
      const lastDesc = new Date(resDesc.body.tickets[1].createdAt).getTime();
      expect(firstDesc).toBeGreaterThanOrEqual(lastDesc);

      const firstAsc = new Date(resAsc.body.tickets[0].createdAt).getTime();
      const lastAsc = new Date(resAsc.body.tickets[1].createdAt).getTime();
      expect(firstAsc).toBeLessThanOrEqual(lastAsc);
    }
  });
});
