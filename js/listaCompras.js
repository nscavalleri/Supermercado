// Lógica común para una "lista de compra": se usa tanto para la lista Online
// como para la lista Presencial de cada supermercado (funcionan igual).
// No manejan cantidad: cada fila es un producto a comprar. Tampoco hay un
// estado "comprado" guardado: cuando lo comprás, tildás el check y el item
// se elimina de la lista.
import { el, clearNode, showMensaje, crearInputConAutocompletado } from "./ui.js";
import { fetchProductos, buscarOCrearProducto, agruparPorTipo } from "./db.js";

// config: { fetchItems, agregarItem(productoId), eliminarItem(id) }
export function crearListaComprasView(config) {
  return async function render(container) {
    clearNode(container);

    const mensajeBox = el("div", { class: "mensaje-box" });
    const listaBox = el("div", { class: "lista-compras" }, "Cargando...");

    // Items que están actualmente en la lista; se usa para no agregar dos
    // veces el mismo producto (ver onSubmit más abajo).
    let itemsActuales = [];

    let productosCatalogo = [];
    try {
      productosCatalogo = await fetchProductos();
    } catch (err) {
      // si falla, el autocompletado simplemente no sugiere nada
      productosCatalogo = [];
    }

    const { nodo: formAgregar, input } = crearInputConAutocompletado({
      placeholder: "Escribí un producto y presioná Enter para agregarlo...",
      getSugerencias: (texto) =>
        productosCatalogo.filter((p) => p.nombre.toLowerCase().includes(texto.toLowerCase())),
      onSubmit: async (texto) => {
        try {
          const producto = await buscarOCrearProducto(texto);
          if (!productosCatalogo.some((p) => p.id === producto.id)) {
            productosCatalogo.push(producto);
          }
          // Si el producto ya está en la lista, no se agrega de nuevo:
          // se ignora y se avisa, para no tener filas repetidas.
          if (yaEstaEnLaLista(producto.id)) {
            showMensaje(mensajeBox, `"${producto.nombre}" ya está en la lista.`, "info");
            return;
          }
          clearNode(mensajeBox);
          await config.agregarItem(producto.id);
          await cargar();
        } catch (err) {
          showMensaje(mensajeBox, "No se pudo agregar el producto: " + err.message);
        }
      },
    });

    function yaEstaEnLaLista(productoId) {
      return itemsActuales.some((item) => item.producto && item.producto.id === productoId);
    }

    container.appendChild(mensajeBox);
    container.appendChild(formAgregar);
    container.appendChild(listaBox);

    async function cargar() {
      clearNode(listaBox);
      try {
        const items = await config.fetchItems();
        itemsActuales = items;
        if (items.length === 0) {
          listaBox.appendChild(el("p", { class: "texto-ayuda" }, "La lista está vacía. Agregá productos arriba."));
          return;
        }
        // Se muestra agrupada por tipo de producto (orden alfabético, con
        // "Sin clasificar" siempre al final) y alfabéticamente dentro de cada tipo.
        agruparPorTipo(items).forEach(({ tipoNombre, items: itemsTipo }) => {
          listaBox.appendChild(el("h3", { class: "grupo-tipo__titulo" }, tipoNombre));
          const ul = el("ul", { class: "item-lista" });
          itemsTipo.forEach((item) => ul.appendChild(renderFila(item)));
          listaBox.appendChild(ul);
        });
      } catch (err) {
        showMensaje(mensajeBox, "No se pudo cargar la lista: " + err.message);
      }
    }

    function renderFila(item) {
      const checkbox = el("input", { type: "checkbox" });
      const nombre = el(
        "span",
        { class: "item-lista__nombre" },
        item.producto ? item.producto.nombre : "(producto eliminado)"
      );
      const li = el("li", { class: "item-lista__fila" }, [checkbox, nombre]);

      checkbox.addEventListener("change", () => {
        // Comprar un producto = sacarlo de la lista. Se marca visualmente
        // por un instante y después se elimina, para que se note la acción.
        checkbox.disabled = true;
        li.classList.add("item-lista__fila--comprado");
        setTimeout(async () => {
          try {
            await config.eliminarItem(item.id);
            await cargar();
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

    await cargar();
  };
}
