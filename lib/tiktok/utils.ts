/**
 * Extracts TikTok video ID from various TikTok URL formats.
 * Supports both standard and shortened URLs.
 */
export function extractTiktokId(url: string): string | null {
    if (!url) return null;

    try {
        const urlObj = new URL(url);

        // Handle standard URLs: tiktok.com/@user/video/12345
        if (urlObj.hostname.includes('tiktok.com')) {
            const pathParts = urlObj.pathname.split('/');
            const videoIndex = pathParts.indexOf('video');
            if (videoIndex !== -1 && pathParts[videoIndex + 1]) {
                // Remove any query params if they were somehow part of the path segment
                return pathParts[videoIndex + 1].split('?')[0];
            }

            // Some URLs might be tiktok.com/v/12345
            const vIndex = pathParts.indexOf('v');
            if (vIndex !== -1 && pathParts[vIndex + 1]) {
                return pathParts[vIndex + 1].split('?')[0];
            }
        }
    } catch (e) {
        // If URL parsing fails, try regex as fallback
    }

    // Regex fallback for various formats
    const patterns = [
        /\/video\/(\d+)/,
        /\/v\/(\d+)/,
        /video_id=(\d+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

/**
 * Resolves shortened TikTok URLs (vm.tiktok.com, vt.tiktok.com)
 */
export async function resolveTiktokUrl(url: string): Promise<string> {
    const trimmed = (url || "").trim();
    if (!trimmed) return url;

    // Strict allowlist to avoid SSRF: only resolve known TikTok short domains.
    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return url;
    }

    const host = parsed.hostname.toLowerCase();
    const allowedHosts = new Set(["vm.tiktok.com", "vt.tiktok.com", "v.tiktok.com"]);
    if (!allowedHosts.has(host)) return url;

    // Only allow http(s)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return url;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch(parsed.toString(), {
            method: "HEAD",
            redirect: "follow",
            signal: controller.signal,
        });

        // Ensure the final URL is still a TikTok domain.
        try {
            const finalUrl = new URL(response.url);
            const finalHost = finalUrl.hostname.toLowerCase();
            if (finalHost.endsWith("tiktok.com")) return response.url;
        } catch {
            // ignore
        }
        return url;
    } catch (e) {
        console.error("Error resolving TikTok URL:", e);
        return url;
    } finally {
        clearTimeout(timeout);
    }
}