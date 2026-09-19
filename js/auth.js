// Lógica de acceso a la app.
// En vez de un login tradicional (email + contraseña), se elige un nombre
// de una lista fija (Nadia / Leo) y se escribe un código compartido.
// Por dentro seguimos usando una sesión anónima de Supabase, para que las
// reglas de seguridad de la base de datos (RLS) sigan exigiendo una sesión
// válida antes de dejar leer o escribir datos.
import { supabase } from "./supabaseClient.js";

export const USUARIO_STORAGE_KEY = "supermercado_usuario";

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

export function getUsuarioActual() {
  return localStorage.getItem(USUARIO_STORAGE_KEY);
}

// Verifica nombre + código contra la tabla "usuarios" y, si coincide, deja
// la app lista para usarse (guarda el nombre localmente para mostrarlo y
// para saber, la próxima vez que se abra la app, que ya se había ingresado).
export async function ingresar(nombre, codigo) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    const { error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError) {
      throw new Error("No se pudo conectar. Probá de nuevo.");
    }
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("nombre")
    .eq("nombre", nombre)
    .eq("codigo", codigo)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Usuario o código incorrecto.");
  }

  localStorage.setItem(USUARIO_STORAGE_KEY, data.nombre);
  return data.nombre;
}

export async function signOut() {
  localStorage.removeItem(USUARIO_STORAGE_KEY);
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
