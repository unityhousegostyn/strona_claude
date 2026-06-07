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
      message: parsed.error.issues[0].message,
    };
  }

  const { email, password, full_name } = parsed.data;

  // 2️⃣ Supabase (service role key)
  const supabase = getSupabaseServerClient();

  // 3️⃣ Tworzenie użytkownika w Supabase Auth (admin)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // email od razu potwierdzony
  });

  if (error) {
    return { success: false, message: "Błąd: " + error.message };
  }

  const userId = data.user?.id;

  if (!userId) {
    return {
      success: false,
      message: "Błąd: nie udało się pobrać ID użytkownika.",
    };
  }

  // 4️⃣ Tworzenie profilu w tabeli profiles
  const { error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      email,
      full_name,
      role: "user",
      status: "pending", // użytkownik czeka na akceptację admina
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
    message: "Rejestracja zakończona. Konto oczekuje na akceptację administratora.",
  };
}
