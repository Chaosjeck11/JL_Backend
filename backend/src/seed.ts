import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// ── Kategorien ────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: "Mitgliedsbeitrag", description: "Beiträge der Vereinsmitglieder", isMitgliedsbeitrag: true },
  { name: "Übertrag", description: "Jahresübertrag aus dem Vorjahr", isMitgliedsbeitrag: false },
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


// ── Mitglieder ────────────────────────────────────────────────────────────────
// TODO: Mitgliederdaten aus dem Excel-Kassenbuch importieren, sobald die
//       vollständige Mitgliederliste vorliegt.

// ── System-Admin ──────────────────────────────────────────────────────────────

async function seedAdminUser() {
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: { name: "Admin", description: "Systemadministrator" },
  });

  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.member.upsert({
    where: { email: "admin@jl.local" },
    update: {},
    create: {
      firstname: "System",
      lastname: "Admin",
      email: "admin@jl.local",
      passwordHash,
      roleId: adminRole.id,
      accessLevel: 5,
    },
  });

  console.log("[Admin] Systemadmin-User sichergestellt.");
}

// ── Einstiegspunkt ────────────────────────────────────────────────────────────

async function main() {
  console.log("Seed gestartet…\n");

  await seedAdminUser();
  await seedCategories();

  console.log("\nSeed abgeschlossen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
