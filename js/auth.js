// Lógica de autenticación: login, registro y logout con Supabase Auth.
import { supabase } from "./supabaseClient.js";

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Error obteniendo la sesión:", error);
    return null;
  }
  return data.session;
}

export function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
