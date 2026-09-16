import { PrismaClient, Role, Priority, TicketStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Local-development-only initial password for every seeded account.
// Never a real secret. mustChangePassword defaults to true, so every
// seeded account is forced through the Change Password flow at first
// login (BR-02). Documented again in docs/lab-03/specification.md §8
// and README.md.
const SEED_INITIAL_PASSWORD = 'ChangeMe123!';

async function main() {
  console.log('Seeding TokTickIT Database (Lab 1-3, cumulative and idempotent)...');

  // ---------------------------------------------------------------------
  // Categories (idempotent — Lab 1/2)
  // ---------------------------------------------------------------------
  const categoriesData = [
    { name: 'Account and Access' },
    { name: 'Hardware' },
    { name: 'Software' },
    { name: 'Network' },
  ];
  for (const cat of categoriesData) {
    await prisma.category.upsert({ where: { name: cat.name }, update: {}, create: cat });
  }
  const categories = await prisma.category.findMany({ orderBy: { id: 'asc' } });
  const accountCat = categories.find(c => c.name === 'Account and Access')!.id;
  const hardwareCat = categories.find(c => c.name === 'Hardware')!.id;
  const softwareCat = categories.find(c => c.name === 'Software')!.id;
  const networkCat = categories.find(c => c.name === 'Network')!.id;

  // ---------------------------------------------------------------------
  // Related Systems (idempotent — Lab 1/2)
  // ---------------------------------------------------------------------
  const systemsData = [
    { name: 'ERP Core', description: 'Enterprise Resource Planning financial & inventory ledger' },
    { name: 'HR Portal', description: 'Employee benefits, leave requests, and payroll self-service' },
    { name: 'Email & Collaboration', description: 'Corporate mailbox, calendars, and real-time chat' },
    { name: 'VPN & Remote Access', description: 'Secure gateway for remote telework' },
    { name: 'Finance Central', description: 'Invoicing, procurement, and billing subsystem' },
    { name: 'CRM Platform', description: 'Customer relationship and lead management' },
    { name: 'IT Helpdesk', description: 'Internal IT asset tracking and issue dispatcher' },
  ];
  for (const sys of systemsData) {
    await prisma.relatedSystem.upsert({ where: { name: sys.name }, update: { description: sys.description }, create: sys });
  }
  const systems = await prisma.relatedSystem.findMany({ orderBy: { id: 'asc' } });

  // ---------------------------------------------------------------------
  // Users (idempotent, upsert by email — Lab 1/2 Requesters evolved in
  // place per BR-30; Lab 3 adds IT Staff and Administrator accounts).
  // NEVER deleted/recreated: existing Ticket.requesterId FKs must keep
  // resolving to the same rows they always did.
  // ---------------------------------------------------------------------
  const initialPasswordHash = bcrypt.hashSync(SEED_INITIAL_PASSWORD, 10);

  const requestersData = [
    { name: 'Jennifer Anderson', email: 'jennifer.anderson@toktick.internal', department: 'Finance', isActive: true },
    { name: 'Michael Brown', email: 'michael.brown@toktick.internal', department: 'Operations', isActive: true },
    { name: 'Emily Davis', email: 'emily.davis@toktick.internal', department: 'Marketing', isActive: true },
    { name: 'David Wilson', email: 'david.wilson@toktick.internal', department: 'Engineering', isActive: true },
    { name: 'Alex Taylor', email: 'alex.taylor@toktick.internal', department: 'Human Resources', isActive: false },
  ];

  const staffData = [
    { name: 'Priya Nair', email: 'priya.nair@toktick.internal', department: 'IT Support', isActive: true },
    { name: 'Carlos Mendez', email: 'carlos.mendez@toktick.internal', department: 'IT Support', isActive: true },
    { name: 'Sofia Rossi', email: 'sofia.rossi@toktick.internal', department: 'IT Support', isActive: true },
    { name: 'Tom Becker', email: 'tom.becker@toktick.internal', department: 'IT Support', isActive: false },
  ];

  const adminData = [
    { name: 'Grace Kim', email: 'grace.kim@toktick.internal', department: 'IT Administration', isActive: true },
    { name: 'Daniel Osei', email: 'daniel.osei@toktick.internal', department: 'IT Administration', isActive: true },
  ];

  // Requesters: only set role/password fields on CREATE. An upsert `update`
  // here deliberately does not touch role/password so a real user's later
  // password change or role edit is never clobbered by re-running the seed.
  for (const req of requestersData) {
    await prisma.user.upsert({
      where: { email: req.email },
      update: { name: req.name, department: req.department, isActive: req.isActive },
      create: { ...req, role: Role.REQUESTER, passwordHash: initialPasswordHash, mustChangePassword: true },
    });
  }
  for (const staff of staffData) {
    await prisma.user.upsert({
      where: { email: staff.email },
      update: {},
      create: { ...staff, role: Role.IT_STAFF, passwordHash: initialPasswordHash, mustChangePassword: true },
    });
  }
  for (const admin of adminData) {
    await prisma.user.upsert({
      where: { email: admin.email },
      update: {},
      create: { ...admin, role: Role.ADMINISTRATOR, passwordHash: initialPasswordHash, mustChangePassword: true },
    });
  }

  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
  const byEmail = (email: string) => users.find(u => u.email === email)!;
  const jennifer = byEmail('jennifer.anderson@toktick.internal');
  const priya = byEmail('priya.nair@toktick.internal');
  const carlos = byEmail('carlos.mendez@toktick.internal');
  const sofia = byEmail('sofia.rossi@toktick.internal');

  // ---------------------------------------------------------------------
  // Lab 1/2 Tickets: seeded once, historically. NEVER deleted or
  // recreated here — a prior destructive `deleteMany` was removed because
  // it would wipe tickets created through real app usage (and referenced
  // in the already-submitted Lab 2 report) on every seed run. Idempotency
  // for tickets means "skip if this ticketNumber already exists."
  // ---------------------------------------------------------------------
  const existingNumbers = new Set((await prisma.ticket.findMany({ select: { ticketNumber: true } })).map(t => t.ticketNumber));

  async function ensureTicket(t: {
    ticketNumber: string;
    summary: string;
    description: string;
    requestedPriority: Priority;
    itPriority?: Priority;
    status: TicketStatus;
    categoryId: number;
    relatedSystemId: number | null;
    requesterId: number;
    ownerId?: number | null;
  }) {
    if (existingNumbers.has(t.ticketNumber)) return;
    await prisma.ticket.create({
      data: {
        ticketNumber: t.ticketNumber,
        summary: t.summary,
        description: t.description,
        requestedPriority: t.requestedPriority,
        itPriority: t.itPriority ?? t.requestedPriority,
        status: t.status,
        categoryId: t.categoryId,
        relatedSystemId: t.relatedSystemId,
        requesterId: t.requesterId,
        ownerId: t.ownerId ?? null,
      },
    });
  }

  // Original Lab 1/2 seed set (kept for reference/idempotency; already
  // present in every real database this seed has run against — these
  // `ensureTicket` calls are no-ops there, but let a truly fresh database
  // reproduce the historical Lab 2 dataset from scratch).
  const jenniferLab2Tickets: Array<Parameters<typeof ensureTicket>[0]> = [
    { ticketNumber: 'TKT-2026-000101', summary: 'ERP Core Ledger Balance Discrepancy on Monthly Close', description: 'The reconciliation module displays an unbalanced ledger entry of $4,520 for Q2 closing.', requestedPriority: Priority.URGENT, status: TicketStatus.IN_PROGRESS, categoryId: softwareCat, relatedSystemId: systems[0].id, requesterId: jennifer.id },
    { ticketNumber: 'TKT-2026-000102', summary: 'Dual-Monitor Stand Replacement Request', description: 'The height adjustment arm for the secondary display is loose and poses an ergonomics hazard.', requestedPriority: Priority.LOW, status: TicketStatus.NEW, categoryId: hardwareCat, relatedSystemId: null, requesterId: jennifer.id },
    { ticketNumber: 'TKT-2026-000103', summary: 'VPN Connection Dropping Intermittently During Remote Audit', description: 'Cisco AnyConnect drops authentication token every 15 minutes when connecting from home subnet.', requestedPriority: Priority.HIGH, status: TicketStatus.IN_PROGRESS, categoryId: networkCat, relatedSystemId: systems[3].id, requesterId: jennifer.id },
    { ticketNumber: 'TKT-2026-000104', summary: 'Billing Portal Access Permission for Junior Accountant', description: 'Please provision read-only auditor role in Finance Central for incoming contract auditor.', requestedPriority: Priority.MEDIUM, status: TicketStatus.RESOLVED, categoryId: accountCat, relatedSystemId: systems[4].id, requesterId: jennifer.id },
    { ticketNumber: 'TKT-2026-000105', summary: 'Outlook Shared Mailbox Sync Failure on Finance Inbox', description: 'Inbound vendor invoice emails fail to sync across team members since Monday morning.', requestedPriority: Priority.HIGH, status: TicketStatus.NEW, categoryId: softwareCat, relatedSystemId: systems[2].id, requesterId: jennifer.id },
    { ticketNumber: 'TKT-2026-000106', summary: 'Standing Desk Power Converter Replacement', description: 'Motorized desk control panel displays error E08 and fails to elevate.', requestedPriority: Priority.LOW, status: TicketStatus.CLOSED, categoryId: hardwareCat, relatedSystemId: null, requesterId: jennifer.id },
    { ticketNumber: 'TKT-2026-000107', summary: 'Annual Tax Report Export Module Timeout', description: 'Exporting 10,000 ledger records to Excel returns HTTP 504 gateway timeout after 60 seconds.', requestedPriority: Priority.URGENT, status: TicketStatus.IN_PROGRESS, categoryId: softwareCat, relatedSystemId: systems[0].id, requesterId: jennifer.id },
    { ticketNumber: 'TKT-2026-000108', summary: 'Floor 3 Finance Department Wi-Fi Signal Degradation', description: 'Meeting room 3B has high packet loss and poor signal reception during Zoom conference calls.', requestedPriority: Priority.MEDIUM, status: TicketStatus.NEW, categoryId: networkCat, relatedSystemId: null, requesterId: jennifer.id },
    { ticketNumber: 'TKT-2026-000109', summary: 'Adobe Acrobat Pro License Renewal Required', description: 'PDF digital signature capability is disabled due to expired enterprise license key.', requestedPriority: Priority.MEDIUM, status: TicketStatus.RESOLVED, categoryId: softwareCat, relatedSystemId: null, requesterId: jennifer.id },
    { ticketNumber: 'TKT-2026-000110', summary: 'Finance Shared Drive Read/Write Provisioning', description: 'Grant access to folder Z:\\Finance\\Audit_2026 for newly transferred financial analyst.', requestedPriority: Priority.HIGH, status: TicketStatus.CLOSED, categoryId: accountCat, relatedSystemId: null, requesterId: jennifer.id },
    { ticketNumber: 'TKT-2026-000111', summary: 'Laptop Docking Station Ethernet Port Damaged', description: 'Physical RJ-45 jack clip is broken causing frequent network disconnection when desk is bumped.', requestedPriority: Priority.LOW, status: TicketStatus.NEW, categoryId: hardwareCat, relatedSystemId: null, requesterId: jennifer.id },
    { ticketNumber: 'TKT-2026-000112', summary: 'Expense Report Submission Error in HR Portal', description: 'Receipt PDF attachment fails to upload with message "Multipart boundary not found".', requestedPriority: Priority.MEDIUM, status: TicketStatus.NEW, categoryId: softwareCat, relatedSystemId: systems[1].id, requesterId: jennifer.id },
  ];
  for (const t of jenniferLab2Tickets) await ensureTicket(t);

  const michael = byEmail('michael.brown@toktick.internal');
  await ensureTicket({ ticketNumber: 'TKT-2026-000201', summary: 'Warehouse Barcode Scanner Battery Replacement', description: 'Zebra TC52 handheld scanner battery holds charge for only 30 minutes during inventory scan.', requestedPriority: Priority.HIGH, status: TicketStatus.NEW, categoryId: hardwareCat, relatedSystemId: null, requesterId: michael.id });

  // Attachments for TKT-2026-000101, if not already present.
  const t101 = await prisma.ticket.findUnique({ where: { ticketNumber: 'TKT-2026-000101' } });
  if (t101) {
    const existingAttachments = await prisma.attachment.count({ where: { ticketId: t101.id } });
    if (existingAttachments === 0) {
      await prisma.attachment.createMany({
        data: [
          { ticketId: t101.id, fileName: 'ledger_audit_error_log.pdf', fileUrl: '/uploads/sample_ledger_audit.pdf', fileSize: 245000, mimeType: 'application/pdf', isRemoved: false },
          { ticketId: t101.id, fileName: 'confidential_employee_payroll_sample.png', fileUrl: '/uploads/sample_payroll.png', fileSize: 180000, mimeType: 'image/png', isRemoved: true, removedReason: 'Contains confidential employee payroll info; soft-removed per IT security policy compliance.', removedAt: new Date() },
        ],
      });
    }
  }

  // ---------------------------------------------------------------------
  // Lab 3 Tickets: cover the 4 statuses Lab 2 never produced (OPEN,
  // WAITING_FOR_REQUESTER, REOPENED, CANCELLED), plus assigned/unassigned
  // ownership and cases where itPriority differs from requestedPriority.
  // ---------------------------------------------------------------------
  const emily = byEmail('emily.davis@toktick.internal');
  const david = byEmail('david.wilson@toktick.internal');

  const lab3Tickets: Array<Parameters<typeof ensureTicket>[0]> = [
    { ticketNumber: 'TKT-2026-000301', summary: 'CRM Platform Duplicate Lead Records After Import', description: 'Bulk lead import created 40 duplicate contact records; needs dedup and root-cause review.', requestedPriority: Priority.MEDIUM, itPriority: Priority.HIGH, status: TicketStatus.OPEN, categoryId: softwareCat, relatedSystemId: systems[5].id, requesterId: emily.id, ownerId: priya.id },
    { ticketNumber: 'TKT-2026-000302', summary: 'Marketing Team Shared Calendar Not Syncing to Mobile', description: 'Shared Outlook calendar events do not appear on iOS Outlook app for 3 team members.', requestedPriority: Priority.LOW, status: TicketStatus.OPEN, categoryId: softwareCat, relatedSystemId: systems[2].id, requesterId: emily.id, ownerId: null },
    { ticketNumber: 'TKT-2026-000303', summary: 'Engineering Laptop Requires BIOS Update for Docking Compatibility', description: 'New docking stations are not recognized until BIOS is updated to the latest vendor firmware.', requestedPriority: Priority.MEDIUM, status: TicketStatus.WAITING_FOR_REQUESTER, categoryId: hardwareCat, relatedSystemId: null, requesterId: david.id, ownerId: carlos.id },
    { ticketNumber: 'TKT-2026-000304', summary: 'VPN Client Certificate Expired for Remote Engineering Staff', description: 'Client cert expired at midnight; VPN handshake fails for the full engineering remote pool.', requestedPriority: Priority.URGENT, itPriority: Priority.URGENT, status: TicketStatus.WAITING_FOR_REQUESTER, categoryId: networkCat, relatedSystemId: systems[3].id, requesterId: david.id, ownerId: sofia.id },
    { ticketNumber: 'TKT-2026-000305', summary: 'IT Helpdesk Ticket Dispatcher Queue Not Refreshing Automatically', description: 'The dispatcher dashboard requires a manual page refresh to show newly assigned tickets.', requestedPriority: Priority.MEDIUM, status: TicketStatus.REOPENED, categoryId: softwareCat, relatedSystemId: systems[6].id, requesterId: jennifer.id, ownerId: priya.id },
    { ticketNumber: 'TKT-2026-000306', summary: 'Finance Analyst Duplicate Account Creation Request', description: 'Requester submitted a duplicate of an already-resolved account request in error.', requestedPriority: Priority.LOW, status: TicketStatus.CANCELLED, categoryId: accountCat, relatedSystemId: null, requesterId: jennifer.id, ownerId: null },
    { ticketNumber: 'TKT-2026-000307', summary: 'HR Portal Leave Balance Displaying Incorrect Carryover', description: 'Leave carryover from last fiscal year is not reflected for 6 employees after year-end rollover.', requestedPriority: Priority.HIGH, status: TicketStatus.OPEN, categoryId: softwareCat, relatedSystemId: systems[1].id, requesterId: michael.id, ownerId: sofia.id },
    { ticketNumber: 'TKT-2026-000308', summary: 'Network Printer on Floor 2 Offline Since Firmware Update', description: 'Printer went offline after an automatic firmware push; not reachable via IP or name.', requestedPriority: Priority.MEDIUM, status: TicketStatus.CANCELLED, categoryId: hardwareCat, relatedSystemId: null, requesterId: emily.id, ownerId: carlos.id },
    { ticketNumber: 'TKT-2026-000309', summary: 'CRM Platform Login Loop After SSO Provider Maintenance', description: 'Users are redirected back to the login page repeatedly after entering valid credentials.', requestedPriority: Priority.URGENT, status: TicketStatus.WAITING_FOR_REQUESTER, categoryId: softwareCat, relatedSystemId: systems[5].id, requesterId: david.id, ownerId: priya.id },
    { ticketNumber: 'TKT-2026-000310', summary: 'Reopened: Email Delivery Delay to External Vendors', description: 'Issue believed resolved last week has recurred; outbound mail to two vendor domains delayed 20+ minutes.', requestedPriority: Priority.HIGH, status: TicketStatus.REOPENED, categoryId: softwareCat, relatedSystemId: systems[2].id, requesterId: michael.id, ownerId: sofia.id },
    { ticketNumber: 'TKT-2026-000311', summary: 'New Hire Hardware Provisioning for Engineering Intern', description: 'Standard laptop and monitor bundle requested ahead of intern start date.', requestedPriority: Priority.LOW, status: TicketStatus.OPEN, categoryId: hardwareCat, relatedSystemId: null, requesterId: david.id, ownerId: null },
    { ticketNumber: 'TKT-2026-000312', summary: 'IT Helpdesk Category Taxonomy Cleanup Request', description: 'Several legacy categories are unused and cluttering the ticket creation dropdown.', requestedPriority: Priority.LOW, status: TicketStatus.CANCELLED, categoryId: softwareCat, relatedSystemId: systems[6].id, requesterId: emily.id, ownerId: null },
  ];
  for (const t of lab3Tickets) await ensureTicket(t);

  // ---------------------------------------------------------------------
  // Example Public Comments and Internal Notes (idempotent: only added if
  // the ticket has none yet). No sensitive information, per BR-23.
  // ---------------------------------------------------------------------
  async function ensureCommentary(ticketNumber: string) {
    const ticket = await prisma.ticket.findUnique({ where: { ticketNumber } });
    if (!ticket) return;
    const [commentCount, noteCount] = await Promise.all([
      prisma.publicComment.count({ where: { ticketId: ticket.id } }),
      prisma.internalNote.count({ where: { ticketId: ticket.id } }),
    ]);
    if (commentCount === 0) {
      await prisma.publicComment.create({
        data: { ticketId: ticket.id, authorId: ticket.requesterId, body: 'Following up — is there an update on this? It is starting to affect my daily work.' },
      });
      if (ticket.ownerId) {
        await prisma.publicComment.create({
          data: { ticketId: ticket.id, authorId: ticket.ownerId, body: 'Thanks for the follow-up — we are actively investigating and will update this ticket by end of day.' },
        });
      }
    }
    if (noteCount === 0 && ticket.ownerId) {
      await prisma.internalNote.create({
        data: { ticketId: ticket.id, authorId: ticket.ownerId, body: 'Checked vendor status page — related outage acknowledged upstream; monitoring for resolution before escalating further.' },
      });
    }
  }
  for (const num of ['TKT-2026-000301', 'TKT-2026-000303', 'TKT-2026-000304', 'TKT-2026-000309']) {
    await ensureCommentary(num);
  }

  const finalCounts = {
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    systems: await prisma.relatedSystem.count(),
    tickets: await prisma.ticket.count(),
    comments: await prisma.publicComment.count(),
    notes: await prisma.internalNote.count(),
  };
  console.log(`✅ Seed complete: ${finalCounts.users} users, ${finalCounts.categories} categories, ${finalCounts.systems} systems, ${finalCounts.tickets} tickets, ${finalCounts.comments} public comments, ${finalCounts.notes} internal notes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
