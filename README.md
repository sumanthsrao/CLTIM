# CLTIM — Topic reader assets

This repository contains only shared external topic-reader CSS/JS and approved, topic-specific images. It is not a copy of the CLATGK repository.

**Hosting (2026-10-10):** moving from a manually-deployed Netlify site to GitHub Pages, served directly from this repo's `main` branch — auto-publishes on every push, no manual upload step. Once Pages is enabled (Settings → Pages → Source: `main` / root), the live URL becomes `https://sumanthsrao.github.io/CLTIM/assets/7f3a91c2.css` and `https://sumanthsrao.github.io/CLTIM/assets/c84d21be.js`. Update `control/FOUR_ACTOR_PIPELINE.md` and `Prompts/TOPIC_GPT_DAILY.md` in the CLATGK repo to point at the new URL once confirmed live.

**2026-10-10 incident, for context:** this repo's `assets/7f3a91c2.css` and `assets/c84d21be.js` had been overwritten at some point with unrelated VISUAL-GPT dashboard code, not the real topic reader. The live Netlify site was still serving the correct, older reader content independently of what was committed here — meaning the previous Netlify deploy was not actually tracking this repo's `main` branch (or was deployed from a stale/different source). Both files were restored here from the live site's actual served content, verified line-for-line, before switching hosts — so GitHub Pages serves the real reader from day one, not a stale or substituted copy.

## Structure

- `assets/7f3a91c2.css` — external topic viewer CSS
- `assets/c84d21be.js` — external topic viewer JavaScript
- `samples/forest-rights.html` — sample topic HTML for pilot testing
- `images/YYYY-MM/TOPIC_ID/NODE_ID.ext` — approved images associated with individual topic nodes (currently none)
- `manifest.json` — asset registry
- `index.html` — pilot navigation

Do not place DeepSeek Magazine Builder HTML, JS or CSS, other duplicate stylesheets, unrelated stock/test images, source PDFs, prompts, credentials or pipeline outputs in this repository.

Only publish images after mapping to their correct topic/node and verifying public distribution rights.
