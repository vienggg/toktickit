import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding TokTickIT Database for Sprint 2 (Lab 2)...');

  // 1. Seed Categories (Idempotent)
  const categoriesData = [
    { name: 'Account and Access' },
    { name: 'Hardware' },
    { name: 'Software' },
    { name: 'Network' },
  ];

  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  const categories = await prisma.category.findMany({ orderBy: { id: 'asc' } });
  const accountCat = categories.find(c => c.name === 'Account and Access')?.id || categories[0].id;
  const hardwareCat = categories.find(c => c.name === 'Hardware')?.id || categories[1].id;
  const softwareCat = categories.find(c => c.name === 'Software')?.id || categories[2].id;
  const networkCat = categories.find(c => c.name === 'Network')?.id || categories[3].id;

  // 2. Seed Requester Users (4 Active, 1 Inactive)
  const requestersData = [
    { name: 'Jennifer Anderson', email: 'jennifer.anderson@toktick.internal', department: 'Finance', isActive: true },
    { name: 'Michael Brown', email: 'michael.brown@toktick.internal', department: 'Operations', isActive: true },
    { name: 'Emily Davis', email: 'emily.davis@toktick.internal', department: 'Marketing', isActive: true },
    { name: 'David Wilson', email: 'david.wilson@toktick.internal', department: 'Engineering', isActive: true },
    { name: 'Alex Taylor', email: 'alex.taylor@toktick.internal', department: 'Human Resources', isActive: false },
  ];

  for (const req of requestersData) {
    await prisma.requesterUser.upsert({
      where: { email: req.email },
      update: { name: req.name, department: req.department, isActive: req.isActive },
      create: req,
    });
  }
  const requesters = await prisma.requesterUser.findMany({ orderBy: { id: 'asc' } });
  const jennifer = requesters.find(r => r.email === 'jennifer.anderson@toktick.internal') || requesters[0];
  const michael = requesters.find(r => r.email === 'michael.brown@toktick.internal') || requesters[1];

  // 3. Seed Related Systems
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
    await prisma.relatedSystem.upsert({
      where: { name: sys.name },
      update: { description: sys.description },
      create: sys,
    });
  }
  const systems = await prisma.relatedSystem.findMany({ orderBy: { id: 'asc' } });

  // Clean old tickets for fresh seed if existing
  await prisma.attachment.deleteMany({});
  await prisma.ticket.deleteMany({});

  // 4. Seed 12 Multi-Page Tickets for Jennifer Anderson (ID 1)
  const jenniferTickets = [
    {
      ticketNumber: 'TKT-2026-000101',
      summary: 'ERP Core Ledger Balance Discrepancy on Monthly Close',
      description: 'The reconciliation module displays an unbalanced ledger entry of $4,520 for Q2 closing.',
      priority: 'Urgent',
      status: 'In_Progress',
      categoryId: softwareCat,
      relatedSystemId: systems[0].id, // ERP Core
      requesterId: jennifer.id,
    },
    {
      ticketNumber: 'TKT-2026-000102',
      summary: 'Dual-Monitor Stand Replacement Request',
      description: 'The height adjustment arm for the secondary display is loose and poses an ergonomics hazard.',
      priority: 'Low',
      status: 'New',
      categoryId: hardwareCat,
      relatedSystemId: null,
      requesterId: jennifer.id,
    },
    {
      ticketNumber: 'TKT-2026-000103',
      summary: 'VPN Connection Dropping Intermittently During Remote Audit',
      description: 'Cisco AnyConnect drops authentication token every 15 minutes when connecting from home subnet.',
      priority: 'High',
      status: 'In_Progress',
      categoryId: networkCat,
      relatedSystemId: systems[3].id, // VPN
      requesterId: jennifer.id,
    },
    {
      ticketNumber: 'TKT-2026-000104',
      summary: 'Billing Portal Access Permission for Junior Accountant',
      description: 'Please provision read-only auditor role in Finance Central for incoming contract auditor.',
      priority: 'Medium',
      status: 'Resolved',
      categoryId: accountCat,
      relatedSystemId: systems[4].id, // Finance Central
      requesterId: jennifer.id,
    },
    {
      ticketNumber: 'TKT-2026-000105',
      summary: 'Outlook Shared Mailbox Sync Failure on Finance Inbox',
      description: 'Inbound vendor invoice emails fail to sync across team members since Monday morning.',
      priority: 'High',
      status: 'New',
      categoryId: softwareCat,
      relatedSystemId: systems[2].id, // Email
      requesterId: jennifer.id,
    },
    {
      ticketNumber: 'TKT-2026-000106',
      summary: 'Standing Desk Power Converter Replacement',
      description: 'Motorized desk control panel displays error E08 and fails to elevate.',
      priority: 'Low',
      status: 'Closed',
      categoryId: hardwareCat,
      relatedSystemId: null,
      requesterId: jennifer.id,
    },
    {
      ticketNumber: 'TKT-2026-000107',
      summary: 'Annual Tax Report Export Module Timeout',
      description: 'Exporting 10,000 ledger records to Excel returns HTTP 504 gateway timeout after 60 seconds.',
      priority: 'Urgent',
      status: 'In_Progress',
      categoryId: softwareCat,
      relatedSystemId: systems[0].id, // ERP Core
      requesterId: jennifer.id,
    },
    {
      ticketNumber: 'TKT-2026-000108',
      summary: 'Floor 3 Finance Department Wi-Fi Signal Degradation',
      description: 'Meeting room 3B has high packet loss and poor signal reception during Zoom conference calls.',
      priority: 'Medium',
      status: 'New',
      categoryId: networkCat,
      relatedSystemId: null,
      requesterId: jennifer.id,
    },
    {
      ticketNumber: 'TKT-2026-000109',
      summary: 'Adobe Acrobat Pro License Renewal Required',
      description: 'PDF digital signature capability is disabled due to expired enterprise license key.',
      priority: 'Medium',
      status: 'Resolved',
      categoryId: softwareCat,
      relatedSystemId: null,
      requesterId: jennifer.id,
    },
    {
      ticketNumber: 'TKT-2026-000110',
      summary: 'Finance Shared Drive Read/Write Provisioning',
      description: 'Grant access to folder Z:\\Finance\\Audit_2026 for newly transferred financial analyst.',
      priority: 'High',
      status: 'Closed',
      categoryId: accountCat,
      relatedSystemId: null,
      requesterId: jennifer.id,
    },
    {
      ticketNumber: 'TKT-2026-000111',
      summary: 'Laptop Docking Station Ethernet Port Damaged',
      description: 'Physical RJ-45 jack clip is broken causing frequent network disconnection when desk is bumped.',
      priority: 'Low',
      status: 'New',
      categoryId: hardwareCat,
      relatedSystemId: null,
      requesterId: jennifer.id,
    },
    {
      ticketNumber: 'TKT-2026-000112',
      summary: 'Expense Report Submission Error in HR Portal',
      description: 'Receipt PDF attachment fails to upload with message "Multipart boundary not found".',
      priority: 'Medium',
      status: 'New',
      categoryId: softwareCat,
      relatedSystemId: systems[1].id, // HR Portal
      requesterId: jennifer.id,
    },
  ];

  for (const t of jenniferTickets) {
    const created = await prisma.ticket.create({ data: t });

    // Add sample attachments for ticket 1
    if (t.ticketNumber === 'TKT-2026-000101') {
      await prisma.attachment.createMany({
        data: [
          {
            ticketId: created.id,
            fileName: 'ledger_audit_error_log.pdf',
            fileUrl: '/uploads/sample_ledger_audit.pdf',
            fileSize: 245000,
            mimeType: 'application/pdf',
            isRemoved: false,
          },
          {
            ticketId: created.id,
            fileName: 'confidential_employee_payroll_sample.png',
            fileUrl: '/uploads/sample_payroll.png',
            fileSize: 180000,
            mimeType: 'image/png',
            isRemoved: true,
            removedReason: 'Contains confidential employee payroll info; soft-removed per IT security policy compliance.',
            removedAt: new Date(),
          },
        ],
      });
    }
  }

  // 5. Seed 1 Ticket for Michael Brown (ID 2) for Data Isolation Testing
  await prisma.ticket.create({
    data: {
      ticketNumber: 'TKT-2026-000201',
      summary: 'Warehouse Barcode Scanner Battery Replacement',
      description: 'Zebra TC52 handheld scanner battery holds charge for only 30 minutes during inventory scan.',
      priority: 'High',
      status: 'New',
      categoryId: hardwareCat,
      relatedSystemId: null,
      requesterId: michael.id,
    },
  });

  console.log('✅ Seed completed successfully: 5 users (4 active, 1 inactive), 4 categories, 7 systems, 13 tickets seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
