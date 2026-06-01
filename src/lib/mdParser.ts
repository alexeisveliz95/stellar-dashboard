import fs from "node:fs";
import path from "node:path";
import type {
  DashboardStats,
  CategorySummary,
  CategoryDetail,
  ProjectRow,
  TrendingReport,
  TrendingRow,
  TopFiveDetail,
  CuratedPicksReport,
  CuratedWeek,
} from "./types";
import { readFile, readDir, ROOT } from "./io";

// ── DASHBOARD.md ─────────────────────────────────────────────────────────────

export function parseDashboard(): DashboardStats {
  const raw = readFile("DASHBOARD.md");

  const itemsMatch = raw.match(/\*\*(\d+)\*\* proyectos curados/);
  const catsMatch = raw.match(/en \*\*(\d+)\*\* categorías/);
  const timeMatch = raw.match(/`([^`]+)`/);

  const cats: CategorySummary[] = [];
  const tableRegex = /\[\*\*(.+?)\*\*\]\((.+?)\)\s*\|\s*(\d+)\s*\|\s*\*\*([\d.]+)\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = tableRegex.exec(raw)) !== null) {
    cats.push({
      name: m[1],
      projects: parseInt(m[3]),
      bestScore: parseFloat(m[4]),
      slug: slugify(m[1]),
    });
  }

  return {
    totalItems: itemsMatch ? parseInt(itemsMatch[1]) : 0,
    activeCategories: catsMatch ? parseInt(catsMatch[1]) : 0,
    lastUpdated: timeMatch ? timeMatch[1] : "",
    categories: cats,
  };
}

// ── Categorias/*.md ──────────────────────────────────────────────────────────

export function parseCategoryFile(filename: string): CategoryDetail | null {
  const filePath = `Categorias/${filename}`;
  if (!fs.existsSync(path.join(ROOT, filePath))) return null;

  const raw = readFile(filePath);
  const nameMatch = raw.match(/^# 📂 (.+)/);
  if (!nameMatch) return null;
  const name = nameMatch[1];

  const totalMatch = raw.match(/\*\*(\d+)\s*proyectos?\*\*/);
  const scoreMatch = raw.match(/Mejor score:\s*\*\*([\d.]+)\*\*/);
  const starsMatch = raw.match(/Estrellas totales:\s*\*\*([^*]+)\*\*/);
  const timeMatch = raw.match(/Actualizado:\s*`([^`]+)`/);

  const projects: ProjectRow[] = [];
  const projRegex = /\|\s*\[\*\*(.+?)\*\*\]\((.+?)\)\s*\|\s*\*\*([\d.]+)\*\*\s*\|\s*([\d.kM]+)\s*\|\s*`(.+?)`\s*\|\s*(.+?)\s*\|/g;
  let m: RegExpExecArray | null;
  while ((m = projRegex.exec(raw)) !== null) {
    projects.push({
      name: m[1],
      url: m[2],
      score: parseFloat(m[3]),
      stars: m[4],
      starsRaw: parseStars(m[4]),
      momentumBar: m[5],
      description: m[6].trim(),
    });
  }

  return {
    name,
    slug: slugify(name),
    lastUpdated: timeMatch?.[1] || "",
    totalProjects: totalMatch ? parseInt(totalMatch[1]) : projects.length,
    bestScore: scoreMatch ? parseFloat(scoreMatch[1]) : 0,
    totalStars: starsMatch?.[1] || "0",
    projects,
  };
}

export function loadAllCategories(): CategoryDetail[] {
  const files = readDir("Categorias");
  return files
    .map((f) => parseCategoryFile(f))
    .filter((c): c is CategoryDetail => c !== null)
    .sort((a, b) => b.totalProjects - a.totalProjects);
}

export function loadCategory(slug: string): CategoryDetail | null {
  const files = readDir("Categorias");
  for (const f of files) {
    const cat = parseCategoryFile(f);
    if (cat && cat.slug === slug) return cat;
  }
  return null;
}

// ── Tendencias/*.md ─────────────────────────────────────────────────────────

export function parseTrendingFile(filename: string): TrendingReport | null {
  const filePath = `Tendencias/${filename}`;
  if (!fs.existsSync(path.join(ROOT, filePath))) return null;

  const raw = readFile(filePath);
  const dateMatch = filename.match(/Trending-(\d{4}-\d{2}-\d{2})\.md/);
  if (!dateMatch) return null;

  const date = dateMatch[1];
  const totalMatch = raw.match(/\*\*(\d+) repos?\*\* analizados/);
  const hotMatch = raw.match(/\*\*(\d+) en zona HOT\*\*/);
  const starsMatch = raw.match(/\*\*\+([\d.kM]+) estrellas\*\* acumuladas/);

  let topRepo: TrendingReport["topRepo"] = null;
  const topMatch = raw.match(
    /\*\*\[(.+?)\]\((.+?)\)\*\* lideró.*?\+\*?(\d[\d,]*)\*? estrellas.*?\(([^)]+)\)\.\n> _(.+?)_/s
  );
  if (topMatch) {
    topRepo = {
      name: topMatch[1],
      url: topMatch[2],
      growth: parseInt(topMatch[3].replace(/,/g, "")),
      growthPercent: topMatch[4],
      description: topMatch[5],
    };
  }

  const ranking: TrendingRow[] = [];
  const rankRegex =
    /\|\s*(🔥|📈)\s+\*\*(\d+)\*\*\s*\|\s*\[\*\*(.+?)\*\*\]\((.+?)\)\s*`(.+?)`\s*\|\s*([\d.kM]+)\s*\|\s*\+?(\d[\d,]*)\s*\|\s*`(.+?)`\s*\|/g;
  let m: RegExpExecArray | null;
  while ((m = rankRegex.exec(raw)) !== null) {
    ranking.push({
      rank: parseInt(m[2]),
      name: m[3],
      url: m[4],
      owner: m[5],
      stars: m[6],
      growth: parseInt(m[7].replace(/,/g, "")),
      momentumBar: m[8],
      hot: m[1] === "🔥",
    });
  }

  const topFive: TopFiveDetail[] = [];
  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const medalMap: Record<string, number> = {
    "🥇": 1, "🥈": 2, "🥉": 3, "4️⃣": 4, "5️⃣": 5,
  };

  let detailRegex = /### (.+?)\s\[(.+?)\]\((.+?)\)/g;
  let positions: { medal: string; name: string; url: string }[] = [];
  let d: RegExpExecArray | null;
  while ((d = detailRegex.exec(raw)) !== null) {
    positions.push({ medal: d[1], name: d[2], url: d[3] });
  }

  const sections = raw.split(/### /);
  for (const section of sections) {
    const headerMatch = section.match(/^(🥇|🥈|🥉|4️⃣|5️⃣)\s\[(.+?)\]\((.+?)\)/);
    if (!headerMatch) continue;

    const descMatch = section.match(/> \[!note\] (.+?)\n/);
    const starsMatch2 = section.match(/⭐ Stars totales\s*\|\s*\*\*([\d.kM]+)\*\*\s*·\s*(.+?)\s*·\s*(.+?)\s*\|/);
    const growthMatch = section.match(/🚀 Crecimiento hoy\s*\|\s*\*\*\+?(\d[\d,]*)\*\*/);
    const momMatch = section.match(/📊 Momentum\s*\|\s*`(.+?)`/);
    const scoreMatch = section.match(/🏷️ Score\s*\|\s*`([\d.]+)`/);

    const medal = headerMatch[1];
    const tierIcon = medal;
    const threshold = starsMatch2?.[3] || "";
    const tier = starsMatch2?.[2] || "";

    topFive.push({
      rank: medalMap[medal] || 0,
      name: headerMatch[2],
      url: headerMatch[3],
      description: descMatch?.[1]?.trim() || "",
      stars: starsMatch2?.[1] || "0",
      starsRaw: parseStars(starsMatch2?.[1] || "0"),
      growth: parseInt((growthMatch?.[1] || "0").replace(/,/g, "")),
      momentumBar: momMatch?.[1] || "",
      score: parseFloat(scoreMatch?.[1] || "0"),
      tier,
      tierIcon,
      threshold,
    });
  }

  return {
    date,
    slug: date,
    totalRepos: totalMatch ? parseInt(totalMatch[1]) : 0,
    hotZone: hotMatch ? parseInt(hotMatch[1]) : 0,
    totalStarsGained: starsMatch?.[1] || "0",
    topRepo,
    ranking,
    topFive,
  };
}

export function loadAllTrending(): TrendingReport[] {
  const files = readDir("Tendencias");
  return files
    .map((f) => parseTrendingFile(f))
    .filter((t): t is TrendingReport => t !== null);
}

export function loadTrending(slug: string): TrendingReport | null {
  return parseTrendingFile(`Trending-${slug}.md`);
}

export function loadLatestTrending(): TrendingReport | null {
  const files = readDir("Tendencias");
  for (const f of files) {
    const report = parseTrendingFile(f);
    if (report) return report;
  }
  return null;
}

// ── data/repos/curated_picks.json ────────────────────────────────────────────

export function loadCuratedPicks(): CuratedWeek | null {
  const relPath = "data/repos/curated_picks.json";
  if (!fs.existsSync(path.join(ROOT, relPath))) return null;

  let parsed: CuratedPicksReport;
  try {
    const raw = readFile(relPath);
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed?.weeks?.length) return null;
  return parsed.weeks[parsed.weeks.length - 1];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseStars(val: string): number {
  val = val.replace(/,/g, "");
  if (val.includes("k")) return Math.round(parseFloat(val) * 1000);
  if (val.includes("M")) return Math.round(parseFloat(val) * 1_000_000);
  return parseInt(val) || 0;
}
