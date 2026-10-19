# LegacyScape Atlas — RuneScape 667 Cache Explorer

A modern, static website built from **your actual Matrix/Dragon 667 cache JSON dumps**. All data is loaded from files inside `data/` — no account, manual importing, database or third-party services required.

## Data included in this download

| File | Records | Source |
| --- | ---: | --- |
| `data/objects.json` | 64,092 | Your uploaded `objects.json` |
| `data/npcs.json` | 14,674 | Your uploaded `npcs.json` |
| `data/items.json` | 23,247 | Your uploaded `items.json` |

All fields and definition IDs are preserved. JSON has been compacted by removing unnecessary whitespace to make the site load faster. Names like `"null"` in your original cache are kept as-is in the data and shown as unnamed in the interface.

## How to run on Windows

1. Extract the entire ZIP.
2. Double-click **`start-website.bat`** (requires a JDK, such as the JDK you use with IntelliJ).
3. Open **http://localhost:8000/** in your browser.

Alternatively, run `python -m http.server 8000` in the extracted folder and open the same URL.

**Important:** Don't open `index.html` with a `file://` URL. Most browsers don't allow `fetch()` to load local JSON without serving the files over HTTP.

## Updating definitions later

Your server exporter writes to `YOUR_SERVER/data/dump/`. Copy over these files whenever you regenerate the dump:

```
YOUR_SERVER/data/dump/objects.json -> ATLAS/data/objects.json
YOUR_SERVER/data/dump/npcs.json    -> ATLAS/data/npcs.json
YOUR_SERVER/data/dump/items.json   -> ATLAS/data/items.json
```

Refresh the page. No import buttons needed. The website also works on any standard static hosting service, provided the same `data/` directory is uploaded with it.

## Searches and wiki links

- Exact ID: `#items:4151` (Abyssal whip)
- NPC: `#npcs:6260` (General Graardor)
- Object: `#objects:2213` (Bank booth)
- Multiple object IDs: `#objects:4310,14887`
- Ranges: `#objects:100-150` or `#objects:100+25` (100 through 124)
- Names: type text in the search field; space-separated words can appear in any order

On a hosted Atlas site, your MediaWiki infobox module can link to:

```
https://YOUR-DOMAIN/#objects:4310,14887
https://YOUR-DOMAIN/#npcs:6260
https://YOUR-DOMAIN/#items:4151
```

Keep regular MediaWiki internal `[[Page]]` links unchanged.

## Features

- Responsive dark interface (desktop, tablet and mobile).
- Search by name, exact ID, multiple IDs, ID range, and interactions.
- Category-specific filters: clipped, interactive, combat, stackable, noted, members and equipment.
- Sort by ID or name; 30 results per page.
- Record inspector shows decoded properties, actions, model IDs, transforms and recolours.
- Full original cache record in expandable raw JSON.
- Saved bookmarks stored in **your browser's localStorage**; no server writes.
- Copy IDs and direct links; export currently filtered results to JSON.
- `/` focuses search, `Esc` closes dialogs, left/right arrows paginate outside of inputs.

### Limits

The JSONs are **definition exports**, not rendered meshes or sprites. The website displays real model IDs but does **not** render NPCs, items or 3D objects until you provide model files/rendered assets and a compatible renderer. There are also no spawn locations in these cache definition files, and item cache `value` is not a live Grand Exchange price. Missing properties aren't invented.

## Files

```
legacyscape-atlas/
├── index.html
├── styles.css
├── app.js
├── start-website.bat
├── start-website.sh
├── README.md
└── data/
    ├── objects.json
    ├── npcs.json
    └── items.json
```

Everything runs in the browser; the HTTP server just serves static files.
