import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { conditions, exchangeStatuses, reportReasons, reportStatuses, issueStatuses } from "../src/features/help/content";
import { genreGuide } from "../src/features/help/genres";
const spec = JSON.parse(fs.readFileSync(new URL("../contracts/openapi.json", import.meta.url), "utf8"));
test("help covers every supported exchange, condition, issue and report label", () => {
 const schemas = spec.components.schemas;
 for (const [entries, values] of [[exchangeStatuses, schemas.ExchangeResponse.properties.status.enum], [conditions, schemas.PublicBookCard.properties.condition.enum], [reportReasons, schemas.ReportInput.properties.reason.enum], [reportStatuses, schemas.ReportResponse.properties.status.enum], [issueStatuses, schemas.IssueResponse.properties.status.enum], [genreGuide, schemas.Genre.enum]] as [Record<string, { label: string; description: string }>, string[]][]) {
  assert.deepEqual(Object.keys(entries).sort(), [...values].sort());
  for (const entry of Object.values(entries)) { assert.ok(entry.label.length > 0); assert.ok(entry.description.length > 10); }
 }
});
