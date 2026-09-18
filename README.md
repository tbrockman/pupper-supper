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
  state.js        current diet, localStorage, daily maths, sanitize() + migration
  share.js        diet <-> compressed URL hash (formats v1–v3)
  fdc.js          built-in search, USDA FoodData Central client, classified errors
  render.js       tables, analysis, toast
  style.css
public/_headers   security headers applied by Pages (CSP, cache)
public/icons/     app icons for the installable (PWA) build
vite.config.js    build + PWA manifest / service worker (vite-plugin-pwa)
scripts/          regenerate src/bundled.js from USDA (needs an API key)
test/             node --test unit tests (URL encoding, migration, expressions, bundle)
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
npm test           # URL round-trip tests
npm run build      # writes dist/
npm run preview    # serves dist/ locally
FDC_KEY=... node scripts/refresh-bundled.mjs   # refresh built-in ingredients from USDA
```

To add a built-in ingredient, append its exact FoodData Central description to
`scripts/bundled-list.js` and run the refresh script.

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
