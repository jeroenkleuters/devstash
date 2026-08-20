import { describe, expect, it, vi } from "vitest";

import { appOrigin } from "@/lib/app-url";

/** Stands in for the request a route handler is answering. */
function requestTo(url: string) {
  return new Request(url);
}

describe("appOrigin", () => {
  it("prefers APP_URL over the request", () => {
    vi.stubEnv("APP_URL", "https://devstash.io");

    expect(appOrigin(requestTo("http://localhost:3000/api/auth/verify"))).toBe(
      "https://devstash.io",
    );
  });

  it("strips trailing slashes so links are not built with a double one", () => {
    vi.stubEnv("APP_URL", "https://devstash.io///");

    expect(appOrigin(requestTo("http://localhost:3000/"))).toBe(
      "https://devstash.io",
    );
  });

  it("ignores an APP_URL that is only whitespace", () => {
    vi.stubEnv("APP_URL", "   ");
    vi.stubEnv("NODE_ENV", "development");

    expect(appOrigin(requestTo("http://localhost:3000/x"))).toBe(
      "http://localhost:3000",
    );
  });

  describe("without APP_URL", () => {
    /**
     * The fallback reads the request's own origin, which Next derives from the
     * `Host` header — i.e. from the caller. This test documents that: outside
     * production the header is trusted, which is fine locally and for previews.
     */
    it("falls back to the request origin outside production", () => {
      vi.stubEnv("APP_URL", undefined);
      vi.stubEnv("NODE_ENV", "development");

      expect(appOrigin(requestTo("http://evil.example.com/api/x"))).toBe(
        "http://evil.example.com",
      );
    });

    /**
     * And why it must not be trusted in production: a forgot-password request
     * carrying a spoofed `Host` would mail the real owner of the address a
     * reset link pointing at the attacker's domain. Failing the request is the
     * safe direction, so the variable is required rather than merely preferred.
     */
    it("throws in production rather than trusting the Host header", () => {
      vi.stubEnv("APP_URL", undefined);
      vi.stubEnv("NODE_ENV", "production");

      expect(() => appOrigin(requestTo("http://evil.example.com/api/x"))).toThrow(
        /APP_URL must be set in production/,
      );
    });
  });
});
