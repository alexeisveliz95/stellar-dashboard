import fs from "node:fs";
import path from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;

function readFile(relPath: string): string {
  const full = path.join(ROOT, relPath);
  return fs.readFileSync(full, "utf-8");
}

function readDir(relPath: string): string[] {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();
}

export { ROOT, readFile, readDir };
