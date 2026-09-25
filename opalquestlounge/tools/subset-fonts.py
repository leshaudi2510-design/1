"""Subset and trim the variable fonts used by the site.

Source files are the Latin variable woff2 files served by Google Fonts
(OFL licence). Run from the site folder:

    pip install fonttools brotli
    python3 tools/subset-fonts.py path/to/source-fonts

Writes src/public/assets/fonts/*.woff2
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
    + [0xA0, 0xA9, 0xB0, 0xB1, 0xB7, 0xBC, 0xBD, 0xBE, 0xD7, 0xE9,
       0x2009, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022,
       0x2026, 0x2212]
)

JOBS = [
    # file in, file out, axis limits (None = keep full range)
    # Google Fonts lists the italic file first; these names match what each file really is.
    ("bodoni-roman.woff2", "bodoni-moda.woff2", {"wght": (400, 800), "opsz": (6, 96)}),
    ("bodoni-italic.woff2", "bodoni-moda-italic.woff2", {"wght": (400, 700), "opsz": (6, 96)}),
    ("geologica.woff2", "geologica.woff2", {"wght": (300, 700), "SHRP": (0, 100), "slnt": 0, "CRSV": 0}),
    ("martian.woff2", "martian-mono.woff2", {"wght": (300, 700), "wdth": (75, 112.5)}),
]

for src, out, limits in JOBS:
    font = TTFont(SRC / src, lazy=False)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "clig", "calt", "tnum", "lnum", "onum", "pnum", "frac", "case", "ss01"]
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    opts.notdef_outline = True
    opts.hinting = False
    s = subset.Subsetter(opts)
    s.populate(unicodes=UNICODES)
    s.subset(font)
    font = instancer.instantiateVariableFont(font, limits)
    font.flavor = "woff2"
    font.save(OUT / out)
    print(out, (OUT / out).stat().st_size, "bytes")
