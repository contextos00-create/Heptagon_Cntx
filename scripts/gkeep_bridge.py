#!/usr/bin/env python3
"""
Unofficial Google Keep bridge using gkeepapi.

Google Keep has no public consumer API. This script is a practical workaround:
authenticate with a master token (preferred) or email+password (deprecated),
sync notes, and emit normalized JSON for Heptasurface.

Usage (stdin JSON → stdout JSON):
  echo '{"email":"...","master_token":"...","include_archived":false}' | python3 scripts/gkeep_bridge.py

Or env:
  GKEEP_EMAIL / GKEEP_MASTER_TOKEN / GKEEP_PASSWORD
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from datetime import datetime, timezone
from typing import Any


def _dt_to_ms(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return int(value.timestamp() * 1000)
    return None


def _color_name(color: Any) -> str | None:
    if color is None:
        return None
    name = getattr(color, "name", None)
    if isinstance(name, str):
        return name
    return str(color)


def _serialize_note(note: Any) -> dict[str, Any] | None:
    if getattr(note, "trashed", False):
        return None

    labels: list[str] = []
    try:
        for label in note.labels.all():
            name = getattr(label, "name", None)
            if name:
                labels.append(str(name))
    except Exception:
        pass

    list_items: list[dict[str, Any]] = []
    text = ""
    try:
        # gkeepapi List notes expose .items; Note exposes .text
        if hasattr(note, "items"):
            for item in note.items:
                if getattr(item, "trashed", False):
                    continue
                list_items.append(
                    {
                        "text": str(getattr(item, "text", "") or ""),
                        "isChecked": bool(getattr(item, "checked", False)),
                    }
                )
            text = "\n".join(
                f"{'[x]' if i['isChecked'] else '[ ]'} {i['text']}".strip()
                for i in list_items
                if i["text"]
            )
        else:
            text = str(getattr(note, "text", "") or "")
    except Exception:
        text = str(getattr(note, "text", "") or "")

    title = str(getattr(note, "title", "") or "").strip()
    if not title and not text and not list_items:
        return None
    if not title:
        title = (text.split("\n", 1)[0][:64] if text else "Untitled Keep note")

    timestamps = getattr(note, "timestamps", None)
    created = _dt_to_ms(getattr(timestamps, "created", None) if timestamps else None)
    updated = _dt_to_ms(getattr(timestamps, "edited", None) if timestamps else None) or _dt_to_ms(
        getattr(timestamps, "updated", None) if timestamps else None
    )

    note_id = str(getattr(note, "id", "") or getattr(note, "server_id", "") or title)
    return {
        "id": f"gkeep-{note_id}",
        "source": "keep",
        "title": title,
        "content": text or title,
        "labels": labels,
        "color": _color_name(getattr(note, "color", None)),
        "isPinned": bool(getattr(note, "pinned", False)),
        "isArchived": bool(getattr(note, "archived", False)),
        "listItems": list_items or None,
        "createdAt": created,
        "updatedAt": updated,
        "sourceUrl": getattr(note, "url", None),
    }


def fetch_notes(payload: dict[str, Any]) -> dict[str, Any]:
    import gkeepapi
    from gkeepapi.exception import LoginException

    email = (payload.get("email") or os.environ.get("GKEEP_EMAIL") or "").strip()
    master_token = (
        payload.get("master_token")
        or payload.get("masterToken")
        or os.environ.get("GKEEP_MASTER_TOKEN")
        or ""
    ).strip()
    password = (
        payload.get("password") or os.environ.get("GKEEP_PASSWORD") or ""
    ).strip()
    include_archived = bool(payload.get("include_archived", False))
    include_trashed = bool(payload.get("include_trashed", False))
    max_notes = int(payload.get("max_notes") or payload.get("maxNotes") or 200)
    max_notes = max(1, min(max_notes, 500))

    if not email:
        return {"ok": False, "error": "email is required"}
    if not master_token and not password:
        return {
            "ok": False,
            "error": "Provide master_token (preferred) or password. Password login is deprecated by gkeepapi.",
        }

    keep = gkeepapi.Keep()
    try:
        if master_token:
            keep.authenticate(email, master_token)
        else:
            # Deprecated path — may fail under Google's current auth policies.
            keep.login(email, password)
            # Prefer returning the master token so callers can switch to authenticate()
            try:
                master_token = keep.getMasterToken() or master_token
            except Exception:
                pass
    except LoginException as exc:
        return {
            "ok": False,
            "error": f"Keep login failed: {exc}",
            "hint": "Use an oauth master token with Keep.authenticate (see gkeepapi docs). Password login is often blocked.",
        }
    except Exception as exc:
        return {
            "ok": False,
            "error": f"Keep auth error: {exc}",
            "hint": "gkeepapi is unofficial and may break when Google changes auth.",
        }

    notes_out: list[dict[str, Any]] = []
    try:
        for note in keep.all():
            if not include_trashed and getattr(note, "trashed", False):
                continue
            if not include_archived and getattr(note, "archived", False):
                continue
            serialized = _serialize_note(note)
            if serialized:
                notes_out.append(serialized)
            if len(notes_out) >= max_notes:
                break
    except Exception as exc:
        return {"ok": False, "error": f"Keep sync failed while reading notes: {exc}"}

    # Sort newest first when timestamps exist
    notes_out.sort(key=lambda n: n.get("updatedAt") or 0, reverse=True)

    result: dict[str, Any] = {
        "ok": True,
        "email": email,
        "count": len(notes_out),
        "notes": notes_out,
        "via": "gkeepapi",
    }
    # Only echo master token when freshly obtained from password login
    if payload.get("password") and master_token and not payload.get("master_token"):
        result["master_token"] = master_token
        result["warning"] = (
            "Store this master_token securely and prefer it over password on future syncs."
        )
    return result


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as exc:
        print(json.dumps({"ok": False, "error": f"Invalid JSON on stdin: {exc}"}))
        return 1

    try:
        result = fetch_notes(payload if isinstance(payload, dict) else {})
    except Exception as exc:
        result = {
            "ok": False,
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }

    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("ok") else 2


if __name__ == "__main__":
    raise SystemExit(main())
