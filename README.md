# Zero

The website for **Zero** comics: zerosnaketree.com. Plain static files, no build step.
Hosted on Cloudflare (Workers, connected to this repo): every push to `main` goes live in about a minute.

- `index.html`: home. One card per comic issue, plus social links.
- `the-one-true-king/1/index.html`: the reader for The One True King, Issue #1. Add a panel by copying a `.panel` block
  (`data-live` = `snow`, `leaves` or `rain`; `data-origin` = where leaves start, as x,y fractions).
- `assets/site.css`, `assets/live.js`: shared look and the tap-to-play effects and sound.
- `assets/`: panel images (WebP), the Zero logo, the share image.
