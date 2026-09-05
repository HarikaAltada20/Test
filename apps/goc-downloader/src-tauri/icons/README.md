# Icons

Placeholder assets for the Game of Creators Downloader scaffold.

- `logo.svg` — brand mark (navy / gold)
- `icon.png` — minimal PNG placeholder for Tauri bundling
- `icon.ico` — must be generated for real Windows builds

## Generating real Windows icons

Tauri expects multiple sizes. From this folder (after installing a converter):

```bash
# Example with ImageMagick (install separately):
# magick convert logo.svg -resize 512x512 icon.png
# magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

Or use `@tauri-apps/cli` icon generation once a master PNG exists:

```bash
npm run tauri -- icon path/to/master-1024.png
```

Until real icons are generated, `tauri build` may warn or fail on icon validation — replace these placeholders before release packaging.
