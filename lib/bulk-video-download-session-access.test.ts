import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allSubmissionsBelongToContest,
  collectSessionSubmissionIds,
  scopeItemStatusesToJob,
  scopeZipPartsToJob,
  tooManySessionSubmissions,
} from "./bulk-video-download-session-access";
import { MAX_BULK_VIDEO_DOWNLOAD_SESSION_SUBMISSIONS } from "./queue/bulk-job-limits";
import { submissionOwnedByDownloadUser } from "./video-download-auth";

const advertiser = {
  id: "brand-1",
  email: "brand@example.com",
  user_type: "advertiser" as const,
};
const admin = {
  id: "admin-1",
  email: "admin@example.com",
  user_type: "admin" as const,
};

describe("collectSessionSubmissionIds", () => {
  it("unions top-level and ZIP-part IDs without duplicates", () => {
    assert.deepEqual(
      collectSessionSubmissionIds(["a", "b"], [
        { submissionIds: ["b", "c"] },
        { submissionIds: ["a", "d"] },
      ]),
      ["a", "b", "c", "d"],
    );
  });
});

describe("allSubmissionsBelongToContest", () => {
  it("rejects empty requests and IDs missing from the contest", () => {
    assert.equal(allSubmissionsBelongToContest([], ["a"]), false);
    assert.equal(allSubmissionsBelongToContest(["a", "stolen"], ["a", "b"]), false);
  });

  it("accepts only when every requested ID is on the contest", () => {
    assert.equal(
      allSubmissionsBelongToContest(["b", "a"], ["a", "b", "c"]),
      true,
    );
  });
});

describe("scopeItemStatusesToJob / scopeZipPartsToJob", () => {
  it("drops statuses and ZIP-part IDs that are not on the job", () => {
    const allowed = ["keep-1", "keep-2"];
    const statuses = scopeItemStatusesToJob(
      [
        { submissionId: "keep-1", status: "success" },
        { submissionId: "stolen", status: "success" },
      ],
      allowed,
    );
    assert.deepEqual(
      statuses.map((row) => row.submissionId),
      ["keep-1"],
    );

    const parts = scopeZipPartsToJob(
      [
        {
          jobId: "z1",
          zipPartIndex: 1,
          zipPartTotal: 1,
          zipFilename: "a.zip",
          submissionIds: ["keep-2", "stolen"],
        },
      ],
      allowed,
    );
    assert.deepEqual(parts[0].submissionIds, ["keep-2"]);
  });
});

describe("contest ownership for download sessions", () => {
  it("lets advertisers use only their contest and admins use any", () => {
    assert.equal(submissionOwnedByDownloadUser(advertiser, "brand-1"), true);
    assert.equal(submissionOwnedByDownloadUser(advertiser, "other-brand"), false);
    assert.equal(submissionOwnedByDownloadUser(admin, "other-brand"), true);
  });
});

describe("tooManySessionSubmissions", () => {
  it("caps session size", () => {
    assert.equal(tooManySessionSubmissions(2), false);
    assert.equal(
      tooManySessionSubmissions(MAX_BULK_VIDEO_DOWNLOAD_SESSION_SUBMISSIONS + 1),
      true,
    );
  });
});
