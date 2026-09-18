# [pupper supper](https://puppersupper.theo.lol)

Plan your dog's daily diet and check it against the AAFCO adult-maintenance
nutrient profile.

Vibe-coded, unverified, and not made by a veterinarian. 

## Layout

No framework, no server; one page, one stylesheet, plain ES modules, almost entirely local (minus USDA food data).

```
index.html        page markup (Vite entry)
src/
  main.js         boot, events, URL sync, menu, search, problem notices
  data.js         AAFCO nutrient table, units, periods, the example diet
  icons.js        Lucide icons inlined as SVG
  editable.js     inline editable text component (title, food names)
  bundled.js      built-in ingredients (generated, see scripts/)
  expr.js         safe arithmetic evaluator for the grams/day column
  state.js        current diet, localStorage, grams/day + daily totals, sanitize() + migration
  analysis.js     energy need, AAFCO comparison (pure functions; what the tests cover)
  share.js        diet <-> compressed URL hash (formats v1–v3)
  fdc.js          built-in search, USDA FoodData Central client, classified errors
  render.js       tables, analysis, toast
  style.css
public/_headers   security headers applied by Pages (CSP, cache)
public/icons/     app icons for the installable (PWA) build
vite.config.js    build + PWA manifest / service worker (vite-plugin-pwa)
scripts/          regenerate src/bundled.js from USDA (needs an API key)
test/             node --test unit tests (diet maths, URL encoding, migration, expressions, USDA mapping, bundle)
dist/             build output (generated; this is what gets deployed)
wrangler.toml     Pages project name + output dir
```

## Install as an app

The build ships a web-app manifest and a service worker, so browsers offer
"Install" / "Add to Home Screen". The app shell is precached and works
offline with the built-in ingredients; USDA searches still need a connection.
Updates apply automatically on the next visit after a deploy.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173 with hot reload
npm test           # unit tests
npm run build      # writes dist/
npm run preview    # serves dist/ locally
FDC_KEY=... node scripts/refresh-bundled.mjs   # refresh built-in ingredients from USDA
```

To add a built-in ingredient, append its exact FoodData Central description to
`scripts/bundled-list.js` and run the refresh script. It only searches for foods
whose id it does not already have, so a refresh of the existing list is three
requests and fits inside the demo key; if USDA rate-limits it part-way, the
foods it could not fetch keep their previous values and you can re-run later.
The example diet takes its USDA-sourced values from the bundle by name, so a
refresh updates it too.

## How the analysis works

Every food is converted to grams per day (amount expression × unit × 1/period),
and its per-100 g nutrients are scaled by that. The dog's energy need is
RER × activity, where RER = 70 × kg^0.75. AAFCO states its adult-maintenance
profile per 1,000 kcal on the assumption that the food is fed to meet the
energy need, so each minimum and maximum is multiplied by (need ÷ 1,000) to get
an amount per day, and that is what the day's intake is judged against. The
diet's nutrient density per 1,000 kcal is shown alongside for reference: it
says whether the *food* is balanced, while the per-day columns say whether the
*dog* is getting enough.

The nutrient table (`NUTS`) covers the AAFCO adult profile except chloride,
which USDA does not report, and the amino acids. New nutrients are appended
to the end of the table because saved and shared diets store values by
position; `DISPLAY` gives the order the page shows them in. Besides the
nutrient minimums the quick checks apply AAFCO's three balances: calcium to
phosphorus (1:1 to 2:1), omega-6 to omega-3 (at most 30:1) and vitamin E to
polyunsaturated fat (at least 0.6 IU/g).

When a row is out of range, its status carries a note (`NOTES` in
`src/data.js`) of what sustained excess or shortfall looks like, and a few
nutrients carry a breed note beside their name (copper and the copper-storage
breeds, zinc and the Arctic breeds, fat and pancreatitis-prone breeds, calcium
and large-breed puppies). Each note is paraphrased from the linked source,
mostly the Merck Veterinary Manual.

AAFCO's 2016 profile has maximums only for calcium, phosphorus, iodine,
selenium and vitamins A and D. For six nutrients it leaves open-ended, the app
carries an *advisory* upper level from elsewhere (`ADVISORY` in `src/data.js`,
per 1,000 kcal, dry-matter figures converted at AAFCO's 4,000 kcal/kg
convention): the EU legal maximums for copper, zinc, iron and manganese from
the FEDIAF 2024 guidelines, FEDIAF's "shown safe" level for sodium, and the
NRC's lower bound for magnesium as quoted in AAFCO's 2014 rationale. A diet
above one is marked "above advisory level" rather than "over max", and the
tooltip carries the reasoning and a link to the source. Vitamin E, potassium,
the B vitamins, choline, protein and fat have no published upper figure for
dogs and are left open.

When a nutrient is added to the table, diets saved or shared earlier have no
value for it. On load, `backfill()` fills such blanks from the built-in table
for any food with a USDA id in its source note or a built-in's exact name.
Only blanks are ever filled; typed values are never overwritten.

A nutrient a source does not report is stored as `null`, not 0. USDA's SR
Legacy records never carry iodine, for instance, and some lack choline or
vitamin E. Such values count as 0 in the totals, but the food's editor button
shows how many are unknown, the editor leaves those fields blank, and the
analysis marks the affected nutrients as lower bounds.

## Sharing a diet

The whole diet (title, weight, activity, every food with its amount, unit,
period, note and per-100 g nutrients) is compressed and kept in the URL hash, e.g.
`https://puppersupper.theo.lol/#r=…`. The address bar is updated as you edit, so
copying it at any time gives a link to exactly what you see. The menu's
*Copy link* does the same, appending `&key=…` when *include key in shared
links* is ticked so the recipient can search without getting their own.

Opening a link loads that diet into the recipient's browser, replacing
whatever they had saved there. Their edits are then their own; to send changes
back they copy their link. Nothing is stored on a server, and because the
diet lives in the hash it is never sent to Cloudflare either.

Untrusted input from links is sanitised (`sanitize()` in `src/state.js`) and
all names are escaped before rendering. Amount expressions go through a tiny
hand-written parser, never `eval`. The CSP in `public/_headers` also forbids
inline scripts. Diets saved or shared by earlier versions of the page are
migrated automatically.

## Notes

- `public/_headers` sets a Content-Security-Policy that allows only Google Fonts
  and `api.nal.usda.gov`. If you add another external script, font, or API,
  add its origin there or the browser will block it.
- The USDA FDC API key is entered in the page and stored in the browser's
  localStorage (and in a share link only if you tick the box).
