import { z } from "zod";

// Username must start with @, have letters, end with 2+ digits
const usernameSchema = z
  .string()
  .min(1, "Username is required")
  .refine(
    (val) => /^@?[a-zA-Z][a-zA-Z0-9]*\d{2,}$/.test(val),
    "Username must have at least 2 numbers at the end (e.g. @ali12)"
  );

export const registerSchema = z.object({
  name:     z.string().min(2, "Name must be at least 2 characters"),
  username: usernameSchema,
  email:    z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  password:   z.string().min(1, "Password is required"),
});

export type RegisterForm = z.infer<typeof registerSchema>;
export type LoginForm    = z.infer<typeof loginSchema>;