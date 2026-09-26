"""Subset and trim the variable fonts used by the site.

Source files are the full variable TrueType fonts from the google/fonts
repository (OFL licence), not the Latin woff2 files the Google Fonts CSS API
serves: those stop at U+206F, so they leave out signs the site uses, such as
U+2248 (≈).

    ofl/archivo/Archivo[wdth,wght].ttf
    ofl/radiocanada/RadioCanada[wdth,wght].ttf

from https://github.com/google/fonts. Run from the site folder:

    pip install fonttools brotli
    python3 tools/subset-fonts.py path/to/folder-with-the-two-ttf-files

Writes src/public/assets/fonts/archivo.woff2 and radio-canada.woff2, and
src/data/font-coverage.json: the code points both files cover. build.mjs
fails when a page or a script draws a character outside that list, and
gives each font file a content-hashed name, so a regenerated font reaches
returning visitors despite the year-long immutable caching.

Stops with an error, and writes nothing, when a source font lacks one of
the code points below: the fontTools subsetter would otherwise drop it
without a word.

Afterwards run `node tools/font-fallbacks.mjs --measure`, so the
metric-matched fallback faces in src/styles/00-tokens.css still match the
new files.
"""
import json, pathlib, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
SITE = pathlib.Path(__file__).resolve().parent.parent
OUT = SITE / "src/public/assets/fonts"
COVERAGE = SITE / "src/data/font-coverage.json"

UNICODES = sorted(
    list(range(0x20, 0x7F))
    + [
        0xA0,    # no-break space
        0xA9,    # ©
        0xB0,    # °
        0xB1,    # ±
        0xB7,    # ·
        0xBC, 0xBD, 0xBE,  # ¼ ½ ¾
        0xD7,    # ×
        0xE7,    # ç (François Blanc)
        0xE9,    # é
        0xF7,    # ÷ (36 ÷ 37)
        0x2013, 0x2014,  # – —
        0x2018, 0x2019, 0x201C, 0x201D,  # ‘ ’ “ ”
        0x2022,  # •
        0x2026,  # …
        0x2212,  # −
        0x2248,  # ≈ (RTP ≈ 99.6%)
    ]
)
# Not included: U+2011 (non-breaking hyphen) and U+2009 (thin space), which
# Radio Canada doesn't have (keep hyphenated words together with
# <span class="nobr"> instead), and signs neither family has, such as U+25B8 (▸).
# U+203A (›) was the Twenty-One active-hand marker for a while; the marker
# is now the words "(playing)", so nothing draws it.

JOBS = [
    # file in, file out, axis limits (a range keeps that part of the axis; a number pins it)
    ("Archivo[wdth,wght].ttf", "archivo.woff2", {"wght": (500, 900), "wdth": (100, 125)}),
    # Radio Canada also has a wdth axis (75-100); the site uses the normal width only.
    ("RadioCanada[wdth,wght].ttf", "radio-canada.woff2", {"wght": (400, 700), "wdth": 100}),
]

# Check every source first, so a missing glyph stops the run before any file changes.
fonts = []
missing = {}
for src, out, limits in JOBS:
    path = SRC / src
    if not path.exists():
        sys.exit(f"error: {path} not found. Download it from https://github.com/google/fonts (see the notes at the top of this script).")
    font = TTFont(path, lazy=False)
    cmap = font.getBestCmap()
    lacking = [u for u in UNICODES if u not in cmap]
    if lacking:
        missing[src] = lacking
    fonts.append((font, out, limits))
if missing:
    for src, lacking in missing.items():
        print(f"error: {src} has no glyph for {', '.join(f'U+{u:04X} ({chr(u)})' for u in lacking)}", file=sys.stderr)
    sys.exit("error: nothing written. Take those code points out of UNICODES, or use a source font that has them.")

OUT.mkdir(parents=True, exist_ok=True)
covered = None
for font, out, limits in fonts:
    opts = subset.Options()
    opts.flavor = "woff2"
    # Only the features the stylesheet can switch on (tabular and lining
    # figures) or that browsers apply by default. Old-style figures and
    # case-sensitive forms would add about 40 glyphs nobody sees.
    opts.layout_features = ["kern", "liga", "clig", "calt", "tnum", "lnum", "pnum", "frac"]
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    opts.notdef_outline = True
    # Keep the prep table: without it FreeType (Linux, ChromeOS, Android) sets
    # the text about 4% wider than the same font served by Google.
    opts.hinting = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=UNICODES)
    s.subset(font)
    font = instancer.instantiateVariableFont(font, limits)
    font.flavor = "woff2"
    font.save(OUT / out)
    # Read the written file back: the coverage list is what was really saved.
    have = set(TTFont(OUT / out).getBestCmap())
    lost = [u for u in UNICODES if u not in have]
    if lost:
        sys.exit(f"error: {out} lost {', '.join(f'U+{u:04X}' for u in lost)} while subsetting")
    covered = have if covered is None else covered & have
    print(out, (OUT / out).stat().st_size, "bytes,", len(have), "code points")

COVERAGE.write_text(
    json.dumps(
        {
            "_about": "Code points both self-hosted fonts cover, written by tools/subset-fonts.py. build.mjs fails when visible text, a script's strings or the stylesheet use a character above U+007E that isn't listed here, because the browser would draw it in a fallback face.",
            "fonts": [out for _, out, _ in JOBS],
            "codepoints": [f"U+{u:04X}" for u in sorted(covered)],
        },
        indent=2,
        ensure_ascii=False,
    )
    + "\n"
)
print(COVERAGE.relative_to(SITE), len(covered), "code points")
print("Now run: node tools/font-fallbacks.mjs --measure")
