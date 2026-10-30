import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPayoutDetails,
  impliedUsdInrRate,
  matchSkydoPayouts,
  parseCreditDate,
  parseMoneyMinor,
  parseSkydoPayouts,
  readPayoutDetails,
  type MatchableRequest,
} from "./skydo-payout-import";

/** Copied straight from the Skydo payouts dashboard (Oct 2026). */
const COPIED_TABLE = `Payout ID
Payee (12)
Payout status
Payout amount
Amount settled (INR)
Date of credit
UTR no.
pout_K4cpDw
GOURAV NAG
gauravnag390@gmail.com
Completed
USD 14.10
INR 1,331.47
Oct 16, 2026
628919315123
pout_XweYXb
Argho Ghosh
arghoitz71@gmail.com
Completed
USD 69.89
INR 6,599.42
Oct 16, 2026
628919312073
pout_dXhyw4
ANAND PRAMOD UPADHYAY
upadhyayanand2025@gmail.com
Completed
USD 19.40
INR 1,831.59
Oct 16, 2026
628919312483
pout_FKtEIM
MEHUL SHARMA
mehulvyas104@gmail.com
Completed
USD 19.55
INR 1,845.83
Oct 16, 2026
628919313865
pout_eCklJA
PRIYARANJAN SAHU
tikunsahu4u@gmail.com
Completed
USD 12.00
INR 1,133.12
Oct 16, 2026
628919311805
pout_YFko6B
NAMAN KUMAR
namankumar4858@gmail.com
Completed
USD 7.21
INR 680.44
Oct 16, 2026
628919311962
pout_3NETvr
Arvind Kumar
arvindkumar885825@gmail.com
In progress
USD 7.30
-
-
-
pout_zdhJTX
OM RAJESH LAHE
omlahe7@gmail.com
Completed
USD 13.17
INR 1,243.21
Oct 16, 2026
628919312237
pout_SxXqHe
ROSHAN KUMAR
rk5400694@gmail.com
Completed
USD 12.27
INR 1,158.75
Oct 16, 2026
628919314469
pout_SqwKhj
guptavishesh2
guptavishesh2@gmail.com
In progress
USD 16.90
INR 1,596.24
-
-
pout_20OdWb
Vishal Dhakad
forbenkyou257@gmail.com
Completed
USD 6.40
INR 604.52
Oct 16, 2026
628919311527
pout_4DNO01
ANJU BHATT
bhattdeepanshu639@gmail.com
Completed
USD 7.00
INR 660.51
Oct 16, 2026
628919351647`;

describe("parseMoneyMinor", () => {
  it("reads Skydo amounts", () => {
    assert.equal(parseMoneyMinor("USD 14.10"), 1410);
    assert.equal(parseMoneyMinor("INR 1,331.47"), 133147);
    assert.equal(parseMoneyMinor("₹ 680.44"), 68044);
    assert.equal(parseMoneyMinor(69.89), 6989);
    assert.equal(parseMoneyMinor("-"), null);
    assert.equal(parseMoneyMinor("abc"), null);
  });
});

describe("parseCreditDate", () => {
  it("reads the formats Skydo and ChatGPT use", () => {
    assert.equal(parseCreditDate("Oct 16, 2026"), "2026-10-16");
    assert.equal(parseCreditDate("16 Oct 2026"), "2026-10-16");
    assert.equal(parseCreditDate("2026-10-16"), "2026-10-16");
    assert.equal(parseCreditDate("Sept 3, 2026"), "2026-09-03");
    assert.equal(parseCreditDate("-"), null);
    assert.equal(parseCreditDate("yesterday"), null);
  });
});

describe("parseSkydoPayouts: copied table", () => {
  const res = parseSkydoPayouts(COPIED_TABLE);

  it("reads every row", () => {
    assert.equal(res.format, "table");
    assert.deepEqual(res.errors, []);
    assert.equal(res.payouts.length, 12);
  });

  it("reads a completed row exactly", () => {
    assert.deepEqual(res.payouts[1], {
      payoutId: "pout_XweYXb",
      name: "Argho Ghosh",
      email: "arghoitz71@gmail.com",
      status: "Completed",
      statusKey: "completed",
      payoutAmountCents: 6989,
      settledInrPaise: 659942,
      dateOfCredit: "2026-10-16",
      utr: "628919312073",
    });
  });

  it("reads in-progress rows with dashes", () => {
    const arvind = res.payouts.find((p) => p.payoutId === "pout_3NETvr")!;
    assert.equal(arvind.statusKey, "in_progress");
    assert.equal(arvind.settledInrPaise, null);
    assert.equal(arvind.dateOfCredit, null);
    assert.equal(arvind.utr, null);
    const vishesh = res.payouts.find((p) => p.payoutId === "pout_SqwKhj")!;
    assert.equal(vishesh.settledInrPaise, 159624);
    assert.equal(vishesh.utr, null);
  });

  it("accepts the same table tab-separated", () => {
    const tsv = [
      "Payout ID\tPayee (2)\tPayout status\tPayout amount\tAmount settled (INR)\tDate of credit\tUTR no.",
      'pout_K4cpDw\t"GOURAV NAG\ngauravnag390@gmail.com"\tCompleted\tUSD 14.10\tINR 1,331.47\tOct 16, 2026\t628919315123',
      'pout_3NETvr\t"Arvind Kumar\narvindkumar885825@gmail.com"\tIn progress\tUSD 7.30\t-\t-\t-',
    ].join("\n");
    const r = parseSkydoPayouts(tsv);
    assert.deepEqual(r.errors, []);
    assert.equal(r.payouts.length, 2);
    assert.equal(r.payouts[0].email, "gauravnag390@gmail.com");
    assert.equal(r.payouts[0].utr, "628919315123");
  });

  it("drops a repeated payout ID with a warning", () => {
    const twice = COPIED_TABLE + "\n" + COPIED_TABLE.split("\n").slice(7, 15).join("\n");
    const r = parseSkydoPayouts(twice);
    assert.equal(r.payouts.length, 12);
    assert.equal(r.warnings.length, 1);
  });

  it("explains when nothing looks like Skydo", () => {
    const r = parseSkydoPayouts("hello world");
    assert.equal(r.payouts.length, 0);
    assert.equal(r.errors.length, 1);
  });
});

describe("parseSkydoPayouts: JSON", () => {
  it("reads the ChatGPT prompt's shape, in a code fence", () => {
    const json =
      "```json\n" +
      JSON.stringify([
        {
          payout_id: "pout_K4cpDw",
          name: "GOURAV NAG",
          email: "GauravNag390@gmail.com ",
          status: "Completed",
          payout_amount_usd: 14.1,
          amount_settled_inr: 1331.47,
          date_of_credit: "2026-10-16",
          utr: "628919315123",
        },
        {
          payout_id: "pout_3NETvr",
          email: "arvindkumar885825@gmail.com",
          status: "In progress",
          payout_amount_usd: "USD 7.30",
          amount_settled_inr: null,
          date_of_credit: null,
          utr: null,
        },
      ]) +
      "\n```";
    const r = parseSkydoPayouts(json);
    assert.equal(r.format, "json");
    assert.deepEqual(r.errors, []);
    assert.equal(r.payouts[0].email, "gauravnag390@gmail.com");
    assert.equal(r.payouts[0].payoutAmountCents, 1410);
    assert.equal(r.payouts[1].payoutAmountCents, 730);
    assert.equal(r.payouts[1].statusKey, "in_progress");
  });

  it("reports invalid JSON", () => {
    const r = parseSkydoPayouts('[{"payout_id": "pout_x",}');
    assert.equal(r.payouts.length, 0);
    assert.match(r.errors[0], /isn't valid/);
  });

  it("reports a row without an amount", () => {
    const r = parseSkydoPayouts(
      JSON.stringify([{ payout_id: "pout_a", email: "a@b.com", status: "Completed" }]),
    );
    assert.equal(r.payouts.length, 0);
    assert.match(r.errors[0], /payout amount/);
  });
});

describe("matchSkydoPayouts", () => {
  const payouts = parseSkydoPayouts(COPIED_TABLE).payouts;
  const req = (id: string, email: string, sendCents: number, status = "approved"): MatchableRequest => ({
    id,
    email,
    sendCents,
    status,
    username: id,
  });
  const requests: MatchableRequest[] = [
    // Argho's group: 4 requests that add up to the Skydo payout.
    req("sachin", "arghoitz71@gmail.com", 1140),
    req("immortal", "arghoitz71@gmail.com", 1935),
    req("talk", "arghoitz71@gmail.com", 3268),
    req("ark", "arghoitz71@gmail.com", 646),
    req("gaurav", "GauravNag390@gmail.com", 1410),
    req("arvind", "arvindkumar885825@gmail.com", 730),
    // Mehul has a newer request that Skydo didn't pay yet.
    req("mehul1", "mehulvyas104@gmail.com", 1955),
    req("mehul2", "mehulvyas104@gmail.com", 500),
    // Already paid requests are ignored.
    req("omold", "omlahe7@gmail.com", 1317, "processed"),
  ];
  const rows = matchSkydoPayouts(payouts, requests, {
    recordedPayoutIds: new Set(["pout_SxXqHe"]),
    outsideCounts: new Map([["gauravnag390@gmail.com", 2]]),
  });
  const row = (id: string) => rows.find((r) => r.payout.payoutId === id)!;

  it("marks a whole group ready when the totals match", () => {
    const argho = row("pout_XweYXb");
    assert.equal(argho.state, "ready");
    assert.deepEqual(argho.requestIds, ["sachin", "immortal", "talk", "ark"]);
    assert.equal(argho.expectedCents, 6989);
  });

  it("matches email case-insensitively and reports requests outside the filters", () => {
    const gaurav = row("pout_K4cpDw");
    assert.equal(gaurav.state, "ready");
    assert.equal(gaurav.outsideFilterCount, 2);
  });

  it("leaves in-progress payouts alone", () => {
    assert.equal(row("pout_3NETvr").state, "not_completed");
  });

  it("flags an amount mismatch", () => {
    const mehul = row("pout_FKtEIM");
    assert.equal(mehul.state, "amount_mismatch");
    assert.match(mehul.message, /\$19\.55.*\$24\.55/);
  });

  it("reports emails with nothing approved, ignoring paid requests", () => {
    assert.equal(row("pout_zdhJTX").state, "no_match");
  });

  it("skips payout IDs already recorded", () => {
    assert.equal(row("pout_SxXqHe").state, "already_recorded");
  });

  it("matches a cut-off email when only one payee fits", () => {
    const cut = parseSkydoPayouts(
      JSON.stringify([
        { payout_id: "pout_cut", email: "arghoitz71@gma…", status: "Completed", payout_amount_usd: 69.89 },
      ]),
    ).payouts;
    const [r] = matchSkydoPayouts(cut, requests);
    assert.equal(r.state, "ready");
    assert.equal(r.partialEmail, true);
    assert.equal(r.matchedEmail, "arghoitz71@gmail.com");
  });

  it("refuses two completed payouts to one email", () => {
    const dup = parseSkydoPayouts(
      JSON.stringify([
        { payout_id: "pout_a", email: "gauravnag390@gmail.com", status: "Completed", payout_amount_usd: 14.1 },
        { payout_id: "pout_b", email: "gauravnag390@gmail.com", status: "Completed", payout_amount_usd: 14.1 },
      ]),
    ).payouts;
    const res = matchSkydoPayouts(dup, requests);
    assert.deepEqual(res.map((r) => r.state), ["duplicate_email", "duplicate_email"]);
  });
});

describe("payout details", () => {
  it("builds and reads back the stored object", () => {
    const [p] = parseSkydoPayouts(COPIED_TABLE).payouts;
    const d = buildPayoutDetails(p, {
      groupRequestCount: 1,
      source: "import",
      recordedBy: "admin-1",
      now: new Date("2026-10-16T15:20:00Z"),
    });
    assert.equal(d.payout_amount_usd, 14.1);
    assert.equal(d.amount_settled_inr, 1331.47);
    assert.equal(d.recorded_at, "2026-10-16T15:20:00.000Z");
    const back = readPayoutDetails(JSON.parse(JSON.stringify(d)));
    assert.deepEqual(back, d);
    assert.equal(impliedUsdInrRate(d), 94.43);
  });

  it("ignores junk", () => {
    assert.equal(readPayoutDetails(null), null);
    assert.equal(readPayoutDetails("x"), null);
    assert.equal(readPayoutDetails([]), null);
  });
});
