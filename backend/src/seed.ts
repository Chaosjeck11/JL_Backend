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

  await prisma.role.upsert({
    where: { name: "Strafenwart" },
    update: { accessLevel: 1 },
    create: { name: "Strafenwart", description: "Vollzugriff auf Strafenverwaltung", accessLevel: 1 },
  });

  await prisma.role.upsert({
    where: { name: "Orgateam" },
    update: { accessLevel: 2 },
    create: { name: "Orgateam", description: "Veranstaltungsorganisation und Mitgliederansicht", accessLevel: 2 },
  });

  await prisma.role.upsert({
    where: { name: "Vorstand" },
    update: { accessLevel: 3 },
    create: { name: "Vorstand", description: "Vereinsführung mit erweitertem Lesezugriff", accessLevel: 3 },
  });

  await prisma.role.upsert({
    where: { name: "Kassenwart" },
    update: { accessLevel: 4 },
    create: { name: "Kassenwart", description: "Vollzugriff auf Finanzen und Buchhaltung", accessLevel: 4 },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: { accessLevel: 5 },
    create: { name: "Admin", description: "Systemadministrator", accessLevel: 5 },
  });

  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      "ADMIN_SEED_PASSWORD environment variable is not set. Set it before running the seeder.",
    );
  }
  const passwordHash = await bcrypt.hash(adminPassword, 10);

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

// ── Strafenkatalog ───────────────────────────────────────────────────────────

const DEFAULT_STRAFEN = [
  { name: "Nicht erscheinen trotz Zusage", beschreibung: "Mitglied hat zugesagt, ist aber nicht erschienen.", betrag: 10 },
  { name: "Zu spät abgesagt", beschreibung: "Absage erfolgte zu kurzfristig.", betrag: 5 },
  { name: "Zu spät / gar nicht bei Abstimmungen teilgenommen", beschreibung: "Abstimmungsfrist verpasst oder ignoriert.", betrag: 5 },
  { name: "Nicht Einhaltung von Kleiderordnung", beschreibung: "Kleiderordnung bei Veranstaltung nicht eingehalten.", betrag: 5 },
  { name: "Schädigendes Verhalten für den Verein", beschreibung: "Verhalten schadet dem Verein; Rauswurf möglich (entscheidet Leitung).", betrag: 25 },
  { name: "Zahlungsfristen nicht eingehalten", beschreibung: "Fällige Zahlung nicht fristgerecht beglichen.", betrag: 5 },
  { name: "Zu spät kommen ohne Bescheid (je 5 min)", beschreibung: "Pro angefangene 5 Minuten zu spät ohne vorherige Mitteilung an Präsident oder Geschäftsführer.", betrag: 2 },
];

async function seedStrafen() {
  let processed = 0;

  for (const s of DEFAULT_STRAFEN) {
    await prisma.strafe.upsert({
      where: { name: s.name },
      update: { beschreibung: s.beschreibung, betrag: s.betrag },
      create: s,
    });
    processed++;
  }

  console.log(`[Strafenkatalog] ${processed} verarbeitet (upsert).`);
}

// ── Einstiegspunkt ────────────────────────────────────────────────────────────

async function main() {
  console.log("Seed gestartet…\n");

  await seedAdminUser();
  await seedCategories();
  await seedBusinessYears();
  await seedStrafen();

  console.log("\nSeed abgeschlossen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
