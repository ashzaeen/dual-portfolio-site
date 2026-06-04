"""
Reads scripts/stories-files-manifest.csv (produced by rename-stories.py --apply)
and bulk-inserts the corresponding Story + Story Media rows into Notion,
attaching to existing Location rows by Name.

For each folder:
  - Find the Location pageId from notionLocationName
  - Create one Story row (Status=Draft, Name=notionStoryTitle, Slug=derived,
    Location=relation). If a Story with that Name already exists under the same
    Location, reuse it instead of creating a duplicate.
  - Create one Story Media row per file (Type, URL, Order, Story relation).

Usage:
  # dry-run — prints what would happen, sends nothing to Notion
  python scripts/upload-to-notion.py

  # apply — actually create the rows
  python scripts/upload-to-notion.py --apply

Requires .env.local at the project root with:
  NOTION_TOKEN, NOTION_LOCATIONS_DB_ID, NOTION_STORIES_DB_ID, NOTION_STORY_MEDIA_DB_ID

Uses only Python stdlib (no pip installs).
"""
from __future__ import annotations
import argparse
import csv
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

# Make Unicode prints work on Windows consoles
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env.local"
MANIFEST_PATH = ROOT / "scripts" / "stories-manifest.json"
CSV_PATH = ROOT / "scripts" / "stories-files-manifest.csv"

NOTION_VERSION = "2025-09-03"
API_BASE = "https://api.notion.com/v1"


def load_env(path: Path) -> dict:
    env = {}
    if not path.exists():
        print(f"ERROR: {path} not found", file=sys.stderr)
        sys.exit(1)
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def derive_slug(title: str) -> str:
    """Lowercase, ASCII alphanumerics only. Matches watch-notion's pattern."""
    s = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9]+", "", s.lower())
    return s[:60] or "untitled"


def unique_slug(base: str, used: set) -> str:
    if base not in used:
        return base
    i = 2
    while f"{base}{i}" in used:
        i += 1
    return f"{base}{i}"


class Notion:
    def __init__(self, token: str):
        self.token = token

    def _req(self, method: str, path: str, body=None, max_retries: int = 6):
        url = f"{API_BASE}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        # Retry on 429 (rate limit), 5xx (transient upstream errors).
        for attempt in range(max_retries):
            req = urllib.request.Request(url, data=data, method=method)
            req.add_header("Authorization", f"Bearer {self.token}")
            req.add_header("Notion-Version", NOTION_VERSION)
            req.add_header("Content-Type", "application/json")
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return json.loads(r.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                if e.code in (429, 502, 503, 504) and attempt < max_retries - 1:
                    delay = min(60, 2 ** attempt)
                    print(f"      ! Notion {e.code} — retry in {delay}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(delay)
                    continue
                err_body = e.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"Notion {e.code}: {err_body}") from None
            except (urllib.error.URLError, TimeoutError) as e:
                if attempt < max_retries - 1:
                    delay = min(60, 2 ** attempt)
                    print(f"      ! network error ({e}) — retry in {delay}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(delay)
                    continue
                raise RuntimeError(f"network error after {max_retries} retries: {e}") from None

    def query_all(self, db_id: str) -> list:
        # Resolve data source then paginate via /v1/data_sources/{ds}/query.
        db = self._req("GET", f"/databases/{db_id}")
        ds_id = db["data_sources"][0]["id"]
        results = []
        cursor = None
        while True:
            body = {"page_size": 100}
            if cursor:
                body["start_cursor"] = cursor
            page = self._req("POST", f"/data_sources/{ds_id}/query", body)
            results.extend(page["results"])
            if not page.get("has_more"):
                break
            cursor = page.get("next_cursor")
        return results

    def create_page(self, db_id: str, properties: dict) -> dict:
        body = {"parent": {"database_id": db_id}, "properties": properties}
        return self._req("POST", "/pages", body)


def read_title(prop):
    if not prop or prop.get("type") != "title":
        return ""
    return "".join(t.get("plain_text", "") for t in prop["title"]).strip()


def read_text(prop):
    if not prop or prop.get("type") != "rich_text":
        return ""
    return "".join(t.get("plain_text", "") for t in prop["rich_text"]).strip()


def read_relation_ids(prop):
    if not prop or prop.get("type") != "relation":
        return []
    return [r["id"] for r in prop["relation"]]


def read_number(prop):
    if not prop or prop.get("type") != "number":
        return None
    return prop.get("number")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Actually create Notion pages (default is dry-run)")
    args = ap.parse_args()

    env = load_env(ENV_PATH)
    token = env.get("NOTION_TOKEN")
    loc_db = env.get("NOTION_LOCATIONS_DB_ID")
    story_db = env.get("NOTION_STORIES_DB_ID")
    media_db = env.get("NOTION_STORY_MEDIA_DB_ID")
    if not all([token, loc_db, story_db, media_db]):
        print("ERROR: missing one of NOTION_TOKEN / NOTION_LOCATIONS_DB_ID / NOTION_STORIES_DB_ID / NOTION_STORY_MEDIA_DB_ID", file=sys.stderr)
        sys.exit(1)

    if not CSV_PATH.exists():
        print(f"ERROR: {CSV_PATH} not found. Run rename-stories.py --apply first.", file=sys.stderr)
        sys.exit(1)

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{mode}] reading {CSV_PATH.relative_to(ROOT)}")

    # Group CSV rows by folder, preserving file order
    rows_by_folder = defaultdict(list)
    with CSV_PATH.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows_by_folder[row["folder"]].append(row)

    notion = Notion(token)

    # Locations: build Name → pageId
    print(f"[{mode}] fetching all Locations…")
    loc_rows = notion.query_all(loc_db)
    loc_by_name = {}
    for r in loc_rows:
        name = read_title(r["properties"].get("Name"))
        if name:
            loc_by_name[name] = r["id"]
    print(f"[{mode}] found {len(loc_by_name)} Locations")

    # Stories: collect existing slugs (for collision avoidance) and (locId, name)→pageId
    print(f"[{mode}] fetching all Stories…")
    story_rows = notion.query_all(story_db)
    used_slugs = set()
    existing_story = {}  # (locationPageId, title) → storyPageId
    for r in story_rows:
        slug = read_text(r["properties"].get("Slug"))
        if slug:
            used_slugs.add(slug)
        title = read_title(r["properties"].get("Name"))
        loc_ids = read_relation_ids(r["properties"].get("Location"))
        for lid in loc_ids:
            existing_story[(lid, title)] = r["id"]
    print(f"[{mode}] found {len(story_rows)} Stories ({len(used_slugs)} with slugs)")

    # Media: build set of (storyPageId, order) already in Notion so we never double-insert
    print(f"[{mode}] fetching all Story Media…")
    media_rows = notion.query_all(media_db)
    existing_media = set()  # (storyPageId, order)
    for r in media_rows:
        order = read_number(r["properties"].get("Order"))
        for sid in read_relation_ids(r["properties"].get("Story")):
            if order is not None:
                existing_media.add((sid, int(order)))
    print(f"[{mode}] found {len(media_rows)} Media rows ({len(existing_media)} keyed)")

    created_stories = 0
    reused_stories = 0
    created_media = 0
    skipped_media = 0
    skipped_folders = 0

    for folder, file_rows in rows_by_folder.items():
        first = file_rows[0]
        loc_name = first["notionLocationName"]
        story_title = first["notionStoryTitle"]

        loc_id = loc_by_name.get(loc_name)
        if not loc_id:
            print(f"  ⚠ {folder}: no Location row named \"{loc_name}\" — folder skipped")
            skipped_folders += 1
            continue

        # Reuse or create the Story
        story_id = existing_story.get((loc_id, story_title))
        if story_id:
            print(f"  → {folder}: reusing existing Story \"{story_title}\" (id={story_id[:8]})")
            reused_stories += 1
        else:
            slug = unique_slug(derive_slug(story_title), used_slugs)
            used_slugs.add(slug)
            props = {
                "Name": {"title": [{"text": {"content": story_title}}]},
                "Slug": {"rich_text": [{"text": {"content": slug}}]},
                "Status": {"status": {"name": "Draft"}},
                "Location": {"relation": [{"id": loc_id}]},
            }
            if args.apply:
                resp = notion.create_page(story_db, props)
                story_id = resp["id"]
                existing_story[(loc_id, story_title)] = story_id
                print(f"  ✓ {folder}: created Story \"{story_title}\" slug={slug}")
            else:
                story_id = "<dry-run>"
                print(f"  [dry] {folder}: would create Story \"{story_title}\" slug={slug}")
            created_stories += 1

        # Create Media rows (idempotent: skip ones already in Notion for this story+order)
        folder_created = 0
        folder_skipped = 0
        for r in file_rows:
            order = int(r["order"])
            media_type = r["mediaType"]  # video | image
            url = r["cdnUrl"]
            name = f"{story_title} {order:02d}"

            if args.apply and (story_id, order) in existing_media:
                folder_skipped += 1
                skipped_media += 1
                continue

            props = {
                "Name": {"title": [{"text": {"content": name}}]},
                "Story": {"relation": [{"id": story_id}]} if story_id != "<dry-run>" else {"relation": []},
                "Type": {"select": {"name": media_type}},
                "URL": {"url": url},
                "Order": {"number": order},
            }
            if args.apply:
                notion.create_page(media_db, props)
                existing_media.add((story_id, order))
                folder_created += 1
                created_media += 1
            else:
                print(f"      [dry] media #{order:02d} [{media_type}] → {url}")
                created_media += 1

        if args.apply:
            msg = f"      ✓ {folder_created} media rows created"
            if folder_skipped:
                msg += f", {folder_skipped} already existed (skipped)"
            print(msg)

    print(f"\n[{mode}] summary:")
    print(f"  stories created: {created_stories}")
    print(f"  stories reused:  {reused_stories}")
    print(f"  media created:   {created_media}")
    print(f"  media skipped:   {skipped_media} (already in Notion)")
    print(f"  folders skipped: {skipped_folders}")
    if not args.apply:
        print("(dry-run — re-run with --apply to actually create the pages)")


if __name__ == "__main__":
    main()
