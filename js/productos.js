// Pantalla Configuración > Productos: ABM (alta, baja, modificación) del catálogo de productos.
import { el, clearNode, showMensaje, confirmar } from "./ui.js";
import { fetchProductos, crearProducto, actualizarProducto, eliminarProducto } from "./db.js";

export async function renderProductos(container) {
  clearNode(container);

  const mensajeBox = el("div", { class: "mensaje-box" });
  const listaBox = el("div", { class: "lista-abm" }, "Cargando...");

  const inputNuevo = el("input", { type: "text", placeholder: "Nombre del producto (ej: Leche)" });
  const botonNuevo = el("button", { class: "btn btn--primario", type: "button" }, "Agregar producto");
  const formNuevo = el("div", { class: "form-agregar" }, [inputNuevo, botonNuevo]);

  container.appendChild(el("h2", {}, "Productos"));
  container.appendChild(mensajeBox);
  container.appendChild(formNuevo);
  container.appendChild(listaBox);

  async function cargar() {
    clearNode(listaBox);
    try {
      const productos = await fetchProductos();
      if (productos.length === 0) {
        listaBox.appendChild(el("p", { class: "texto-ayuda" }, "Todavía no cargaste ningún producto."));
        return;
      }
      const ul = el("ul", { class: "abm-lista" });
      productos.forEach((producto) => ul.appendChild(renderFila(producto)));
      listaBox.appendChild(ul);
    } catch (err) {
      showMensaje(mensajeBox, "No se pudieron cargar los productos: " + err.message);
    }
  }

  function renderFila(producto) {
    const nombreSpan = el("span", { class: "abm-lista__nombre" }, producto.nombre);

    const botonEditar = el("button", { class: "btn btn--secundario btn--chico", type: "button" }, "Editar");
    const botonEliminar = el("button", { class: "btn btn--peligro btn--chico", type: "button" }, "Eliminar");

    const li = el("li", { class: "abm-lista__fila" }, [nombreSpan, botonEditar, botonEliminar]);

    botonEditar.addEventListener("click", () => {
      const inputEdit = el("input", { type: "text", value: producto.nombre });
      const guardar = el("button", { class: "btn btn--primario btn--chico", type: "button" }, "Guardar");
      const cancelar = el("button", { class: "btn btn--secundario btn--chico", type: "button" }, "Cancelar");
      clearNode(li);
      li.append(inputEdit, guardar, cancelar);
      inputEdit.focus();

      guardar.addEventListener("click", async () => {
        const nuevoNombre = inputEdit.value.trim();
        if (!nuevoNombre) return;
        try {
          await actualizarProducto(producto.id, nuevoNombre);
          await cargar();
        } catch (err) {
          showMensaje(mensajeBox, "No se pudo actualizar: " + err.message);
        }
      });
      cancelar.addEventListener("click", cargar);
    });

    botonEliminar.addEventListener("click", async () => {
      if (!confirmar(`¿Eliminar "${producto.nombre}"? También se va a quitar de todas las listas.`)) return;
      try {
        await eliminarProducto(producto.id);
        await cargar();
      } catch (err) {
        showMensaje(mensajeBox, "No se pudo eliminar: " + err.message);
      }
    });

    return li;
  }

  async function agregar() {
    const nombre = inputNuevo.value.trim();
    if (!nombre) return;
    try {
      await crearProducto(nombre);
      inputNuevo.value = "";
      await cargar();
    } catch (err) {
      showMensaje(mensajeBox, "No se pudo crear el producto (¿ya existe?): " + err.message);
    }
  }

  botonNuevo.addEventListener("click", agregar);
  inputNuevo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") agregar();
  });

  await cargar();
}
