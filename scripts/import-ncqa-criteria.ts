/**
 * Import NCQA CVO criteria from a CSV file.
 *
 * Compliance owns the content of the criteria (see docs/status/blocked.md
 * B-006). This script is the one-shot loader: once the team exports their
 * standards as CSV, running:
 *
 *   npx tsx scripts/import-ncqa-criteria.ts path/to/file.csv
 *
 * inserts or updates rows in `ncqa_criteria`. Idempotent by `code`.
 *
 * Expected CSV columns (first row is a header):
 *   code,category,title,description,evidenceRequired,weight,sortOrder
 *
 * - `category` must be one of NcqaCategory:
 *     CREDENTIALING, RECREDENTIALING, DELEGATION, PRACTITIONER_RIGHTS,
 *     CONFIDENTIALITY, OPERATIONS, QUALITY_MANAGEMENT
 * - `weight` defaults to 1, `sortOrder` defaults to 0.
 * - `evidenceRequired` may be empty.
 *
 * The script does no deletes — criteria removed from the CSV stay in the
 * DB and are simply not mentioned; flip `isActive = false` manually via
 * the admin UI if you need to retire one.
 */

import { PrismaClient, NcqaCategory } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const prisma = new PrismaClient();

interface Row {
  code: string;
  category: NcqaCategory;
  title: string;
  description: string;
  evidenceRequired: string | null;
  weight: number;
  sortOrder: number;
}

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = parseLine(lines[0]!).map((h) => h.trim());
  const expected = [
    "code",
    "category",
    "title",
    "description",
    "evidenceRequired",
    "weight",
    "sortOrder",
  ];
  for (const h of expected) {
    if (!header.includes(h)) {
      throw new Error(`Missing CSV column: ${h}`);
    }
  }

  const idx = (name: string) => header.indexOf(name);
  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]!);
    const category = cells[idx("category")]!.trim();
    if (!Object.values(NcqaCategory).includes(category as NcqaCategory)) {
      throw new Error(
        `Line ${i + 1}: invalid category ${category}. Allowed: ${Object.values(NcqaCategory).join(", ")}`,
      );
    }
    rows.push({
      code: cells[idx("code")]!.trim(),
      category: category as NcqaCategory,
      title: cells[idx("title")]!.trim(),
      description: cells[idx("description")]!.trim(),
      evidenceRequired: cells[idx("evidenceRequired")]?.trim() || null,
      weight: Number(cells[idx("weight")] ?? 1) || 1,
      sortOrder: Number(cells[idx("sortOrder")] ?? 0) || 0,
    });
  }

  return rows;
}

/**
 * Minimal CSV line parser that handles quoted cells with embedded
 * commas and doubled quotes ("") per RFC 4180.
 */
function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: tsx scripts/import-ncqa-criteria.ts <path.csv>");
    process.exit(1);
  }
  const path = resolve(arg);
  const text = await readFile(path, "utf8");
  const rows = parseCsv(text);
  console.log(`Parsed ${rows.length} criteria from ${path}`);

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const existing = await prisma.ncqaCriterion.findUnique({
      where: { code: row.code },
    });
    if (existing) {
      await prisma.ncqaCriterion.update({
        where: { code: row.code },
        data: {
          category: row.category,
          title: row.title,
          description: row.description,
          evidenceRequired: row.evidenceRequired,
          weight: row.weight,
          sortOrder: row.sortOrder,
          isActive: true,
        },
      });
      updated++;
    } else {
      await prisma.ncqaCriterion.create({ data: row });
      created++;
    }
  }

  console.log(
    `Done. Inserted ${created}, updated ${updated}. Retire old criteria manually via the admin UI.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
