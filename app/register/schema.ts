import { z } from "zod";

export const RegisterSchema = z.object({
  email: z
    .string()
    .email("Niepoprawny adres email"),

  password: z
    .string()
    .min(8, "Hasło musi mieć minimum 8 znaków")
    .regex(/[A-Z]/, "Hasło musi zawierać wielką literę")
    .regex(/[a-z]/, "Hasło musi zawierać małą literę")
    .regex(/[0-9]/, "Hasło musi zawierać cyfrę"),

  full_name: z
    .string()
    .min(3, "Imię i nazwisko musi mieć minimum 3 znaki"),
});
