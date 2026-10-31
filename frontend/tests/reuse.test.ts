import test from "node:test";
import assert from "node:assert/strict";
import { reuseIllustration } from "../src/features/landing/reuse";
test("two-way exchanges illustrate two handovers each", () => { assert.deepEqual(reuseIllustration(4), { exchanges: 4, handovers: 8 }); assert.equal(reuseIllustration(20).handovers, 40); });
test("illustration clamps invalid, fractional and out-of-range values", () => { assert.equal(reuseIllustration(-5).exchanges, 1); assert.equal(reuseIllustration(Infinity).exchanges, 1); assert.equal(reuseIllustration(2.7).exchanges, 3); assert.equal(reuseIllustration(100).exchanges, 20); });
