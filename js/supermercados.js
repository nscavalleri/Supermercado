// Pantalla Configuración > Supermercados: ABM (alta, baja, modificación) del catálogo de supermercados.
import { el, clearNode, showMensaje, confirmar } from "./ui.js";
import {
  fetchSupermercados,
  crearSupermercado,
  actualizarSupermercado,
  eliminarSupermercado,
} from "./db.js";

// onCambio se llama después de crear/editar/eliminar, para que la pantalla de
// Lista > Presencial actualice sus subsolapas (una por supermercado).
export async function renderSupermercados(container, onCambio) {
  clearNode(container);

  const mensajeBox = el("div", { class: "mensaje-box" });
  const listaBox = el("div", { class: "lista-abm" }, "Cargando...");

  const inputNuevo = el("input", { type: "text", placeholder: "Nombre del supermercado (ej: Mercadona)" });
  const botonNuevo = el("button", { class: "btn btn--primario", type: "button" }, "Agregar supermercado");
  const formNuevo = el("div", { class: "form-agregar" }, [inputNuevo, botonNuevo]);

  container.appendChild(el("h2", {}, "Supermercados"));
  container.appendChild(mensajeBox);
  container.appendChild(formNuevo);
  container.appendChild(listaBox);

  function avisarCambio() {
    if (typeof onCambio === "function") onCambio();
  }

  async function cargar() {
    clearNode(listaBox);
    try {
      const supermercados = await fetchSupermercados();
      if (supermercados.length === 0) {
        listaBox.appendChild(el("p", { class: "texto-ayuda" }, "Todavía no cargaste ningún supermercado."));
        return;
      }
      const ul = el("ul", { class: "abm-lista" });
      supermercados.forEach((s) => ul.appendChild(renderFila(s)));
      listaBox.appendChild(ul);
    } catch (err) {
      showMensaje(mensajeBox, "No se pudieron cargar los supermercados: " + err.message);
    }
  }

  function renderFila(supermercado) {
    const nombreSpan = el("span", { class: "abm-lista__nombre" }, supermercado.nombre);
    const botonEditar = el("button", { class: "btn btn--secundario btn--chico", type: "button" }, "Editar");
    const botonEliminar = el("button", { class: "btn btn--peligro btn--chico", type: "button" }, "Eliminar");
    const li = el("li", { class: "abm-lista__fila" }, [nombreSpan, botonEditar, botonEliminar]);

    botonEditar.addEventListener("click", () => {
      const inputEdit = el("input", { type: "text", value: supermercado.nombre });
      const guardar = el("button", { class: "btn btn--primario btn--chico", type: "button" }, "Guardar");
      const cancelar = el("button", { class: "btn btn--secundario btn--chico", type: "button" }, "Cancelar");
      clearNode(li);
      li.append(inputEdit, guardar, cancelar);
      inputEdit.focus();

      guardar.addEventListener("click", async () => {
        const nuevoNombre = inputEdit.value.trim();
        if (!nuevoNombre) return;
        try {
          await actualizarSupermercado(supermercado.id, nuevoNombre);
          await cargar();
          avisarCambio();
        } catch (err) {
          showMensaje(mensajeBox, "No se pudo actualizar: " + err.message);
        }
      });
      cancelar.addEventListener("click", cargar);
    });

    botonEliminar.addEventListener("click", async () => {
      if (
        !confirmar(
          `¿Eliminar "${supermercado.nombre}"? También se va a quitar su lista presencial.`
        )
      )
        return;
      try {
        await eliminarSupermercado(supermercado.id);
        await cargar();
        avisarCambio();
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
      await crearSupermercado(nombre);
      inputNuevo.value = "";
      await cargar();
      avisarCambio();
    } catch (err) {
      showMensaje(mensajeBox, "No se pudo crear el supermercado (¿ya existe?): " + err.message);
    }
  }

  botonNuevo.addEventListener("click", agregar);
  inputNuevo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") agregar();
  });

  await cargar();
}
