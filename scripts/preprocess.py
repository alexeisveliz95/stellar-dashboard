#!/usr/bin/env python3
"""Preprocessor: parses Categorias/*.md and Tendencias/*.md into JSON for Hugo.

Run before `hugo build` in the GHA workflow. Output:
  - data/categorias.json
  - data/tendencias.json
  - data/dashboard_meta.json
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path


def parse_stars(val: str) -> int:
    """Convert stars string like '76.7k' or '1.2M' or '350' to int."""
    s = val.strip().replace(",", "")
    m = re.match(r"^([\d.]+)\s*([kKmM]?)$", s)
    if not m:
        return 0
    num, suf = m.groups()
    n = float(num)
    if suf.lower() == "k":
        return int(n * 1_000)
    if suf.lower() == "m":
        return int(n * 1_000_000)
    return int(n)


def fmt_stars(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}k"
    return str(n)


def normalize_growth(val: str) -> int:
    """Normalize various growth formats to a single int.

    Accepts: '+14,741', '+14.8k', '+8,320', '14741', '1.2M'
    Returns: int (14741, 14800, 8320, 14741, 1200000)
    """
    if not val:
        return 0
    s = val.strip().lstrip("+").replace(",", "").replace(" ", "")
    m = re.match(r"^([\d.]+)\s*([kKmM]?)$", s)
    if not m:
        return 0
    num, suf = m.groups()
    n = float(num)
    if suf.lower() == "k":
        return int(n * 1_000)
    if suf.lower() == "m":
        return int(n * 1_000_000)
    return int(n)


def load_category_meta(path: Path) -> dict[str, str]:
    """Load explicit category → emoji mapping from JSON.

    Falls back to {} if file doesn't exist or is invalid.
    """
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {k: v for k, v in data.items() if not k.startswith("_")}
    except (json.JSONDecodeError, OSError):
        return {}


def slugify(text: str) -> str:
    s = text.lower()
    s = s.replace("&", "and")
    s = s.replace("/", "-")
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def parse_categoria(path: Path) -> dict | None:
    raw = path.read_text(encoding="utf-8")
    title_match = re.search(r"^#\s*📂\s*(.+)$", raw, re.MULTILINE)
    if not title_match:
        title_match = re.search(r"^#\s+(.+)$", raw, re.MULTILINE)
    if not title_match:
        return None
    name = title_match.group(1).strip()

    count_match = re.search(r"\*\*(\d+)\s*proyectos?\*\*", raw)
    score_match = re.search(r"Mejor score:\s*\*\*([\d.]+)\*\*", raw)
    stars_match = re.search(r"Estrellas totales:\s*\*\*([^*]+)\*\*", raw)
    updated_match = re.search(r"Actualizado:\s*`([^`]+)`", raw)

    projects = []
    proj_re = re.compile(
        r"\[\*\*(?P<name>[^*]+)\*\*\]\((?P<url>[^)]+)\)\s*\|\s*"
        r"\*\*(?P<score>[\d.]+)\*\*\s*\|\s*"
        r"(?P<stars>[\d.kKmM]+)\s*\|\s*"
        r"`(?P<momentum>[^`]+)`\s*\|\s*"
        r"(?P<desc>.+?)\s*(?:\||$|\n)",
    )
    for m in proj_re.finditer(raw):
        stars = parse_stars(m.group("stars"))
        projects.append({
            "name": m.group("name").strip(),
            "url": m.group("url").strip(),
            "score": float(m.group("score")),
            "stars": stars,
            "stars_fmt": fmt_stars(stars),
            "momentum": m.group("momentum").strip(),
            "description": m.group("desc").strip(),
        })

    total_stars_raw = sum(p["stars"] for p in projects)
    return {
        "name": name,
        "slug": slugify(name),
        "total_projects": int(count_match.group(1)) if count_match else len(projects),
        "best_score": float(score_match.group(1)) if score_match else 0.0,
        "total_stars_fmt": stars_match.group(1).strip() if stars_match else fmt_stars(total_stars_raw),
        "total_stars_raw": total_stars_raw,
        "updated": updated_match.group(1).strip() if updated_match else "",
        "filename": path.name,
        "projects": projects,
    }


def parse_tendencia(path: Path) -> dict | None:
    raw = path.read_text(encoding="utf-8")
    date_match = re.search(r"Trending\s*[—-]\s*(\d{4}-\d{2}-\d{2})", raw)
    if not date_match:
        date_match = re.search(r"(\d{4}-\d{2}-\d{2})", path.name)
    if not date_match:
        return None
    date = date_match.group(1)

    total_match = re.search(r"\*\*(\d+)\s*repos?\*\*\s*analizados", raw)
    hot_match = re.search(r"\*\*(\d+)\s*en zona HOT\*\*", raw)
    growth_match = re.search(r"\*\*\+?([\d.kKmM,]+)\s*estrellas\*\*\s*acumuladas", raw)
    growth_int = normalize_growth(growth_match.group(1)) if growth_match else 0

    top_repo = None
    top_match = re.search(
        r"\*\*\[(?P<name>[^\]]+)\]\((?P<url>[^)]+)\)\*\*\s*lider[oó]\s*"
        r"el trending con\s*\*\*\+?([\d,]+)\s*estrellas\s*hoy\*\*\s*"
        r"\(([\d.]+)%\s*de su total\)\.",
        raw,
    )
    if top_match:
        top_repo = {
            "name": top_match.group("name").strip(),
            "url": top_match.group("url").strip(),
            "growth": normalize_growth(top_match.group(3)),
            "growth_pct": float(top_match.group(4)),
        }
    desc_match = re.search(
        r"lider[oó]\s*el trending.*?\.\s*\n>\s*_(.+?)_",
        raw, re.DOTALL,
    )
    if top_repo and desc_match:
        top_repo["description"] = desc_match.group(1).strip()

    ranking = []
    rank_re = re.compile(
        r"🔥\s*\*\*(\d+)\*\*\s*\|\s*"
        r"\[\*\*(?P<name>[^*]+)\*\*\]\((?P<url>[^)]+)\)\s*`(?P<owner>[^`]+)`\s*\|\s*"
        r"(?P<stars>[\d.kKmM]+)\s*\|\s*\+?(?P<growth>[\d,]+)\s*\|\s*"
        r"`(?P<momentum>[^`]+)`",
    )
    for m in rank_re.finditer(raw):
        stars = parse_stars(m.group("stars"))
        ranking.append({
            "rank": int(m.group(1)),
            "name": m.group("name").strip(),
            "url": m.group("url").strip(),
            "owner": m.group("owner").strip(),
            "stars": stars,
            "stars_fmt": fmt_stars(stars),
            "growth": int(m.group("growth").replace(",", "")),
            "momentum": m.group("momentum").strip(),
            "hot": True,
        })

    if not ranking:
        rank_re2 = re.compile(
            r"📈\s*\*\*(\d+)\*\*\s*\|\s*"
            r"\[\*\*(?P<name>[^*]+)\*\*\]\((?P<url>[^)]+)\)\s*`(?P<owner>[^`]+)`\s*\|\s*"
            r"(?P<stars>[\d.kKmM]+)\s*\|\s*\+?(?P<growth>[\d,]+)\s*\|\s*"
            r"`(?P<momentum>[^`]+)`",
        )
        for m in rank_re2.finditer(raw):
            stars = parse_stars(m.group("stars"))
            ranking.append({
                "rank": int(m.group(1)),
                "name": m.group("name").strip(),
                "url": m.group("url").strip(),
                "owner": m.group("owner").strip(),
                "stars": stars,
                "stars_fmt": fmt_stars(stars),
                "growth": int(m.group("growth").replace(",", "")),
                "momentum": m.group("momentum").strip(),
                "hot": False,
            })

    return {
        "date": date,
        "slug": date,
        "filename": path.name,
        "total_repos": int(total_match.group(1)) if total_match else len(ranking),
        "hot_zone": int(hot_match.group(1)) if hot_match else 0,
        "growth_fmt": fmt_stars(growth_int),
        "growth_raw": growth_int,
        "top_repo": top_repo,
        "ranking": ranking,
    }


def parse_dashboard_md(path: Path) -> dict:
    if not path.exists():
        return {"last_updated": "", "total_projects": 0, "active_categories": 0}
    raw = path.read_text(encoding="utf-8")
    updated = ""
    m = re.search(r"Última actualización:\s*`([^`]+)`", raw)
    if m:
        updated = m.group(1).strip()
    else:
        m = re.search(r"Actualizado:\s*`([^`]+)`", raw)
        if m:
            updated = m.group(1).strip()
    m = re.search(r"\*\*(\d+)\*\*\s*proyectos?\s*curados", raw)
    total_projects = int(m.group(1)) if m else 0
    m = re.search(r"en\s*\*\*(\d+)\*\*\s*categor[ií]as", raw)
    active_cats = int(m.group(1)) if m else 0
    return {
        "last_updated": updated,
        "total_projects": total_projects,
        "active_categories": active_cats,
    }


def category_emoji(name: str, meta: dict[str, str]) -> str:
    """Resolve emoji from explicit meta mapping; fallback to generic."""
    return meta.get(name, "📁")


def generate_og_image(trends: list, cats_count: int, curated_count: int, out_path: Path) -> None:
    """Generate static/og-image.svg with current trending data.

    Used for OpenGraph/Twitter card preview (1200x630).
    """
    latest = trends[0] if trends else {}
    top = latest.get("top_repo") or {}
    trending_count = latest.get("total_repos", 0)
    hot_count = latest.get("hot_zone", 0)
    growth_raw = latest.get("growth_raw", 0)
    growth_k = f"{growth_raw / 1000:.1f}k" if growth_raw >= 1000 else str(growth_raw)
    date = latest.get("date", "—")
    top_name = (top.get("name") or "—").replace("&", "&amp;").replace("<", "&lt;")
    top_growth = top.get("growth", 0)

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0e1a"/>
      <stop offset="50%" stop-color="#161c2f"/>
      <stop offset="100%" stop-color="#0f1424"/>
    </linearGradient>
    <radialGradient id="glow1" cx="20%" cy="30%" r="40%">
      <stop offset="0%" stop-color="#7c5cff" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#7c5cff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="85%" cy="70%" r="35%">
      <stop offset="0%" stop-color="#00d4ff" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#00d4ff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>

  <text x="60" y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="36" font-weight="700" fill="#7c5cff">✦</text>
  <text x="110" y="82" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="30" font-weight="700" fill="#e6e9f2">Stellar Dashboard</text>
  <text x="60" y="118" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="18" fill="#8a93a8">Repos curados · Categorías · Tendencias de GitHub</text>

  <text x="60" y="200" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="22" font-weight="600" fill="#ff6b9d">🔥 Trending Now — {date}</text>
  <text x="60" y="275" font-family="monospace" font-size="18" fill="#5a6378">// #1 hoy</text>
  <text x="60" y="330" font-family="monospace" font-size="44" font-weight="700" fill="#e6e9f2">{top_name}</text>
  <text x="60" y="380" font-family="monospace" font-size="22" fill="#4ade80">+{top_growth} ⭐ estrellas hoy</text>

  <g transform="translate(60, 470)">
    <rect x="0" y="0" width="220" height="120" rx="14" fill="#161c2f" stroke="#1f2841" stroke-width="1"/>
    <text x="110" y="55" text-anchor="middle" font-family="monospace" font-size="40" font-weight="700" fill="#00d4ff">{cats_count}</text>
    <text x="110" y="85" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#8a93a8">CATEGORÍAS</text>

    <rect x="240" y="0" width="220" height="120" rx="14" fill="#161c2f" stroke="#1f2841" stroke-width="1"/>
    <text x="350" y="55" text-anchor="middle" font-family="monospace" font-size="40" font-weight="700" fill="#00d4ff">{trending_count}</text>
    <text x="350" y="85" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#8a93a8">TRENDING HOY</text>

    <rect x="480" y="0" width="220" height="120" rx="14" fill="#161c2f" stroke="#1f2841" stroke-width="1"/>
    <text x="590" y="55" text-anchor="middle" font-family="monospace" font-size="40" font-weight="700" fill="#ff5e5e">{hot_count}</text>
    <text x="590" y="85" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#8a93a8">EN ZONA HOT</text>

    <rect x="720" y="0" width="220" height="120" rx="14" fill="#161c2f" stroke="#1f2841" stroke-width="1"/>
    <text x="830" y="55" text-anchor="middle" font-family="monospace" font-size="40" font-weight="700" fill="#4ade80">+{growth_k}</text>
    <text x="830" y="85" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#8a93a8">⭐ NUEVAS</text>
  </g>
</svg>
'''
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(svg, encoding="utf-8")
    print(f"✅ og-image.svg ({len(svg)} bytes)")


def write_content_stub(path: Path, fm: dict, body: str = "") -> None:
    """Write a Hugo content stub with YAML frontmatter and optional body."""
    lines = ["---"]
    for key, val in fm.items():
        if isinstance(val, (int, float)):
            lines.append(f"{key}: {val}")
        elif isinstance(val, bool):
            lines.append(f"{key}: {'true' if val else 'false'}")
        else:
            escaped = str(val).replace('"', '\\"')
            lines.append(f'{key}: "{escaped}"')
    lines.append("---")
    if body:
        lines.append("")
        lines.append(body)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def enrich_curated_picks(root: Path) -> None:
    """Add stars_fmt to curated_picks.json so Hugo templates don't need
    to do number formatting (avoids the 4.200 Spanish locale issue)."""
    src = root / "data" / "repos" / "curated_picks.json"
    if not src.exists():
        return
    try:
        data = json.loads(src.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return

    changed = False
    for week in data.get("weeks", []):
        for pick in week.get("picks", []):
            if "stars_fmt" not in pick and "stars" in pick:
                pick["stars_fmt"] = fmt_stars(int(pick["stars"]))
                changed = True

    if changed:
        src.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✅ curated_picks.json: added stars_fmt to {sum(len(w.get('picks', [])) for w in data.get('weeks', []))} picks")


def build_heatmap_data(trends: list, weeks_back: int = 12) -> dict:
    """Build calendar heatmap data: 7 rows × N columns (weeks).

    Each cell: {date, has_data, growth, growth_fmt, slug, intensity}
    intensity is normalized 0.0-1.0 vs the max growth in range.
    """
    import datetime as dt

    by_date = {t["date"]: t for t in trends if t.get("date")}
    if not by_date:
        return {"weeks": [], "max_growth": 0}

    newest_date = max(t["date"] for t in trends)
    newest_dt = dt.datetime.strptime(newest_date, "%Y-%m-%d").date()

    # Find Monday of the week containing the newest trending date
    days_since_monday = newest_dt.weekday()  # 0=Mon
    end_of_week = newest_dt + dt.timedelta(days=(6 - days_since_monday))
    # Start: end_of_week - (weeks_back-1)*7 days
    start_dt = end_of_week - dt.timedelta(days=(weeks_back - 1) * 7)

    max_growth = max((t.get("growth_raw", 0) or 0) for t in trends) or 1

    weeks = []
    cur = start_dt
    for _ in range(weeks_back):
        week = []
        for d in range(7):
            day = cur + dt.timedelta(days=d)
            date_str = day.strftime("%Y-%m-%d")
            trend = by_date.get(date_str)
            cell = {
                "date": date_str,
                "has_data": bool(trend),
                "growth": trend.get("growth_raw", 0) if trend else 0,
                "growth_fmt": trend.get("growth_fmt", "") if trend else "",
                "slug": trend.get("slug", "") if trend else "",
                "top_name": (trend.get("top_repo") or {}).get("name", "") if trend else "",
                "hot": trend.get("hot_zone", 0) if trend else 0,
            }
            cell["intensity"] = round((cell["growth"] / max_growth), 3) if cell["has_data"] else 0.0
            week.append(cell)
        weeks.append(week)
        cur = cur + dt.timedelta(days=7)

    return {
        "weeks": weeks,
        "max_growth": max_growth,
        "start_date": start_dt.strftime("%Y-%m-%d"),
        "end_date": (end_of_week).strftime("%Y-%m-%d"),
    }


def parse_my_saved(root: Path) -> dict:
    """Read the user's GitHub Stars payload synced by the engine.

    Input:  data/repos/my_saved.json  (written by engine, may not exist)
    Output: data/my_saved.json        (Hugo data, with enriched fields)

    Enrichments:
      - owner          = full_name.split("/")[0]
      - stars_fmt      = formatted string for display
      - description_short = truncated 140 chars
    """
    src = root / "data" / "repos" / "my_saved.json"
    if not src.exists():
        out = {
            "version": 1,
            "updated_at": "",
            "source": "github_stars",
            "user": "alexeisveliz95",
            "count": 0,
            "repos": [],
        }
        return out
    try:
        data = json.loads(src.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {
            "version": 1,
            "updated_at": "",
            "source": "github_stars",
            "user": "alexeisveliz95",
            "count": 0,
            "repos": [],
        }

    for r in data.get("repos", []):
        full = r.get("name", "")
        r["owner"] = full.split("/")[0] if "/" in full else ""
        if "stars_fmt" not in r and "stars" in r:
            r["stars_fmt"] = fmt_stars(int(r["stars"]))
        desc = r.get("description") or ""
        if len(desc) > 140:
            r["description_short"] = desc[:137].rstrip() + "…"
        else:
            r["description_short"] = desc

    return data


def generate_content_stubs(cats: list, trends: list, root: Path) -> None:
    """Generate Hugo content stubs for category and trend sub-pages.

    Creates:
      - content/categorias/_index.md  (section root)
      - content/categorias/<slug>.md  (one per category)
      - content/tendencias/_index.md  (section root)
      - content/tendencias/<slug>.md  (one per trend)
      - content/guardados/_index.md   (section root for saved stars)
    """
    content_dir = root / "content"

    # Categorias section root
    write_content_stub(
        content_dir / "categorias" / "_index.md",
        {
            "title": "Categorías",
            "description": "Repos curados por categoría",
        },
    )

    # Per-category stubs
    for cat in cats:
        slug = cat.get("slug") or slugify(cat["name"])
        write_content_stub(
            content_dir / "categorias" / f"{slug}.md",
            {
                "title": f"{cat.get('emoji', '📁')} {cat['name']}",
                "slug": slug,
                "weight": -cat.get("total_projects", 0),
            },
        )

    # Tendencias section root
    write_content_stub(
        content_dir / "tendencias" / "_index.md",
        {
            "title": "Historial de Tendencias",
            "description": "Trending de GitHub por fecha",
        },
    )

    # Per-trend stubs (weight = newer first)
    for i, trend in enumerate(trends):
        slug = trend.get("slug") or slugify(trend.get("date", ""))
        write_content_stub(
            content_dir / "tendencias" / f"{slug}.md",
            {
                "title": f"🔥 {trend.get('date', '—')}",
                "slug": slug,
                "weight": -i,
            },
        )

    # Guardados section root (always created; data may be empty)
    write_content_stub(
        content_dir / "guardados" / "_index.md",
        {
            "title": "📌 Mis Guardados",
            "description": "Tus repos favoritos de GitHub sincronizados automáticamente",
        },
    )

    print(f"✅ content stubs: {len(cats)} categorias, {len(trends)} tendencias, guardados/")


def main() -> None:
    p = argparse.ArgumentParser(description="Preprocess engine data for Hugo")
    p.add_argument("--root", default=".", help="Repo root")
    args = p.parse_args()

    root = Path(args.root).resolve()
    cat_meta = load_category_meta(root / "data" / "category_meta.json")

    cats_dir = root / "Categorias"
    cats = []
    if cats_dir.exists():
        for f in sorted(cats_dir.glob("*.md")):
            data = parse_categoria(f)
            if data:
                data["emoji"] = category_emoji(data["name"], cat_meta)
                cats.append(data)
    cats.sort(key=lambda c: c["total_projects"], reverse=True)

    trend_dir = root / "Tendencias"
    trends = []
    if trend_dir.exists():
        for f in sorted(trend_dir.glob("Trending-*.md")):
            data = parse_tendencia(f)
            if data:
                trends.append(data)
    trends.sort(key=lambda t: t["date"], reverse=True)

    dashboard_meta = parse_dashboard_md(root / "DASHBOARD.md")

    out_dir = root / "data"
    out_dir.mkdir(exist_ok=True)

    (out_dir / "categorias.json").write_text(
        json.dumps({"version": 1, "categories": cats}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"✅ categorias.json: {len(cats)} categories")

    (out_dir / "tendencias.json").write_text(
        json.dumps({"version": 1, "trends": trends}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"✅ tendencias.json: {len(trends)} trendings")

    (out_dir / "dashboard_meta.json").write_text(
        json.dumps(dashboard_meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"✅ dashboard_meta.json: {dashboard_meta}")

    generate_og_image(trends, len(cats), 0, root / "static" / "og-image.svg")

    heatmap = build_heatmap_data(trends, weeks_back=26)
    enrich_curated_picks(root)
    (out_dir / "heatmap.json").write_text(
        json.dumps(heatmap, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"✅ heatmap.json: {len(heatmap['weeks'])} weeks, {sum(sum(1 for c in w if c['has_data']) for w in heatmap['weeks'])} cells with data")

    my_saved = parse_my_saved(root)
    (out_dir / "my_saved.json").write_text(
        json.dumps(my_saved, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"✅ my_saved.json: {my_saved['count']} saved repos (updated {my_saved['updated_at'] or 'never'})")

    generate_content_stubs(cats, trends, root)


if __name__ == "__main__":
    main()
