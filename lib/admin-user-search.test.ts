import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectScopeShortcut,
  normalizeSearchTerm,
  parseUserSearchParams,
  redactSecrets,
} from "./admin-user-search";

test("detectScopeShortcut maps prefixes to scopes", () => {
  assert.deepEqual(detectScopeShortcut("@bbl"), { scope: "username", rest: "bbl" });
  assert.deepEqual(detectScopeShortcut("Email: a@b.com"), {
    scope: "email",
    rest: "a@b.com",
  });
  assert.deepEqual(detectScopeShortcut("name:Raj"), { scope: "name", rest: "Raj" });
  assert.deepEqual(detectScopeShortcut("id:df33"), { scope: "id", rest: "df33" });
  assert.deepEqual(detectScopeShortcut("#df33"), { scope: "id", rest: "df33" });
});

test("detectScopeShortcut ignores @ inside an email", () => {
  assert.equal(detectScopeShortcut("raj@gmail.com"), null);
  assert.equal(detectScopeShortcut("bbl"), null);
});

test("normalizeSearchTerm per scope", () => {
  assert.equal(normalizeSearchTerm("username", "  @@flavor "), "flavor");
  assert.equal(normalizeSearchTerm("id", "#DF33B1"), "df33b1");
  assert.equal(normalizeSearchTerm("all", "x".repeat(150)).length, 100);
});

test("parseUserSearchParams defaults and validation", () => {
  assert.deepEqual(parseUserSearchParams({ q: "bbl", scope: null, type: null }), {
    ok: true,
    scope: "all",
    type: "all",
    term: "bbl",
  });
  assert.equal(parseUserSearchParams({ q: "b", scope: "all", type: null }).ok, false);
  assert.equal(parseUserSearchParams({ q: "df3", scope: "id", type: null }).ok, false);
  assert.equal(parseUserSearchParams({ q: "zzzz", scope: "id", type: null }).ok, false);
  assert.equal(parseUserSearchParams({ q: "df33", scope: "id", type: null }).ok, true);
  assert.equal(parseUserSearchParams({ q: "abc", scope: "phone", type: null }).ok, false);
  assert.equal(parseUserSearchParams({ q: "abc", scope: null, type: "admin" }).ok, false);
});

test("redactSecrets hides token-like keys at any depth", () => {
  const input = {
    youtube_account: {
      channel_title: "FlavorZen",
      access_token: "ya29.x",
      refresh_token: "1//y",
      nested: [{ client_secret: "s", subscribers: 10 }],
    },
    bio: "hi",
  };
  const out = redactSecrets(input);
  assert.equal(out.youtube_account.channel_title, "FlavorZen");
  assert.equal(out.youtube_account.access_token, "[hidden]");
  assert.equal(out.youtube_account.refresh_token, "[hidden]");
  assert.equal(out.youtube_account.nested[0].client_secret, "[hidden]");
  assert.equal(out.youtube_account.nested[0].subscribers, 10);
  assert.equal(input.youtube_account.access_token, "ya29.x");
});
