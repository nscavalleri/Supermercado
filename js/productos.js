// Pantalla Configuración > Productos: ABM (alta, baja, modificación) del catálogo de productos.
import { el, clearNode, showMensaje, confirmar } from "./ui.js";
import { fetchProductos, crearProducto, actualizarProducto, eliminarProducto, fetchTiposProducto } from "./db.js";

const SIN_TIPO_VALOR = "";

export async function renderProductos(container) {
  clearNode(container);

  const mensajeBox = el("div", { class: "mensaje-box" });
  const listaBox = el("div", { class: "lista-abm" }, "Cargando...");

  // Catálogo de tipos para los selects de clasificar; si falla, los selects
  // quedan solo con la opción "Sin tipo" (no bloquea el resto de la pantalla).
  let tiposProducto = [];
  try {
    tiposProducto = await fetchTiposProducto();
  } catch (err) {
    tiposProducto = [];
  }

  function crearSelectTipo(tipoProductoIdActual) {
    const select = el("select", { class: "select-tipo" });
    select.appendChild(el("option", { value: SIN_TIPO_VALOR }, "Sin tipo"));
    tiposProducto.forEach((tipo) => {
      select.appendChild(el("option", { value: String(tipo.id) }, tipo.nombre));
    });
    select.value = tipoProductoIdActual != null ? String(tipoProductoIdActual) : SIN_TIPO_VALOR;
    return select;
  }

  const inputNuevo = el("input", { type: "text", placeholder: "Nombre del producto (ej: Leche)" });
  const selectNuevoTipo = crearSelectTipo(null);
  const botonNuevo = el("button", { class: "btn btn--primario", type: "button" }, "Agregar producto");
  const formNuevo = el("div", { class: "form-agregar" }, [inputNuevo, selectNuevoTipo, botonNuevo]);

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
    const tipoSpan = el(
      "span",
      { class: "abm-lista__tipo" },
      producto.tipo_producto ? producto.tipo_producto.nombre : "Sin tipo"
    );

    const botonEditar = el("button", { class: "btn btn--secundario btn--chico", type: "button" }, "Editar");
    const botonEliminar = el("button", { class: "btn btn--peligro btn--chico", type: "button" }, "Eliminar");

    const li = el("li", { class: "abm-lista__fila" }, [nombreSpan, tipoSpan, botonEditar, botonEliminar]);

    botonEditar.addEventListener("click", () => {
      const inputEdit = el("input", { type: "text", value: producto.nombre });
      const selectEditTipo = crearSelectTipo(producto.tipo_producto_id);
      const guardar = el("button", { class: "btn btn--primario btn--chico", type: "button" }, "Guardar");
      const cancelar = el("button", { class: "btn btn--secundario btn--chico", type: "button" }, "Cancelar");
      clearNode(li);
      li.append(inputEdit, selectEditTipo, guardar, cancelar);
      inputEdit.focus();

      guardar.addEventListener("click", async () => {
        const nuevoNombre = inputEdit.value.trim();
        if (!nuevoNombre) return;
        const tipoSeleccionado = selectEditTipo.value ? Number(selectEditTipo.value) : null;
        try {
          await actualizarProducto(producto.id, nuevoNombre, tipoSeleccionado);
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
    const tipoSeleccionado = selectNuevoTipo.value ? Number(selectNuevoTipo.value) : null;
    try {
      await crearProducto(nombre, tipoSeleccionado);
      inputNuevo.value = "";
      selectNuevoTipo.value = SIN_TIPO_VALOR;
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
