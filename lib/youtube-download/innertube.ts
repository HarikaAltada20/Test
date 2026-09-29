import { Readable } from "stream";

export type InnertubeStreamResult = {
  stream: ReadableStream<Uint8Array>;
  contentLength: string | null;
};

type InnertubeModule = typeof import("youtubei.js");

let innertubePromise: Promise<InstanceType<InnertubeModule["Innertube"]>> | null =
  null;

async function getAndroidInnertube(): Promise<
  InstanceType<InnertubeModule["Innertube"]>
> {
  if (!innertubePromise) {
    innertubePromise = (async () => {
      const { Innertube, ClientType } = await import("youtubei.js");
      return Innertube.create({
        client_type: ClientType.ANDROID,
        retrieve_player: true,
        generate_session_locally: true,
      });
    })();
  }
  try {
    return await innertubePromise;
  } catch (error) {
    innertubePromise = null;
    throw error;
  }
}

function toWebStream(stream: unknown): ReadableStream<Uint8Array> {
  if (stream instanceof ReadableStream) {
    return stream as ReadableStream<Uint8Array>;
  }
  if (stream && typeof (stream as { getReader?: unknown }).getReader === "function") {
    return stream as ReadableStream<Uint8Array>;
  }
  if (stream instanceof Readable) {
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }
  return Readable.toWeb(Readable.from(stream as AsyncIterable<Uint8Array>)) as ReadableStream<Uint8Array>;
}

const DOWNLOAD_ATTEMPTS: Array<{
  type: "video+audio";
  quality: "best";
  format?: string;
  client: string;
}> = [
  { type: "video+audio", quality: "best", format: "mp4", client: "ANDROID" },
  { type: "video+audio", quality: "best", client: "ANDROID" },
];

/**
 * Extract and download from the same IP via YouTube InnerTube (ANDROID).
 * RapidAPI googlevideo URLs are bound to RapidAPI's IP and 403 from ours.
 */
export async function getYouTubeVideoStreamViaInnertube(
  videoId: string
): Promise<InnertubeStreamResult> {
  const yt = await getAndroidInnertube();
  let lastError: unknown;

  for (const options of DOWNLOAD_ATTEMPTS) {
    try {
      const downloaded = await yt.download(videoId, options as never);
      const stream = toWebStream(downloaded);
      return { stream, contentLength: null };
    } catch (error) {
      lastError = error;
      console.warn(
        `[YTStream] InnerTube ${options.client} ${options.format || "any"} failed for ${videoId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError || "unknown");
  throw new Error(`InnerTube download failed for ${videoId}: ${message}`);
}
