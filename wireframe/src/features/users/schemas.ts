import { z } from "zod";

export const profileSchema = z.object({ name: z.string().normalize("NFKC").trim().transform((value) => value.replace(/\s+/gu, " ")).refine((value) => Array.from(value).length >= 2 && Array.from(value).length <= 100) }).strict();
