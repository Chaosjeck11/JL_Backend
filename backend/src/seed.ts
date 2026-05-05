import { PrismaClient, TransactionType } from "@prisma/client";

const prisma = new PrismaClient();

// ── Kategorien ────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: "Spende", description: "Spendeneinnahmen" },
  { name: "Mitgliedsbeitrag", description: "Beiträge der Vereinsmitglieder" },
  { name: "Barzahlung", description: "Bare Ein- oder Auszahlungen" },
  { name: "Ausgabe", description: "Allgemeine Ausgaben" },
  { name: "Übertrag", description: "Jahresübertrag aus dem Vorjahr" },
  { name: "Sonstiges", description: "Sonstige Buchungen" },
];

async function seedCategories() {
  let created = 0;

  for (const cat of DEFAULT_CATEGORIES) {
    const result = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    if (result.name === cat.name) created++;
  }

  console.log(`[Kategorien] ${created} verarbeitet (upsert).`);
}

// ── Kassenbuchdaten ───────────────────────────────────────────────────────────

interface TransactionSeed {
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  category: string;
}

interface BusinessYearSeed {
  year: number;
  carryOver: number;
  transactions: TransactionSeed[];
}

// carryOver 2025 = 0 + (500 + 40 + 35) - 456 = 119 (entspricht dem Saldo aus 2023)
const BUSINESS_YEARS: BusinessYearSeed[] = [
  {
    year: 2023,
    carryOver: 0,
    transactions: [
      {
        date: "2023-10-08",
        description: "Spende vom Corps á la Schiff",
        type: TransactionType.EINZAHLUNG,
        amount: 500,
        category: "Spende",
      },
      {
        date: "2023-12-02",
        description: "Direktspende Weihnachtsbaumverkauf",
        type: TransactionType.EINZAHLUNG,
        amount: 40,
        category: "Spende",
      },
      {
        date: "2024-01-29",
        description: "Anschaffung Polos mit Logo",
        type: TransactionType.AUSZAHLUNG,
        amount: 456,
        category: "Ausgabe",
      },
      {
        date: "2024-02-29",
        description: "Mitgliedsbeitragszahlung T.Potthoff",
        type: TransactionType.EINZAHLUNG,
        amount: 35,
        category: "Mitgliedsbeitrag",
      },
    ],
  },
  {
    year: 2025,
    carryOver: 119,
    transactions: [
      {
        date: "2025-12-14",
        description: "Spende in Bar über Laura",
        type: TransactionType.EINZAHLUNG,
        amount: 50,
        category: "Spende",
      },
    ],
  },
];

async function seedFinanceData() {
  for (const byData of BUSINESS_YEARS) {
    const businessYear = await prisma.businessYear.upsert({
      where: { year: byData.year },
      update: {},
      create: { year: byData.year, carryOver: byData.carryOver },
    });

    let created = 0;
    let skipped = 0;

    for (const tx of byData.transactions) {
      const existing = await prisma.transaction.findFirst({
        where: {
          description: tx.description,
          businessYearId: businessYear.id,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const category = await prisma.category.findUniqueOrThrow({
        where: { name: tx.category },
      });

      await prisma.transaction.create({
        data: {
          date: new Date(tx.date),
          description: tx.description,
          type: tx.type,
          amount: tx.amount,
          categoryId: category.id,
          businessYearId: businessYear.id,
        },
      });

      created++;
    }

    console.log(
      `[GJ ${byData.year}] ${created} Transaktion(en) angelegt, ${skipped} übersprungen.`,
    );
  }
}

// ── Mitglieder ────────────────────────────────────────────────────────────────
// TODO: Mitgliederdaten aus dem Excel-Kassenbuch importieren, sobald die
//       vollständige Mitgliederliste vorliegt. Das MembersModule (src/members/)
//       ist bereits implementiert – hier analog zu seedFinanceData() vorgehen
//       und prisma.member.upsert({ where: { email }, ... }) nutzen.

// ── Einstiegspunkt ────────────────────────────────────────────────────────────

async function main() {
  console.log("Seed gestartet…\n");

  await seedCategories();
  await seedFinanceData();

  console.log("\nSeed abgeschlossen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
