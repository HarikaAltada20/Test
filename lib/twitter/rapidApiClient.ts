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
      if (isSubscriptionError(error)) {
        console.error(
          `[rapidApiClient] RapidAPI key #${keyIndex} subscription error - API key not subscribed to Twitter API. Not retrying.`
        );
        throw error;
      }
      
      // Only retry on rate limit errors
      if (isRateLimitError(error)) {
        console.warn(
          `[rapidApiClient] RapidAPI key #${keyIndex} rate-limited; trying next key`
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
