import axios from "axios";

const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

if (!RAPIDAPI_HOST) {
  console.warn("[twitter/searchTweets] RAPIDAPI_HOST is not configured");
}

if (!RAPIDAPI_KEY) {
  console.warn("[twitter/searchTweets] RAPIDAPI_KEY is not configured");
}

export type TwitterSearchType = "Top" | "Latest" | "People" | "Photos" | "Videos";

export async function searchTweets(
  query: string,
  searchType: TwitterSearchType = "Top"
): Promise<any> {
  if (!RAPIDAPI_KEY || !RAPIDAPI_HOST) {
    throw new Error("RAPIDAPI_HOST / RAPIDAPI_KEY are not configured");
  }

  const response = await axios.request({
    method: "GET",
    url: `https://${RAPIDAPI_HOST}/search.php`,
    params: {
      query,
      search_type: searchType,
    },
    headers: {
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": RAPIDAPI_KEY,
    },
  });

  return response.data;
}
