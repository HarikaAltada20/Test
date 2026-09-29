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
  const envCheck = {
    TWITTER_RAPIDAPI_KEYS: process.env.TWITTER_RAPIDAPI_KEYS ? "set" : "not set",
    RAPIDAPI_KEYS: process.env.RAPIDAPI_KEYS ? "set" : "not set",
    TWITTER_RAPIDAPI_KEY: process.env.TWITTER_RAPIDAPI_KEY ? "set" : "not set",
    RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ? "set" : "not set",
    NODE_ENV: process.env.NODE_ENV || "not set",
  };
  
  console.error(
    "[rapidApiClient] No RapidAPI keys configured. Environment check:",
    envCheck
  );
  console.error(
    "[rapidApiClient] Please set one of: TWITTER_RAPIDAPI_KEYS, RAPIDAPI_KEYS, TWITTER_RAPIDAPI_KEY, or RAPIDAPI_KEY"
  );
}

let rotationIndex = 0;

/**
 * Check if error is a subscription error (API key not subscribed to the API)
 */
const isSubscriptionError = (error: unknown): boolean => {
  const status =
    (error as any)?.response?.status ?? (error as any)?.status ?? null;
  
  // Subscription errors typically return 403
  if (status !== 403) {
    return false;
  }

  const message =
    ((error as any)?.response?.data?.message || (error as any)?.message || "")
      ?.toString()
      ?.toLowerCase() || "";
  
  return (
    message.includes("not subscribed") ||
    message.includes("subscription") ||
    message.includes("not authorized to access") ||
    message.includes("you are not subscribed")
  );
};

/**
 * Check if error is a rate limit error (quota exceeded, too many requests)
 */
const isRateLimitError = (error: unknown): boolean => {
  // Don't treat subscription errors as rate limits
  if (isSubscriptionError(error)) {
    return false;
  }

  const status =
    (error as any)?.response?.status ?? (error as any)?.status ?? null;
  
  // Only 429 is a true rate limit error
  // 403 can be subscription or auth issues, so we check the message
  if (status === 429) {
    return true;
  }

  const message =
    ((error as any)?.response?.data?.message || (error as any)?.message || "")
      ?.toString()
      ?.toLowerCase() || "";
  
  return (
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("exceeded") ||
    message.includes("too many requests")
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
  const timeoutMs = Number(process.env.RAPIDAPI_TIMEOUT_MS ?? 30000);

  while (attempts < RAPIDAPI_KEYS.length) {
    const apiKey = RAPIDAPI_KEYS[keyIndex];
    const requestHeaders = {
      ...headers,
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": apiKey,
    };

    try {
      // Ensure URL is properly formatted using WHATWG URL API
      let url = config.url;
      if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL in rapidApiRequest config');
      }

      // If params are provided, construct URL with query string using WHATWG URL API
      if (config.params && Object.keys(config.params).length > 0) {
        try {
          const urlObj = new URL(url);
          Object.entries(config.params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              urlObj.searchParams.append(key, String(value));
            }
          });
          url = urlObj.toString();
        } catch (urlError: any) {
          throw new Error(`Failed to construct URL with params: ${urlError?.message}`);
        }
      }

      // Create request config without params (since we've added them to URL)
      const { params, ...requestConfig } = config;
      
      const response = await axios.request<T>({
        ...requestConfig,
        url,
        headers: requestHeaders,
        // Prevent requests from hanging indefinitely (RapidAPI sometimes stalls).
        timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
      });
      rotationIndex = keyIndex;
      return response;
    } catch (error: any) {
      lastError = error;
      
      // Enhanced error logging
      if (error?.response) {
        const errorMessage = error.response.data?.message || error.response.statusText;
        console.error(`[rapidApiClient] RapidAPI request failed:`, {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          url: config.url,
          keyIndex,
          errorMessage,
        });
      } else if (error?.request) {
        console.error(`[rapidApiClient] RapidAPI request failed (no response):`, {
          message: error.message,
          code: error.code,
          url: config.url,
          keyIndex,
        });
      } else {
        console.error(`[rapidApiClient] RapidAPI request error:`, {
          message: error?.message,
          stack: error?.stack,
          url: config.url,
          keyIndex,
        });
      }
      
      // Don't retry on subscription errors - fail immediately
      // 403 "not subscribed" is usually tied to the specific RapidAPI key/account.
      // Rotate through all configured keys before failing (same idea as 429).
      if (isSubscriptionError(error)) {
        attempts++;
        if (attempts >= RAPIDAPI_KEYS.length) {
          console.error(
            `[rapidApiClient] All ${RAPIDAPI_KEYS.length} RapidAPI key(s) returned subscription/auth 403 for this API. Subscribe at https://rapidapi.com or add a subscribed key.`
          );
          throw error;
        }
        console.warn(
          `[rapidApiClient] RapidAPI key #${keyIndex} subscription/auth error; trying next key`
        );
        keyIndex = (keyIndex + 1) % RAPIDAPI_KEYS.length;
        rotationIndex = keyIndex;
        continue;
      }

      // Retry on rate limits and network timeouts (try next key).
      if (isRateLimitError(error)) {
        console.warn(
          `[rapidApiClient] RapidAPI key #${keyIndex} rate-limited; trying next key`
        );
        attempts++;
        keyIndex = (keyIndex + 1) % RAPIDAPI_KEYS.length;
        rotationIndex = keyIndex;
        continue;
      }

      const message = (error as any)?.message ? String((error as any).message) : "";
      const isTimeout =
        (error as any)?.code === "ECONNABORTED" ||
        (error as any)?.code === "ETIMEDOUT" ||
        message.toLowerCase().includes("timeout");

      if (isTimeout) {
        console.warn(
          `[rapidApiClient] RapidAPI request timed out; trying next key (keyIndex=${keyIndex})`
        );
        attempts++;
        keyIndex = (keyIndex + 1) % RAPIDAPI_KEYS.length;
        rotationIndex = keyIndex;
        continue;
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }

  throw lastError ?? new Error("RapidAPI request failed without a response");
}
