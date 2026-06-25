"""Camada de persistência SQLite — campanhas, criativos e carrosséis."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import List, Optional

DB_PATH = Path(os.environ.get("DB_PATH", "./data/boxys.db")).resolve()


def _migrate() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _conn() as cx:
        cx.executescript("""
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                figma_file_key TEXT DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS copies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                title TEXT DEFAULT '',
                description TEXT DEFAULT '',
                message TEXT DEFAULT '',
                content_html TEXT DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS creatives (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
                copy_id INTEGER REFERENCES copies(id) ON DELETE SET NULL,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                local_path TEXT DEFAULT '',
                supabase_url TEXT DEFAULT '',
                thumbnail_url TEXT DEFAULT '',
                width INTEGER DEFAULT 0,
                height INTEGER DEFAULT 0,
                figma_node_id TEXT DEFAULT '',
                format_label TEXT DEFAULT '',
                manifest_json TEXT DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS carousels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS carousel_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                carousel_id INTEGER REFERENCES carousels(id) ON DELETE CASCADE,
                creative_id INTEGER REFERENCES creatives(id) ON DELETE CASCADE,
                order_index INTEGER DEFAULT 0
            );
        """)
    # Safe migration: add copy_id to existing creatives tables
    with _conn() as cx:
        try:
            cx.execute("ALTER TABLE creatives ADD COLUMN copy_id INTEGER REFERENCES copies(id) ON DELETE SET NULL")
        except sqlite3.OperationalError:
            pass  # column already exists
    # add 'type' column to copies
    with _conn() as cx:
        try:
            cx.execute("ALTER TABLE copies ADD COLUMN type TEXT DEFAULT 'criativo'")
        except sqlite3.OperationalError:
            pass
    # add 'content' column to copies (plain text reference)
    with _conn() as cx:
        try:
            cx.execute("ALTER TABLE copies ADD COLUMN content TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
    # add boxys_campaign_id to link local campaign to a Boxys (Supabase) campaign
    with _conn() as cx:
        try:
            cx.execute("ALTER TABLE campaigns ADD COLUMN boxys_campaign_id INTEGER DEFAULT NULL")
        except sqlite3.OperationalError:
            pass
    # add search_ads_json to store Google Search Ads copy per campaign
    with _conn() as cx:
        try:
            cx.execute("ALTER TABLE campaigns ADD COLUMN search_ads_json TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass


def _conn() -> sqlite3.Connection:
    cx = sqlite3.connect(str(DB_PATH))
    cx.row_factory = sqlite3.Row
    cx.execute("PRAGMA foreign_keys = ON")
    return cx


def _row(row) -> Optional[dict]:
    return dict(row) if row else None


def _rows(rows: list) -> List[dict]:
    return [dict(r) for r in rows]


# ---- campaigns ----

def create_campaign(name: str, figma_file_key: str = "", boxys_campaign_id: Optional[int] = None) -> dict:
    with _conn() as cx:
        cur = cx.execute(
            "INSERT INTO campaigns (name, figma_file_key, boxys_campaign_id) VALUES (?, ?, ?)",
            (name, figma_file_key, boxys_campaign_id),
        )
        return _row(cx.execute("SELECT * FROM campaigns WHERE id = ?", (cur.lastrowid,)).fetchone())


def list_campaigns() -> list[dict]:
    with _conn() as cx:
        rows = cx.execute("SELECT * FROM campaigns ORDER BY updated_at DESC").fetchall()
        result = _rows(rows)
        for c in result:
            c["creative_count"] = cx.execute(
                "SELECT COUNT(*) FROM creatives WHERE campaign_id = ?", (c["id"],)
            ).fetchone()[0]
        return result


def get_campaign(campaign_id: int) -> Optional[dict]:
    with _conn() as cx:
        return _row(cx.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,)).fetchone())


def update_campaign(campaign_id: int, name: Optional[str] = None, figma_file_key: Optional[str] = None) -> Optional[dict]:
    with _conn() as cx:
        if name is not None:
            cx.execute(
                "UPDATE campaigns SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (name, campaign_id),
            )
        if figma_file_key is not None:
            cx.execute(
                "UPDATE campaigns SET figma_file_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (figma_file_key, campaign_id),
            )
        return _row(cx.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,)).fetchone())


def get_search_ads(campaign_id: int) -> dict:
    with _conn() as cx:
        row = cx.execute("SELECT search_ads_json FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()
        if not row or not row["search_ads_json"]:
            return {"titles": "", "descriptions": "", "keywords": ""}
        import json
        try:
            return json.loads(row["search_ads_json"])
        except Exception:
            return {"titles": "", "descriptions": "", "keywords": ""}


def update_search_ads(campaign_id: int, data: dict) -> bool:
    import json
    with _conn() as cx:
        cur = cx.execute(
            "UPDATE campaigns SET search_ads_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (json.dumps(data), campaign_id),
        )
        return cur.rowcount > 0


def delete_campaign(campaign_id: int) -> bool:
    with _conn() as cx:
        cur = cx.execute("DELETE FROM campaigns WHERE id = ?", (campaign_id,))
        return cur.rowcount > 0


def touch_campaign(campaign_id: int) -> None:
    with _conn() as cx:
        cx.execute(
            "UPDATE campaigns SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (campaign_id,),
        )


# ---- creatives ----

def create_creative(
    campaign_id: int,
    type: str,
    name: str,
    local_path: str = "",
    supabase_url: str = "",
    thumbnail_url: str = "",
    width: int = 0,
    height: int = 0,
    figma_node_id: str = "",
    format_label: str = "",
    manifest_json: str = "",
    copy_id: Optional[int] = None,
) -> dict:
    with _conn() as cx:
        cur = cx.execute(
            """INSERT INTO creatives
               (campaign_id, copy_id, type, name, local_path, supabase_url, thumbnail_url,
                width, height, figma_node_id, format_label, manifest_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (campaign_id, copy_id, type, name, local_path, supabase_url, thumbnail_url,
             width, height, figma_node_id, format_label, manifest_json),
        )
        return _row(cx.execute("SELECT * FROM creatives WHERE id = ?", (cur.lastrowid,)).fetchone())


def list_creatives(campaign_id: int) -> list[dict]:
    with _conn() as cx:
        return _rows(cx.execute(
            "SELECT * FROM creatives WHERE campaign_id = ? ORDER BY created_at DESC",
            (campaign_id,),
        ).fetchall())


def get_creative(creative_id: int) -> Optional[dict]:
    with _conn() as cx:
        return _row(cx.execute("SELECT * FROM creatives WHERE id = ?", (creative_id,)).fetchone())


def delete_creative(creative_id: int) -> bool:
    with _conn() as cx:
        cur = cx.execute("DELETE FROM creatives WHERE id = ?", (creative_id,))
        return cur.rowcount > 0


def update_creative_thumbnail(creative_id: int, thumbnail_url: str) -> None:
    with _conn() as cx:
        cx.execute(
            "UPDATE creatives SET thumbnail_url = ? WHERE id = ?",
            (thumbnail_url, creative_id),
        )


def update_creative(
    creative_id: int,
    supabase_url: Optional[str] = None,
    thumbnail_url: Optional[str] = None,
    manifest_json: Optional[str] = None,
    local_path: Optional[str] = None,
    copy_id: Optional[int] = None,
    clear_copy: bool = False,
) -> Optional[dict]:
    with _conn() as cx:
        pairs = []
        vals: list = []
        if supabase_url is not None:
            pairs.append("supabase_url = ?"); vals.append(supabase_url)
        if thumbnail_url is not None:
            pairs.append("thumbnail_url = ?"); vals.append(thumbnail_url)
        if manifest_json is not None:
            pairs.append("manifest_json = ?"); vals.append(manifest_json)
        if local_path is not None:
            pairs.append("local_path = ?"); vals.append(local_path)
        if copy_id is not None:
            pairs.append("copy_id = ?"); vals.append(copy_id)
        elif clear_copy:
            pairs.append("copy_id = ?"); vals.append(None)
        if pairs:
            vals.append(creative_id)
            cx.execute(f"UPDATE creatives SET {', '.join(pairs)} WHERE id = ?", vals)
        return _row(cx.execute("SELECT * FROM creatives WHERE id = ?", (creative_id,)).fetchone())


# ---- carousels ----

def create_carousel(campaign_id: int, name: str) -> dict:
    with _conn() as cx:
        cur = cx.execute(
            "INSERT INTO carousels (campaign_id, name) VALUES (?, ?)",
            (campaign_id, name),
        )
        return _row(cx.execute("SELECT * FROM carousels WHERE id = ?", (cur.lastrowid,)).fetchone())


def list_carousels(campaign_id: int) -> list[dict]:
    with _conn() as cx:
        rows = cx.execute(
            "SELECT * FROM carousels WHERE campaign_id = ? ORDER BY created_at ASC",
            (campaign_id,),
        ).fetchall()
        result = _rows(rows)
        for c in result:
            items = get_carousel_items(c["id"])
            c["items"] = items
            c["item_count"] = len(items)
        return result


def get_carousel(carousel_id: int) -> Optional[dict]:
    with _conn() as cx:
        return _row(cx.execute("SELECT * FROM carousels WHERE id = ?", (carousel_id,)).fetchone())


def delete_carousel(carousel_id: int) -> bool:
    with _conn() as cx:
        cur = cx.execute("DELETE FROM carousels WHERE id = ?", (carousel_id,))
        return cur.rowcount > 0


def add_carousel_item(carousel_id: int, creative_id: int) -> dict:
    with _conn() as cx:
        next_order = cx.execute(
            "SELECT COALESCE(MAX(order_index), -1) + 1 FROM carousel_items WHERE carousel_id = ?",
            (carousel_id,),
        ).fetchone()[0]
        cur = cx.execute(
            "INSERT INTO carousel_items (carousel_id, creative_id, order_index) VALUES (?, ?, ?)",
            (carousel_id, creative_id, next_order),
        )
        return _row(cx.execute("SELECT * FROM carousel_items WHERE id = ?", (cur.lastrowid,)).fetchone())


def remove_carousel_item(item_id: int) -> bool:
    with _conn() as cx:
        cur = cx.execute("DELETE FROM carousel_items WHERE id = ?", (item_id,))
        return cur.rowcount > 0


def reorder_carousel_items(carousel_id: int, ordered_ids: list[int]) -> None:
    with _conn() as cx:
        for idx, item_id in enumerate(ordered_ids):
            cx.execute(
                "UPDATE carousel_items SET order_index = ? WHERE id = ? AND carousel_id = ?",
                (idx, item_id, carousel_id),
            )


def get_carousel_items(carousel_id: int) -> list[dict]:
    with _conn() as cx:
        rows = cx.execute(
            """SELECT ci.id as item_id, ci.order_index,
                      c.id, c.campaign_id, c.type, c.name, c.local_path,
                      c.supabase_url, c.thumbnail_url, c.width, c.height,
                      c.figma_node_id, c.format_label, c.manifest_json, c.created_at
               FROM carousel_items ci
               JOIN creatives c ON c.id = ci.creative_id
               WHERE ci.carousel_id = ?
               ORDER BY ci.order_index ASC""",
            (carousel_id,),
        ).fetchall()
        return [dict(r) for r in rows]


# ---- copies ----

def create_copy(
    campaign_id: int,
    name: str,
    title: str = "",
    description: str = "",
    message: str = "",
    content_html: str = "",
    type: str = "criativo",
    content: str = "",
) -> dict:
    with _conn() as cx:
        cur = cx.execute(
            """INSERT INTO copies (campaign_id, name, title, description, message, content_html, type, content)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (campaign_id, name, title, description, message, content_html, type, content),
        )
        return _row(cx.execute("SELECT * FROM copies WHERE id = ?", (cur.lastrowid,)).fetchone())


def list_copies(campaign_id: int) -> List[dict]:
    with _conn() as cx:
        rows = cx.execute(
            "SELECT * FROM copies WHERE campaign_id = ? ORDER BY updated_at DESC",
            (campaign_id,),
        ).fetchall()
        result = _rows(rows)
        for cp in result:
            cp["creative_count"] = cx.execute(
                "SELECT COUNT(*) FROM creatives WHERE copy_id = ?", (cp["id"],)
            ).fetchone()[0]
        return result


def get_copy(copy_id: int) -> Optional[dict]:
    with _conn() as cx:
        return _row(cx.execute("SELECT * FROM copies WHERE id = ?", (copy_id,)).fetchone())


def update_copy(
    copy_id: int,
    name: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    message: Optional[str] = None,
    content_html: Optional[str] = None,
    type: Optional[str] = None,
    content: Optional[str] = None,
) -> Optional[dict]:
    with _conn() as cx:
        pairs = []
        vals: list = []
        for col, val in (("name", name), ("title", title), ("description", description),
                         ("message", message), ("content_html", content_html),
                         ("type", type), ("content", content)):
            if val is not None:
                pairs.append(f"{col} = ?")
                vals.append(val)
        if pairs:
            pairs.append("updated_at = CURRENT_TIMESTAMP")
            vals.append(copy_id)
            cx.execute(f"UPDATE copies SET {', '.join(pairs)} WHERE id = ?", vals)
        return _row(cx.execute("SELECT * FROM copies WHERE id = ?", (copy_id,)).fetchone())


def delete_copy(copy_id: int) -> bool:
    with _conn() as cx:
        cur = cx.execute("DELETE FROM copies WHERE id = ?", (copy_id,))
        return cur.rowcount > 0
