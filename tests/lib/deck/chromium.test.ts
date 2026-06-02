/**
 * SSRF allowlist matcher for the shared Chromium boot. This is a security
 * boundary, so substring-spoofing must be rejected.
 */
import { describe, expect, test } from "vitest";
import { isHostAllowed, FONT_IMAGE_HOSTS } from "@/lib/deck/chromium";

describe("isHostAllowed", () => {
  test("empty allowlist rejects everything", () => {
    expect(isHostAllowed("https://fonts.googleapis.com/x", [])).toBe(false);
  });

  test("exact host match is allowed", () => {
    expect(isHostAllowed("https://fonts.googleapis.com/css2", FONT_IMAGE_HOSTS)).toBe(true);
    expect(isHostAllowed("https://images.unsplash.com/photo-1", FONT_IMAGE_HOSTS)).toBe(true);
  });

  test("subdomains of an allowed host are allowed", () => {
    expect(isHostAllowed("https://cdn.images.unsplash.com/x", ["images.unsplash.com"])).toBe(true);
  });

  test("substring-spoofing hosts are rejected", () => {
    expect(isHostAllowed("https://evil-unsplash.com/x", ["unsplash.com"])).toBe(false);
    expect(isHostAllowed("https://fonts.googleapis.com.evil.com/x", FONT_IMAGE_HOSTS)).toBe(false);
  });

  test("non-allowlisted hosts are rejected", () => {
    expect(isHostAllowed("https://example.com/x", FONT_IMAGE_HOSTS)).toBe(false);
    expect(isHostAllowed("http://169.254.169.254/latest/meta-data", FONT_IMAGE_HOSTS)).toBe(false);
  });

  test("malformed urls are rejected, not thrown", () => {
    expect(isHostAllowed("not a url", FONT_IMAGE_HOSTS)).toBe(false);
    expect(isHostAllowed("data:image/png;base64,AAAA", FONT_IMAGE_HOSTS)).toBe(false);
  });

  test("host match is case-insensitive", () => {
    expect(isHostAllowed("https://Fonts.GoogleAPIs.com/css", FONT_IMAGE_HOSTS)).toBe(true);
  });
});
