import { getPrisma } from "../src/prisma.js";

async function main() {
  const prisma = getPrisma();

  // 1. Seed 4 Categories (Idempotent)
  const categories = [
    "Account and Access",
    "Hardware",
    "Software",
    "Network"
  ];
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  console.log(`Seeded ${categories.length} categories.`);

  // 2. Seed 7 Related Systems (Idempotent)
  const relatedSystems = [
    { name: "Email", description: "Corporate Exchange & Webmail" },
    { name: "Campus Wi-Fi", description: "Secure campus wireless network" },
    { name: "VPN", description: "Remote access gateway" },
    { name: "LEB2 App", description: "Learning management platform" },
    { name: "Grade Submission App", description: "Registrar grading portal" },
    { name: "Printer", description: "Network multi-function printers" },
    { name: "Corporate Laptop", description: "Standard issue hardware" }
  ];
  for (const sys of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name: sys.name },
      update: { description: sys.description },
      create: { name: sys.name, description: sys.description, isActive: true }
    });
  }
  console.log(`Seeded ${relatedSystems.length} related systems.`);

  // 3. Seed 4 Active Requesters + 1 Inactive Requester (Idempotent)
  const requesters = [
    { name: "Jennifer Anderson", email: "jennifer.anderson@toktickit.local", isActive: true },
    { name: "Michael Brown", email: "michael.brown@toktickit.local", isActive: true },
    { name: "David Lee", email: "david.lee@toktickit.local", isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@toktickit.local", isActive: true },
    { name: "Alex Taylor", email: "alex.taylor@toktickit.local", isActive: false }
  ];
  for (const req of requesters) {
    await prisma.requesterUser.upsert({
      where: { email: req.email },
      update: { name: req.name, isActive: req.isActive },
      create: { name: req.name, email: req.email, isActive: req.isActive }
    });
  }
  console.log(`Seeded ${requesters.length} development requesters (4 active, 1 inactive).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
