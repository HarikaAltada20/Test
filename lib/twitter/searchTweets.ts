import { rapidApiHost, rapidApiRequest } from "./rapidApiClient";

export type TwitterSearchType =
  | "Top"
  | "Latest"
  | "People"
  | "Photos"
  | "Videos";

export async function searchTweets(
  query: string,
  searchType: TwitterSearchType = "Top"
): Promise<any> {
  const response = await rapidApiRequest({
    method: "GET",
    url: `https://${rapidApiHost}/search.php`,
    params: {
      query,
      search_type: searchType,
    },
  });

  return response.data;
}
