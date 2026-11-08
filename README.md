# Salad Poster

A single web page built from a Figma layout with plain HTML, CSS and JavaScript.

## Structure

- `index.html`: the page
- `css/style.css`: styles
- `css/fonts.css`: the local fonts (Monofett comes from Google Fonts)
- `js/script.js`: interactions
- `assets/images`: art exported from Figma; `assets/images/burst` holds the stickers thrown by the sticker burst
- `assets/fonts`, `assets/cursors`: fonts and the custom cursors

After changing a file, bump its `?v=` in `index.html` (or `js/script.js` for the burst stickers) so browsers fetch the new copy.

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
npx serve .
```

## Publish

Hosted with GitHub Pages from the `main` branch root.
