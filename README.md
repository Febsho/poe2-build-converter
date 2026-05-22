# pob2build

Convert Path of Building exports, pobb.in links, Mobalytics builds, and Maxroll guides into official **Path of Exile 2 `.build`** files that you can drop straight into the in-game Build Planner.

---

## What it does

Paste any of the following into the web UI and click **Convert**:

| Input | Example |
|---|---|
| pobb.in link | `https://pobb.in/abc123` |
| Mobalytics build | `https://mobalytics.gg/poe-2/builds/my-build` |
| Maxroll build guide | `https://maxroll.gg/poe2/build-guides/my-build` |
| Maxroll planner | `https://maxroll.gg/poe2/planner/lo2p80kj` |
| PoB export code | `eNqVk…` |
| Raw PoB XML | `<PathOfBuilding>…` |

The converter outputs a `.build` JSON file. Place it in:

```
Documents/My Games/Path of Exile 2/BuildPlanner/
```

Then open the Build Planner in-game and your build appears.

---

## Running locally

**Requirements:** Node.js 20+ and npm.

```bash
git clone https://github.com/febsho/poe2-build-converter
cd poe2-build-converter
npm install
npm start
```

Open `http://localhost:3000` in your browser.

For auto-reload during development:

```bash
npm run dev
```

---

## Running with Docker

### Pull and run the pre-built image

```bash
docker compose up -d
```

The `docker-compose.yml` pulls `ghcr.io/febsho/poe2-build-converter:latest` automatically.

Open `http://localhost:3000`.

### Update to the latest version

```bash
docker compose pull && docker compose up -d
```

### Build the image yourself

```bash
docker build -t poe2-build-converter .
docker run -p 3000:3000 poe2-build-converter
```

---

## How the conversion works

1. **Fetch** — if you paste a URL, the server fetches the PoB export code from pobb.in, Mobalytics, or Maxroll
2. **Parse** — the PoB XML (or Maxroll JSON) is read to extract skills, passive tree, and gear
3. **Convert** — skills use GGG gem IDs directly; passive nodes are resolved against real game data; items carry their stats in `additional_text`
4. **Download** — click **Download .build** or copy the JSON from the preview panel

### Multiple variants (skill steps / gear sets / tree specs)

Builds from pobb.in and Maxroll often have multiple progression stages (Campaign → Endgame). After the first convert, dropdowns appear letting you pick which variant to use for gems, gear, and the passive tree independently.

---

## Conversion quality

| Label | Meaning |
|---|---|
| **Converted** | Mapped with high confidence using real GGG game data |
| **Guessed** | Best-effort match — double-check before using in-game |
| **Unsupported** | Could not be mapped — kept as text for reference |

---

## Project structure

```
src/
  pobParser.js     — decode & parse PoB XML
  mobalytics.js    — fetch builds from Mobalytics
  maxroll.js       — fetch builds from Maxroll
  pobbin.js        — fetch export codes from pobb.in
  converter.js     — convert parsed build → .build JSON
  resolve.js       — auto-detect input type and route it
  data/
    passives_default.json   — GGG passive node ID → internal ID map
    ascendancies.json       — ascendancy display name → internal key map
public/
  index.html / app.js / style.css   — web UI
server.js          — Express API server (/api/convert, /api/inspect)
Dockerfile         — multi-arch image (amd64 + arm64)
```

---

## API

The server exposes two JSON endpoints if you want to integrate programmatically.

### `POST /api/inspect`

Returns available variants without converting. Useful for showing set selectors.

```json
{ "input": "https://pobb.in/abc123", "kind": "auto" }
```

Response:
```json
{
  "ok": true,
  "meta": { "level": 90, "className": "Ranger", "ascendClassName": "Deadeye" },
  "skillSets": [{ "id": 1, "title": "Skill Set 1" }],
  "itemSets":  [{ "id": 1, "title": "Item Set 1" }],
  "treeSpecs": [{ "index": 0, "title": "Spec 1", "treeVersion": "2_3" }]
}
```

### `POST /api/convert`

Converts a build and returns the `.build` JSON plus a report.

```json
{
  "input": "https://pobb.in/abc123",
  "kind": "auto",
  "name": "My Deadeye",
  "skillSetId": 1,
  "itemSetId": 1,
  "specIndex": 0
}
```

Response:
```json
{
  "ok": true,
  "build": { ... },
  "filename": "MyDeadeye.build",
  "report": {
    "converted": ["skill \"Whirling Slash\"", "26 passive nodes resolved"],
    "guessed": [],
    "unsupported": [],
    "warnings": []
  },
  "source": { "kind": "pobbin" }
}
```
