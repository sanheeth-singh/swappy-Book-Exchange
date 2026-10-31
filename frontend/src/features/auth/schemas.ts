import { z } from "zod";
export const credentialsSchema = z.object({ email: z.email("Enter a valid email address.").max(254), password: z.string().min(4, "Use at least 4 characters.").max(128) });
export const profileSchema = z.object({ display_name: z.string().trim().min(1, "Enter your name.").max(80), campus_id: z.uuid("Select a campus.") });
