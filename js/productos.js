// Pantalla Configuración > Productos: ABM (alta, baja, modificación) del catálogo de productos.
import {
  el,
  clearNode,
  showMensaje,
  confirmar,
  botonIcono,
  crearInputConAutocompletado,
  mismoNombre,
} from "./ui.js";
import { fetchProductos, crearProducto, actualizarProducto, eliminarProducto, fetchTiposProducto } from "./db.js";

const SIN_TIPO_VALOR = "";
// Valores especiales del filtro por tipo (no son ids reales de tipos_producto).
const FILTRO_TODOS = "__todos__";
const FILTRO_SIN_TIPO = "__sin_tipo__";

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

  // Productos traídos de la base: se guardan acá para poder filtrar en pantalla
  // sin tener que volver a consultar cada vez que se cambia el filtro.
  let productosCargados = [];

  function crearSelectTipo(tipoProductoIdActual) {
    const select = el("select", { class: "select-tipo" });
    select.appendChild(el("option", { value: SIN_TIPO_VALOR }, "Sin tipo"));
    tiposProducto.forEach((tipo) => {
      select.appendChild(el("option", { value: String(tipo.id) }, tipo.nombre));
    });
    select.value = tipoProductoIdActual != null ? String(tipoProductoIdActual) : SIN_TIPO_VALOR;
    return select;
  }

  /* ---------- Alta de producto, con autocompletado para no duplicar ---------- */
  // Mientras se escribe se sugieren los productos ya cargados (igual que en las
  // listas). Si el nombre coincide con uno existente no se crea de nuevo: se
  // avisa y se deja el que ya estaba.
  const selectNuevoTipo = crearSelectTipo(null);

  const { nodo: formNuevo, input: inputNuevo } = crearInputConAutocompletado({
    placeholder: "Nombre del producto (ej: Leche)",
    textoBoton: "Agregar producto",
    extras: [selectNuevoTipo],
    getSugerencias: (texto) =>
      productosCargados.filter((p) => p.nombre.toLowerCase().includes(texto.toLowerCase())),
    onSubmit: (texto) => agregar(texto),
  });

  /* ---------- Filtro por tipo de producto ---------- */
  // Además de los tipos cargados, incluye "Todos los tipos" (sin filtrar) y
  // "Sin tipo" (productos que todavía no fueron clasificados).
  const selectFiltroTipo = el("select", { class: "select-tipo", id: "filtro-tipo-producto" });
  selectFiltroTipo.appendChild(el("option", { value: FILTRO_TODOS }, "Todos los tipos"));
  tiposProducto.forEach((tipo) => {
    selectFiltroTipo.appendChild(el("option", { value: String(tipo.id) }, tipo.nombre));
  });
  selectFiltroTipo.appendChild(el("option", { value: FILTRO_SIN_TIPO }, "Sin tipo"));
  selectFiltroTipo.value = FILTRO_TODOS;

  const filtroBox = el("div", { class: "form-filtro" }, [
    el("label", { class: "form-filtro__label", for: "filtro-tipo-producto" }, "Filtrar por tipo"),
    selectFiltroTipo,
  ]);

  selectFiltroTipo.addEventListener("change", pintarLista);

  container.appendChild(el("h2", {}, "Productos"));
  container.appendChild(mensajeBox);
  container.appendChild(formNuevo);
  container.appendChild(filtroBox);
  container.appendChild(listaBox);

  // Devuelve los productos que corresponden al filtro elegido.
  function productosFiltrados() {
    const filtro = selectFiltroTipo.value;
    if (filtro === FILTRO_TODOS) return productosCargados;
    if (filtro === FILTRO_SIN_TIPO) return productosCargados.filter((p) => p.tipo_producto_id == null);
    return productosCargados.filter((p) => String(p.tipo_producto_id) === filtro);
  }

  // Dibuja la lista aplicando el filtro actual (no consulta la base).
  function pintarLista() {
    clearNode(listaBox);
    if (productosCargados.length === 0) {
      listaBox.appendChild(el("p", { class: "texto-ayuda" }, "Todavía no cargaste ningún producto."));
      return;
    }
    const productos = productosFiltrados();
    if (productos.length === 0) {
      listaBox.appendChild(el("p", { class: "texto-ayuda" }, "No hay productos de ese tipo."));
      return;
    }
    const ul = el("ul", { class: "abm-lista" });
    productos.forEach((producto) => ul.appendChild(renderFila(producto)));
    listaBox.appendChild(ul);
  }

  async function cargar() {
    clearNode(listaBox);
    try {
      productosCargados = await fetchProductos();
      pintarLista();
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

    const botonEditar = botonIcono("editar");
    const botonEliminar = botonIcono("eliminar");

    const acciones = el("div", { class: "abm-lista__acciones" }, [botonEditar, botonEliminar]);
    const li = el("li", { class: "abm-lista__fila" }, [nombreSpan, tipoSpan, acciones]);

    botonEditar.addEventListener("click", () => {
      const inputEdit = el("input", { type: "text", value: producto.nombre });
      const selectEditTipo = crearSelectTipo(producto.tipo_producto_id);
      const guardar = botonIcono("guardar");
      const cancelar = botonIcono("cancelar");
      clearNode(li);
      li.append(inputEdit, selectEditTipo, el("div", { class: "abm-lista__acciones" }, [guardar, cancelar]));
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

  async function agregar(textoIngresado) {
    const nombre = (textoIngresado ?? inputNuevo.value).trim();
    if (!nombre) return;

    // Si ya existe un producto con ese nombre (sin importar mayúsculas ni
    // acentos), no se crea otro: se avisa y se limpia el formulario.
    const existente = productosCargados.find((p) => mismoNombre(p.nombre, nombre));
    if (existente) {
      showMensaje(mensajeBox, `"${existente.nombre}" ya está en el catálogo.`, "info");
      selectNuevoTipo.value = SIN_TIPO_VALOR;
      // Deja el filtro donde se ve el producto que ya existía.
      selectFiltroTipo.value = existente.tipo_producto_id != null
        ? String(existente.tipo_producto_id)
        : FILTRO_SIN_TIPO;
      pintarLista();
      return;
    }

    const tipoSeleccionado = selectNuevoTipo.value ? Number(selectNuevoTipo.value) : null;
    try {
      await crearProducto(nombre, tipoSeleccionado);
      clearNode(mensajeBox);
      inputNuevo.value = "";
      selectNuevoTipo.value = SIN_TIPO_VALOR;
      await cargar();
    } catch (err) {
      showMensaje(mensajeBox, "No se pudo crear el producto: " + err.message);
    }
  }

  await cargar();
}
