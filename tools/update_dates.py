"""Stamp each game card on the home page with the date its folder last changed in git.

Run from the repo root:  python3 tools/update_dates.py
The deploy workflow runs this too, so the live site never shows a stale date.
"""
import re
import subprocess
from datetime import date
from pathlib import Path

PAGE = Path(__file__).resolve().parent.parent / "index.html"

PLAY_LINK = re.compile(r'( *)<a class="btn btn-play" href="([^"/]+)/index.html">')
UPDATED_LINE = re.compile(r' *<p class="updated"[^\n]*</p>\n')


def all_last_changed():
    """One git call for the whole repo: newest commit date per top-level folder."""
    out = subprocess.run(
        ["git", "log", "--format=@%cs", "--name-only"],
        capture_output=True, text=True, check=True, cwd=PAGE.parent,
    ).stdout
    dates, current = {}, None
    for line in out.splitlines():
        if line.startswith("@"):
            current = date.fromisoformat(line[1:])
        elif "/" in line and current:
            dates.setdefault(line.split("/", 1)[0], current)  # log is newest first
    return dates


DATES = all_last_changed()


def last_changed(folder):
    return DATES.get(folder)


def stamp(match):
    indent, folder = match.group(1), match.group(2)
    when = last_changed(folder)
    if when is None:
        return match.group(0)
    pretty = f"{when.day} {when:%b %Y}"
    line = f'{indent}<p class="updated">🛠 Updated <time datetime="{when}">{pretty}</time></p>\n'
    return line + match.group(0)


html = PAGE.read_text(encoding="utf-8")
html = UPDATED_LINE.sub("", html)
html, count = PLAY_LINK.subn(stamp, html)
PAGE.write_text(html, encoding="utf-8")
print(f"Stamped {count} games")
