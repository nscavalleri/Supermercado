// Pantalla Configuración > Menú: catálogo de comidas (platos) y los productos
// que lleva cada una. Lo que se carga acá es lo que después se puede poner en
// el menú semanal (solapa Menú).
import {
  el,
  clearNode,
  showMensaje,
  confirmar,
  botonIcono,
  crearInputConAutocompletado,
  mismoNombre,
} from "./ui.js";
import {
  fetchComidas,
  crearComida,
  actualizarComida,
  eliminarComida,
  agregarIngrediente,
  eliminarIngrediente,
  fetchProductos,
  fetchTiposComida,
  buscarOCrearProducto,
} from "./db.js";

// Valor del select cuando la comida todavía no tiene tipo asignado.
const SIN_TIPO_VALOR = "";

export async function renderConfigMenu(container) {
  clearNode(container);

  const mensajeBox = el("div", { class: "mensaje-box" });
  const listaBox = el("div", { class: "lista-abm" }, "Cargando...");

  let comidas = [];
  let productosCatalogo = [];
  let tiposComida = [];
  // Comidas cuyo detalle de ingredientes está abierto: se recuerda entre
  // recargas para que agregar un ingrediente no cierre el panel.
  const abiertas = new Set();

  try {
    productosCatalogo = await fetchProductos();
  } catch (err) {
    productosCatalogo = [];
  }

  // Los tipos de comida se cargan por base de datos (Principal, Guarnición...).
  // Si la tabla todavía no existe, los selects quedan solo con "Sin tipo".
  try {
    tiposComida = await fetchTiposComida();
  } catch (err) {
    tiposComida = [];
  }

  function crearSelectTipo(tipoComidaIdActual) {
    const select = el("select", { class: "select-tipo" });
    select.appendChild(el("option", { value: SIN_TIPO_VALOR }, "Sin tipo"));
    tiposComida.forEach((tipo) => {
      select.appendChild(el("option", { value: String(tipo.id) }, tipo.nombre));
    });
    select.value = tipoComidaIdActual != null ? String(tipoComidaIdActual) : SIN_TIPO_VALOR;
    return select;
  }

  const selectNuevoTipo = crearSelectTipo(null);

  const { nodo: formNueva, input: inputNueva } = crearInputConAutocompletado({
    placeholder: "Nombre de la comida (ej: Milanesa con puré)",
    textoBoton: "Agregar comida",
    extras: [selectNuevoTipo],
    getSugerencias: (texto) =>
      comidas.filter((c) => c.nombre.toLowerCase().includes(texto.toLowerCase())),
    onSubmit: (texto) => agregarComida(texto),
  });

  container.appendChild(el("h2", {}, "Menú"));
  container.appendChild(
    el(
      "p",
      { class: "texto-ayuda" },
      "Cargá acá cada comida con los productos que lleva. Después, desde la solapa Menú, las asignás a los días de la semana."
    )
  );
  container.appendChild(mensajeBox);
  container.appendChild(formNueva);
  container.appendChild(listaBox);

  async function cargar() {
    clearNode(listaBox);
    try {
      comidas = await fetchComidas();
      pintar();
    } catch (err) {
      showMensaje(mensajeBox, "No se pudieron cargar las comidas: " + err.message);
    }
  }

  function pintar() {
    clearNode(listaBox);
    if (comidas.length === 0) {
      listaBox.appendChild(el("p", { class: "texto-ayuda" }, "Todavía no cargaste ninguna comida."));
      return;
    }
    const ul = el("ul", { class: "abm-lista" });
    comidas.forEach((comida) => ul.appendChild(renderComida(comida)));
    listaBox.appendChild(ul);
  }

  function renderComida(comida) {
    const cantidad = comida.ingredientes.length;
    const nombreSpan = el("span", { class: "abm-lista__nombre" }, comida.nombre);
    const tipoSpan = el(
      "span",
      { class: "abm-lista__tipo" },
      comida.tipo_comida ? comida.tipo_comida.nombre : "Sin tipo"
    );
    const contador = el(
      "span",
      { class: "abm-lista__tipo" },
      cantidad === 0 ? "Sin ingredientes" : cantidad === 1 ? "1 ingrediente" : `${cantidad} ingredientes`
    );

    const abierta = abiertas.has(comida.id);
    const botonDetalle = el(
      "button",
      {
        class: `btn btn--secundario btn--chico${abierta ? " btn--activo" : ""}`,
        type: "button",
      },
      abierta ? "Ocultar" : "Ingredientes"
    );
    const botonEditar = botonIcono("editar");
    const botonEliminar = botonIcono("eliminar");

    const acciones = el("div", { class: "abm-lista__acciones" }, [
      botonDetalle,
      botonEditar,
      botonEliminar,
    ]);
    const cabecera = el("div", { class: "comida__cabecera" }, [nombreSpan, tipoSpan, contador, acciones]);
    const li = el("li", { class: "abm-lista__fila abm-lista__fila--bloque" }, [cabecera]);

    if (abierta) li.appendChild(renderIngredientes(comida));

    botonDetalle.addEventListener("click", () => {
      if (abiertas.has(comida.id)) abiertas.delete(comida.id);
      else abiertas.add(comida.id);
      pintar();
    });

    botonEditar.addEventListener("click", () => {
      const inputEdit = el("input", { type: "text", value: comida.nombre });
      const selectEditTipo = crearSelectTipo(comida.tipo_comida_id);
      const guardar = botonIcono("guardar");
      const cancelar = botonIcono("cancelar");
      clearNode(cabecera);
      cabecera.append(
        inputEdit,
        selectEditTipo,
        el("div", { class: "abm-lista__acciones" }, [guardar, cancelar])
      );
      inputEdit.focus();

      guardar.addEventListener("click", async () => {
        const nuevoNombre = inputEdit.value.trim();
        if (!nuevoNombre) return;
        const repetida = comidas.some((c) => c.id !== comida.id && mismoNombre(c.nombre, nuevoNombre));
        if (repetida) {
          showMensaje(mensajeBox, `Ya existe una comida llamada "${nuevoNombre}".`, "info");
          return;
        }
        const tipoElegido = selectEditTipo.value ? Number(selectEditTipo.value) : null;
        try {
          await actualizarComida(comida.id, nuevoNombre, tipoElegido);
          clearNode(mensajeBox);
          await cargar();
        } catch (err) {
          showMensaje(mensajeBox, "No se pudo actualizar: " + err.message);
        }
      });
      cancelar.addEventListener("click", pintar);
    });

    botonEliminar.addEventListener("click", async () => {
      if (!confirmar(`¿Eliminar "${comida.nombre}"? También se va a quitar del menú semanal.`)) return;
      try {
        await eliminarComida(comida.id);
        abiertas.delete(comida.id);
        await cargar();
      } catch (err) {
        showMensaje(mensajeBox, "No se pudo eliminar: " + err.message);
      }
    });

    return li;
  }

  // Panel desplegable con los ingredientes de una comida y el buscador para
  // sumar más. El buscador crea el producto si todavía no existe, igual que
  // cuando se escribe algo nuevo en una lista de compra.
  function renderIngredientes(comida) {
    const caja = el("div", { class: "comida__ingredientes" });
    const yaEstan = new Set(comida.ingredientes.map((i) => i.producto?.id));

    const { nodo: formIngrediente } = crearInputConAutocompletado({
      placeholder: "Agregar ingrediente (ej: Papas)",
      getSugerencias: (texto) =>
        productosCatalogo.filter(
          (p) => !yaEstan.has(p.id) && p.nombre.toLowerCase().includes(texto.toLowerCase())
        ),
      onSubmit: async (texto) => {
        try {
          const producto = await buscarOCrearProducto(texto);
          if (!productosCatalogo.some((p) => p.id === producto.id)) productosCatalogo.push(producto);
          if (yaEstan.has(producto.id)) {
            showMensaje(mensajeBox, `"${producto.nombre}" ya es ingrediente de esta comida.`, "info");
            return;
          }
          clearNode(mensajeBox);
          await agregarIngrediente(comida.id, producto.id);
          await cargar();
        } catch (err) {
          showMensaje(mensajeBox, "No se pudo agregar el ingrediente: " + err.message);
        }
      },
    });
    caja.appendChild(formIngrediente);

    if (comida.ingredientes.length === 0) {
      caja.appendChild(
        el("p", { class: "texto-ayuda" }, "Esta comida todavía no tiene ingredientes cargados.")
      );
      return caja;
    }

    const chips = el("ul", { class: "chips" });
    comida.ingredientes.forEach((ingrediente) => {
      const quitar = el(
        "button",
        {
          class: "chip__quitar",
          type: "button",
          title: "Quitar ingrediente",
          "aria-label": `Quitar ${ingrediente.producto?.nombre || "ingrediente"}`,
        },
        "×"
      );
      quitar.addEventListener("click", async () => {
        try {
          await eliminarIngrediente(ingrediente.id);
          await cargar();
        } catch (err) {
          showMensaje(mensajeBox, "No se pudo quitar el ingrediente: " + err.message);
        }
      });
      chips.appendChild(
        el("li", { class: "chip" }, [
          el("span", {}, ingrediente.producto ? ingrediente.producto.nombre : "(producto eliminado)"),
          quitar,
        ])
      );
    });
    caja.appendChild(chips);
    return caja;
  }

  async function agregarComida(texto) {
    const nombre = (texto || "").trim();
    if (!nombre) return;
    const existente = comidas.find((c) => mismoNombre(c.nombre, nombre));
    if (existente) {
      showMensaje(mensajeBox, `"${existente.nombre}" ya está cargada.`, "info");
      abiertas.add(existente.id);
      pintar();
      return;
    }
    const tipoElegido = selectNuevoTipo.value ? Number(selectNuevoTipo.value) : null;
    try {
      const creada = await crearComida(nombre, tipoElegido);
      clearNode(mensajeBox);
      inputNueva.value = "";
      selectNuevoTipo.value = SIN_TIPO_VALOR;
      // Se abre sola para poder cargarle los ingredientes enseguida.
      abiertas.add(creada.id);
      await cargar();
    } catch (err) {
      showMensaje(mensajeBox, "No se pudo crear la comida: " + err.message);
    }
  }

  await cargar();
}
