import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

const DEFAULT_RAPIDAPI_HOST = "twitter-api45.p.rapidapi.com";
const RAPIDAPI_HOST =
  (
    process.env.RAPIDAPI_HOST ||
    process.env.TWITTER_RAPIDAPI_HOST ||
    DEFAULT_RAPIDAPI_HOST
  )?.trim() || DEFAULT_RAPIDAPI_HOST;

const KEY_DELIMITER = /[\s,;]+/;

const parseKeys = (value?: string) =>
  value
    ? value
        .split(KEY_DELIMITER)
        .map((key) => key.trim())
        .filter(Boolean)
    : [];

const explicitKeys = parseKeys(process.env.TWITTER_RAPIDAPI_KEYS);
const legacyKeys = parseKeys(process.env.RAPIDAPI_KEYS);
const fallbackSingleKey = (
  process.env.TWITTER_RAPIDAPI_KEY ||
  process.env.RAPIDAPI_KEY ||
  ""
).trim();

const combinedKeys = [...explicitKeys, ...legacyKeys];
if (fallbackSingleKey) {
  combinedKeys.push(fallbackSingleKey);
}

const RAPIDAPI_KEYS = Array.from(new Set(combinedKeys)).filter(Boolean);

if (RAPIDAPI_KEYS.length === 0) {
  console.warn(
    "[rapidApiClient] No RapidAPI keys configured (TWITTER_RAPIDAPI_KEYS / RAPIDAPI_KEYS / TWITTER_RAPIDAPI_KEY / RAPIDAPI_KEY)"
  );
}

let rotationIndex = 0;

const isRateLimitError = (error: unknown) => {
  const status =
    (error as any)?.response?.status ?? (error as any)?.status ?? null;
  if (status === 429 || status === 403) {
    return true;
  }

  const message =
    ((error as any)?.response?.data?.message || (error as any)?.message || "")
      ?.toString()
      ?.toLowerCase() || "";
  return (
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("exceeded")
  );
};

export const rapidApiHost = RAPIDAPI_HOST;
export const hasRapidApiKeys = RAPIDAPI_KEYS.length > 0;

export async function rapidApiRequest<T = any>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  if (RAPIDAPI_KEYS.length === 0) {
    throw new Error(
      "No RapidAPI keys configured. Please set TWITTER_RAPIDAPI_KEYS or TWITTER_RAPIDAPI_KEY."
    );
  }

  const headers = { ...(config.headers || {}) };
  let lastError: unknown;
  let keyIndex = rotationIndex;
  let attempts = 0;

  while (attempts < RAPIDAPI_KEYS.length) {
    const apiKey = RAPIDAPI_KEYS[keyIndex];
    const requestHeaders = {
      ...headers,
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": apiKey,
    };

    try {
      const response = await axios.request<T>({
        ...config,
        headers: requestHeaders,
      });
      rotationIndex = keyIndex;
      return response;
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error)) {
        console.warn(
          `[rapidApiClient] RapidAPI key #${keyIndex} rate-limited; trying next key`
        );
        attempts++;
        keyIndex = (keyIndex + 1) % RAPIDAPI_KEYS.length;
        rotationIndex = keyIndex;
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("RapidAPI request failed without a response");
}
