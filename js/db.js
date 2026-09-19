// Capa de acceso a datos: todas las consultas a Supabase pasan por acá,
// para que el resto de la app no tenga que saber SQL ni nombres de tablas.
import { supabase } from "./supabaseClient.js";

/* ---------- Productos (catálogo, se usa en Configuración y en los autocompletados) ---------- */

export async function fetchProductos() {
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data;
}

export async function crearProducto(nombre) {
  const { data, error } = await supabase
    .from("productos")
    .insert({ nombre: nombre.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarProducto(id, nombre) {
  const { error } = await supabase.from("productos").update({ nombre: nombre.trim() }).eq("id", id);
  if (error) throw error;
}

export async function eliminarProducto(id) {
  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) throw error;
}

// Busca un producto por nombre (sin importar mayúsculas/espacios); si no existe, lo crea.
// Esto es lo que permite que al escribir en la lista, si el producto no está
// cargado en Configuración > Productos, se cree solo.
export async function buscarOCrearProducto(nombreIngresado) {
  const nombre = nombreIngresado.trim();
  if (!nombre) throw new Error("El nombre del producto no puede estar vacío");

  const { data: existentes, error: errorBusqueda } = await supabase
    .from("productos")
    .select("id, nombre")
    .ilike("nombre", nombre);
  if (errorBusqueda) throw errorBusqueda;

  if (existentes && existentes.length > 0) return existentes[0];

  try {
    return await crearProducto(nombre);
  } catch (err) {
    // Si dos pestañas/clicks intentan crear el mismo producto al mismo tiempo,
    // puede que ya lo haya creado la otra petición justo antes: en vez de
    // mostrar un error, buscamos de nuevo y devolvemos el que ya existe.
    if (err?.code === "23505") {
      const { data: reintento, error: errorReintento } = await supabase
        .from("productos")
        .select("id, nombre")
        .ilike("nombre", nombre);
      if (!errorReintento && reintento && reintento.length > 0) return reintento[0];
    }
    throw err;
  }
}

/* ---------- Supermercados (catálogo, se usa en Configuración y en Lista > Presencial) ---------- */

export async function fetchSupermercados() {
  const { data, error } = await supabase
    .from("supermercados")
    .select("id, nombre")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data;
}

export async function crearSupermercado(nombre) {
  const { data, error } = await supabase
    .from("supermercados")
    .insert({ nombre: nombre.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarSupermercado(id, nombre) {
  const { error } = await supabase.from("supermercados").update({ nombre: nombre.trim() }).eq("id", id);
  if (error) throw error;
}

export async function eliminarSupermercado(id) {
  const { error } = await supabase.from("supermercados").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Lista online ---------- */
// No tiene cantidad ni "comprado": comprar un producto es sacarlo de la lista.

export async function fetchListaOnline() {
  const { data, error } = await supabase
    .from("lista_online")
    .select("id, producto:productos(id, nombre)")
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

export async function agregarItemOnline(productoId) {
  const { data, error } = await supabase
    .from("lista_online")
    .insert({ producto_id: productoId })
    .select("id, producto:productos(id, nombre)")
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarItemOnline(id) {
  const { error } = await supabase.from("lista_online").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Lista presencial (por supermercado, y vista "Todos") ---------- */
// Misma idea: sin cantidad ni "comprado", comprar = eliminar de la lista.

export async function fetchListaPresencial(supermercadoId) {
  const { data, error } = await supabase
    .from("lista_presencial")
    .select("id, producto:productos(id, nombre)")
    .eq("supermercado_id", supermercadoId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchListaPresencialTodos() {
  const { data, error } = await supabase
    .from("lista_presencial")
    .select("id, producto:productos(id, nombre), supermercado:supermercados(id, nombre)")
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

export async function agregarItemPresencial(productoId, supermercadoId) {
  const { data, error } = await supabase
    .from("lista_presencial")
    .insert({ producto_id: productoId, supermercado_id: supermercadoId })
    .select("id, producto:productos(id, nombre)")
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarItemPresencial(id) {
  const { error } = await supabase.from("lista_presencial").delete().eq("id", id);
  if (error) throw error;
}
