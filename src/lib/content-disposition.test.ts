import { describe, expect, it } from "vitest";

import { contentDisposition } from "@/lib/content-disposition";

describe("contentDisposition", () => {
  it("names the file twice, plainly and encoded", () => {
    expect(contentDisposition("attachment", "notes.pdf")).toBe(
      `attachment; filename="notes.pdf"; filename*=UTF-8''notes.pdf`,
    );
  });

  it("carries the disposition it is given", () => {
    // Inline is what the drawer's image preview loads; attachment is Download.
    expect(contentDisposition("inline", "a.png")).toMatch(/^inline; /);
  });

  it("strips quotes and backslashes from the plain name", () => {
    // Either would end the quoted string early and let the rest of the name be
    // read as header parameters.
    const header = contentDisposition("attachment", 'we"ird\\name.txt');

    expect(header).toContain(`filename="weirdname.txt"`);
  });

  it("keeps control characters out of the header", () => {
    // A newline in a filename would end the header itself, so this is the case
    // that matters most — the name reaches us from whoever uploaded it.
    const header = contentDisposition("attachment", "a\r\nX-Evil: 1.txt");

    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toContain(`filename="a__X-Evil: 1.txt"`);
  });

  it("stands non-ASCII characters in rather than dropping them", () => {
    // The name keeps its shape in the fallback; the encoded half carries the
    // real thing for clients that read it.
    const header = contentDisposition("attachment", "résumé.pdf");

    expect(header).toContain(`filename="r_sum_.pdf"`);
    expect(header).toContain(
      `filename*=UTF-8''${encodeURIComponent("résumé.pdf")}`,
    );
  });

  it("falls back to a name when nothing ASCII survives", () => {
    // An empty `filename=""` reads as "no name" to some clients and as an error
    // to others.
    const header = contentDisposition("attachment", "文档.pdf");

    expect(header).toContain(`filename="__.pdf"`);
  });

  it("uses a whole fallback name when the file name is only non-ASCII", () => {
    const header = contentDisposition("attachment", "日本語");

    expect(header).toContain(`filename="___"`);
  });

  it("encodes a space rather than leaving it bare in the encoded half", () => {
    // `filename*` is a token, so an unencoded space would end it.
    const header = contentDisposition("attachment", "my file.txt");

    expect(header).toContain("filename*=UTF-8''my%20file.txt");
  });
});
