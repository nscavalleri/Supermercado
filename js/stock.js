// Pantalla Stock: los productos que hay en casa, con su fecha de vencimiento
// y cantidad de unidades.
// - "Agregar stock" abre un formulario (producto del catálogo + fecha +
//   cantidad). Producto y fecha arrancan vacíos y son obligatorios.
// - El mismo producto puede estar dos veces si vence en fechas distintas; si
//   se agrega con una fecha que ya estaba, se suma la cantidad ingresada.
// - La cantidad se edita directo en la lista; tildar el check saca el
//   producto del stock (igual que "comprado" en las listas de compra).
import { el, clearNode, showMensaje, abrirFormularioModal, crearCampoAutocompletado, mismoNombre } from "./ui.js";
import { fetchStock, fetchProductos, agregarStock, actualizarCantidadStock, eliminarItemStock } from "./db.js";

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
    botonAgregar,
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

    const li = el("li", { class: "item-lista__fila stock__fila" }, [checkbox, info, cantidadBox]);

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

  botonAgregar.addEventListener("click", async () => {
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
    const inputFecha = el("input", { type: "date", id: "stock-fecha" });
    const inputCantidad = el("input", { type: "number", id: "stock-cantidad", min: "1", step: "1", inputmode: "numeric", value: "1" });

    let resultado = null;
    const guardado = await abrirFormularioModal({
      titulo: "Agregar stock",
      textoAceptar: "Agregar",
      campos: [
        el("label", { class: "modal__campo", for: "stock-producto" }, ["Producto *", campoProducto.nodo]),
        el("label", { class: "modal__campo", for: "stock-fecha" }, ["Fecha de vencimiento *", inputFecha]),
        el("label", { class: "modal__campo", for: "stock-cantidad" }, ["Cantidad de unidades", inputCantidad]),
      ],
      guardar: async () => {
        const nombre = campoProducto.input.value.trim();
        const fecha = inputFecha.value;
        const cantidadTexto = inputCantidad.value.trim();
        const cantidad = Number(cantidadTexto);

        const faltan = [];
        if (!nombre) faltan.push("el producto");
        if (!fecha) faltan.push("la fecha de vencimiento");
        if (faltan.length) return `Completá ${faltan.join(" y ")}.`;

        const producto = catalogo.find((p) => mismoNombre(p.nombre, nombre));
        if (!producto)
          return `"${nombre}" no está en el catálogo. Elegí un producto de la lista, o agregalo primero en Configuración > Productos.`;
        if (!cantidadTexto || !Number.isInteger(cantidad) || cantidad < 1)
          return "La cantidad tiene que ser un número entero mayor a 0.";

        resultado = { producto, fecha, ...(await agregarStock(producto.id, fecha, cantidad)) };
        return null;
      },
    });

    if (!guardado || !resultado) return;
    const { producto, fecha, sumado, cantidad } = resultado;
    showMensaje(
      mensajeBox,
      sumado
        ? `"${producto.nombre}" ya estaba con vencimiento ${formatearFecha(fecha)}: se sumó la cantidad (ahora hay ${cantidad}).`
        : `Se agregó "${producto.nombre}" (vence el ${formatearFecha(fecha)}).`,
      "info"
    );
    await cargar();
  });

  await cargar();
}
