import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
test("selected photo previews before upload, survives failure, and releases its blob URL", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost:3000",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    FormData: dom.window.FormData,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const revoked: string[] = [];
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  URL.createObjectURL = () => "blob:photo-fixture";
  URL.revokeObjectURL = (url) => {
    revoked.push(url);
  };
  const { createElement, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { PhotoUpload } = await import(
    "../src/features/books/components/photo-upload"
  );
  let calls = 0;
  const onUpload = async () => {
    calls++;
    if (calls === 1) throw new Error("Temporary upload failure");
  };
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () =>
      root.render(createElement(PhotoUpload, { onUpload })),
    );
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new dom.window.File(["fixture"], "cover.png", {
      type: "image/png",
    });
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    await act(async () => {
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    assert.equal(
      document.querySelector("img")?.getAttribute("src"),
      "blob:photo-fixture",
    );
    assert.match(
      document.body.textContent ?? "",
      /Previewed locally before upload/,
    );
    await act(async () => {
      document
        .querySelector("form")!
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    assert.match(document.body.textContent ?? "", /Temporary upload failure/);
    assert.ok(document.querySelector("img"));
    await act(async () => {
      document
        .querySelector("form")!
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    assert.equal(calls, 2);
    assert.equal(document.querySelector("img"), null);
    assert.ok(revoked.includes("blob:photo-fixture"));
  } finally {
    await act(async () => root.unmount());
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    dom.window.close();
  }
});
