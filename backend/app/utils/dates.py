"""Tratamento de datas — porta direta do utils/date.js do backend Node."""

from __future__ import annotations

from datetime import date as date_cls
from datetime import datetime, timezone


def parse_date_only_to_utc_noon(date_str: str | None) -> datetime | None:
    """
    Converte "AAAA-MM-DD" para um datetime em 12:00 UTC.

    Usar meio-dia evita o "menos 1 dia" em fusos negativos (ex.: Brasil), que
    aconteceria se gravássemos 00:00 UTC.
    """
    if not date_str or not isinstance(date_str, str):
        return None

    parts = date_str.split("-")
    if len(parts) != 3:
        return None

    try:
        year, month, day = (int(p) for p in parts)
    except ValueError:
        return None

    if not year or not month or not day:
        return None

    try:
        return datetime(year, month, day, 12, 0, 0, tzinfo=timezone.utc)
    except ValueError:
        return None


def is_past_date(value: datetime) -> bool:
    """True se a data (considerando só o dia) é anterior a hoje."""
    today = date_cls.today()
    compare = value.date() if isinstance(value, datetime) else value
    return compare < today
