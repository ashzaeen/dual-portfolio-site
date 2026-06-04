"""
Restructure /stories into /stories-organized/<country>/<state>/<citySlug>/NN.<ext>.

Parses date+time from filenames like
  ash_1221w_story_10_5_2025_9_07_45 PM3737095038690964734.mp4
sorts each city's files ascending by that date, and copies them into the
structured tree with names 01.mp4, 02.mp4, ... Originals are never moved.

Usage:
  # dry-run — prints what would happen, writes nothing
  python scripts/rename-stories.py

  # apply — actually copies files and writes the CSV manifest
  python scripts/rename-stories.py --apply

Output:
  /stories-organized/<country>/<state>/<city>/NN.<ext>
  /scripts/stories-files-manifest.csv  (consumed by upload-to-notion.py)
"""
from __future__ import annotations
import argparse
import csv
import datetime as dt
import json
import re
import shutil
import sys
from pathlib import Path

# Make Unicode prints work on Windows consoles (default cp1252 chokes on arrows)
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "scripts" / "stories-manifest.json"
CSV_OUT_PATH = ROOT / "scripts" / "stories-files-manifest.csv"

# Captures: month, day, year, hour, minute, second, AM/PM, extension
FILENAME_RE = re.compile(
    r"ash_1221w_story_(\d+)_(\d+)_(\d+)_(\d+)_(\d+)_(\d+)\s+(AM|PM)\d+\.(\w+)$",
    re.IGNORECASE,
)

VALID_EXTS = {".mp4", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".mov"}


def parse_dt(name: str):
    """Return (datetime, ext) or (None, ext_or_None) if filename doesn't match."""
    m = FILENAME_RE.match(name)
    if not m:
        ext = Path(name).suffix.lower()
        return None, ext if ext in VALID_EXTS else None
    month, day, year, hour, minute, second, ampm, ext = m.groups()
    hour = int(hour)
    if ampm.upper() == "PM" and hour != 12:
        hour += 12
    if ampm.upper() == "AM" and hour == 12:
        hour = 0
    when = dt.datetime(int(year), int(month), int(day), hour, int(minute), int(second))
    return when, "." + ext.lower()


def build_target_dir(out_root: Path, country: str, state: str, city_slug: str) -> Path:
    """For non-US/BD countries (state == ''), skip the state segment."""
    parts = [out_root, country]
    if state:
        parts.append(state)
    parts.append(city_slug)
    return Path(*parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Actually copy files (default is dry-run)")
    args = ap.parse_args()

    if not MANIFEST_PATH.exists():
        print(f"ERROR: manifest not found at {MANIFEST_PATH}", file=sys.stderr)
        sys.exit(1)

    with MANIFEST_PATH.open(encoding="utf-8") as f:
        manifest = json.load(f)

    cfg = manifest["config"]
    stories_root = ROOT / cfg["storiesRoot"]
    out_root = ROOT / cfg["outputRoot"]
    cdn_base = cfg["cdnBase"].rstrip("/")

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{mode}] stories root: {stories_root}")
    print(f"[{mode}] output root:  {out_root}")
    print(f"[{mode}] cdn base:     {cdn_base}\n")

    csv_rows = []
    total_files = 0
    total_skipped = 0

    for entry in manifest["folders"]:
        folder = entry["folder"]
        src_dir = stories_root / folder
        if not src_dir.is_dir():
            print(f"  ⚠ {folder}: source folder missing — skipped")
            continue

        # Gather all media files, parsed
        items = []  # list of (datetime_or_None, ext, src_path)
        for p in src_dir.iterdir():
            if not p.is_file():
                continue
            when, ext = parse_dt(p.name)
            if ext is None:
                print(f"    ⚠ {folder}/{p.name}: unrecognized extension — skipped")
                total_skipped += 1
                continue
            if when is None:
                print(f"    ⚠ {folder}/{p.name}: couldn't parse date — placed last (mtime fallback)")
                # Fall back to mtime so it still gets ordered
                when = dt.datetime.fromtimestamp(p.stat().st_mtime)
            items.append((when, ext, p))

        if not items:
            print(f"  ⚠ {folder}: no media files found — skipped")
            continue

        # Sort ascending by date+time (earliest = lowest number)
        items.sort(key=lambda t: t[0])

        target_dir = build_target_dir(out_root, entry["country"], entry["state"], entry["citySlug"])

        # Decide padding width (2 digits is enough for any current folder; future-proof to 2)
        width = max(2, len(str(len(items))))

        print(f"  {folder} → {target_dir.relative_to(ROOT)} ({len(items)} files)")

        for i, (when, ext, src_path) in enumerate(items, start=1):
            new_name = f"{i:0{width}d}{ext}"
            dst_path = target_dir / new_name
            cdn_url = f"{cdn_base}/{dst_path.relative_to(out_root).as_posix()}"
            csv_rows.append({
                "folder": folder,
                "originalPath": str(src_path.relative_to(ROOT)).replace("\\", "/"),
                "newPath": str(dst_path.relative_to(ROOT)).replace("\\", "/"),
                "dateTime": when.isoformat(),
                "order": i,
                "ext": ext.lstrip("."),
                "mediaType": "video" if ext.lower() in (".mp4", ".mov") else "image",
                "cdnUrl": cdn_url,
                "country": entry["country"],
                "state": entry["state"],
                "citySlug": entry["citySlug"],
                "notionLocationName": entry["notionLocationName"],
                "notionStoryTitle": entry["notionStoryTitle"],
            })
            total_files += 1

            if args.apply:
                target_dir.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_path, dst_path)

    print(f"\n[{mode}] {total_files} files mapped, {total_skipped} skipped")

    if args.apply:
        # Write CSV manifest for upload-to-notion.py
        with CSV_OUT_PATH.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(csv_rows[0].keys()))
            writer.writeheader()
            writer.writerows(csv_rows)
        print(f"[APPLY] wrote {CSV_OUT_PATH.relative_to(ROOT)}")
    else:
        print("(dry-run — re-run with --apply to copy files and write the CSV)")


if __name__ == "__main__":
    main()
