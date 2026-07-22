export type OpportunitiesListQueryParams = {
  tab: string;
  sort: string;
  page: number;
  limit: number;
  platform: string;
  contestType: string;
  mediaType: string;
  search: string;
  userCountries?: string[];
  /** When true, server returns only contests the creator passes gates for. */
  eligibleOnly?: boolean;
};

export function buildOpportunitiesListQueryKey(
  params: OpportunitiesListQueryParams,
): string {
  const urlParams = new URLSearchParams({
    tab: params.tab,
    sort: params.sort,
    page: String(params.page),
    limit: String(params.limit),
    platform: params.platform,
    contestType: params.contestType,
    mediaType: params.mediaType,
    search: params.search,
  });
  if (params.userCountries && params.userCountries.length > 0) {
    urlParams.set("countries", params.userCountries.join(","));
  }
  if (params.eligibleOnly) {
    urlParams.set("eligibleOnly", "1");
  }
  return urlParams.toString();
}
