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
            "growth": int(top_match.group(3).replace(",", "")),
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
        "growth_fmt": growth_match.group(1).strip() if growth_match else "0",
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


def category_emoji(name: str) -> str:
    mapping = {
        "ai": "🤖", "data": "📊", "automation": "⚡", "devops": "🔧",
        "web": "🌐", "blockchain": "⛓️", "web3": "⛓️", "cybersecurity": "🛡️",
        "hacking": "🛡️", "mobile": "📱", "playstation": "🎮", "homebrew": "🎮",
        "linux": "🐧", "python": "🐍", "backend": "⚙️", "otros": "📦",
        "other": "📁",
    }
    for key, emoji in mapping.items():
        if key in name.lower():
            return emoji
    return "📁"


def main() -> None:
    p = argparse.ArgumentParser(description="Preprocess engine data for Hugo")
    p.add_argument("--root", default=".", help="Repo root")
    args = p.parse_args()

    root = Path(args.root).resolve()

    cats_dir = root / "Categorias"
    cats = []
    if cats_dir.exists():
        for f in sorted(cats_dir.glob("*.md")):
            data = parse_categoria(f)
            if data:
                data["emoji"] = category_emoji(data["name"])
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


if __name__ == "__main__":
    main()
