import { describe, expect, it } from "vitest";

import {
  DEFAULT_LANGUAGE,
  languageLabel,
  languageOptions,
  monacoLanguageId,
} from "@/lib/code-language";

describe("monacoLanguageId", () => {
  it("passes through a hint that is already a Monaco id", () => {
    expect(monacoLanguageId("typescript")).toBe("typescript");
  });

  it("translates an alias to the id Monaco knows", () => {
    expect(monacoLanguageId("ts")).toBe("typescript");
    expect(monacoLanguageId("py")).toBe("python");
  });

  it("maps every shell dialect onto one id", () => {
    // Monaco has no `bash` or `zsh` grammar, so a hint naming one would render
    // as plain text rather than as the shell script it is.
    for (const hint of ["sh", "bash", "zsh", "fish", "console"]) {
      expect(monacoLanguageId(hint)).toBe("shell");
    }
  });

  it("ignores case and surrounding whitespace in the hint", () => {
    expect(monacoLanguageId("  TypeScript  ")).toBe("typescript");
    expect(monacoLanguageId("TS")).toBe("typescript");
  });

  it("falls back when the item names no language", () => {
    expect(monacoLanguageId(null)).toBe(DEFAULT_LANGUAGE);
    expect(monacoLanguageId(undefined)).toBe(DEFAULT_LANGUAGE);
    expect(monacoLanguageId("")).toBe(DEFAULT_LANGUAGE);
    expect(monacoLanguageId("   ")).toBe(DEFAULT_LANGUAGE);
  });

  it("takes the caller's fallback, which is how a command defaults to shell", () => {
    expect(monacoLanguageId(null, "shell")).toBe("shell");
    // A hint that is present still wins over the type's default.
    expect(monacoLanguageId("python", "shell")).toBe("python");
  });

  it("passes an unknown hint through rather than discarding it", () => {
    // Monaco knows many more ids than ALIASES lists; anything it does not know
    // renders as plain text, which is no worse than the fallback would be.
    expect(monacoLanguageId("elixir")).toBe("elixir");
  });
});

describe("languageLabel", () => {
  it("uses the conventional capitalisation for ids a title-case gets wrong", () => {
    expect(languageLabel("typescript")).toBe("TypeScript");
    expect(languageLabel("csharp")).toBe("C#");
    expect(languageLabel("cpp")).toBe("C++");
    expect(languageLabel("yaml")).toBe("YAML");
    expect(languageLabel(DEFAULT_LANGUAGE)).toBe("Plain Text");
  });

  it("title-cases an id it has no entry for", () => {
    expect(languageLabel("rust")).toBe("Rust");
    expect(languageLabel("elixir")).toBe("Elixir");
  });
});

describe("languageOptions", () => {
  it("offers every alias target, so no hint the app translates is unsayable", () => {
    const values = new Set(languageOptions().map((option) => option.value));

    for (const id of ["typescript", "javascript", "shell", "csharp", "cpp"]) {
      expect(values).toContain(id);
    }
  });

  it("labels an id the way the editor header does", () => {
    const typescript = languageOptions().find(
      (option) => option.value === "typescript",
    );

    expect(typescript?.label).toBe("TypeScript");
  });

  it("orders by label rather than by id", () => {
    const labels = languageOptions().map((option) => option.label);

    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("keeps a stored hint the list does not offer, so a save cannot rewrite it", () => {
    const options = languageOptions("cobol");

    expect(options[0]).toEqual({ value: "cobol", label: "cobol" });
  });

  it("does not duplicate a stored hint the list already offers", () => {
    const rust = languageOptions("rust").filter(
      (option) => option.value === "rust",
    );

    expect(rust).toHaveLength(1);
  });

  it("adds nothing for an empty or whitespace-only hint", () => {
    const base = languageOptions().length;

    expect(languageOptions("")).toHaveLength(base);
    expect(languageOptions("   ")).toHaveLength(base);
    expect(languageOptions(null)).toHaveLength(base);
  });
});
