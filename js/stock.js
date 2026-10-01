// Pantalla Stock: los productos que hay en casa, con su fecha de vencimiento
// y cantidad de unidades.
// - "Agregar stock" abre un formulario (producto del catálogo + fecha +
//   cantidad). Producto y fecha arrancan vacíos y son obligatorios.
// - El mismo producto puede estar dos veces si vence en fechas distintas; si
//   se agrega con una fecha que ya estaba, se suma la cantidad ingresada.
// - La cantidad se edita directo en la lista; tildar el check saca el
//   producto del stock (igual que "comprado" en las listas de compra).
import {
  el,
  clearNode,
  showMensaje,
  abrirFormularioModal,
  crearCampoAutocompletado,
  crearCampoFecha,
  mismoNombre,
  botonIcono,
} from "./ui.js";
import {
  fetchStock,
  fetchProductos,
  agregarStock,
  actualizarCantidadStock,
  actualizarItemStock,
  eliminarItemStock,
} from "./db.js";
import { actualizarAvisoVencimientos } from "./avisoVencimientos.js";

const ORDENES = {
  "vencimiento-asc": { texto: "Vencimiento (más próximo primero)" },
  "vencimiento-desc": { texto: "Vencimiento (más lejano primero)" },
  "nombre-asc": { texto: "Nombre (A → Z)" },
  "nombre-desc": { texto: "Nombre (Z → A)" },
};
// El orden elegido se recuerda mientras la app esté abierta (al cambiar de
// solapa y volver, sigue el mismo).
let ordenActual = "vencimiento-asc";

// "2026-10-12" → "12/10/2026"
function formatearFecha(iso) {
  const [a, m, d] = (iso || "").split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso || "";
}

// Fecha de hoy en "AAAA-MM-DD", según el reloj del dispositivo (no UTC).
function hoyISO() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

const nombreDe = (item) => item.producto?.nombre || "";
const porNombre = (a, b) => nombreDe(a).localeCompare(nombreDe(b), "es", { sensitivity: "base" });
const porFecha = (a, b) => (a.fecha_vencimiento || "").localeCompare(b.fecha_vencimiento || "");

function ordenar(items, orden) {
  const copia = [...items];
  // Criterio principal y, para empatar, el otro (mismo producto → por fecha;
  // misma fecha → por nombre), así el orden siempre es previsible.
  if (orden === "nombre-asc") copia.sort((a, b) => porNombre(a, b) || porFecha(a, b));
  else if (orden === "nombre-desc") copia.sort((a, b) => porNombre(b, a) || porFecha(a, b));
  else if (orden === "vencimiento-desc") copia.sort((a, b) => porFecha(b, a) || porNombre(a, b));
  else copia.sort((a, b) => porFecha(a, b) || porNombre(a, b));
  return copia;
}

export async function renderStock(container) {
  clearNode(container);

  const mensajeBox = el("div", { class: "mensaje-box" });
  const listaBox = el("div", { class: "lista-stock" }, "Cargando...");
  let items = [];

  const botonAgregar = el("button", { class: "btn btn--primario", type: "button" }, "Agregar stock");
  // Botón de ícono (descargar), sin texto: el tooltip explica qué hace.
  const botonExportar = botonIcono("descargar", "Descargar el stock en Excel");

  const selectOrden = el("select", { class: "select-tipo", id: "orden-stock" });
  Object.entries(ORDENES).forEach(([valor, { texto }]) => selectOrden.appendChild(el("option", { value: valor }, texto)));
  selectOrden.value = ordenActual;
  selectOrden.addEventListener("change", () => {
    ordenActual = selectOrden.value;
    pintar();
  });

  container.appendChild(el("h2", {}, "Stock"));
  container.appendChild(mensajeBox);
  container.appendChild(el("div", { class: "stock__barra" }, [
    el("div", { class: "stock__botones" }, [botonAgregar, botonExportar]),
    el("div", { class: "form-filtro stock__orden" }, [
      el("label", { class: "form-filtro__label", for: "orden-stock" }, "Ordenar por"),
      selectOrden,
    ]),
  ]));
  container.appendChild(listaBox);

  async function cargar() {
    try {
      items = await fetchStock();
      pintar();
    } catch (err) {
      clearNode(listaBox);
      showMensaje(mensajeBox, "No se pudo cargar el stock: " + err.message);
    }
  }

  function pintar() {
    clearNode(listaBox);
    // Sin nada en stock no hay qué exportar.
    botonExportar.disabled = items.length === 0;
    if (items.length === 0) {
      listaBox.appendChild(el("p", { class: "texto-ayuda" }, "No hay nada en stock. Tocá \"Agregar stock\" para cargar un producto."));
      return;
    }
    const ul = el("ul", { class: "item-lista" });
    ordenar(items, ordenActual).forEach((item) => ul.appendChild(renderFila(item)));
    listaBox.appendChild(ul);
  }

  function renderFila(item) {
    const checkbox = el("input", { type: "checkbox", "aria-label": "Sacar del stock" });
    const vencido = item.fecha_vencimiento < hoyISO();
    const info = el("div", { class: "stock__info" }, [
      el("span", { class: "item-lista__nombre" }, item.producto ? item.producto.nombre : "(producto eliminado)"),
      el(
        "span",
        { class: "stock__vence" + (vencido ? " stock__vence--vencido" : "") },
        (vencido ? "Venció el " : "Vence el ") + formatearFecha(item.fecha_vencimiento)
      ),
    ]);

    const inputCantidad = el("input", {
      type: "number",
      class: "stock__cantidad",
      min: "1",
      step: "1",
      inputmode: "numeric",
      value: String(item.cantidad),
      "aria-label": "Cantidad de unidades",
    });
    const cantidadBox = el("label", { class: "stock__cantidad-box" }, [inputCantidad, el("span", {}, "u.")]);

    // Lápiz: abre el formulario para cambiar producto, fecha de vencimiento o cantidad.
    const botonEditar = botonIcono("editar", "Editar (producto, fecha o cantidad)");
    botonEditar.classList.add("btn-icono--chico");
    botonEditar.addEventListener("click", () => abrirFormularioStock(item));

    const li = el("li", { class: "item-lista__fila stock__fila" }, [checkbox, info, cantidadBox, botonEditar]);

    // La cantidad se guarda al salir del campo o con Enter.
    async function guardarCantidad() {
      const valor = inputCantidad.value.trim();
      const nueva = Number(valor);
      if (nueva === item.cantidad) return;
      if (!valor || !Number.isInteger(nueva) || nueva < 1) {
        showMensaje(mensajeBox, "La cantidad tiene que ser un número entero mayor a 0. Para sacar el producto del stock, tildá el check.");
        inputCantidad.value = String(item.cantidad);
        return;
      }
      try {
        await actualizarCantidadStock(item.id, nueva);
        item.cantidad = nueva;
        clearNode(mensajeBox);
      } catch (err) {
        showMensaje(mensajeBox, "No se pudo actualizar la cantidad: " + err.message);
        inputCantidad.value = String(item.cantidad);
      }
    }
    inputCantidad.addEventListener("change", guardarCantidad);
    inputCantidad.addEventListener("keydown", (e) => {
      if (e.key === "Enter") inputCantidad.blur();
    });

    checkbox.addEventListener("change", () => {
      // Igual que en las listas de compra: se marca por un instante y se elimina.
      checkbox.disabled = true;
      li.classList.add("item-lista__fila--comprado");
      setTimeout(async () => {
        try {
          await eliminarItemStock(item.id);
          items = items.filter((i) => i.id !== item.id);
          pintar();
          actualizarAvisoVencimientos();
        } catch (err) {
          showMensaje(mensajeBox, "No se pudo actualizar el stock: " + err.message);
          checkbox.disabled = false;
          checkbox.checked = false;
          li.classList.remove("item-lista__fila--comprado");
        }
      }, 350);
    });

    return li;
  }

  /* ---------- Exportar a Excel ---------- */
  // Descarga un .xlsx con todo el stock, en el MISMO orden que está elegido en
  // "Ordenar por" (lo que ves en pantalla es lo que bajás).
  // La librería de Excel (SheetJS) se baja recién al tocar el botón, desde su
  // CDN oficial, así no hace más lenta la carga de la app.
  botonExportar.addEventListener("click", async () => {
    botonExportar.disabled = true;
    botonExportar.classList.add("btn-icono--cargando");
    try {
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
      // Se relee el stock para exportar lo último (por si la otra persona cambió algo).
      items = await fetchStock();
      pintar();
      const hoy = hoyISO();
      const ordenados = ordenar(items, ordenActual);

      const filas = ordenados.map((item) => {
        const [a, m, d] = item.fecha_vencimiento.split("-").map(Number);
        const dias = Math.round((new Date(a, m - 1, d) - new Date(hoy + "T00:00:00")) / 86400000);
        const estado = dias < 0 ? "Vencido" : dias === 0 ? "Vence hoy" : dias === 1 ? "Vence mañana" : `Vence en ${dias} días`;
        return [new Date(a, m - 1, d), item.producto ? item.producto.nombre : "(producto eliminado)", item.cantidad, estado];
      });
      const hoja = XLSX.utils.aoa_to_sheet([["Fecha de vencimiento", "Producto", "Cantidad", "Estado"], ...filas], {
        cellDates: true,
      });
      // Fechas con formato día/mes/año y ancho de columnas legible.
      for (let fila = 1; fila <= filas.length; fila++) {
        const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: 0 })];
        if (celda) celda.z = "dd/mm/yyyy";
      }
      hoja["!cols"] = [{ wch: 20 }, { wch: 32 }, { wch: 10 }, { wch: 18 }];
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Stock");
      XLSX.writeFile(libro, `Stock ${formatearFecha(hoy).replaceAll("/", "-")}.xlsx`);
      clearNode(mensajeBox);
    } catch (err) {
      showMensaje(
        mensajeBox,
        "No se pudo exportar a Excel (¿hay conexión a internet?): " + (err?.message || err)
      );
    } finally {
      botonExportar.classList.remove("btn-icono--cargando");
      botonExportar.disabled = items.length === 0;
    }
  });

  botonAgregar.addEventListener("click", () => abrirFormularioStock(null));

  // Formulario de stock, para AGREGAR (item = null) o EDITAR una fila existente.
  async function abrirFormularioStock(item) {
    const editando = !!item;
    let catalogo = [];
    try {
      catalogo = await fetchProductos();
    } catch (err) {
      showMensaje(mensajeBox, "No se pudo cargar el catálogo de productos: " + err.message);
      return;
    }

    const campoProducto = crearCampoAutocompletado({
      id: "stock-producto",
      placeholder: "Escribí para buscar (ej: Leche)",
      getSugerencias: (texto) => catalogo.filter((p) => p.nombre.toLowerCase().includes(texto.toLowerCase())),
    });
    // Fecha siempre en dd/mm/aaaa (ver crearCampoFecha en ui.js).
    const campoFecha = crearCampoFecha({ id: "stock-fecha" });
    const inputCantidad = el("input", { type: "number", id: "stock-cantidad", min: "1", step: "1", inputmode: "numeric", value: "1" });
    if (editando) {
      // Al editar, el formulario viene completo con lo que ya estaba.
      campoProducto.input.value = item.producto ? item.producto.nombre : "";
      campoFecha.setISO(item.fecha_vencimiento);
      inputCantidad.value = String(item.cantidad);
    }

    let resultado = null;
    const guardado = await abrirFormularioModal({
      titulo: editando ? "Editar stock" : "Agregar stock",
      textoAceptar: editando ? "Guardar" : "Agregar",
      campos: [
        el("label", { class: "modal__campo", for: "stock-producto" }, ["Producto *", campoProducto.nodo]),
        el("label", { class: "modal__campo", for: "stock-fecha" }, ["Fecha de vencimiento *", campoFecha.nodo]),
        el("label", { class: "modal__campo", for: "stock-cantidad" }, ["Cantidad de unidades", inputCantidad]),
      ],
      guardar: async () => {
        const nombre = campoProducto.input.value.trim();
        const fecha = campoFecha.getISO();
        const cantidadTexto = inputCantidad.value.trim();
        const cantidad = Number(cantidadTexto);

        const faltan = [];
        if (!nombre) faltan.push("el producto");
        if (fecha === "") faltan.push("la fecha de vencimiento");
        if (faltan.length) return `Completá ${faltan.join(" y ")}.`;
        if (fecha === null) return "La fecha de vencimiento no es válida. Escribila como dd/mm/aaaa (ej: 15/10/2026).";

        const producto = catalogo.find((p) => mismoNombre(p.nombre, nombre));
        if (!producto)
          return `"${nombre}" no está en el catálogo. Elegí un producto de la lista, o agregalo primero en Configuración > Productos.`;
        if (!cantidadTexto || !Number.isInteger(cantidad) || cantidad < 1)
          return "La cantidad tiene que ser un número entero mayor a 0.";

        if (!editando) {
          resultado = { modo: "agregar", producto, fecha, ...(await agregarStock(producto.id, fecha, cantidad)) };
          return null;
        }

        // Editando: si no cambió nada, se cierra sin tocar la base.
        if (producto.id === item.producto?.id && fecha === item.fecha_vencimiento && cantidad === item.cantidad) return null;

        // Si con el cambio queda igual a OTRA fila (mismo producto y misma
        // fecha), se juntan en una sola sumando las cantidades, igual que al
        // agregar. Se relee el stock por si la otra persona cambió algo.
        const actuales = await fetchStock();
        const otra = actuales.find(
          (s) => s.id !== item.id && s.producto?.id === producto.id && s.fecha_vencimiento === fecha
        );
        if (otra) {
          const total = otra.cantidad + cantidad;
          await actualizarCantidadStock(otra.id, total);
          await eliminarItemStock(item.id);
          resultado = { modo: "juntado", producto, fecha, cantidad: total };
          return null;
        }
        const ok = await actualizarItemStock(item.id, producto.id, fecha, cantidad);
        if (!ok) return `Ya hay "${producto.nombre}" con vencimiento ${formatearFecha(fecha)}. Probá de nuevo.`;
        resultado = { modo: "editado", producto, fecha, cantidad };
        return null;
      },
    });

    if (!guardado || !resultado) return;
    const { modo, producto, fecha, cantidad } = resultado;
    const textos = {
      agregar: resultado.sumado
        ? `"${producto.nombre}" ya estaba con vencimiento ${formatearFecha(fecha)}: se sumó la cantidad (ahora hay ${cantidad}).`
        : `Se agregó "${producto.nombre}" (vence el ${formatearFecha(fecha)}).`,
      editado: `Se actualizó "${producto.nombre}" (vence el ${formatearFecha(fecha)}, ${cantidad} u.).`,
      juntado: `Ya había "${producto.nombre}" con vencimiento ${formatearFecha(fecha)}: se juntaron en una sola fila (ahora hay ${cantidad}).`,
    };
    showMensaje(mensajeBox, textos[modo], "info");
    await cargar();
    actualizarAvisoVencimientos();
  }

  await cargar();
}
