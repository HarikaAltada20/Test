/** Shown when contest-detail client paging stops before every row is loaded. */
export const CONTEST_SUBMISSIONS_HYDRATE_ERROR =
  "Could not load all contest submissions. Retry before bulk verify, pay, download, or export.";

export type ContestSubmissionsHydrateFinish = {
  cancelled: boolean;
  aborted: boolean;
  pageFailed: boolean;
};

export type ContestSubmissionsHydrateOutcome = {
  fullyHydrated: boolean;
  error: string | null;
};

/**
 * Incomplete paging must not be treated as a full load.
 * Abort/unmount leaves hydration unfinished without a user-facing error.
 */
export function finishContestSubmissionsHydrate(
  input: ContestSubmissionsHydrateFinish,
): ContestSubmissionsHydrateOutcome {
  if (input.cancelled || input.aborted) {
    return { fullyHydrated: false, error: null };
  }
  if (input.pageFailed) {
    return {
      fullyHydrated: false,
      error: CONTEST_SUBMISSIONS_HYDRATE_ERROR,
    };
  }
  return { fullyHydrated: true, error: null };
}
