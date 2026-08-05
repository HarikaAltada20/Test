import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMediaItemFromWebInfoResponse,
  normalizeMediaToLegacyGraphQL,
  type InstagramMediaItem,
  type InstagramWebInfoResponse,
} from "./graphql";

describe("normalizeMediaToLegacyGraphQL", () => {
  it("treats media_type 2 as video", () => {
    const media: InstagramMediaItem = {
      media_type: 2,
      video_versions: [{ url: "https://cdn.example/v.mp4" }],
      code: "abc",
    };
    const data = normalizeMediaToLegacyGraphQL(media);
    assert.equal(data.xdt_shortcode_media.is_video, true);
    assert.equal(data.xdt_shortcode_media.video_url, "https://cdn.example/v.mp4");
  });

  it("treats non-2 media_type with video_versions as video", () => {
    const media: InstagramMediaItem = {
      media_type: 8,
      video_versions: [{ url: "https://cdn.example/reel.mp4" }],
      code: "reel1",
    };
    const data = normalizeMediaToLegacyGraphQL(media);
    assert.equal(data.xdt_shortcode_media.is_video, true);
    assert.equal(
      data.xdt_shortcode_media.video_url,
      "https://cdn.example/reel.mp4",
    );
  });

  it("does not treat photo-only media as video", () => {
    const media: InstagramMediaItem = {
      media_type: 1,
      image_versions2: { candidates: [{ url: "https://cdn.example/p.jpg" }] },
    };
    const data = normalizeMediaToLegacyGraphQL(media);
    assert.equal(data.xdt_shortcode_media.is_video, false);
    assert.equal(data.xdt_shortcode_media.video_url, "");
  });
});

describe("getMediaItemFromWebInfoResponse", () => {
  it("prefers an item with a video URL over a leading photo", () => {
    const payload: InstagramWebInfoResponse = {
      data: {
        xdt_api__v1__media__shortcode__web_info: {
          items: [
            {
              media_type: 1,
              image_versions2: {
                candidates: [{ url: "https://cdn.example/p.jpg" }],
              },
            },
            {
              media_type: 2,
              video_versions: [{ url: "https://cdn.example/v.mp4" }],
              code: "vid",
            },
          ],
        },
      },
    };
    const item = getMediaItemFromWebInfoResponse(payload);
    assert.equal(item?.code, "vid");
    assert.equal(item?.video_versions?.[0]?.url, "https://cdn.example/v.mp4");
  });
});
