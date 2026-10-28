# Experimental designs

Trial redesigns of the discovery map. They are built from the same workbook and the same engine
(`src/atlas.js`) as the production page, so every filter, view, record and test applies to them;
only the page template, styles and extra sections differ. The production `index.html` is unchanged.

| File | Direction | Skin sources |
|---|---|---|
| `variant-a.html` | **Field atlas** (editorial): engraving-style hero drawn from the coastline, ledger figures, the atlas, a decade chart, provenance/material/completeness bars that filter the atlas, specimen plates for the complete carcasses, a method section. Libre Caslon Display, Source Sans 3, IBM Plex Mono. | `a/atlas.html`, `a/atlas.css`, `a/extra.js` |
| `variant-b.html` | **Museum catalogue** (information design): sticky filter drawer, the map as a catalogue plate, label-plate record cards, a catalogue summary band, an accessions ledger, catalogue notes. Archivo, IBM Plex Mono. | `b/atlas.html`, `b/atlas.css`, `b/extra.js` |

Both use the colour-vision-safe taxon palette (Mammoth `#c98500`, Rhinoceros `#199e70`,
Cave Lion/Felid `#d95926`, Horse `#3987e5`, Wolf/Canid `#d55181`, Bison `#6a8f00`), set through
`globalThis.__ATLAS_PALETTE__` before the engine script, and load their fonts from Google Fonts
with system fallbacks.

Rebuild after a workbook update:

```bash
python3 scripts/build_atlas.py --skin experimental/a --out experimental/variant-a.html --previous index.html
python3 scripts/build_atlas.py --skin experimental/b --out experimental/variant-b.html --previous index.html
ATLAS_HTML=experimental/variant-a.html node --test tests/atlas.test.mjs
ATLAS_HTML=experimental/variant-b.html node --test tests/atlas.test.mjs
```

A skin directory needs `atlas.html` (every element ID from `src/atlas.html`, filter groups as
`<details class="filter-section">`) and `atlas.css`; `extra.js` is optional and is inserted at
`{{EXTRA}}` after the engine. Extra sections read the data from the embedded payload and drive
the engine through the URL hash (for example `#view=sites&record=84`, `#prov=source_stated`,
`#from=1900&to=1909`).
