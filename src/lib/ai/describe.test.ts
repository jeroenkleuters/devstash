import { describe, expect, it } from "vitest";

import { describeCode, describeItem } from "@/lib/ai/describe";
import { EXISTING_TAGS_LABEL } from "@/lib/ai/prompts";
import { TAG_CHARACTER_BUDGET, TRUNCATION_MARKER } from "@/lib/ai/truncate";

/**
 * These two build the entire user-supplied half of every AI request, so what is
 * asserted here is mostly a privacy guarantee rather than a behaviour: the
 * privacy page names which fields leave the app, and nothing else may.
 *
 * Reachable directly only since the builders moved out of `src/actions/ai.ts`;
 * before that these rules could be checked only through a mocked action.
 */

const BUDGET = TAG_CHARACTER_BUDGET;

describe("describeItem", () => {
  it("sends the title, description, tags and content, and nothing else", () => {
    // A row carries far more than the four fields the privacy page names. The
    // parameter is structural, so a wider object is accepted — which is exactly
    // the mistake this test exists to catch.
    const row = {
      id: "item-1",
      userId: "user-1",
      fileName: "secret-invoice.pdf",
      fileUrl: "uploads/user-1/abc123",
      collections: ["Client work"],
      language: "typescript",
      title: "Debounce hook",
      description: "Delays a value",
      tags: ["react"],
      content: "export function useDebounce() {}",
    };

    const sent = describeItem(row, BUDGET);

    expect(sent).toContain("Debounce hook");
    expect(sent).toContain("Delays a value");
    expect(sent).toContain("react");
    expect(sent).toContain("export function useDebounce() {}");

    expect(sent).not.toContain("item-1");
    expect(sent).not.toContain("user-1");
    expect(sent).not.toContain("secret-invoice.pdf");
    expect(sent).not.toContain("uploads/");
    expect(sent).not.toContain("Client work");
    expect(sent).not.toContain("typescript");
  });

  it("always sends the title", () => {
    const sent = describeItem(
      { title: "Just a title", description: null, content: null, tags: [] },
      BUDGET,
    );

    expect(sent).toBe("Title: Just a title");
  });

  it("omits an absent description rather than sending an empty label", () => {
    const sent = describeItem(
      { title: "T", description: null, content: "body", tags: [] },
      BUDGET,
    );

    expect(sent).not.toContain("Description");
  });

  it("omits the tag line when there are no tags", () => {
    const sent = describeItem(
      { title: "T", description: null, content: "body", tags: [] },
      BUDGET,
    );

    expect(sent).not.toContain(EXISTING_TAGS_LABEL);
  });

  it("omits the content line when the item has none", () => {
    const sent = describeItem(
      { title: "T", description: "D", content: null, tags: [] },
      BUDGET,
    );

    expect(sent).not.toContain("Content");
  });

  it("labels existing tags with the label the prompt names", () => {
    // Asserted against the constant, not a literal: the prompt tells the model
    // not to repeat them, and that instruction is only obeyable if both sides
    // say the same word.
    const sent = describeItem(
      { title: "T", description: null, content: null, tags: ["a", "b"] },
      BUDGET,
    );

    expect(sent).toContain(`${EXISTING_TAGS_LABEL}: a, b`);
  });

  it("truncates the assembled block, so a huge content cannot push the title out", () => {
    const sent = describeItem(
      {
        title: "Kept",
        description: null,
        content: "x".repeat(BUDGET * 2),
        tags: [],
      },
      BUDGET,
    );

    expect(sent).toContain("Title: Kept");
    expect(sent).toContain(TRUNCATION_MARKER);
    expect(sent.length).toBe(BUDGET + TRUNCATION_MARKER.length);
  });

  it("honours the caller's budget rather than a fixed one", () => {
    const item = {
      title: "T",
      description: null,
      content: "x".repeat(500),
      tags: [],
    };

    expect(describeItem(item, 5_000)).not.toContain(TRUNCATION_MARKER);
    expect(describeItem(item, 100)).toContain(TRUNCATION_MARKER);
  });
});

describe("describeCode", () => {
  it("sends the code and the language hint", () => {
    const sent = describeCode({
      content: "echo hello",
      language: "bash",
    });

    expect(sent).toBe("Language: bash\n\nCode:\necho hello");
  });

  it("omits the language line when the item carries no hint", () => {
    const sent = describeCode({ content: "echo hello", language: null });

    expect(sent).toBe("Code:\necho hello");
  });

  it("truncates head-first, keeping the opening", () => {
    const content = `import { first } from "a";\n${"filler\n".repeat(10_000)}const last = 1;`;

    const sent = describeCode({ content, language: null });

    expect(sent).toContain('import { first } from "a";');
    expect(sent).not.toContain("const last = 1;");
    expect(sent).toContain(TRUNCATION_MARKER);
  });
});
