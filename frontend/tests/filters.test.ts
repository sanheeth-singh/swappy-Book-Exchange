import test from "node:test";
import assert from "node:assert/strict";
import { parseOffset, previewSearch } from "../src/features/public-preview/filters";
test("preview offsets stay within the public window", () => { for (const value of ["-1", "100", "1.5", "abc"]) assert.equal(parseOffset(value), 0); assert.equal(parseOffset("96"), 96); assert.equal(parseOffset(null), 0); });
test("filter changes reset pagination and preserve encoded search", () => { const next = previewSearch(new URLSearchParams("offset=24&genre=FICTION"), { q: "books & stories", offset: 0 }); const parsed = new URLSearchParams(next); assert.equal(parsed.get("q"), "books & stories"); assert.equal(parsed.has("offset"), false); assert.equal(parsed.get("genre"), "FICTION"); });
