// Capa de acceso a datos: todas las consultas a Supabase pasan por acá,
// para que el resto de la app no tenga que saber SQL ni nombres de tablas.
import { supabase } from "./supabaseClient.js";

/* ---------- Productos (catálogo, se usa en Configuración y en los autocompletados) ---------- */

export async function fetchProductos() {
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, descripcion, tipo_producto_id, perecedero, tipo_producto:tipos_producto(id, nombre)")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data;
}

// tipoProductoId es opcional: cuando el producto se crea desde una lista
// (buscarOCrearProducto) siempre queda sin tipo (null), y se clasifica
// después desde Configuración > Productos.
// perecedero: si el producto se vence (columna productos.perecedero, por defecto false).
// descripcion: texto libre opcional (productos.descripcion); vacío se guarda como null.
// Solo se muestra en Configuración > Productos, no en las listas.
const limpiarDescripcion = (texto) => (texto || "").trim() || null;

export async function crearProducto(nombre, tipoProductoId = null, perecedero = false, descripcion = null) {
  const { data, error } = await supabase
    .from("productos")
    .insert({ nombre: nombre.trim(), tipo_producto_id: tipoProductoId, perecedero, descripcion: limpiarDescripcion(descripcion) })
    .select("id, nombre, descripcion, tipo_producto_id, perecedero, tipo_producto:tipos_producto(id, nombre)")
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarProducto(id, nombre, tipoProductoId = null, descripcion = null) {
  const { error } = await supabase
    .from("productos")
    .update({ nombre: nombre.trim(), tipo_producto_id: tipoProductoId, descripcion: limpiarDescripcion(descripcion) })
    .eq("id", id);
  if (error) throw error;
}

// Dónde se está usando un producto: listas de compra y comidas (como
// ingrediente). Se usa para avisar antes de eliminarlo.
// Devuelve { enOnline, supermercados: [nombres], comidas: [{ nombre, enMenu }],
//            stock: [{ fecha_vencimiento, cantidad }] }.
export async function fetchUsosProducto(productoId) {
  const [online, presencial, ingredientes, stock] = await Promise.all([
    supabase.from("lista_online").select("id").eq("producto_id", productoId),
    supabase
      .from("lista_presencial")
      .select("id, supermercado:supermercados(id, nombre)")
      .eq("producto_id", productoId),
    supabase
      .from("comida_ingredientes")
      .select("id, comida:comidas(id, nombre, menu:menu_semanal(id))")
      .eq("producto_id", productoId),
    supabase
      .from("stock")
      .select("id, fecha_vencimiento, cantidad")
      .eq("producto_id", productoId)
      .order("fecha_vencimiento", { ascending: true }),
  ]);
  for (const r of [online, presencial, ingredientes, stock]) if (r.error) throw r.error;

  const porNombre = (a, b) => a.localeCompare(b, "es", { sensitivity: "base" });
  const supermercados = [
    ...new Set((presencial.data || []).map((f) => f.supermercado?.nombre).filter(Boolean)),
  ].sort(porNombre);
  const comidas = (ingredientes.data || [])
    .filter((f) => f.comida)
    .map((f) => ({ nombre: f.comida.nombre, enMenu: (f.comida.menu || []).length > 0 }))
    .sort((a, b) => porNombre(a.nombre, b.nombre));

  return { enOnline: (online.data || []).length > 0, supermercados, comidas, stock: stock.data || [] };
}

// Antes de borrar el producto se lo quita explícitamente de las listas y de
// los ingredientes de las comidas, para no depender de cómo estén definidas
// las FK en la base (sin cascada, el delete fallaría por estar en uso).
export async function actualizarPerecederoProducto(id, perecedero) {
  const { error } = await supabase.from("productos").update({ perecedero }).eq("id", id);
  if (error) throw error;
}

export async function eliminarProducto(id) {
  for (const tabla of ["lista_online", "lista_presencial", "comida_ingredientes", "stock"]) {
    const { error: errorUso } = await supabase.from(tabla).delete().eq("producto_id", id);
    if (errorUso) throw errorUso;
  }
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

// Productos que tienen asignado un tipo: se usa para avisar antes de eliminar el tipo.
export async function fetchProductosPorTipo(tipoProductoId) {
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre")
    .eq("tipo_producto_id", tipoProductoId)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Antes de borrar el tipo, deja sus productos sin tipo (null) de forma explícita.
// Así quedan "Sin clasificar" sin depender de cómo esté definida la FK en la
// base (si fuera ON DELETE CASCADE, borrar el tipo borraría los productos).
export async function eliminarTipoProducto(id) {
  const { error: errorDesasignar } = await supabase
    .from("productos")
    .update({ tipo_producto_id: null })
    .eq("tipo_producto_id", id);
  if (errorDesasignar) throw errorDesasignar;

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
  // Mismo orden en toda la app: Principal, Guarnición y después el resto alfabético.
  return (data || []).sort((a, b) => {
    const [ga, na] = claveTipoComida(a.nombre);
    const [gb, nb] = claveTipoComida(b.nombre);
    return ga - gb || na.localeCompare(nb, "es");
  });
}

/* ---------- Comidas y sus ingredientes (Configuración > Menú) ---------- */
// Cada comida es un plato con uno o varios tipos (ej. Desayuno y Principal) y
// sus ingredientes son productos del catálogo. Los tipos de cada comida están
// en la tabla comida_tipos (comida_id, tipo_comida_id).

// Se piden los tipos pasando por comida_tipos de forma explícita (y no
// "tipos_comida" directo) para que Supabase no se confunda con la columna
// vieja comidas.tipo_comida_id mientras siga existiendo.
const SELECT_TIPOS = "comida_tipos(tipo:tipos_comida(id, nombre))";

// Deja en comida.tipos la lista [{id, nombre}] ordenada (Principal,
// Guarnición, después el resto alfabético) y saca el dato intermedio.
function conTipos(comida) {
  if (!comida) return comida;
  const { comida_tipos, ...resto } = comida;
  const tipos = (comida_tipos || []).map((ct) => ct.tipo).filter(Boolean);
  tipos.sort((a, b) => {
    const [ga, na] = claveTipoComida(a.nombre);
    const [gb, nb] = claveTipoComida(b.nombre);
    return ga - gb || na.localeCompare(nb, "es");
  });
  return { ...resto, tipos };
}

export async function fetchComidas() {
  const { data, error } = await supabase
    .from("comidas")
    .select(
      `id, nombre, repetible, ${SELECT_TIPOS}, ingredientes:comida_ingredientes(id, producto:productos(id, nombre))`
    )
    .order("nombre", { ascending: true });
  if (error) throw error;
  // Los ingredientes vienen en el orden que los devuelve la base: acá los
  // dejamos alfabéticos para que la pantalla sea previsible.
  return (data || []).map((comida) => ({
    ...conTipos(comida),
    ingredientes: (comida.ingredientes || []).sort((a, b) =>
      (a.producto?.nombre || "").localeCompare(b.producto?.nombre || "", "es", { sensitivity: "base" })
    ),
  }));
}

// Deja a la comida exactamente con estos tipos: agrega los que faltan y
// borra los que sobran (primero agrega, así nunca queda sin ninguno).
export async function guardarTiposComida(comidaId, tipoIds) {
  const { data, error } = await supabase.from("comida_tipos").select("tipo_comida_id").eq("comida_id", comidaId);
  if (error) throw error;
  const actuales = new Set((data || []).map((f) => f.tipo_comida_id));
  const nuevos = new Set(tipoIds);
  const agregar = [...nuevos].filter((id) => !actuales.has(id));
  const quitar = [...actuales].filter((id) => !nuevos.has(id));
  if (agregar.length > 0) {
    const { error: e1 } = await supabase
      .from("comida_tipos")
      .insert(agregar.map((id) => ({ comida_id: comidaId, tipo_comida_id: id })));
    if (e1 && e1.code !== "23505") throw e1;
  }
  for (const id of quitar) {
    const { error: e2 } = await supabase
      .from("comida_tipos")
      .delete()
      .eq("comida_id", comidaId)
      .eq("tipo_comida_id", id);
    if (e2) throw e2;
  }
}

// repetible: si la comida puede estar más de una vez en el menú de la semana
// (columna comidas.repetible, por defecto false). tipoIds: lista de ids de tipos_comida.
export async function crearComida(nombre, tipoIds = [], repetible = false) {
  const { data, error } = await supabase
    .from("comidas")
    .insert({ nombre: nombre.trim(), repetible })
    .select("id, nombre, repetible")
    .single();
  if (error) throw error;
  if (tipoIds.length > 0) await guardarTiposComida(data.id, tipoIds);
  return data;
}

export async function actualizarComida(id, nombre, tipoIds = []) {
  const { error } = await supabase.from("comidas").update({ nombre: nombre.trim() }).eq("id", id);
  if (error) throw error;
  await guardarTiposComida(id, tipoIds);
}

// Crea una comida nueva copiando los tipos, si es repetible y los ingredientes de otra.
export async function duplicarComida(nombre, tipoIds, productoIds, repetible = false) {
  const creada = await crearComida(nombre, tipoIds, repetible);
  if (productoIds.length > 0) {
    const { error } = await supabase
      .from("comida_ingredientes")
      .insert(productoIds.map((id) => ({ comida_id: creada.id, producto_id: id })));
    if (error) throw error;
  }
  return creada;
}

export async function actualizarRepetibleComida(id, repetible) {
  const { error } = await supabase.from("comidas").update({ repetible }).eq("id", id);
  if (error) throw error;
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
      `id, dia_id, momento_id, comida:comidas(id, nombre, repetible, ${SELECT_TIPOS}, ingredientes:comida_ingredientes(id, producto:productos(id, nombre)))`
    )
    .order("id", { ascending: true });
  if (error) throw error;
  return (data || []).map((item) => ({ ...item, comida: conTipos(item.comida) }));
}

export async function agregarComidaAlMenu(diaId, momentoId, comidaId) {
  const { error } = await supabase
    .from("menu_semanal")
    .insert({ dia_id: diaId, momento_id: momentoId, comida_id: comidaId });
  // 23505 = esa comida ya estaba en ese día y momento: se ignora.
  if (error && error.code !== "23505") throw error;
}

// Vacía el menú de la semana entero (todas las filas de menu_semanal). Las
// comidas del catálogo no se tocan. El filtro "id > 0" es porque Supabase no
// deja borrar una tabla sin ninguna condición; todos los ids son positivos.
export async function vaciarMenuSemanal() {
  const { error } = await supabase.from("menu_semanal").delete().gt("id", 0);
  if (error) throw error;
}

// Mueve una comida del menú a otro día y/o momento (arrastrar en Menú 2).
// Devuelve false si en ese destino ya estaba esa misma comida (no se duplica).
export async function moverComidaDelMenu(id, diaId, momentoId) {
  const { error } = await supabase.from("menu_semanal").update({ dia_id: diaId, momento_id: momentoId }).eq("id", id);
  if (error && error.code === "23505") return false;
  if (error) throw error;
  return true;
}

export async function quitarComidaDelMenu(id) {
  const { error } = await supabase.from("menu_semanal").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Configuración general (tabla "configuracion") ---------- */
// Parámetros de la app guardados como clave/valor (texto). Se editan solo
// desde Supabase, no desde la app: el cliente tiene permiso de lectura nomás.
// Devuelve el valor como texto, o null si esa clave no está cargada.
export async function fetchConfiguracion(clave) {
  const { data, error } = await supabase.from("configuracion").select("valor").eq("clave", clave).maybeSingle();
  if (error) throw error;
  return data ? data.valor : null;
}

/* ---------- Stock (productos en casa, con fecha de vencimiento y cantidad) ---------- */
// Un mismo producto puede estar varias veces si vence en fechas distintas; para
// la misma fecha hay una sola fila (UNIQUE producto_id + fecha_vencimiento) y
// agregar de nuevo suma la cantidad. Consumirlo (tildar) borra la fila.

export async function fetchStock() {
  const { data, error } = await supabase
    .from("stock")
    .select("id, fecha_vencimiento, cantidad, producto:productos(id, nombre)")
    .order("fecha_vencimiento", { ascending: true });
  if (error) throw error;
  return data || [];
}

// fechaVencimiento en formato "AAAA-MM-DD" (lo que devuelve un <input type="date">).
// Devuelve { sumado: true/false, cantidad: total que quedó }.
export async function agregarStock(productoId, fechaVencimiento, cantidad) {
  async function sumarAExistente() {
    const { data: existente, error } = await supabase
      .from("stock")
      .select("id, cantidad")
      .eq("producto_id", productoId)
      .eq("fecha_vencimiento", fechaVencimiento)
      .maybeSingle();
    if (error) throw error;
    if (!existente) return null;
    const total = existente.cantidad + cantidad;
    const { error: errorUpdate } = await supabase.from("stock").update({ cantidad: total }).eq("id", existente.id);
    if (errorUpdate) throw errorUpdate;
    return { sumado: true, cantidad: total };
  }

  const sumado = await sumarAExistente();
  if (sumado) return sumado;

  const { error } = await supabase
    .from("stock")
    .insert({ producto_id: productoId, fecha_vencimiento: fechaVencimiento, cantidad });
  if (!error) return { sumado: false, cantidad };
  // 23505 = justo otra pestaña creó la misma fila recién: se suma a esa.
  if (error.code === "23505") {
    const reintento = await sumarAExistente();
    if (reintento) return reintento;
  }
  throw error;
}

// Stock que vence hasta una fecha dada (incluye lo ya vencido). Se usa para
// el aviso de vencimientos de arriba de la pantalla.
export async function fetchStockPorVencer(hastaFechaISO) {
  const { data, error } = await supabase
    .from("stock")
    .select("id, fecha_vencimiento, cantidad, producto:productos(id, nombre)")
    .lte("fecha_vencimiento", hastaFechaISO)
    .order("fecha_vencimiento", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Edita una fila de stock entera (producto, fecha de vencimiento y cantidad).
// Devuelve false si choca con otra fila del mismo producto y fecha (23505).
export async function actualizarItemStock(id, productoId, fechaVencimiento, cantidad) {
  const { error } = await supabase
    .from("stock")
    .update({ producto_id: productoId, fecha_vencimiento: fechaVencimiento, cantidad })
    .eq("id", id);
  if (error && error.code === "23505") return false;
  if (error) throw error;
  return true;
}

export async function actualizarCantidadStock(id, cantidad) {
  const { error } = await supabase.from("stock").update({ cantidad }).eq("id", id);
  if (error) throw error;
}

export async function eliminarItemStock(id) {
  const { error } = await supabase.from("stock").delete().eq("id", id);
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

/* ---------- Orden de las comidas dentro de un día/momento del menú ---------- */
// Primero los platos principales, después las guarniciones, después cualquier
// otro tipo (alfabético) y al final las que no tienen tipo. Dentro del mismo
// tipo, en el orden en que se cargaron. Lo usan las dos versiones del Menú.
const ORDEN_TIPOS_COMIDA = ["principal", "guarnicion"];

// Posición de un tipo de comida en ese orden: [grupo, nombre para desempatar].
function claveTipoComida(nombreTipo) {
  const nombre = (nombreTipo || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!nombre) return [3, ""];
  const i = ORDEN_TIPOS_COMIDA.indexOf(nombre);
  return i >= 0 ? [i, ""] : [2, nombre];
}

// Una comida con varios tipos se ordena por el que va primero (ej. una que es
// Desayuno y Principal se ordena como Principal).
export function ordenarPorTipoComida(items) {
  const clave = (item) => {
    const tipos = item.comida?.tipos || [];
    if (tipos.length === 0) return [3, ""];
    return tipos.map((t) => claveTipoComida(t.nombre)).sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1], "es"))[0];
  };
  return [...items].sort((a, b) => {
    const [ga, na] = clave(a);
    const [gb, nb] = clave(b);
    return ga - gb || na.localeCompare(nb, "es") || a.id - b.id;
  });
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
