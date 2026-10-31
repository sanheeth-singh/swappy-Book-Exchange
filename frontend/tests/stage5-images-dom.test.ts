import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
test("batch upload keeps failed and unsubmitted images without resending successful files", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost:3000",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.HTMLElement.prototype.scrollTo = function (options) {
    this.scrollLeft =
      typeof options === "number" ? options : (options?.left ?? 0);
  };
  const oldCreate = URL.createObjectURL,
    oldRevoke = URL.revokeObjectURL;
  let n = 0;
  const revoked: string[] = [];
  URL.createObjectURL = () => `blob:fixture-${++n}`;
  URL.revokeObjectURL = (url) => {
    revoked.push(url);
  };
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { ImagePicker } = await import("../src/components/ui/image-picker");
  const root = createRoot(document.getElementById("root")!);
  const calls: string[] = [];
  let fail = true;
  try {
    await act(async () =>
      root.render(
        createElement(ImagePicker, {
          maxFiles: 3,
          accept: "image/png",
          validate: () => undefined,
          onUpload: async (file) => {
            calls.push(file.name);
            if (file.name === "two.png" && fail) {
              fail = false;
              throw new Error("Network failed");
            }
          },
        }),
      ),
    );
    const input = document.querySelector("input")!;
    assert.ok(input.multiple);
    Object.defineProperty(input, "files", {
      value: ["one.png", "two.png", "three.png"].map(
        (name) => new dom.window.File(["x"], name, { type: "image/png" }),
      ),
    });
    await act(async () => {
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    assert.equal(document.querySelectorAll("img").length, 3);
    async function submit() {
      await act(async () => {
        document
          .querySelector("form")!
          .dispatchEvent(
            new dom.window.Event("submit", { bubbles: true, cancelable: true }),
          );
      });
    }
    await submit();
    assert.deepEqual(calls, ["one.png", "two.png"]);
    assert.equal(document.querySelectorAll("img").length, 2);
    assert.match(document.body.textContent!, /Remaining selections are kept/);
    await submit();
    assert.deepEqual(calls, ["one.png", "two.png", "two.png", "three.png"]);
    assert.equal(document.querySelectorAll("img").length, 0);
    assert.equal(revoked.length, 3);
  } finally {
    await act(async () => root.unmount());
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
    dom.window.close();
  }
});
test("grouped gallery switches active image and protected proof releases preview on close", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost:3000",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.HTMLElement.prototype.scrollTo = function (options) {
    this.scrollLeft =
      typeof options === "number" ? options : (options?.left ?? 0);
  };
  const oldCreate = URL.createObjectURL,
    oldRevoke = URL.revokeObjectURL;
  const revoked: string[] = [];
  URL.createObjectURL = () => "blob:proof";
  URL.revokeObjectURL = (url) => {
    revoked.push(url);
  };
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { BookGallery } = await import("../src/components/cards/book-gallery");
  const { ProtectedImagePreview } = await import(
    "../src/components/ui/protected-image-preview"
  );
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () =>
      root.render(
        createElement(BookGallery, {
          title: "Book",
          author: "Author",
          photos: [
            { id: "a", url: "https://example.com/a.jpg" },
            { id: "b", url: "https://example.com/b.jpg" },
          ],
        }),
      ),
    );
    assert.match(
      document.querySelector("figcaption")!.textContent!,
      /Photo 1 of 2/,
    );
    await act(async () => {
      (
        document.querySelector(
          '[aria-label="Next book photo"]',
        ) as HTMLButtonElement
      ).click();
    });
    assert.match(
      document.querySelector("figcaption")!.textContent!,
      /Photo 2 of 2/,
    );
    assert.equal(document.querySelectorAll(".gallery-slide").length, 2);
    assert.equal(document.querySelector(".gallery-thumbnail"), null);
    const track = document.querySelector(".gallery-track") as HTMLDivElement;
    Array.from(track.children).forEach((slide, index) =>
      Object.defineProperty(slide, "offsetLeft", { value: index * 300 }),
    );
    await act(async () => {
      track.scrollLeft = 0;
      track.dispatchEvent(new dom.window.Event("scroll", { bubbles: true }));
    });
    assert.match(
      document.querySelector("figcaption")!.textContent!,
      /Photo 1 of 2/,
    );
    await act(async () => {
      track.scrollLeft = 300;
      track.dispatchEvent(new dom.window.Event("scroll", { bubbles: true }));
    });
    assert.match(
      document.querySelector("figcaption")!.textContent!,
      /Photo 2 of 2/,
    );
    await act(async () => {
      track.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: "ArrowLeft",
          bubbles: true,
        }),
      );
    });
    assert.match(
      document.querySelector("figcaption")!.textContent!,
      /Photo 1 of 2/,
    );
    let loads = 0;
    await act(async () =>
      root.render(
        createElement(ProtectedImagePreview, {
          load: async () => {
            loads++;
            return new Blob(["fixture"], { type: "image/png" });
          },
        }),
      ),
    );
    await act(async () => {
      document.querySelector("button")!.click();
    });
    assert.equal(loads, 1);
    assert.equal(
      document.querySelector("img")?.getAttribute("src"),
      "blob:proof",
    );
    assert.equal(document.querySelector("a[download]"), null);
    await act(async () => {
      document.querySelector("button")!.click();
    });
    assert.equal(document.querySelector("img"), null);
    assert.ok(revoked.includes("blob:proof"));
  } finally {
    await act(async () => root.unmount());
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
    dom.window.close();
  }
});
