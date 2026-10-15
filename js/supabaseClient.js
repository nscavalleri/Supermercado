// Cliente único de Supabase para toda la app.
// Usamos el build ESM desde CDN para no necesitar build tools (npm, webpack, etc.):
// la app funciona con solo abrir index.html o publicarla en GitHub Pages.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

// Reintento automático del error "JWT issued at future".
// Al abrir la app después de un rato, la sesión se renueva sola y Supabase
// entrega un "pase" nuevo. Si la base de datos lo recibe un instante antes de
// que su reloj llegue a la hora con la que se emitió el pase (diferencias de
// fracciones de segundo entre los servidores de Supabase), lo rechaza con
// "JWT issued at future". Esperando un momento y repitiendo el mismo pedido,
// funciona — por eso "la segunda vez carga bien". Esto lo hace solo, sin que
// se vea el error: hasta 3 reintentos (1 s, 2 s y 3 s de espera).
const MAX_REINTENTOS = 3;
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

export async function fetchConReintento(url, opciones) {
  for (let intento = 0; ; intento++) {
    const respuesta = await fetch(url, opciones);
    if (respuesta.status !== 401 || intento >= MAX_REINTENTOS) return respuesta;
    let texto = "";
    try {
      texto = await respuesta.clone().text();
    } catch {
      return respuesta;
    }
    if (!/issued at future/i.test(texto)) return respuesta;
    await esperar(1000 * (intento + 1));
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Mantiene la sesión guardada en el navegador (localStorage) y la renueva
    // sola, para no tener que loguearse de nuevo hasta hacer logout.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // Todos los pedidos a Supabase pasan por el reintento de arriba.
  global: { fetch: fetchConReintento },
});
