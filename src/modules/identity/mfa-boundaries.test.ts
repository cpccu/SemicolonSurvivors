import { describe, expect, it } from "vitest";
import { mfaChallengeSchema, mfaEnrollSchema, mfaRemoveSchema, mfaVerifySchema } from "./mfa-schemas";
import { hasFreshMfaProof, validManagedTotpUri } from "./mfa-policy";
import { safeTotpQrDataUri } from "./mfa-qr";

const userId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const factorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const challengeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const now = 1801962000;
const syntheticSecret = "JBSWY3DPEHPK3PXP";
const prefix = "data:image/svg+xml;utf-8,";
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="white"/><path fill="black" d="M0 0h10v10H0z"/></svg>';

describe("MFA request and proof boundaries", () => {
  it("does not accept caller identity, roles, factor type, or assurance claims", () => {
    expect(mfaEnrollSchema.safeParse({}).success).toBe(true);
    for (const body of [{ userId }, { factorType: "phone" }, { role: "system_admin" }, { assurance: "aal2" }]) {
      expect(mfaEnrollSchema.safeParse(body).success).toBe(false);
    }
    expect(mfaChallengeSchema.safeParse({ factorId, userId }).success).toBe(false);
  });
  it("requires exactly six code characters, including valid leading zeroes", () => {
    expect(mfaVerifySchema.parse({ factorId, challengeId, code: "012345" }).code).toBe("012345");
    for (const code of [123456, "12345", "1234567", " 123456", "abcdef"]) {
      expect(mfaVerifySchema.safeParse({ factorId, challengeId, code }).success).toBe(false);
    }
  });
  it("requires explicit literal confirmation for removal", () => {
    expect(mfaRemoveSchema.safeParse({ factorId, confirmRemoval: true }).success).toBe(true);
    for (const confirmRemoval of [false, undefined, "true", 1]) {
      expect(mfaRemoveSchema.safeParse({ factorId, confirmRemoval }).success).toBe(false);
    }
  });
  it("requires matching verified subject, aal2 and recent timestamped MFA proof", () => {
    const proof = { sub: userId, aal: "aal2", amr: [{ method: "totp", timestamp: now }] };
    expect(hasFreshMfaProof(proof, userId, now)).toBe(true);
    expect(hasFreshMfaProof({ ...proof, aal: "aal1", role: "system_admin" }, userId, now)).toBe(false);
    expect(hasFreshMfaProof(proof, factorId, now)).toBe(false);
    expect(hasFreshMfaProof({ ...proof, amr: ["totp"] }, userId, now)).toBe(false);
    expect(hasFreshMfaProof({ ...proof, amr: [{ method: "password", timestamp: now }] }, userId, now)).toBe(false);
    expect(hasFreshMfaProof(proof, userId, now + 301)).toBe(false);
    expect(hasFreshMfaProof(proof, userId, now - 31)).toBe(false);
    expect(hasFreshMfaProof(proof, userId, now + 300)).toBe(true);
  });
  it("matches managed URI settings to the key instead of trusting arbitrary setup configuration", () => {
    const uri = `otpauth://totp/CampusOS:synthetic?secret=${syntheticSecret}&issuer=CampusOS&algorithm=SHA1&digits=6&period=30`;
    expect(validManagedTotpUri(uri, syntheticSecret)).toBe(true);
    expect(validManagedTotpUri(uri.replace("SHA1", "SHA256"), syntheticSecret)).toBe(false);
    expect(validManagedTotpUri(`${uri}&secret=OTHER`, syntheticSecret)).toBe(false);
    expect(validManagedTotpUri(uri, "OTHER")).toBe(false);
    expect(validManagedTotpUri(uri.replace("otpauth:", "https:"), syntheticSecret)).toBe(false);
  });
});

describe("inert provider QR image", () => {
  it("normalizes supported provider data-URI variants as a data image, with no external QR service", () => {
    for (const sourcePrefix of [prefix, "data:image/svg+xml;utf8,", "data:image/svg+xml;charset=utf-8,"]) {
      expect(safeTotpQrDataUri(sourcePrefix + svg)).toBe(`data:image/svg+xml;charset=utf-8,${encodeURI(svg).replace(/#/g, "%23")}`);
    }
    expect(safeTotpQrDataUri(`${prefix}<?xml version="1.0" encoding="UTF-8"?>${svg}`)).toBe(`data:image/svg+xml;charset=utf-8,${encodeURI(svg).replace(/#/g, "%23")}`);
    expect(safeTotpQrDataUri(`${prefix}<?xml version="1.0"?>${svg}`)).toBe(`data:image/svg+xml;charset=utf-8,${encodeURI(svg).replace(/#/g, "%23")}`);
    const providerSvg = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="256" height="256"><!-- qr --><rect x="0" y="0" width="256" height="256" style="fill:rgb(255,255,255);stroke:none"/></svg>';
    expect(safeTotpQrDataUri(prefix + providerSvg)).toContain("data:image/svg+xml;charset=utf-8,");
  });
  it("rejects scripts, external references, event handlers, entities and non-geometry SVG", () => {
    for (const unsafe of [
      svg.replace("<rect", '<script>alert("synthetic")</script><rect'),
      svg.replace('<rect width=', '<rect onclick="alert(1)" width='),
      svg.replace('<rect width=', '<rect style="fill:url(https://outside.invalid)" width='),
      svg.replace('<rect width=', '<image href="https://outside.invalid/qr"/><rect width='),
      svg.replace('<rect width=', '<foreignObject><div>synthetic</div></foreignObject><rect width='),
      svg.replace('fill="black"', 'fill="&#98;lack"'),
      svg.replace('width="256"', 'width="256" width="256"'),
    ]) expect(safeTotpQrDataUri(prefix + unsafe)).toBeNull();
    expect(safeTotpQrDataUri("https://outside.invalid/qr")).toBeNull();
    expect(safeTotpQrDataUri(prefix + "x".repeat(65536))).toBeNull();
  });
});
