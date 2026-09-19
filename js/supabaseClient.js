// Cliente único de Supabase para toda la app.
// Usamos el build ESM desde CDN para no necesitar build tools (npm, webpack, etc.):
// la app funciona con solo abrir index.html o publicarla en GitHub Pages.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Mantiene la sesión guardada en el navegador (localStorage) y la renueva
    // sola, para no tener que loguearse de nuevo hasta hacer logout.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
