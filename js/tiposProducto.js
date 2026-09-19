// Pantalla Configuración > Tipos de producto: ABM (alta, baja, modificación) del
// catálogo de tipos de producto. Se usan para clasificar los productos y para
// ordenar las listas de compra (primero por tipo, después alfabéticamente).
import { el, clearNode, showMensaje, confirmar } from "./ui.js";
import {
  fetchTiposProducto,
  crearTipoProducto,
  actualizarTipoProducto,
  eliminarTipoProducto,
} from "./db.js";

export async function renderTiposProducto(container) {
  clearNode(container);

  const mensajeBox = el("div", { class: "mensaje-box" });
  const listaBox = el("div", { class: "lista-abm" }, "Cargando...");

  const inputNuevo = el("input", { type: "text", placeholder: "Nombre del tipo (ej: Lácteos)" });
  const botonNuevo = el("button", { class: "btn btn--primario", type: "button" }, "Agregar tipo");
  const formNuevo = el("div", { class: "form-agregar" }, [inputNuevo, botonNuevo]);

  container.appendChild(el("h2", {}, "Tipos de producto"));
  container.appendChild(
    el(
      "p",
      { class: "texto-ayuda" },
      "Se usan para clasificar los productos y ordenar las listas de compra. Los productos sin tipo aparecen como \"Sin clasificar\"."
    )
  );
  container.appendChild(mensajeBox);
  container.appendChild(formNuevo);
  container.appendChild(listaBox);

  async function cargar() {
    clearNode(listaBox);
    try {
      const tipos = await fetchTiposProducto();
      if (tipos.length === 0) {
        listaBox.appendChild(el("p", { class: "texto-ayuda" }, "Todavía no cargaste ningún tipo de producto."));
        return;
      }
      const ul = el("ul", { class: "abm-lista" });
      tipos.forEach((tipo) => ul.appendChild(renderFila(tipo)));
      listaBox.appendChild(ul);
    } catch (err) {
      showMensaje(mensajeBox, "No se pudieron cargar los tipos de producto: " + err.message);
    }
  }

  function renderFila(tipo) {
    const nombreSpan = el("span", { class: "abm-lista__nombre" }, tipo.nombre);

    const botonEditar = el("button", { class: "btn btn--secundario btn--chico", type: "button" }, "Editar");
    const botonEliminar = el("button", { class: "btn btn--peligro btn--chico", type: "button" }, "Eliminar");

    const li = el("li", { class: "abm-lista__fila" }, [nombreSpan, botonEditar, botonEliminar]);

    botonEditar.addEventListener("click", () => {
      const inputEdit = el("input", { type: "text", value: tipo.nombre });
      const guardar = el("button", { class: "btn btn--primario btn--chico", type: "button" }, "Guardar");
      const cancelar = el("button", { class: "btn btn--secundario btn--chico", type: "button" }, "Cancelar");
      clearNode(li);
      li.append(inputEdit, guardar, cancelar);
      inputEdit.focus();

      guardar.addEventListener("click", async () => {
        const nuevoNombre = inputEdit.value.trim();
        if (!nuevoNombre) return;
        try {
          await actualizarTipoProducto(tipo.id, nuevoNombre);
          await cargar();
        } catch (err) {
          showMensaje(mensajeBox, "No se pudo actualizar: " + err.message);
        }
      });
      cancelar.addEventListener("click", cargar);
    });

    botonEliminar.addEventListener("click", async () => {
      if (
        !confirmar(
          `¿Eliminar "${tipo.nombre}"? Los productos que lo tengan asignado van a quedar sin clasificar.`
        )
      )
        return;
      try {
        await eliminarTipoProducto(tipo.id);
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
      await crearTipoProducto(nombre);
      inputNuevo.value = "";
      await cargar();
    } catch (err) {
      showMensaje(mensajeBox, "No se pudo crear el tipo (¿ya existe?): " + err.message);
    }
  }

  botonNuevo.addEventListener("click", agregar);
  inputNuevo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") agregar();
  });

  await cargar();
}
