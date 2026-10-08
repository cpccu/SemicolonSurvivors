import { z } from "zod";

export const MFA_FRESHNESS_SECONDS = 300;
const verifiedClaimsSchema = z.object({
  sub: z.uuid(), aal: z.literal("aal2"),
  amr: z.array(z.object({ method: z.string().max(80), timestamp: z.number().int().nonnegative() })).max(50),
});
const mfaMethods = new Set(["totp", "mfa/totp", "mfa/phone", "mfa/webauthn", "mfa/recovery_code"]);

// Call only with claims verified by managed Auth, never a decoded browser token or profile metadata.
export function hasFreshMfaProof(claims: unknown, userId: string, nowSeconds: number): boolean {
  const parsed = verifiedClaimsSchema.safeParse(claims);
  if (!parsed.success || parsed.data.sub !== userId) return false;
  return parsed.data.amr.some((entry) => mfaMethods.has(entry.method)
    && entry.timestamp >= nowSeconds - MFA_FRESHNESS_SECONDS && entry.timestamp <= nowSeconds + 30);
}

export function validManagedTotpUri(uri: string, secret: string): boolean {
  try {
    if (uri.length > 2048) return false;
    const url = new URL(uri);
    if (url.protocol !== "otpauth:" || url.hostname !== "totp" || url.username || url.password || url.port || url.hash) return false;
    const parameters = url.searchParams;
    for (const key of ["secret", "algorithm", "digits", "period"]) if (parameters.getAll(key).length > 1) return false;
    return parameters.get("secret") === secret && (parameters.get("algorithm") ?? "SHA1") === "SHA1"
      && (parameters.get("digits") ?? "6") === "6" && (parameters.get("period") ?? "30") === "30";
  } catch { return false; }
}
