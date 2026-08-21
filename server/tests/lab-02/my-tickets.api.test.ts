import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { getPrisma } from '../../src/prisma.js';

describe('GET /api/tickets (API-06, API-07, API-08, API-09)', () => {
  let jenniferId: number;
  let sampleTicketNumber: string;

  beforeAll(async () => {
    const jennifer = await getPrisma().requesterUser.findFirst({
      where: { email: 'jennifer.anderson@toktick.internal' },
    });
    jenniferId = jennifer!.id;

    const sampleTicket = await getPrisma().ticket.findFirst({
      where: { requesterId: jenniferId },
    });
    sampleTicketNumber = sampleTicket!.ticketNumber;
  });

  it('API-06: returns paginated tickets strictly filtered by requesterId', async () => {
    const res = await request(app)
      .get(`/api/tickets?requesterId=${jenniferId}&page=1&limit=5`);

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

  it('API-07: searches tickets by summary and ticketNumber', async () => {
    const res = await request(app)
      .get(`/api/tickets?requesterId=${jenniferId}&search=${sampleTicketNumber}`);

    expect(res.status).toBe(200);
    expect(res.body.tickets.length).toBeGreaterThan(0);
    expect(res.body.tickets[0].ticketNumber).toBe(sampleTicketNumber);
  });

  it('API-08: filters tickets by status and priority', async () => {
    const res = await request(app)
      .get(`/api/tickets?requesterId=${jenniferId}&status=New&priority=High`);

    expect(res.status).toBe(200);
    const matchesFilter = res.body.tickets.every(
      (t: { status: string; priority: string }) =>
        t.status === 'New' && t.priority === 'High'
    );
    expect(matchesFilter).toBe(true);
  });

  it('API-09: sorts tickets by createdAt ascending and descending', async () => {
    const resDesc = await request(app)
      .get(`/api/tickets?requesterId=${jenniferId}&sort=createdAt:desc`);
    expect(resDesc.status).toBe(200);

    const resAsc = await request(app)
      .get(`/api/tickets?requesterId=${jenniferId}&sort=createdAt:asc`);
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
