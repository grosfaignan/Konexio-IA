#!/usr/bin/env python3
"""Validate JSON source documents and build the static Pages catalogue."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "documents"
SITE = ROOT / "_site"
BLOCK_TYPES = {"heading", "paragraph", "list", "quote", "code", "separator"}


def read_document(path: Path) -> dict[str, Any]:
    try:
        document = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"{path.relative_to(ROOT)} : JSON illisible ({error})") from error

    if not isinstance(document, dict):
        raise ValueError(f"{path.relative_to(ROOT)} : la racine JSON doit être un objet")
    if document.get("schemaVersion") != 1:
        raise ValueError(f"{path.relative_to(ROOT)} : schemaVersion doit valoir 1")
    for field in ("title", "description", "category", "content"):
        if field not in document:
            raise ValueError(f"{path.relative_to(ROOT)} : champ requis manquant « {field} »")
    if not all(isinstance(document[field], str) for field in ("title", "description", "category")):
        raise ValueError(f"{path.relative_to(ROOT)} : title, description et category doivent être du texte")
    if not document["title"].strip() or not document["category"].strip():
        raise ValueError(f"{path.relative_to(ROOT)} : title et category ne peuvent pas être vides")
    if not isinstance(document["content"], list) or not document["content"]:
        raise ValueError(f"{path.relative_to(ROOT)} : content doit être une liste non vide")

    for index, block in enumerate(document["content"], start=1):
        location = f"{path.relative_to(ROOT)} : bloc {index}"
        if not isinstance(block, dict) or block.get("type") not in BLOCK_TYPES:
            raise ValueError(f"{location} : type attendu parmi {', '.join(sorted(BLOCK_TYPES))}")
        kind = block["type"]
        if kind in {"heading", "paragraph", "quote", "code"} and not isinstance(block.get("text"), str):
            raise ValueError(f"{location} : le champ text doit être du texte")
        if kind == "heading" and block.get("level") not in {1, 2, 3}:
            raise ValueError(f"{location} : level doit être 1, 2 ou 3")
        if kind == "list" and "ordered" in block and not isinstance(block["ordered"], bool):
            raise ValueError(f"{location} : ordered doit être un booléen")
        if kind == "list" and (
            not isinstance(block.get("items"), list)
            or not block["items"]
            or not all(isinstance(item, str) for item in block["items"])
        ):
            raise ValueError(f"{location} : items doit être une liste non vide de textes")

    return document


def build_catalog() -> list[dict[str, str]]:
    catalog = []
    if not SOURCE.exists():
        return catalog

    for path in sorted(SOURCE.rglob("*.json"), key=lambda item: item.relative_to(SOURCE).as_posix().casefold()):
        relative = path.relative_to(SOURCE)
        if any(part.startswith(".") for part in relative.parts):
            continue
        document = read_document(path)
        catalog.append(
            {
                "id": relative.with_suffix("").as_posix(),
                "title": document["title"],
                "description": document["description"],
                "category": document["category"],
                "source": f"documents/{relative.as_posix()}",
                "filename": str(document.get("filename") or path.stem),
            }
        )
    return catalog


def build() -> None:
    catalog = build_catalog()
    if SITE.exists():
        if SITE.resolve().parent != ROOT.resolve():
            raise RuntimeError(f"Refus de nettoyer un dossier hors du dépôt : {SITE}")
        shutil.rmtree(SITE)
    SITE.mkdir(parents=True)

    for name in ("index.html", "assets", "schemas", "data", "templates"):
        source = ROOT / name
        target = SITE / name
        if source.is_dir():
            shutil.copytree(source, target)
        elif source.is_file():
            shutil.copy2(source, target)

    for item in catalog:
        relative = Path(item["source"]).relative_to("documents")
        target = SITE / "documents" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SOURCE / relative, target)

    (SITE / "catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (SITE / ".nojekyll").touch()
    print(f"Catalogue créé avec {len(catalog)} document(s).")


if __name__ == "__main__":
    build()

