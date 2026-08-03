#!/usr/bin/env node

/**
 * Script to download yt-dlp binary for Linux (Vercel environment)
 * This ensures the binary is available during deployment
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BIN_DIR = path.join(__dirname, '..', 'bin');
const YTDLP_PATH = path.join(BIN_DIR, 'yt-dlp');

// Latest yt-dlp release URL for Linux x86_64
// Using the standalone binary that works on Vercel's serverless environment
const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);

        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                file.close();
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                file.close();
                if (fs.existsSync(dest)) {
                    fs.unlinkSync(dest);
                }
                reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                // Make executable (works on Unix-like systems, ignored on Windows)
                try {
                    fs.chmodSync(dest, 0o755);
                } catch (err) {
                    // Ignore chmod errors on Windows
                    console.warn('Could not set executable permissions (this is OK on Windows)');
                }
                resolve();
            });
        }).on('error', (err) => {
            file.close();
            if (fs.existsSync(dest)) {
                try {
                    fs.unlinkSync(dest);
                } catch (unlinkErr) {
                    // Ignore unlink errors
                }
            }
            reject(err);
        });
    });
}

async function main() {
    try {
        // Only download Linux binary (for Vercel deployment)
        // On Windows/Mac, ytdlp-nodejs will handle binary automatically
        const platform = process.platform;
        
        if (platform !== 'linux') {
            console.log(`Platform is ${platform}, skipping Linux binary download.`);
            console.log('ytdlp-nodejs will handle binary automatically on this platform.');
            return;
        }

        // Create bin directory if it doesn't exist
        if (!fs.existsSync(BIN_DIR)) {
            fs.mkdirSync(BIN_DIR, { recursive: true });
        }

        // Check if binary already exists
        if (fs.existsSync(YTDLP_PATH)) {
            console.log('yt-dlp binary already exists, skipping download');
            return;
        }

        console.log('Downloading yt-dlp binary for Linux (Vercel deployment)...');
        await downloadFile(YTDLP_URL, YTDLP_PATH);
        console.log(`✅ Successfully downloaded yt-dlp to ${YTDLP_PATH}`);

        // Verify it's executable
        try {
            execSync(`chmod +x "${YTDLP_PATH}"`);
            console.log('✅ Binary is now executable');
        } catch (err) {
            console.warn('⚠️  Could not set executable permissions');
        }
    } catch (error) {
        console.error('❌ Error downloading yt-dlp binary:', error.message);
        // Don't exit with error on Windows/Mac - it's expected
        if (process.platform === 'linux') {
            process.exit(1);
        }
    }
}

main();

