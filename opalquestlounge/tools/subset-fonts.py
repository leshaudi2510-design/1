"""Subset and trim the variable fonts used by the site.

Source files are the full variable fonts from the google/fonts repository
(OFL licence): ofl/archivo/Archivo[wdth,wght].ttf and
ofl/radiocanada/RadioCanada[wdth,wght].ttf. (The Latin files Google Fonts
serves stop at U+206F, so they lack the approximately-equal sign.) Run from
the site folder:

    pip install fonttools brotli
    python3 tools/subset-fonts.py path/to/source-fonts

Writes src/public/assets/fonts/*.woff2, and stops if a character listed
below is missing from a source font (fontTools would drop it silently).
Afterwards run `node tools/font-fallbacks.mjs --measure`, so the fallback
faces still match the new files.
"""
import sys, pathlib
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = pathlib.Path(__file__).resolve().parent.parent / "src/public/assets/fonts"
OUT.mkdir(parents=True, exist_ok=True)

UNICODES = (
    list(range(0x20, 0x7F))
    # nbsp, copyright, degree, plus-minus, middle dot, fractions, times,
    # e-acute, c-cedilla (Francois), division
    + [0xA0, 0xA9, 0xB0, 0xB1, 0xB7, 0xBC, 0xBD, 0xBE, 0xD7, 0xE9, 0xE7, 0xF7,
       # thin space, dashes, curly quotes, bullet, ellipsis, single right
       # angle quote (Twenty-One's active-hand marker), minus, almost equal
       0x2009, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022,
       0x2026, 0x203A, 0x2212, 0x2248]
)

JOBS = [
    # file in, file out, axis limits (None = keep full range), characters the
    # source font doesn't have (the browser draws them from another font)
    ("Archivo[wdth,wght].ttf", "archivo.woff2", {"wght": (500, 900), "wdth": (100, 125)}, set()),
    # Radio Canada also has a wdth axis (75-100); the site uses the normal width only.
    # It has no thin space; a fallback font's is just as blank.
    ("RadioCanada[wdth,wght].ttf", "radio-canada.woff2", {"wght": (400, 700), "wdth": 100}, {0x2009}),
]

for src, out, limits, absent in JOBS:
    font = TTFont(SRC / src, lazy=False)
    missing = [f"U+{u:04X}" for u in UNICODES if u not in absent and u not in font.getBestCmap()]
    if missing:
        sys.exit(f"{src}: no glyph for {', '.join(missing)}")
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "clig", "calt", "tnum", "lnum", "onum", "pnum", "frac", "case", "ss01"]
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
    print(out, (OUT / out).stat().st_size, "bytes")
