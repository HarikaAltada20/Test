import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchAllRows, READ_PAGE_SIZE } from "./supabase-paging";

function fakeTable(total: number, cap = READ_PAGE_SIZE) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const build = () => ({
    range: async (from: number, to: number) => {
      calls.push([from, to]);
      return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null };
    },
  });
  return { build, calls };
}

test("reads past the 1,000-row response cap", async () => {
  const { build, calls } = fakeTable(2500);
  const rows = await fetchAllRows(build);
  assert.equal(rows.length, 2500);
  assert.equal(rows[2499].id, 2499);
  assert.deepEqual(calls, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

test("exact multiple of the page size stops after one empty page", async () => {
  const { build, calls } = fakeTable(2000);
  assert.equal((await fetchAllRows(build)).length, 2000);
  assert.equal(calls.length, 3);
});

test("empty table makes one request", async () => {
  const { build, calls } = fakeTable(0);
  assert.deepEqual(await fetchAllRows(build), []);
  assert.equal(calls.length, 1);
});

test("errors are thrown", async () => {
  const boom = new Error("boom");
  await assert.rejects(
    fetchAllRows(() => ({ range: async () => ({ data: null, error: boom }) })),
    boom,
  );
});
