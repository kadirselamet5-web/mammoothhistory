# A Map of Permafrost-Preserved Pleistocene Megafaunal Specimens

Interactive discovery map of the Mammoth History Lab's soft-tissue specimen database, built as a
single self-contained HTML file (`index.html`) that embeds the data, the coastline geometry and
the globe renderer. It needs no server and makes no network requests, so it can be opened from a
file, hosted on GitHub Pages or embedded in the Lab's website.

**Live file:** `index.html` · **Current edition:** workbook `SOFT_TISSUE_Project_Database_2026_10_28_AO.xlsx`
(84 records, 6 taxon groups, finds recorded 1692–2024).

## The Mammoth History Lab, University of Toronto

The Mammoth History Lab is a group of historical researchers working to unravel the history of
permafrost-preserved mammoths and other Pleistocene creatures. Led by Professor Rebecca Woods, we
track the movement of these animals out of the ground of Siberia, Alaska and the Yukon, into
museum collections, and beyond. How did naturalists encounter frozen mammoths in the past? Why
were they motivated to look for them, and with what consequences? How did collecting frozen
mammoths shape scientific understandings of the Pleistocene era, the circumpolar north and the
history of climate change?

Research agenda

- To understand how the scientific and cultural meanings associated with permafrost-preserved
  soft-tissue specimens from the Pleistocene era change over time, why, and with what consequences
  for how scientists and broader publics understand the Earth's history and its climate.
- Main research outcomes: the extractivist and colonial logic of historical scientific practices
  associated with these specimens; the erasure of Indigenous knowledge and Indigenous experts and
  expertise.

Function of the database

- To visualize patterns and trajectories in the history of permafrost Pleistocene megafauna
  discoveries, where these specimens were found, and how and where they travelled after discovery.
- To test the hypothesis that the frequency of finds increases with industrialization and climate
  change, and to serve as a research tool for tracking and analysing permafrost megafaunal remains.
- Many comprehensive databases exist for scientific research; this is the first such database of
  its kind for humanistic and historical research. The most important fields are the date and the
  location of discovery.

## 1. Citation and contact

| | |
|---|---|
| Title | A Map of Permafrost-Preserved Pleistocene Megafaunal Specimens |
| Authors | Rebecca Woods, Alexander Offord, Kadir Selamet |
| Contact | mammothhistorylab@gmail.com · rebecca.woods@utoronto.ca |
| Funder | Social Sciences and Humanities Research Council of Canada (SSHRC) |
| Repository | University of Toronto Dataverse in Borealis |
| DOI | forthcoming |
| Version | 1.0 (date to follow Borealis deposit) |
| Licence | to follow Borealis rules |

## 2. What is this dataset

The database is a subset of a larger, unpublished database which also includes bony specimens and
fossils. In 2026 the team paused work on that larger database to focus solely on soft-tissue
specimens, for both practical and epistemological reasons: tracking soft-tissue specimens is more
useful for understanding the appearance of permafrost megafaunal finds in the context of climate
change.

- It is a global database of specimen finds.
- The primary point of interest is discovery; specimens recorded as seen but not collected are
  included. The dataset is agnostic on the veracity of uncollected specimens.
- It records finds of soft-tissue specimens at the moment of their discovery and does not account
  for subsequent destruction or decay.
- It includes all forms of specimen, organized broadly into categories of completeness
  (complete, mostly complete, partial, fragments only).
- Mammoths and other megafauna register in the scientific record and the wider historical record
  (newspapers, magazines) in a way that smaller-bodied animals such as Arctic ground squirrels do
  not. Limiting the dataset to megafauna locates the origins of scientific engagement with this
  phenomenon at the transition to the modern period.

How the data were compiled: the database was compiled over eight years from archival documents,
online and print newspaper articles, scientific publications, scholarly books, museum specimens
and more. Data points were extracted from these sources and recorded in the database; it is a
survey of publications and physical remains, and no new paleontological research was conducted.

### Workbook columns

`Sheet1` holds one row per specimen. The map reads these headers (older workbooks used
`Secondary_name`; both spellings are accepted):

`Specimen_id`, `Species_type`, `Binomial`, `Former_classification`, `Common_name`,
`Secondary_name(s)`, `Location_found`, `Latitude`, `Longitude`, `Location Provenance`,
`Date(s)_collected`, `Date_Found`, `Age_BP_radiocarbon`, `Complete?`, `Parts_found`,
`Archival_References`, `Published_References`.

Conventions the map relies on:

- Blank cells, `not_available`, `not_applicable` and `?` are kept as distinct source values and
  shown as such. `?` is displayed with an "uncertain in source" badge.
- `Location Provenance` classifies how each coordinate was obtained. The current labels are
  `source-stated`, `historical map`, `inferred/historical map`, `inferred`,
  `regional_placeholder` and `unlocated`. The map draws source-stated coordinates as solid points,
  inferred and historical-map positions with a dashed ring, and placeholders or unlocated finds as
  hollow points. A placeholder marks a region, not a find spot. New labels are picked up
  automatically (as hollow points until a style is assigned in `src/atlas.js`).
- `Date_Found` drives the discovery chronology; `Date(s)_collected` is the fallback. A range such
  as `1882-1884` is read as its first year.
- `Age_BP_radiocarbon` is reproduced verbatim. For the age plot, digit groups separated by a
  space, comma or period (`29 500`, `34, 450`, `31.700`) are read as thousands; `±` / `+/-`
  uncertainty, ranges, lower limits (`older than`, `>`, `+`) and alternative values separated by
  `/` are kept as intervals. Nothing is calibrated or converted.
- `Complete?` must be one of `Complete`, `Mostly_Complete`, `Partial`, `Fragments_Only`.
- Text in a column without a header (currently column R) is shown in the record as a
  "workbook note" and is not parsed.

## 3. Updating the map when the workbook changes

Requirements: Python 3.10+ with `openpyxl` (`pip install openpyxl`); Node 18+ only for the tests.

```bash
# 1. Put the new workbook in data/ (keep the YYYY_MM_DD date in the file name).
# 2. Rebuild, comparing with the previous edition so the About panel lists what changed.
cp index.html build/previous.html
python3 scripts/build_atlas.py --workbook data/SOFT_TISSUE_Project_Database_YYYY_MM_DD_AO.xlsx \
    --previous build/previous.html --payload-json build/payload.json
# 3. Run the checks.
node --test tests/atlas.test.mjs
# 4. Commit index.html together with the workbook.
```

`--check` prints the summary and review notes without writing anything. Once the dataset is
published on Borealis, pass `--dataset-url` and `--dataset-doi` so the "See dataset" button and
the DOI lines become live.

Review notes: the build script flags duplicate IDs, text-formatted coordinate cells, rows without
coordinates, `unlocated` rows that still carry coordinates, ambiguous age notation and collection
years earlier than discovery years. Hand-written notes (for example the Blue Babe longitude) live
in `data/review_notes.json`, keyed by `Specimen_id`. All notes appear in the record dialog, in the
map tooltip and in the About panel. The build never changes a workbook value; corrections belong
in the workbook.

## Repository layout

```
index.html                 built map (single file, ~1 MB; the deliverable)
data/*.xlsx                the Lab's workbook (source of truth for the map)
data/review_notes.json     curated review notes merged into the build
scripts/build_atlas.py     workbook -> payload JSON -> index.html
src/atlas.html             page template (markup, About text, {{PLACEHOLDERS}})
src/atlas.css              styles, coordinated with mammothhistorylab.com
src/atlas.js               interface logic (filters, map, globe, age plot, records)
src/land.txt               coastline outline used by the flat map and the globe
vendor/three.r128.min.js   Three.js r128 (MIT) for the polar globe
tests/atlas.test.mjs       unit checks run against the built page
```

The interface state (view, projection, filters, selected record) is kept in the URL hash, so a
filtered view or a single record can be linked, e.g. `index.html#view=sites&record=84`.

## Known source values to review (edition 2026-10-28)

- `#84` Blue Babe: longitude is `-47.3166666667` (plots in Greenland); the locality implies about
  `-147.32`.
- `#143` Nun Cho Ga: longitude is `+138.825` (plots in Siberia); Eureka Creek, Yukon is at
  `-138.825`.
- `#92` Mascha: coordinates are those of St. Petersburg while the locality is Yuribei River.
- `#9` Potapov Mammoth: latitude cell is text with a trailing space; provenance is `unlocated`.
- `#148` Dominion Creek: no coordinates, binomial or former classification entered.
- `#146` Yana: age `>50 0000 years` is ambiguous and is not plotted numerically.
- `#149` Bilibino Horse: age `31.700 ± 1.300` is read as 31,700 ± 1,300.
- `#34`: age reads `not_applicable` where other undated rows use `not_available`.

Fix these in the workbook and rebuild; the notes disappear once the cells change (curated notes
in `data/review_notes.json` should be removed by hand).
