import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
test("listing and admin adapters preserve verbs, consent, multipart photos and password whitespace", async () => {
  const calls: { path: string; method: string; data: unknown }[] = [];
  const original = axios.defaults.adapter;
  axios.defaults.adapter = async (config) => {
    calls.push({
      path: config.url!,
      method: config.method!,
      data: config.data,
    });
    return { config, status: 200, statusText: "test", data: {}, headers: {} };
  };
  try {
    const { session } = await import("../src/features/auth/session");
    session.accept({
      access_token: "fixture-access",
      token_type: "bearer",
      expires_in: 900,
      csrf_token: "csrf",
      session_id: "fixture",
      refresh_expires_at: "2030-01-01",
    });
    const { booksApi } = await import("../src/features/books/api");
    const { adminApi } = await import("../src/features/administration/api");
    await booksApi.create({
      title: "Book",
      author: "Author",
      description: "Description",
      condition: "GOOD",
      genre: "FICTION",
      condition_notes: "",
      allow_public_preview: false,
      physical_book_id: "copy",
    });
    await booksApi.preview("listing", false);
    await booksApi.photo(
      "listing",
      new File(["fixture"], "cover.webp", { type: "image/webp" }),
    );
    await adminApi.status("colleges", "college", {
      is_active: false,
      current_password: " fixture secret ",
      reason: "Directory status test",
    });
    await adminApi.review("submission", {
      decision: "VERIFIED",
      expires_at: "2030-01-01T00:00:00Z",
      reason: null,
    });
    assert.equal(calls[0].method, "post");
    assert.equal(JSON.parse(String(calls[0].data)).physical_book_id, "copy");
    assert.equal(calls[1].method, "patch");
    assert.equal(JSON.parse(String(calls[1].data)).allow_public_preview, false);
    assert.equal(
      (calls[2].data as FormData).get("photo") instanceof File,
      true,
    );
    assert.equal(calls[3].path, "/admin/colleges/college/status");
    assert.equal(
      JSON.parse(String(calls[3].data)).current_password,
      " fixture secret ",
    );
    assert.equal(calls[4].path, "/membership/submissions/submission/review");
    session.clear();
  } finally {
    axios.defaults.adapter = original;
  }
});
