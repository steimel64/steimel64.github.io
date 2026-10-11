#!/usr/bin/env python3
"""Rebuild the Japanese font subset after you add or change Japanese text.

The site loads Dela Gothic One with Google Fonts' `text=` parameter, so only the
glyphs actually used are downloaded (a few KB instead of several MB). Run this
from the site root after editing any page:  python3 tools/subset-jp.py
"""
import re
import urllib.parse
from pathlib import Path

root = Path(__file__).resolve().parent.parent
pages = sorted(root.glob('*.html'))
chars = {c for p in pages for c in p.read_text(encoding='utf-8') if ord(c) > 0x3000}
url = 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&amp;display=swap&amp;text=' + urllib.parse.quote(''.join(sorted(chars)))
pattern = re.compile(r'https://fonts\.googleapis\.com/css2\?family=Dela\+Gothic\+One[^"]*')
for p in pages:
    html = p.read_text(encoding='utf-8')
    p.write_text(pattern.sub(url, html), encoding='utf-8')
print(f'{len(chars)} glyphs subset across {len(pages)} pages')
