import { z } from "zod";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const administrationLookupInput = z.strictObject({
  query: z.string().trim().max(80).default(""),
});

export const administrationClubInput = z.strictObject({
  name: text(2, 160),
  description: z.string().trim().max(5000),
});

export type AdministrationLookupInput = z.infer<typeof administrationLookupInput>;
export type AdministrationClubInput = z.infer<typeof administrationClubInput>;
