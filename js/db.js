// Capa de acceso a datos: todas las consultas a Supabase pasan por acá,
// para que el resto de la app no tenga que saber SQL ni nombres de tablas.
import { supabase } from "./supabaseClient.js";

/* ---------- Productos (catálogo, se usa en Configuración y en los autocompletados) ---------- */

export async function fetchProductos() {
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, tipo_producto_id, tipo_producto:tipos_producto(id, nombre)")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data;
}

// tipoProductoId es opcional: cuando el producto se crea desde una lista
// (buscarOCrearProducto) siempre queda sin tipo (null), y se clasifica
// después desde Configuración > Productos.
export async function crearProducto(nombre, tipoProductoId = null) {
  const { data, error } = await supabase
    .from("productos")
    .insert({ nombre: nombre.trim(), tipo_producto_id: tipoProductoId })
    .select("id, nombre, tipo_producto_id, tipo_producto:tipos_producto(id, nombre)")
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarProducto(id, nombre, tipoProductoId = null) {
  const { error } = await supabase
    .from("productos")
    .update({ nombre: nombre.trim(), tipo_producto_id: tipoProductoId })
    .eq("id", id);
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

/* ---------- Tipos de producto (catálogo, configurable en Configuración) ---------- */
// Se usan para clasificar los productos y para ordenar las listas de compra
// (primero por tipo, después alfabéticamente; ver ordenarPorTipoYNombre más abajo).

export async function fetchTiposProducto() {
  const { data, error } = await supabase
    .from("tipos_producto")
    .select("id, nombre")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data;
}

export async function crearTipoProducto(nombre) {
  const { data, error } = await supabase
    .from("tipos_producto")
    .insert({ nombre: nombre.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarTipoProducto(id, nombre) {
  const { error } = await supabase.from("tipos_producto").update({ nombre: nombre.trim() }).eq("id", id);
  if (error) throw error;
}

export async function eliminarTipoProducto(id) {
  const { error } = await supabase.from("tipos_producto").delete().eq("id", id);
  if (error) throw error;
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
    .select("id, producto:productos(id, nombre, tipo_producto:tipos_producto(id, nombre))")
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
    .select("id, producto:productos(id, nombre, tipo_producto:tipos_producto(id, nombre))")
    .eq("supermercado_id", supermercadoId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchListaPresencialTodos() {
  const { data, error } = await supabase
    .from("lista_presencial")
    .select(
      "id, producto:productos(id, nombre, tipo_producto:tipos_producto(id, nombre)), supermercado:supermercados(id, nombre)"
    )
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

/* ---------- Menú: catálogos fijos (días y momentos de comida) ---------- */
// Son tablas chicas que no se editan desde la app: se cargan una vez con el
// SQL de creación (1 = Lunes ... 7 = Domingo; Almuerzo y Cena).

export async function fetchDiasSemana() {
  const { data, error } = await supabase
    .from("dias_semana")
    .select("id, nombre")
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchMomentosComida() {
  const { data, error } = await supabase
    .from("momentos_comida")
    .select("id, nombre, orden")
    .order("orden", { ascending: true });
  if (error) throw error;
  return data;
}

/* ---------- Tipos de comida (Principal, Guarnición...) ---------- */
// Catálogo de solo lectura para la app: se carga directo por base de datos.

export async function fetchTiposComida() {
  const { data, error } = await supabase
    .from("tipos_comida")
    .select("id, nombre")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data;
}

/* ---------- Comidas y sus ingredientes (Configuración > Menú) ---------- */
// Cada comida es un plato con un tipo, y sus ingredientes son productos del catálogo.

export async function fetchComidas() {
  const { data, error } = await supabase
    .from("comidas")
    .select(
      "id, nombre, tipo_comida_id, tipo_comida:tipos_comida(id, nombre), ingredientes:comida_ingredientes(id, producto:productos(id, nombre))"
    )
    .order("nombre", { ascending: true });
  if (error) throw error;
  // Los ingredientes vienen en el orden que los devuelve la base: acá los
  // dejamos alfabéticos para que la pantalla sea previsible.
  return (data || []).map((comida) => ({
    ...comida,
    ingredientes: (comida.ingredientes || []).sort((a, b) =>
      (a.producto?.nombre || "").localeCompare(b.producto?.nombre || "", "es", { sensitivity: "base" })
    ),
  }));
}

export async function crearComida(nombre, tipoComidaId = null) {
  const { data, error } = await supabase
    .from("comidas")
    .insert({ nombre: nombre.trim(), tipo_comida_id: tipoComidaId })
    .select("id, nombre, tipo_comida_id")
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarComida(id, nombre, tipoComidaId = null) {
  const { error } = await supabase
    .from("comidas")
    .update({ nombre: nombre.trim(), tipo_comida_id: tipoComidaId })
    .eq("id", id);
  if (error) throw error;
}

// Crea una comida nueva copiando el tipo y los ingredientes de otra.
export async function duplicarComida(nombre, tipoComidaId, productoIds) {
  const creada = await crearComida(nombre, tipoComidaId);
  if (productoIds.length > 0) {
    const { error } = await supabase
      .from("comida_ingredientes")
      .insert(productoIds.map((id) => ({ comida_id: creada.id, producto_id: id })));
    if (error) throw error;
  }
  return creada;
}

export async function eliminarComida(id) {
  const { error } = await supabase.from("comidas").delete().eq("id", id);
  if (error) throw error;
}

export async function agregarIngrediente(comidaId, productoId) {
  const { error } = await supabase
    .from("comida_ingredientes")
    .insert({ comida_id: comidaId, producto_id: productoId });
  // 23505 = ya estaba ese producto en esa comida: no es un error para el usuario.
  if (error && error.code !== "23505") throw error;
}

export async function eliminarIngrediente(id) {
  const { error } = await supabase.from("comida_ingredientes").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Menú semanal (plantilla fija que se repite cada semana) ---------- */

export async function fetchMenuSemanal() {
  const { data, error } = await supabase
    .from("menu_semanal")
    .select(
      "id, dia_id, momento_id, comida:comidas(id, nombre, tipo_comida:tipos_comida(id, nombre), ingredientes:comida_ingredientes(id, producto:productos(id, nombre)))"
    )
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

export async function agregarComidaAlMenu(diaId, momentoId, comidaId) {
  const { error } = await supabase
    .from("menu_semanal")
    .insert({ dia_id: diaId, momento_id: momentoId, comida_id: comidaId });
  // 23505 = esa comida ya estaba en ese día y momento: se ignora.
  if (error && error.code !== "23505") throw error;
}

export async function quitarComidaDelMenu(id) {
  const { error } = await supabase.from("menu_semanal").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Mandar varios productos a una lista de compra ---------- */
// destino: { tipo: "presencial", supermercadoId } | { tipo: "online" }
// Devuelve { agregados, yaEstaban } para poder avisar qué pasó.
// Los productos que ya estaban en esa lista se ignoran (no se duplican).

export async function agregarProductosALista(productoIds, destino) {
  const ids = [...new Set(productoIds)];
  if (ids.length === 0) return { agregados: 0, yaEstaban: 0 };

  const esOnline = destino.tipo === "online";
  const actuales = esOnline ? await fetchListaOnline() : await fetchListaPresencial(destino.supermercadoId);
  const yaEnLista = new Set((actuales || []).map((item) => item.producto?.id).filter(Boolean));

  const faltantes = ids.filter((id) => !yaEnLista.has(id));
  if (faltantes.length > 0) {
    const filas = esOnline
      ? faltantes.map((id) => ({ producto_id: id }))
      : faltantes.map((id) => ({ producto_id: id, supermercado_id: destino.supermercadoId }));
    const { error } = await supabase.from(esOnline ? "lista_online" : "lista_presencial").insert(filas);
    if (error) throw error;
  }

  return { agregados: faltantes.length, yaEstaban: ids.length - faltantes.length };
}

/* ---------- Orden/agrupado por tipo de producto (usado por las listas online y presencial) ---------- */
// Agrupa items de una lista (cada uno con item.producto.tipo_producto) por
// nombre de tipo, ordena los grupos alfabéticamente y deja "Sin clasificar"
// (productos sin tipo asignado, o sin tipo cargado) siempre al final. Dentro
// de cada grupo, los productos quedan ordenados alfabéticamente.
export const SIN_CLASIFICAR = "Sin clasificar";

export function agruparPorTipo(items) {
  const grupos = new Map();
  items.forEach((item) => {
    const tipoNombre = item.producto?.tipo_producto?.nombre?.trim() || SIN_CLASIFICAR;
    if (!grupos.has(tipoNombre)) grupos.set(tipoNombre, []);
    grupos.get(tipoNombre).push(item);
  });

  const nombreDe = (item) => (item.producto ? item.producto.nombre : "");
  for (const lista of grupos.values()) {
    lista.sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), "es", { sensitivity: "base" }));
  }

  const nombresTipo = Array.from(grupos.keys()).sort((a, b) => {
    if (a === SIN_CLASIFICAR) return 1;
    if (b === SIN_CLASIFICAR) return -1;
    return a.localeCompare(b, "es", { sensitivity: "base" });
  });

  return nombresTipo.map((tipoNombre) => ({ tipoNombre, items: grupos.get(tipoNombre) }));
}
