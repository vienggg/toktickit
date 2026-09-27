import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Agent as SuperTestAgent } from 'supertest';
import { app } from '../../src/app.js';
import { getPrisma } from '../../src/prisma.js';
import {
  loginAsRegressionStaff,
  loginAsRegressionRequester,
  REGRESSION_STAFF_EMAIL,
} from '../helpers/testAuth.js';

// I-6: GET /api/staff/tickets (API-13, API-14). See docs/lab-03/api-spec.md
// §4 and docs/lab-03/ui-spec.md §6.
describe('IT Staff Ticket Queue (API-13, API-14)', () => {
  let staffAgent: SuperTestAgent;
  let requesterAgent: SuperTestAgent;
  let categoryId: number;
  let staffUserId: number;
  const suffix = Date.now().toString().slice(-6);

  beforeAll(async () => {
    const prisma = getPrisma();
    staffAgent = await loginAsRegressionStaff();
    requesterAgent = await loginAsRegressionRequester();

    const staffUser = await prisma.user.findUniqueOrThrow({ where: { email: REGRESSION_STAFF_EMAIL } });
    staffUserId = staffUser.id;
    const category = await prisma.category.findFirstOrThrow();
    categoryId = category.id;
    const requester = await prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER' } });

    // A predictable slice of fixture tickets for search/filter/sort assertions.
    await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-SQ1${suffix}`,
        summary: `Staff Queue Fixture Alpha ${suffix}`,
        description: 'Unassigned, NEW, LOW priority fixture.',
        requestedPriority: 'LOW',
        itPriority: 'LOW',
        status: 'NEW',
        categoryId,
        requesterId: requester.id,
        ownerId: null,
      },
    });
    await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-SQ2${suffix}`,
        summary: `Staff Queue Fixture Beta ${suffix}`,
        description: 'Assigned to staff, IN_PROGRESS, URGENT priority fixture.',
        requestedPriority: 'MEDIUM',
        itPriority: 'URGENT',
        status: 'IN_PROGRESS',
        categoryId,
        requesterId: requester.id,
        ownerId: staffUserId,
      },
    });
    await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-SQ3${suffix}`,
        summary: `Staff Queue Fixture Gamma ${suffix}`,
        description: 'Resolved fixture ticket.',
        requestedPriority: 'HIGH',
        itPriority: 'MEDIUM',
        status: 'RESOLVED',
        categoryId,
        requesterId: requester.id,
        ownerId: null,
      },
    });
  });

  it('API-14a: an IT Staff user gets 200 with the paginated queue', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ search: suffix });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 10 });
    expect(res.body.data.length).toBe(3);
  });

  it('API-14b: an Administrator (or IT_STAFF) response includes owner name and it priority', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ search: `SQ2${suffix}` });
    expect(res.status).toBe(200);
    const ticket = res.body.data[0];
    expect(ticket.ownerId).toBe(staffUserId);
    expect(ticket.ownerName).toBe('Regression Suite Staff');
    expect(ticket.itPriority).toBe('URGENT');
  });

  it('API-14c: a REQUESTER gets 403', async () => {
    const res = await requesterAgent.get('/api/staff/tickets');
    expect(res.status).toBe(403);
  });

  it('API-14d: an unauthenticated request gets 401', async () => {
    const res = await request(app).get('/api/staff/tickets');
    expect(res.status).toBe(401);
  });

  it('API-13a: search matches ticket number, summary, description', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ search: `Fixture Alpha ${suffix}` });
    expect(res.status).toBe(200);
    expect(res.body.data.some((t: { ticketNumber: string }) => t.ticketNumber === `TKT-2026-SQ1${suffix}`)).toBe(true);
  });

  it('API-13b: status filter narrows results', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ search: suffix, status: 'RESOLVED' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('RESOLVED');
  });

  it('API-13c: itPriority filter narrows results', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ search: suffix, itPriority: 'URGENT' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].itPriority).toBe('URGENT');
  });

  it('API-13d: ownerId=unassigned filters to null-owner tickets only', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ search: suffix, ownerId: 'unassigned' });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data.every((t: { ownerId: number | null }) => t.ownerId === null)).toBe(true);
  });

  it('API-13e: ownerId=<id> filters to that owner only', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ search: suffix, ownerId: String(staffUserId) });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].ownerId).toBe(staffUserId);
  });

  it('API-13f: sort+order applied (ticketNumber asc)', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ search: suffix, sort: 'ticketNumber', order: 'asc' });
    expect(res.status).toBe(200);
    const numbers = res.body.data.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(numbers).toEqual([...numbers].sort());
  });

  it('API-13g: default ordering is updatedAt desc', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ search: suffix });
    expect(res.status).toBe(200);
    const dates = res.body.data.map((t: { updatedAt: string }) => new Date(t.updatedAt).getTime());
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });

  it('API-13h: an invalid status value returns 400 naming the field', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ status: 'NOT_A_STATUS' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('status');
  });

  it('API-13i: an invalid itPriority value returns 400 naming the field', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ itPriority: 'BOGUS' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('itPriority');
  });

  it('API-13j: a non-numeric page returns 400 naming the field', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ page: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('page');
  });

  it('API-13k: pageSize over 50 returns 400 naming the field', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ pageSize: '51' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('pageSize');
  });

  it('API-13l: an invalid sort value returns 400 naming the field', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ sort: 'notAField' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('sort');
  });

  it('API-13m: pagination reflects page and pageSize correctly', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ search: suffix, page: 1, pageSize: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
  });

  // Added in review of PR #67 (item 3): page only rejected values < 1;
  // a huge page number like this passed the old /^\d+$/ regex and
  // produced a huge `skip` handed straight to Prisma, likely surfacing
  // as an unhandled 500 instead of this route's usual clean 400.
  it('API-13n: a huge page number returns 400 naming the field, not a 500', async () => {
    const res = await staffAgent.get('/api/staff/tickets').query({ page: '99999999999999999999' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('page');
  });
});

// Added in review of PR #67 (item 2): GET /api/staff/members backs the
// Queue's Owner filter picker. See docs/lab-03/api-spec.md §4.
describe('IT Staff Members Roster (added in review of PR #67)', () => {
  let staffAgent: SuperTestAgent;
  let requesterAgent: SuperTestAgent;

  beforeAll(async () => {
    staffAgent = await loginAsRegressionStaff();
    requesterAgent = await loginAsRegressionRequester();
  });

  it('an IT Staff user gets 200 with an array of active staff/admin members ordered by name', async () => {
    const res = await staffAgent.get('/api/staff/members');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((m: { name: string }) => m.name === 'Regression Suite Staff')).toBe(true);
    const names = res.body.map((m: { name: string }) => m.name);
    expect(names).toEqual([...names].sort());
    for (const member of res.body) {
      expect(Object.keys(member).sort()).toEqual(['id', 'name']);
    }
  });

  it('a REQUESTER gets 403', async () => {
    const res = await requesterAgent.get('/api/staff/members');
    expect(res.status).toBe(403);
  });

  it('an unauthenticated request gets 401', async () => {
    const res = await request(app).get('/api/staff/members');
    expect(res.status).toBe(401);
  });
});
