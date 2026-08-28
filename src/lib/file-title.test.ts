import { describe, expect, it } from "vitest";

import { titleFromFileName } from "@/lib/file-title";

describe("titleFromFileName", () => {
  it("drops the extension", () => {
    expect(titleFromFileName("report.pdf")).toBe("report");
  });

  it("drops only the last extension", () => {
    expect(titleFromFileName("archive.tar.gz")).toBe("archive.tar");
  });

  it("collapses a run of separators to one space", () => {
    expect(titleFromFileName("Q3__report---final.PDF")).toBe(
      "Q3 report final",
    );
  });

  it("treats underscores and dashes alike", () => {
    expect(titleFromFileName("a_-_b.png")).toBe("a b");
  });

  it("collapses whitespace the name already carried", () => {
    expect(titleFromFileName("my   holiday _ photo.jpeg")).toBe(
      "my holiday photo",
    );
  });

  it("trims the separators a name starts or ends with", () => {
    expect(titleFromFileName("_draft_.md")).toBe("draft");
  });

  it("keeps the case it was given", () => {
    expect(titleFromFileName("ReadMe.MD")).toBe("ReadMe");
  });

  it("keeps a name that has no extension", () => {
    expect(titleFromFileName("makefile")).toBe("makefile");
  });

  it("keeps a dotfile's leading dot rather than reading it as an extension", () => {
    expect(titleFromFileName(".gitignore")).toBe(".gitignore");
  });

  it("returns nothing for a name that is all separators", () => {
    expect(titleFromFileName("___.png")).toBe("");
  });

  it("returns nothing for an empty name", () => {
    expect(titleFromFileName("")).toBe("");
  });

  it("caps the title at what the item schema accepts", () => {
    const title = titleFromFileName(`${"a".repeat(250)}.txt`);

    expect(title).toHaveLength(200);
  });

  it("does not leave a trailing space when the cap lands mid-separator", () => {
    const title = titleFromFileName(`${"a".repeat(199)}_bb.txt`);

    expect(title).toBe("a".repeat(199));
  });
});
