import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TOKEN_REFRESH_INTERVAL_MS,
  getAccountRefreshAnchorMs,
  isCreatorDueForWeeklyTokenRefresh,
  isPlatformAccountDueForWeeklyRefresh,
  resolveConnectedAt,
  withWeeklyRefreshTimestamps,
} from "./token-refresh-eligibility";

describe("token-refresh-eligibility", () => {
  const connectedAt = "2026-08-01T06:00:00.000Z";
  const day0 = new Date(connectedAt);
  const day6 = new Date(day0.getTime() + 6 * 24 * 60 * 60 * 1000);
  const day7 = new Date(day0.getTime() + TOKEN_REFRESH_INTERVAL_MS);
  const day8 = new Date(day0.getTime() + 8 * 24 * 60 * 60 * 1000);

  it("is not due until 7 days after connected_at", () => {
    const account = { connected_at: connectedAt };
    assert.equal(isPlatformAccountDueForWeeklyRefresh(account, day0), false);
    assert.equal(isPlatformAccountDueForWeeklyRefresh(account, day6), false);
    assert.equal(isPlatformAccountDueForWeeklyRefresh(account, day7), true);
    assert.equal(isPlatformAccountDueForWeeklyRefresh(account, day8), true);
  });

  it("prefers next_details_refresh_at when present", () => {
    const account = {
      connected_at: connectedAt,
      last_details_refresh_at: connectedAt,
      next_details_refresh_at: "2026-08-10T06:00:00.000Z",
    };
    assert.equal(
      isPlatformAccountDueForWeeklyRefresh(
        account,
        new Date("2026-08-09T06:00:00.000Z"),
      ),
      false,
    );
    assert.equal(
      isPlatformAccountDueForWeeklyRefresh(
        account,
        new Date("2026-08-10T06:00:00.000Z"),
      ),
      true,
    );
  });

  it("uses last_details_refresh_at as the cadence anchor after a successful run", () => {
    const refreshedAt = "2026-08-08T06:00:00.000Z";
    const account = {
      connected_at: connectedAt,
      last_details_refresh_at: refreshedAt,
    };
    assert.equal(
      isPlatformAccountDueForWeeklyRefresh(
        account,
        new Date("2026-08-14T05:59:59.000Z"),
      ),
      false,
    );
    assert.equal(
      isPlatformAccountDueForWeeklyRefresh(
        account,
        new Date("2026-08-15T06:00:00.000Z"),
      ),
      true,
    );
  });

  it("falls back to updated_at / last_synced_at for legacy accounts", () => {
    assert.equal(
      getAccountRefreshAnchorMs({ updated_at: connectedAt }),
      Date.parse(connectedAt),
    );
    assert.equal(
      getAccountRefreshAnchorMs({ last_synced_at: connectedAt }),
      Date.parse(connectedAt),
    );
    assert.equal(
      isPlatformAccountDueForWeeklyRefresh(
        { updated_at: connectedAt },
        day7,
      ),
      true,
    );
  });

  it("treats accounts with no timestamps as due (backfill)", () => {
    assert.equal(isPlatformAccountDueForWeeklyRefresh({}, day0), true);
    assert.equal(isPlatformAccountDueForWeeklyRefresh(null, day0), false);
  });

  it("marks creator due if any platform is due", () => {
    assert.equal(
      isCreatorDueForWeeklyTokenRefresh(
        {
          tiktok_account: { connected_at: connectedAt },
          instagram_account: null,
          youtube_account: null,
        },
        day6,
      ),
      false,
    );
    assert.equal(
      isCreatorDueForWeeklyTokenRefresh(
        {
          tiktok_account: { connected_at: connectedAt },
          instagram_account: {
            connected_at: "2026-07-01T00:00:00.000Z",
          },
          youtube_account: null,
        },
        day0,
      ),
      true,
    );
  });

  it("preserves existing connected_at", () => {
    assert.equal(
      resolveConnectedAt({ connected_at: connectedAt }, day8),
      connectedAt,
    );
    const stamped = withWeeklyRefreshTimestamps(
      { username: "x", connected_at: connectedAt },
      day7,
    );
    assert.equal(stamped.connected_at, connectedAt);
    assert.equal(stamped.last_details_refresh_at, day7.toISOString());
    assert.equal(
      stamped.next_details_refresh_at,
      new Date(day7.getTime() + TOKEN_REFRESH_INTERVAL_MS).toISOString(),
    );
  });
});
