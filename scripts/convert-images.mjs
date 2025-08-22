import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const IMAGE_DIR = path.resolve('public/images');
const exts = new Set(['.png', '.jpg', '.jpeg']);

async function ensureDir(p) {
    await fs.promises.mkdir(p, { recursive: true });
}

async function convertOne(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!exts.has(ext)) return;

    const dir = path.dirname(filePath);
    const base = path.basename(filePath, ext);
    const src = path.resolve(filePath);
    const webpOut = path.resolve(dir, `${base}.avif`);
    const avifOut = path.resolve(dir, `${base}.avif`);

    try {
        const img = sharp(src);
        const meta = await img.metadata();
        // Safety: cap max dimension to 2000px to avoid oversized hero assets
        const width = meta.width && meta.width > 2000 ? 2000 : meta.width;

        // WebP
        await img
            .resize(width)
            .avif({ quality: 80 })
            .toFile(webpOut);

        // AVIF
        await img
            .resize(width)
            .avif({ quality: 50 })
            .toFile(avifOut);

        console.log(`Converted: ${path.basename(src)} -> ${path.basename(webpOut)}, ${path.basename(avifOut)}`);
    } catch (e) {
        console.error(`Failed converting ${filePath}:`, e.message);
    }
}

async function* walk(dir) {
    for (const d of await fs.promises.readdir(dir, { withFileTypes: true })) {
        const entry = path.join(dir, d.name);
        if (d.isDirectory()) yield* walk(entry);
        else yield entry;
    }
}

async function main() {
    await ensureDir(IMAGE_DIR);
    for await (const p of walk(IMAGE_DIR)) {
        await convertOne(p);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});



