"use server";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { RegisterSchema } from "./schema";

export async function registerUser(formData: FormData) {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
  };

  const parsed = RegisterSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  const { email, password, full_name } = parsed.data;
  const supabase = getSupabaseAdminClient();

  // Utwórz użytkownika — email od razu potwierdzony, dostęp blokuje status 'pending'
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return { success: false, message: "Błąd rejestracji: " + error.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { success: false, message: "Błąd: nie udało się pobrać ID użytkownika." };
  }

  const { error: insertError } = await supabase.from("profiles").insert({
    id: userId,
    email,
    full_name,
    role: "user",
    status: "pending",
    community_id: null,
  });

  if (insertError) {
    return { success: false, message: "Błąd zapisu profilu: " + insertError.message };
  }

  return {
    success: true,
    message: "Konto założone! Administrator musi je zaakceptować zanim będziesz mógł się zalogować.",
  };
}
