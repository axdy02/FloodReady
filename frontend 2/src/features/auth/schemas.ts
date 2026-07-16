import { z } from "zod";

const password = z.string().superRefine((value, context) => { if (Array.from(value).length < 12 || Array.from(value).length > 128 || new TextEncoder().encode(value).length > 512) context.addIssue({ code: "custom", message: "Invalid value" }); });
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const name = z.string().normalize("NFKC").trim().transform((value) => value.replace(/\s+/gu, " ")).refine((value) => Array.from(value).length >= 2 && Array.from(value).length <= 100);
export const loginSchema = z.object({ email, password }).strict();
export const registerSchema = z.object({ name, email, password }).strict();
