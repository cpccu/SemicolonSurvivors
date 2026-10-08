import { z } from "zod";

export const mfaEnrollSchema = z.strictObject({});
export const mfaChallengeSchema = z.strictObject({ factorId: z.uuid() });
export const mfaVerifySchema = z.strictObject({
  factorId: z.uuid(), challengeId: z.uuid(), code: z.string().regex(/^\d{6}$/),
});
export const mfaRemoveSchema = z.strictObject({ factorId: z.uuid(), confirmRemoval: z.literal(true) });

export const totpFactorSchema = z.strictObject({
  id: z.uuid(), friendlyName: z.string().max(100), status: z.enum(["unverified", "verified"]),
});
export const mfaStateSchema = z.strictObject({
  currentLevel: z.enum(["aal1", "aal2"]), freshMfa: z.boolean(), canEnroll: z.boolean(),
  hasOtherVerifiedFactors: z.boolean(), factors: z.array(totpFactorSchema).max(20),
});
export const totpSetupSchema = z.strictObject({
  factorId: z.uuid(), secret: z.string().min(16).max(128).regex(/^[A-Z2-7]+=*$/),
  qrCode: z.string().max(500000).startsWith("data:image/svg+xml;charset=utf-8,").nullable(),
});
export const totpChallengeSchema = z.strictObject({
  factorId: z.uuid(), challengeId: z.uuid(), expiresAt: z.number().int().positive(),
});
export const mfaRemovedSchema = z.strictObject({ removed: z.literal(true), signedOut: z.literal(true) });

export type MfaState = z.infer<typeof mfaStateSchema>;
export type TotpFactor = z.infer<typeof totpFactorSchema>;
export type TotpSetup = z.infer<typeof totpSetupSchema>;
export type TotpChallenge = z.infer<typeof totpChallengeSchema>;
