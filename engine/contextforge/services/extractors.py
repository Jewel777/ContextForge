from __future__ import annotations

from io import BytesIO
from pathlib import Path
import re

import pymupdf
from docx import Document
from fastapi import HTTPException

from ..config import MIN_SENTENCE_CHARACTERS, SUPPORTED_EXTENSIONS
from .text_utils import split_sentences


def _is_heading(text: str) -> bool:
    text = " ".join(text.split()).strip()
    if not text or len(text) > 120:
        return False
    words = text.split()
    if len(words) > 14:
        return False
    if re.match(r"^\d+(?:\.\d+)*\s+\S+", text):
        return True
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    upper_ratio = sum(c.isupper() for c in letters) / len(letters)
    if upper_ratio >= 0.65 and len(words) <= 10:
        return True
    title_like = sum(1 for word in words if word[:1].isupper()) / max(1, len(words))
    return title_like >= 0.8 and len(words) <= 8 and not text.endswith(".")


def _items(text: str, page=None, section=None):
    return [
        {"sentence": s.strip(), "page": page, "section": section}
        for s in split_sentences(text)
        if len(s.strip()) >= MIN_SENTENCE_CHARACTERS
    ]


def extract_file(filename: str, data: bytes):
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, "Supported file types: PDF, DOCX, TXT.")

    if ext == ".pdf":
        try:
            doc = pymupdf.open(stream=data, filetype="pdf")
        except Exception as e:
            raise HTTPException(400, f"Could not read PDF: {e}") from e

        items, pages_read, headings = [], 0, 0
        current_section = None

        try:
            for page_number, page in enumerate(doc, start=1):
                text = page.get_text("text")
                if not text.strip():
                    continue
                pages_read += 1
                lines = [" ".join(line.split()).strip() for line in text.splitlines() if line.strip()]
                buffer = []

                def flush():
                    nonlocal buffer
                    if buffer:
                        items.extend(_items(" ".join(buffer), page=page_number, section=current_section))
                        buffer = []

                for line in lines:
                    if _is_heading(line):
                        flush()
                        current_section = line
                        headings += 1
                    else:
                        buffer.append(line)
                flush()
        finally:
            doc.close()

        return items, {"file_type":"pdf", "pages_read":pages_read, "headings_detected":headings}

    if ext == ".docx":
        try:
            doc = Document(BytesIO(data))
        except Exception as e:
            raise HTTPException(400, f"Could not read DOCX: {e}") from e

        items, section, headings = [], None, 0
        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue
            style = (p.style.name or "").lower() if p.style else ""
            if style.startswith("heading") or _is_heading(text):
                section = text
                headings += 1
                continue
            items.extend(_items(text, section=section))

        for ti, table in enumerate(doc.tables, start=1):
            for row in table.rows:
                text = " | ".join(c.text.strip() for c in row.cells if c.text.strip())
                if text:
                    items.extend(_items(text, section=f"Table {ti}"))

        return items, {"file_type":"docx", "headings_detected":headings}

    decoded = None
    for codec in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            decoded = data.decode(codec)
            break
        except UnicodeDecodeError:
            pass

    if decoded is None:
        raise HTTPException(400, "Could not decode TXT file.")

    return _items(decoded), {"file_type":"txt", "headings_detected":0}
