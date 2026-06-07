"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { RegisterSchema } from "./schema";

export async function registerUser(formData: FormData) {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
  };

  // 1️⃣ Walidacja Zod
  const parsed = RegisterSchema.safeParse(rawData);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0].message, // ← poprawione
    };
  }

  const { email, password, full_name } = parsed.data;

  const supabase = getSupabaseServerClient();

  // 2️⃣ Tworzenie użytkownika w Supabase Auth
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return { success: false, message: "Błąd: " + error.message };
  }

  const userId = data.user?.id;

  // 3️⃣ Tworzenie profilu w tabeli profiles
  const { error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      email,
      full_name,
      role: "user",
      status: "pending",
      community_id: null,
    });

  if (insertError) {
    return {
      success: false,
      message: "Błąd zapisu profilu: " + insertError.message,
    };
  }

  return {
    success: true,
    message: "Rejestracja zakończona. Sprawdź email i poczekaj na akceptację.",
  };
}
