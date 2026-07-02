"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type ContestCreatorRequirements,
  type CreatorRequirementsSnapshot,
  type RequirementCheckItem,
  type RequirementFailure,
  buildRequirementChecklist,
  hasAnyContestCreatorRequirement,
  parseContestCreatorRequirements,
} from "@/lib/creator-requirements";

export function useCreatorContestEligibility(
  contestId: string | null | undefined,
  contest: ContestCreatorRequirements | null | undefined,
) {
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [items, setItems] = useState<RequirementCheckItem[]>([]);
  const [failures, setFailures] = useState<RequirementFailure[]>([]);
  const [snapshot, setSnapshot] = useState<CreatorRequirementsSnapshot | null>(
    null,
  );

  const hasRequirements =
    contest != null && hasAnyContestCreatorRequirement(contest);

  const refresh = useCallback(async () => {
    if (!contestId || !contest || !hasRequirements) {
      setItems([]);
      setFailures([]);
      setSnapshot(null);
      setFetchFailed(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchFailed(false);
    try {
      const res = await fetch("/api/creators/stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contestId }),
      });
      if (!res.ok) {
        setFetchFailed(true);
        setItems([]);
        setFailures([]);
        setSnapshot(null);
        return;
      }

      const data = await res.json();
      const requirements = parseContestCreatorRequirements(contest);
      const snap = data.snapshot as CreatorRequirementsSnapshot;
      setSnapshot(snap);
      setFailures((data.failures as RequirementFailure[]) ?? []);
      setItems(buildRequirementChecklist({ requirements, snapshot: snap }));
    } catch {
      setFetchFailed(true);
      setItems([]);
      setFailures([]);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [contestId, contest, hasRequirements]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const failingItems = items.filter((item) => !item.passed);
  const isBlocked =
    hasRequirements && (loading || fetchFailed || failingItems.length > 0);

  return {
    loading,
    fetchFailed,
    hasRequirements,
    items,
    failures,
    failingItems,
    snapshot,
    isBlocked,
    refresh,
  };
}
