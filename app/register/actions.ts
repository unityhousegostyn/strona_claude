"use server";

import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase/server";
import { RegisterSchema } from "./schema";

export async function registerUser(formData: FormData) {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
  };

  // 1️⃣ Walidacja
  const parsed = RegisterSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  const { email, password, full_name } = parsed.data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // 2️⃣ Rejestracja przez anon client — Supabase wyśle mail weryfikacyjny przez SMTP
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/login?verified=true`,
    },
  });

  if (error) {
    return { success: false, message: "Błąd rejestracji: " + error.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { success: false, message: "Błąd: nie udało się pobrać ID użytkownika." };
  }

  // 3️⃣ Wyloguj natychmiast — signUp mógł ustawić sesję w cookies
  await supabase.auth.signOut();

  // 4️⃣ Utwórz profil przez admin client (omija RLS)
  const admin = getSupabaseAdminClient();
  const { error: insertError } = await admin.from("profiles").insert({
    id: userId,
    email,
    full_name,
    role: "user",
    status: "pending",
    community_id: null,
  });

  if (insertError) {
    // Jeśli profil już istnieje (np. podwójna rejestracja), nie traktuj jako błąd krytyczny
    if (!insertError.message.includes("duplicate")) {
      return { success: false, message: "Błąd zapisu profilu: " + insertError.message };
    }
  }

  return {
    success: true,
    message: "Rejestracja zakończona! Sprawdź skrzynkę email i potwierdź adres.",
  };
}
