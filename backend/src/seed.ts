import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// ── Kategorien ────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: "Mitgliedsbeitrag", description: "Beiträge der Vereinsmitglieder", isMitgliedsbeitrag: true },
  { name: "Übertrag", description: "Jahresübertrag aus dem Vorjahr", isMitgliedsbeitrag: false },
  { name: "Strafe", description: "Strafen der Vereinsmitglieder", isMitgliedsbeitrag: false },
];

async function seedCategories() {
  let processed = 0;

  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { isMitgliedsbeitrag: cat.isMitgliedsbeitrag },
      create: cat,
    });
    processed++;
  }

  console.log(`[Kategorien] ${processed} verarbeitet (upsert).`);
}


// ── Geschäftsjahre ────────────────────────────────────────────────────────────

const FIRST_BUSINESS_YEAR = 2023;

function currentBusinessYear(): number {
  const now = new Date();
  // Geschäftsjahr N startet am 1. Februar des Jahres N.
  // Im Januar sind wir noch im Vorjahr.
  return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
}

async function seedBusinessYears() {
  const endYear = currentBusinessYear();
  const activeMembers = await prisma.member.findMany({
    where: { active: true, excludeFromBeitrag: false },
  });

  let created = 0;
  let skipped = 0;

  for (let year = FIRST_BUSINESS_YEAR; year <= endYear; year++) {
    const existing = await prisma.businessYear.findUnique({ where: { year } });
    if (existing) {
      skipped++;
      continue;
    }

    const businessYear = await prisma.businessYear.create({
      data: { year, carryOver: 0 },
    });

    for (const member of activeMembers) {
      const isReduced =
        member.u18 || member.schuelerStudentAzubi || member.bereitsMitglied;
      await prisma.mitgliedsbeitrag.upsert({
        where: {
          memberId_businessYearId: {
            memberId: member.id,
            businessYearId: businessYear.id,
          },
        },
        update: {},
        create: {
          memberId: member.id,
          businessYearId: businessYear.id,
          betragJL: 35,
          betragKG: isReduced ? 0 : 65,
        },
      });
    }

    created++;
  }

  console.log(
    `[Geschäftsjahre] ${created} erstellt, ${skipped} bereits vorhanden (${FIRST_BUSINESS_YEAR}–${endYear}).`,
  );
}

// ── Mitglieder ────────────────────────────────────────────────────────────────
// TODO: Mitgliederdaten aus dem Excel-Kassenbuch importieren, sobald die
//       vollständige Mitgliederliste vorliegt.

// ── System-Admin ──────────────────────────────────────────────────────────────

async function seedAdminUser() {
  await prisma.role.upsert({
    where: { name: "Mitglied" },
    update: { accessLevel: 0 },
    create: { name: "Mitglied", description: "Einfaches Vereinsmitglied", accessLevel: 0 },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: { accessLevel: 5 },
    create: { name: "Admin", description: "Systemadministrator", accessLevel: 5 },
  });

  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.member.upsert({
    where: { email: "admin@jl.local" },
    update: { excludeFromBeitrag: true },
    create: {
      firstname: "System",
      lastname: "Admin",
      email: "admin@jl.local",
      passwordHash,
      roleId: adminRole.id,
      excludeFromBeitrag: true,
    },
  });

  console.log("[Admin] Systemadmin-User sichergestellt.");
}

// ── Einstiegspunkt ────────────────────────────────────────────────────────────

async function main() {
  console.log("Seed gestartet…\n");

  await seedAdminUser();
  await seedCategories();
  await seedBusinessYears();

  console.log("\nSeed abgeschlossen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
