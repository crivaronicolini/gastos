import { cp, mkdir, readdir, rm } from "node:fs/promises";

const legacySrc = "migrations";
const generatedSrc = "drizzle/migrations";
const dest = "drizzle/d1";

// This repo already has a flat Wrangler-applied history in `migrations/`.
// The first nested Drizzle migration is only an internal baseline so future
// `drizzle-kit generate` runs can diff correctly. It must not be copied for D1.
const baselineGeneratedDirs = new Set(["20260425015349_slimy_mentor"]);

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

const legacyFiles = (await readdir(legacySrc, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort();

await Promise.all(
  legacyFiles.map((file) => cp(`${legacySrc}/${file}`, `${dest}/${file}`)),
);

const maxLegacyNumber = legacyFiles.reduce((max, file) => {
  const match = /^(\d+)_/.exec(file);
  return Math.max(max, match ? Number(match[1]) : 0);
}, 0);

const generatedDirs = (await readdir(generatedSrc, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !baselineGeneratedDirs.has(entry.name))
  .map((entry) => entry.name)
  .sort();

await Promise.all(
  generatedDirs.map((dir, index) => {
    const name = dir.split("_").slice(1).join("_") || dir;
    const fileName = `${String(maxLegacyNumber + index + 1).padStart(4, "0")}_${name}.sql`;
    return cp(`${generatedSrc}/${dir}/migration.sql`, `${dest}/${fileName}`);
  }),
);

console.log(
  `Synced ${legacyFiles.length} legacy and ${generatedDirs.length} generated migration${generatedDirs.length === 1 ? "" : "s"} to ${dest}`,
);
