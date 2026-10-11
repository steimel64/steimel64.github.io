#!/usr/bin/env python3
"""Generate the site's hanko logo.

WS in a seal-script style, carved out of a red stamp (hakubun): a chipped rim,
uneven ink, then scanline slices, displaced blocks and an RGB split on top.

    python3 tools/seal.py .

writes two files into the given folder:
  seal.svg     the full mark (header, boot screen, page transitions, app icons)
  favicon.svg  a clean version without texture or glitches, for 16-32 px and the
               trust-run animation

Output is deterministic: the same seeds always draw the same seal.
"""
import argparse
import math
import random
from pathlib import Path

RED = '#ff4030'
NIGHT = '#07060d'
CYAN = '#34f2df'
MAGENTA = '#ff2bd1'
CX = CY = 32  # the seal is drawn on a 64 x 64 grid

# Seal-script letters: even strokes and rounded turns, with ends that run into the rim.
W_PATH = 'M8 9L13.5 50.5L19 25L24.5 50.5L28.3 9'
S_PATH = 'M53.5 21V14.5H39Q37 14.5 37 16.5V29.5Q37 32 39.5 32H51Q53.5 32 53.5 34.5V47.5Q53.5 49.5 51.5 49.5H37V43'
RULE_PATH = 'M32.5 2V62'  # the line between the two letters

# Glitch: horizontal slices (top, bottom, x offset) and displaced blocks (x, y, w, h, dx, dy).
SLICES = [(0, 22, 0), (22, 26.5, 2.6), (26.5, 47, 0), (47, 50, -2.4), (50, 64, 0)]
BLOCKS = [(36, 38.2, 10, 2.6, 2.2, 0), (13, 41.5, 8, 2.2, -1.8, 0), (40, 13, 7, 2.2, 1.6, 0)]


def path(points):
    return 'M' + 'L'.join(f'{x:.2f} {y:.2f}' for x, y in points) + 'Z'


def rough_circle(radius, amp, seed, n=180, freq=(5, 11, 23)):
    """A circle whose edge wobbles like a hand-carved stone."""
    rnd = random.Random(seed)
    phases = [rnd.uniform(0, 6.28) for _ in freq]
    points = []
    for i in range(n):
        a = 2 * math.pi * i / n
        r = radius + sum(amp / (k + 1) * math.sin(f * a + p) for k, (f, p) in enumerate(zip(freq, phases)))
        r += rnd.uniform(-amp * 0.35, amp * 0.35)
        points.append((CX + r * math.cos(a), CY + r * math.sin(a)))
    return path(points)


def ink_texture(seed, specks=22, patches=3):
    """Mask shapes for missing ink: small specks, and dry patches (kasure) near the rim."""
    rnd = random.Random(seed)
    shapes = []
    for _ in range(specks):
        a, d = rnd.uniform(0, 6.283), 30 * math.sqrt(rnd.random())
        r = rnd.uniform(0.12, 0.36)
        shapes.append(f'<circle cx="{CX + d * math.cos(a):.2f}" cy="{CY + d * math.sin(a):.2f}" r="{r:.2f}"/>')
    for _ in range(patches):
        a, d = rnd.uniform(0, 6.283), rnd.uniform(24, 30.5)
        k, size = rnd.randint(5, 8), rnd.uniform(0.7, 1.4)
        points = []
        for j in range(k):
            b, s = 2 * math.pi * j / k, size * rnd.uniform(0.5, 1.2)
            points.append((CX + d * math.cos(a) + s * math.cos(b) * 1.6, CY + d * math.sin(a) + s * math.sin(b) * 0.7))
        shapes.append(f'<path d="{path(points)}"/>')
    return ''.join(shapes)


def stamp(textured=True, seed=7):
    """The carved seal: (defs, body)."""
    texture = ink_texture(seed) if textured else ''
    body = (
        f'<path d="{rough_circle(30, 0.55 if textured else 0, seed)}" fill="{RED}"/>'
        f'<circle cx="32" cy="32" r="25.6" fill="none" stroke="{NIGHT}" stroke-width="1.3"/>'
        f'<g clip-path="url(#inner)" fill="none" stroke="{NIGHT}" stroke-width="3.9" stroke-linejoin="round">'
        f'<path d="{W_PATH}" stroke-width="4.6"/><path d="{S_PATH}"/><path d="{RULE_PATH}" stroke-width="1.8"/></g>'
    )
    defs = (
        '<clipPath id="inner"><circle cx="32" cy="32" r="25.6"/></clipPath>'
        f'<mask id="ink"><rect width="64" height="64" fill="#fff"/><g fill="#000">{texture}</g></mask>'
    )
    return defs, f'<g mask="url(#ink)">{body}</g>'


def tint(body, color):
    """The same shapes in one colour, with the carved lines left open (for the RGB split)."""
    return body.replace(RED, color).replace(f'stroke="{NIGHT}"', 'stroke="none"')


def svg(defs, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>{defs}</defs>{body}</svg>\n'


def full_mark():
    defs, body = stamp()
    clips = ''.join(
        f'<clipPath id="slice{i}"><rect x="-8" y="{top}" width="80" height="{bottom - top}"/></clipPath>'
        for i, (top, bottom, _) in enumerate(SLICES)
    )
    clips += ''.join(
        f'<clipPath id="block{i}"><rect x="{x}" y="{y}" width="{w}" height="{h}"/></clipPath>'
        for i, (x, y, w, h, _, _) in enumerate(BLOCKS)
    )
    holes = ''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}"/>' for x, y, w, h, _, _ in BLOCKS)
    clips += f'<mask id="holes"><rect x="-8" y="-8" width="80" height="80" fill="#fff"/><g fill="#000">{holes}</g></mask>'
    symbol = f'<symbol id="seal" viewBox="0 0 64 64" overflow="visible">{body}</symbol>'
    use = '<use href="#seal" width="64" height="64"/>'
    out = (
        f'<g clip-path="url(#slice1)" transform="translate(-1.2 0)">{tint(body, CYAN)}</g>'
        f'<g clip-path="url(#slice3)" transform="translate(2.2 0)">{tint(body, MAGENTA)}</g>'
    )
    out += ''.join(
        f'<g clip-path="url(#slice{i})" transform="translate({dx} 0)"><g mask="url(#holes)">{use}</g></g>'
        for i, (_, _, dx) in enumerate(SLICES)
    )
    out += ''.join(
        f'<g transform="translate({dx} {dy})"><g clip-path="url(#block{i})">{use}</g></g>'
        for i, (_, _, _, _, dx, dy) in enumerate(BLOCKS)
    )
    return svg(defs + clips + symbol, out)


def clean_mark():
    return svg(*stamp(textured=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('out', nargs='?', default='.', help='folder to write seal.svg and favicon.svg into')
    out = Path(parser.parse_args().out)
    (out / 'seal.svg').write_text(full_mark(), encoding='utf-8')
    (out / 'favicon.svg').write_text(clean_mark(), encoding='utf-8')
    print(f'Wrote {out / "seal.svg"} and {out / "favicon.svg"}')


if __name__ == '__main__':
    main()
