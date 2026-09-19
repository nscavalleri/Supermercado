// Pantalla Lista > Presencial: una subsolapa "Todos" (primera) + una subsolapa
// por cada supermercado cargado en Configuración > Supermercados.
import { el, clearNode, showMensaje } from "./ui.js";
import { crearListaComprasView } from "./listaCompras.js";
import {
  fetchSupermercados,
  fetchListaPresencialTodos,
  fetchListaPresencial,
  agregarItemPresencial,
  eliminarItemPresencial,
} from "./db.js";

const TODOS = "__todos__";

export async function renderPresencial(container) {
  clearNode(container);

  const tabsBox = el("div", { class: "subtabs" });
  const contenidoBox = el("div", { class: "subtabs__contenido" }, "Cargando...");
  container.appendChild(tabsBox);
  container.appendChild(contenidoBox);

  let supermercados = [];
  try {
    supermercados = await fetchSupermercados();
  } catch (err) {
    showMensaje(contenidoBox, "No se pudieron cargar los supermercados: " + err.message);
    return;
  }

  let activo = TODOS;

  function renderTabs() {
    clearNode(tabsBox);
    const opciones = [{ id: TODOS, nombre: "Todos" }, ...supermercados];
    opciones.forEach((op) => {
      const boton = el(
        "button",
        {
          class: `subtab-btn${activo === op.id ? " subtab-btn--activo" : ""}`,
          type: "button",
        },
        op.nombre
      );
      boton.addEventListener("click", () => {
        if (activo === op.id) return;
        activo = op.id;
        renderTabs();
        renderContenido();
      });
      tabsBox.appendChild(boton);
    });
  }

  async function renderContenido() {
    clearNode(contenidoBox);
    if (supermercados.length === 0) {
      contenidoBox.appendChild(
        el("p", { class: "texto-ayuda" }, "Todavía no cargaste ningún supermercado en Configuración.")
      );
      return;
    }
    if (activo === TODOS) {
      await renderTodos(contenidoBox);
    } else {
      const view = crearListaComprasView({
        fetchItems: () => fetchListaPresencial(activo),
        agregarItem: (productoId) => agregarItemPresencial(productoId, activo),
        eliminarItem: (id) => eliminarItemPresencial(id),
      });
      await view(contenidoBox);
    }
  }

  renderTabs();
  await renderContenido();
}

// Vista de sólo agrupar y accionar: agrupa los productos de todas las listas
// presenciales por supermercado, sin formulario de agregar (para agregar hay
// que entrar a la subsolapa del supermercado correspondiente). Comprar un
// producto = tildar el check, que lo elimina de la lista (no hay estado
// "comprado" guardado ni cantidad).
async function renderTodos(container) {
  const mensajeBox = el("div", { class: "mensaje-box" });
  const grupos = el("div", { class: "grupos-todos" }, "Cargando...");
  container.appendChild(mensajeBox);
  container.appendChild(grupos);

  async function cargar() {
    clearNode(grupos);
    let items = [];
    try {
      items = await fetchListaPresencialTodos();
    } catch (err) {
      showMensaje(mensajeBox, "No se pudo cargar: " + err.message);
      return;
    }

    if (items.length === 0) {
      grupos.appendChild(
        el("p", { class: "texto-ayuda" }, "No hay productos cargados en ninguna lista presencial todavía.")
      );
      return;
    }

    const porSupermercado = new Map();
    items.forEach((item) => {
      const nombreSuper = item.supermercado ? item.supermercado.nombre : "(supermercado eliminado)";
      if (!porSupermercado.has(nombreSuper)) porSupermercado.set(nombreSuper, []);
      porSupermercado.get(nombreSuper).push(item);
    });

    for (const [nombreSuper, itemsSuper] of porSupermercado) {
      const ul = el("ul", { class: "item-lista" });
      itemsSuper.forEach((item) => ul.appendChild(renderFilaSoloLectura(item, cargar, mensajeBox)));
      grupos.appendChild(el("h3", { class: "grupos-todos__titulo" }, nombreSuper));
      grupos.appendChild(ul);
    }
  }

  await cargar();
}

function renderFilaSoloLectura(item, recargar, mensajeBox) {
  const checkbox = el("input", { type: "checkbox" });
  const nombre = el(
    "span",
    { class: "item-lista__nombre" },
    item.producto ? item.producto.nombre : "(producto eliminado)"
  );
  const li = el("li", { class: "item-lista__fila" }, [checkbox, nombre]);

  checkbox.addEventListener("change", () => {
    checkbox.disabled = true;
    li.classList.add("item-lista__fila--comprado");
    setTimeout(async () => {
      try {
        await eliminarItemPresencial(item.id);
        await recargar();
      } catch (err) {
        showMensaje(mensajeBox, "No se pudo actualizar la lista: " + err.message);
        checkbox.disabled = false;
        checkbox.checked = false;
        li.classList.remove("item-lista__fila--comprado");
      }
    }, 350);
  });

  return li;
}
