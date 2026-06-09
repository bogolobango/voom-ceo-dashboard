import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./system-prompt.js";

describe("buildSystemPrompt", () => {
  it("includes VOOM identity, schema, tools, voice rules", () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/VOOM/i);
    expect(p).toMatch(/businessName/);          // schema dump present
    expect(p).toMatch(/list_vendors/);          // tool catalog present
    expect(p).toMatch(/em dash/i);              // voice rule present
    expect(p).toMatch(/4th[- ]grade/i);         // copy rule present
    expect(p).toMatch(/48K/);                   // traffic rule present
  });

  it("is stable across calls (for prompt cache)", () => {
    const a = buildSystemPrompt();
    const b = buildSystemPrompt();
    expect(a).toBe(b);
  });
});
