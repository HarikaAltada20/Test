import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isGoogleVideoUrl,
  pickBestDownloadUrl,
  pickDownloadCandidates,
  resolveCgeoParam,
  userAgentForStreamUrl,
} from "./ytstream";

describe("pickBestDownloadUrl", () => {
  it("prefers highest muxed MP4 from progressive formats", () => {
    const url = pickBestDownloadUrl({
      formats: [
        {
          url: "https://cdn.example/low.mp4",
          mimeType: "video/mp4",
          qualityLabel: "360p",
          height: 360,
        },
        {
          url: "https://cdn.example/high.mp4",
          mimeType: "video/mp4",
          qualityLabel: "720p",
          height: 720,
        },
        {
          url: "https://cdn.example/webm",
          mimeType: "video/webm",
          qualityLabel: "1080p",
          height: 1080,
        },
      ],
    });
    assert.equal(url, "https://cdn.example/high.mp4");
  });

  it("falls back to non-MP4 progressive when no MP4 exists", () => {
    const url = pickBestDownloadUrl({
      formats: [
        {
          url: "https://cdn.example/a.webm",
          mimeType: "video/webm",
          qualityLabel: "480p",
          height: 480,
        },
      ],
    });
    assert.equal(url, "https://cdn.example/a.webm");
  });

  it("does not use adaptive video-only streams", () => {
    const url = pickBestDownloadUrl({
      formats: [],
      adaptiveFormats: [
        {
          url: "https://cdn.example/video-only.mp4",
          mimeType: "video/mp4",
          qualityLabel: "1080p",
          height: 1080,
        },
        {
          url: "https://cdn.example/audio-only.m4a",
          mimeType: "audio/mp4",
          audioQuality: "AUDIO_QUALITY_MEDIUM",
        },
      ],
    });
    assert.equal(url, null);
  });

  it("ignores adaptive when a progressive muxed URL exists", () => {
    const url = pickBestDownloadUrl({
      formats: [
        {
          url: "https://cdn.example/muxed.mp4",
          mimeType: "video/mp4",
          qualityLabel: "360p",
          height: 360,
        },
      ],
      adaptiveFormats: [
        {
          url: "https://cdn.example/video-only.mp4",
          mimeType: "video/mp4",
          qualityLabel: "1080p",
          height: 1080,
        },
      ],
    });
    assert.equal(url, "https://cdn.example/muxed.mp4");
  });
});

describe("pickDownloadCandidates", () => {
  it("returns unique URLs ranked by muxed MP4 quality", () => {
    const urls = pickDownloadCandidates({
      formats: [
        {
          url: "https://rr1---sn.googlevideo.com/videoplayback?itag=18",
          mimeType: "video/mp4",
          qualityLabel: "360p",
          height: 360,
        },
        {
          url: "https://rr1---sn.googlevideo.com/videoplayback?itag=22",
          mimeType: "video/mp4",
          qualityLabel: "720p",
          height: 720,
        },
        {
          url: "https://rr1---sn.googlevideo.com/videoplayback?itag=22",
          mimeType: "video/mp4",
          qualityLabel: "720p",
          height: 720,
        },
      ],
    });
    assert.deepEqual(urls, [
      "https://rr1---sn.googlevideo.com/videoplayback?itag=22",
      "https://rr1---sn.googlevideo.com/videoplayback?itag=18",
    ]);
  });

  it("inserts a proxied URL as the second candidate after the best direct URL", () => {
    const urls = pickDownloadCandidates({
      formats: [
        {
          url: "https://rr1---sn.googlevideo.com/videoplayback?itag=22",
          mimeType: "video/mp4",
          qualityLabel: "720p",
          height: 720,
        },
        {
          url: "https://proxy.ytjar.info/dl/360.mp4",
          mimeType: "video/mp4",
          qualityLabel: "360p",
          height: 360,
        },
        {
          url: "https://rr1---sn.googlevideo.com/videoplayback?itag=18",
          mimeType: "video/mp4",
          qualityLabel: "360p",
          height: 360,
        },
      ],
    });
    assert.equal(urls[0], "https://rr1---sn.googlevideo.com/videoplayback?itag=22");
    assert.equal(urls[1], "https://proxy.ytjar.info/dl/360.mp4");
    assert.equal(urls[2], "https://rr1---sn.googlevideo.com/videoplayback?itag=18");
  });
});

describe("userAgentForStreamUrl", () => {
  it("uses an Android client UA for ANDROID stream URLs", () => {
    const ua = userAgentForStreamUrl(
      "https://rr1.googlevideo.com/videoplayback?c=ANDROID_TESTSUITE&itag=18"
    );
    assert.match(ua, /com\.google\.android\.youtube/);
  });

  it("uses an iOS client UA for IOS stream URLs", () => {
    const ua = userAgentForStreamUrl(
      "https://rr1.googlevideo.com/videoplayback?c=IOS&itag=18"
    );
    assert.match(ua, /com\.google\.ios\.youtube/);
  });

  it("uses Chrome for WEB / missing client", () => {
    const ua = userAgentForStreamUrl(
      "https://rr1.googlevideo.com/videoplayback?c=WEB&itag=18"
    );
    assert.match(ua, /Chrome\//);
  });
});

describe("resolveCgeoParam", () => {
  it("omits cgeo by default so YTStream can return proxied links", () => {
    assert.equal(resolveCgeoParam(undefined), null);
    assert.equal(resolveCgeoParam(""), null);
  });

  it("uses an explicit env value unless omitCgeo is set", () => {
    assert.equal(resolveCgeoParam("US"), "US");
    assert.equal(resolveCgeoParam("US", true), null);
  });
});

describe("isGoogleVideoUrl", () => {
  it("detects googlevideo CDN hosts", () => {
    assert.equal(
      isGoogleVideoUrl("https://rr3---sn-abc.googlevideo.com/videoplayback?id=1"),
      true
    );
    assert.equal(isGoogleVideoUrl("https://proxy.ytjar.info/dl/1.mp4"), false);
  });
});

describe("InnerTube fallback module", () => {
  it("exports a same-IP download helper", async () => {
    const { getYouTubeVideoStreamViaInnertube } = await import("./innertube");
    assert.equal(typeof getYouTubeVideoStreamViaInnertube, "function");
  });
});
