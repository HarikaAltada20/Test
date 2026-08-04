import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickBestDownloadUrl } from "./ytstream";

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
