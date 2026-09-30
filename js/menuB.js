// ===================== MENÚ B (prueba A/B) =====================
// Solapa "Menú 2": el mismo menú semanal que js/menu.js (versión A), pero
// mostrado como TABLA: una columna por día (arrancando por hoy) y una fila
// por momento (Almuerzo / Cena). En la computadora ocupa todo el ancho; en
// el celular la tabla se desplaza de costado.
// Es una copia independiente de menu.js: comparte solo db.js, ui.js y
// estilos generales. Para quedarse con UNA versión, ver el resumen del
// proyecto ("Prueba A/B del Menú").
// La lógica (agregar, regla de repetible, mandar ingredientes a las listas,
// Borrar todo) es la misma que en la versión A.
// confirmar() se importa como confirmarModal porque más abajo hay un botón
// que se llama "confirmar" (el de "Agregar a las listas").
import { el, clearNode, showMensaje, botonIcono, mismoNombre, confirmar as confirmarModal } from "./ui.js";
import {
  fetchDiasSemana,
  fetchMomentosComida,
  fetchMenuSemanal,
  fetchComidas,
  fetchTiposComida,
  fetchSupermercados,
  agregarComidaAlMenu,
  quitarComidaDelMenu,
  vaciarMenuSemanal,
  agregarProductosALista,
} from "./db.js";

const SUPERMERCADO_POR_DEFECTO = "Mercadona";
const DESTINO_ONLINE = "online";
// Valor especial del filtro por tipo de comida (no es un id real).
const FILTRO_TODOS = "__todos__";

// Día de hoy en el mismo criterio que la tabla dias_semana: 1 = Lunes ... 7 = Domingo.
function diaDeHoy() {
  return ((new Date().getDay() + 6) % 7) + 1;
}

// Los 7 días arrancando por hoy: hoy, mañana, pasado...
function ordenDesdeHoy(dias) {
  const hoy = diaDeHoy();
  const porId = new Map(dias.map((d) => [d.id, d]));
  const orden = [];
  for (let i = 0; i < 7; i++) {
    const id = ((hoy - 1 + i) % 7) + 1;
    if (porId.has(id)) orden.push(porId.get(id));
  }
  return orden;
}

export async function renderMenuB(container) {
  clearNode(container);

  const mensajeBox = el("div", { class: "mensaje-box" });
  const contenido = el("div", {}, "Cargando...");

  // "Borrar todo": vacía el menú de toda la semana (con confirmación).
  const botonBorrarTodo = el("button", { class: "btn btn--peligro btn--chico", type: "button" }, "Borrar todo");
  const barra = el("div", { class: "menu__barra" }, [botonBorrarTodo]);

  container.appendChild(mensajeBox);
  container.appendChild(barra);
  container.appendChild(contenido);

  let dias = [];
  let momentos = [];
  let menu = [];
  let comidas = [];
  let tiposComida = [];
  let supermercados = [];

  // Panel de "mandar ingredientes" que está abierto (id del item del menú),
  // y slot en el que se está eligiendo una comida para agregar.
  let panelIngredientes = null;
  let slotAgregando = null;
  // Tipo elegido en el filtro del slot que se está editando.
  let filtroTipoSlot = FILTRO_TODOS;

  // Dónde está una comida en el menú de la semana: ["el Lunes (Cena)", ...].
  function dondeEsta(comidaId) {
    return menu
      .filter((m) => m.comida?.id === comidaId)
      .map((m) => {
        const dia = dias.find((d) => d.id === m.dia_id);
        const momento = momentos.find((x) => x.id === m.momento_id);
        return `el ${dia ? dia.nombre : "?"} (${momento ? momento.nombre : "?"})`;
      });
  }

  // Una comida NO repetible (Configuración > Menú) solo puede estar una vez en
  // toda la semana: si ya está en algún día/momento, no se puede agregar.
  function bloqueadaPorRepeticion(comida) {
    return !comida.repetible && menu.some((m) => m.comida?.id === comida.id);
  }

  try {
    [dias, momentos, menu, comidas, tiposComida, supermercados] = await Promise.all([
      fetchDiasSemana(),
      fetchMomentosComida(),
      fetchMenuSemanal(),
      fetchComidas(),
      fetchTiposComida(),
      fetchSupermercados(),
    ]);
  } catch (err) {
    clearNode(contenido);
    showMensaje(mensajeBox, "No se pudo cargar el menú: " + err.message);
    return;
  }

  if (dias.length === 0 || momentos.length === 0) {
    clearNode(contenido);
    showMensaje(
      mensajeBox,
      "Faltan las tablas del menú en la base de datos. Ejecutá el SQL de creación y volvé a entrar."
    );
    return;
  }

  botonBorrarTodo.addEventListener("click", async () => {
    const cantidad = menu.length;
    if (cantidad === 0) return;
    const ok = await confirmarModal({
      titulo: "Borrar todo el menú",
      mensaje: [
        cantidad === 1
          ? "Se va a quitar la comida cargada en el menú de la semana."
          : `Se van a quitar las ${cantidad} comidas cargadas en el menú de la semana (todos los días y momentos).`,
        "Las comidas no se borran del catálogo: siguen en Configuración > Menú para volver a usarlas. ¿Borrar todo?",
      ],
      textoAceptar: "Borrar todo",
    });
    if (!ok) return;
    botonBorrarTodo.disabled = true;
    try {
      await vaciarMenuSemanal();
      slotAgregando = null;
      panelIngredientes = null;
      await recargarMenu();
      showMensaje(mensajeBox, "Se vació el menú de la semana.", "info");
    } catch (err) {
      showMensaje(mensajeBox, "No se pudo borrar el menú: " + err.message);
      botonBorrarTodo.disabled = menu.length === 0;
    }
  });

  async function recargarMenu() {
    menu = await fetchMenuSemanal();
    pintar();
  }

  // Campo que tiene que quedar con el foco después de volver a dibujar (el
  // desplegable de comidas del slot que se está editando).
  let focoPendiente = null;
  let enfocarSlot = false;

  // Se usa para acercar el panel de ingredientes a la vista recién cuando se abre.
  let panelRecienAbierto = false;

  function pintar() {
    // Igual que en la versión A: se arma todo aparte y se reemplaza de una
    // sola vez, conservando el scroll de la página y también el scroll
    // horizontal de la tabla (en el celular), para que no "salte".
    const scrollAntes = window.scrollY;
    const scrollHorizontal = contenido.querySelector(".menuB-scroll")?.scrollLeft || 0;
    const hoy = diaDeHoy();
    const orden = ordenDesdeHoy(dias);

    const encabezado = el("tr", {}, [
      el("th", { class: "menuB-esquina", scope: "col" }, ""),
      ...orden.map((dia) =>
        el("th", { class: "menuB-dia" + (dia.id === hoy ? " menuB-dia--hoy" : ""), scope: "col" }, [
          dia.nombre,
          dia.id === hoy ? el("span", { class: "dia__hoy" }, "Hoy") : null,
        ])
      ),
    ]);
    const filas = momentos.map((momento) =>
      el("tr", {}, [
        el("th", { class: "menuB-momento", scope: "row" }, momento.nombre),
        ...orden.map((dia) => renderCelda(dia, momento, dia.id === hoy)),
      ])
    );
    const tabla = el("table", { class: "menuB-tabla" }, [el("thead", {}, encabezado), el("tbody", {}, filas)]);
    const scroll = el("div", { class: "menuB-scroll" }, [tabla]);

    // El panel de ingredientes va debajo de la tabla, a lo ancho, porque
    // adentro de una celda no entra.
    const itemPanel = panelIngredientes ? menu.find((m) => m.id === panelIngredientes) : null;
    if (!itemPanel) panelIngredientes = null;
    const panel = itemPanel ? renderPanelAbajo(itemPanel) : null;

    contenido.replaceChildren(...[scroll, panel].filter(Boolean));
    scroll.scrollLeft = scrollHorizontal;
    // Con el menú vacío no hay nada para borrar.
    botonBorrarTodo.disabled = menu.length === 0;
    botonBorrarTodo.title = menu.length === 0 ? "El menú de la semana ya está vacío" : "Quitar todas las comidas del menú de la semana";
    window.scrollTo(0, scrollAntes);

    if (focoPendiente) {
      const campo = focoPendiente;
      focoPendiente = null;
      campo.focus({ preventScroll: true });
      campo.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    if (panel && panelRecienAbierto) {
      panelRecienAbierto = false;
      panel.scrollIntoView({ block: "nearest" });
    }
  }

  // Una celda de la tabla: las comidas de ese día y momento, y el "+" abajo.
  function renderCelda(dia, momento, esHoy) {
    const items = menu.filter((m) => m.dia_id === dia.id && m.momento_id === momento.id);
    const clave = `${dia.id}-${momento.id}`;
    const abierto = slotAgregando === clave;

    const celda = el("td", { class: "menuB-celda" + (esHoy ? " menuB-celda--hoy" : "") });
    items.forEach((item) => celda.appendChild(renderItem(item)));

    if (abierto) {
      const selector = renderAgregarComida(dia, momento);
      if (selector) celda.appendChild(selector);
    }

    const botonMas = botonIcono("agregar", `Agregar comida (${dia.nombre}, ${momento.nombre})`);
    botonMas.classList.add("btn-icono--chico");
    if (abierto) botonMas.classList.add("btn-icono--activo");
    botonMas.setAttribute("aria-expanded", abierto ? "true" : "false");
    botonMas.addEventListener("click", () => {
      if (slotAgregando === clave) {
        slotAgregando = null;
      } else {
        slotAgregando = clave;
        enfocarSlot = true;
        filtroTipoSlot = FILTRO_TODOS;
      }
      pintar();
    });
    celda.appendChild(el("div", { class: "menuB-celda__pie" }, [botonMas]));
    return celda;
  }

  // Una comida dentro de la celda: nombre y dos íconos chicos (ingredientes y quitar).
  function renderItem(item) {
    const abierto = panelIngredientes === item.id;
    const verIngredientes = botonIcono("ingredientes", abierto ? "Ocultar ingredientes" : "Ver ingredientes");
    verIngredientes.classList.add("btn-icono--chico");
    if (abierto) verIngredientes.classList.add("btn-icono--activo");
    verIngredientes.setAttribute("aria-expanded", abierto ? "true" : "false");
    const quitar = botonIcono("eliminar", "Quitar del menú");
    quitar.classList.add("btn-icono--chico");

    verIngredientes.addEventListener("click", () => {
      panelIngredientes = abierto ? null : item.id;
      panelRecienAbierto = !abierto;
      pintar();
    });
    quitar.addEventListener("click", async () => {
      try {
        await quitarComidaDelMenu(item.id);
        if (panelIngredientes === item.id) panelIngredientes = null;
        await recargarMenu();
      } catch (err) {
        showMensaje(mensajeBox, "No se pudo quitar la comida: " + err.message);
      }
    });

    return el("div", { class: "menuB-comida" + (abierto ? " menuB-comida--activa" : ""), title: item.comida?.tipo_comida?.nombre || "" }, [
      el("span", { class: "menuB-comida__nombre" }, item.comida ? item.comida.nombre : "(comida eliminada)"),
      el("div", { class: "menuB-comida__acciones" }, [verIngredientes, quitar]),
    ]);
  }

  // Panel de ingredientes debajo de la tabla, con título (qué comida y cuándo) y ✕.
  function renderPanelAbajo(item) {
    const dia = dias.find((d) => d.id === item.dia_id);
    const momento = momentos.find((m) => m.id === item.momento_id);
    const cerrar = botonIcono("cancelar", "Cerrar ingredientes");
    cerrar.classList.add("btn-icono--chico");
    cerrar.addEventListener("click", () => {
      panelIngredientes = null;
      pintar();
    });
    return el("section", { class: "menuB-panel" }, [
      el("div", { class: "menuB-panel__cabecera" }, [
        el("h3", { class: "menuB-panel__titulo" }, [
          `Ingredientes: ${item.comida ? item.comida.nombre : "(comida eliminada)"}`,
          el("span", { class: "menuB-panel__cuando" }, ` — ${dia ? dia.nombre : "?"} (${momento ? momento.nombre : "?"})`),
        ]),
        cerrar,
      ]),
      renderPanelIngredientes(item),
    ]);
  }

  // Panel para mandar ingredientes a una lista: vienen todos tildados y se
  // destildan los que ya se tienen en casa.
  function renderPanelIngredientes(item) {
    const ingredientes = (item.comida?.ingredientes || [])
      .map((i) => i.producto)
      .filter(Boolean)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

    const caja = el("div", { class: "panel-ingredientes" });

    if (ingredientes.length === 0) {
      caja.appendChild(
        el(
          "p",
          { class: "texto-ayuda" },
          "Esta comida no tiene ingredientes cargados. Cargalos en Configuración > Menú."
        )
      );
      return caja;
    }

    caja.appendChild(
      el(
        "p",
        { class: "panel-ingredientes__ayuda" },
        "Tildá los que necesitás comprar y elegí a qué lista va cada uno:"
      )
    );

    /* ---------- Un destino por ingrediente ---------- */
    // Cada ingrediente tiene su propio desplegable, así se puede mandar uno a
    // Mercadona, otro a Carrefour y otro a la lista Online de una sola vez.
    function crearSelectDestino() {
      const select = el("select", { class: "select-tipo select-destino" });
      supermercados.forEach((s) => {
        select.appendChild(el("option", { value: `p:${s.id}` }, s.nombre));
      });
      select.appendChild(el("option", { value: DESTINO_ONLINE }, "Online"));

      const preferido = supermercados.find((s) => mismoNombre(s.nombre, SUPERMERCADO_POR_DEFECTO));
      if (preferido) select.value = `p:${preferido.id}`;
      else if (supermercados.length > 0) select.value = `p:${supermercados[0].id}`;
      else select.value = DESTINO_ONLINE;
      return select;
    }

    function nombreDestino(valor) {
      if (valor === DESTINO_ONLINE) return "Online";
      const id = Number(valor.slice(2));
      const sup = supermercados.find((s) => s.id === id);
      return sup ? sup.nombre : "la lista";
    }

    const filas = [];
    const ul = el("ul", { class: "item-lista" });
    ingredientes.forEach((producto) => {
      // Vienen destildados: se tilda solo lo que hace falta comprar.
      const check = el("input", { type: "checkbox" });
      const selectDestino = crearSelectDestino();
      filas.push({ check, selectDestino, producto });
      ul.appendChild(
        el("li", { class: "item-lista__fila panel-ingredientes__fila" }, [
          check,
          el("span", { class: "item-lista__nombre" }, producto.nombre),
          selectDestino,
        ])
      );
    });
    caja.appendChild(ul);

    const resultado = el("div", { class: "mensaje-box" });
    const confirmar = el(
      "button",
      { class: "btn btn--primario btn--chico", type: "button" },
      "Agregar a las listas"
    );
    caja.appendChild(el("div", { class: "panel-ingredientes__acciones" }, [confirmar]));
    caja.appendChild(resultado);

    confirmar.addEventListener("click", async () => {
      const elegidas = filas.filter(({ check }) => check.checked);
      if (elegidas.length === 0) {
        showMensaje(resultado, "No marcaste ningún ingrediente.", "info");
        return;
      }

      // Se agrupan los ingredientes por la lista que eligió cada uno, para
      // hacer una sola operación por lista.
      const porDestino = new Map();
      elegidas.forEach(({ selectDestino, producto }) => {
        const valor = selectDestino.value;
        if (!porDestino.has(valor)) porDestino.set(valor, []);
        porDestino.get(valor).push(producto.id);
      });

      confirmar.disabled = true;
      try {
        const resumen = [];
        for (const [valor, ids] of porDestino) {
          const destino =
            valor === DESTINO_ONLINE
              ? { tipo: "online" }
              : { tipo: "presencial", supermercadoId: Number(valor.slice(2)) };
          const { agregados, yaEstaban } = await agregarProductosALista(ids, destino);
          const repetidos = yaEstaban === 0 ? "" : ` (${yaEstaban} ya ${yaEstaban === 1 ? "estaba" : "estaban"})`;
          resumen.push(`${nombreDestino(valor)}: ${agregados}${repetidos}`);
        }
        const total = resumen.length;
        showMensaje(
          resultado,
          (total === 1 ? "Agregado a " : "Agregados a ") + resumen.join(" · ") + ".",
          "info"
        );
      } catch (err) {
        showMensaje(resultado, "No se pudo agregar: " + err.message);
      } finally {
        confirmar.disabled = false;
      }
    });

    return caja;
  }

  // Selector para agregar una comida a un día/momento (se abre con el "+").
  function renderAgregarComida(dia, momento) {

    if (comidas.length === 0) {
      const aviso = el(
        "p",
        { class: "texto-ayuda" },
        "Todavía no cargaste ninguna comida. Cargalas en Configuración > Menú."
      );
      slotAgregando = null;
      return aviso;
    }

    const yaEnEsteSlot = new Set(
      menu.filter((m) => m.dia_id === dia.id && m.momento_id === momento.id).map((m) => m.comida?.id)
    );
    const disponibles = comidas.filter((c) => !yaEnEsteSlot.has(c.id));

    /* ---------- Filtro por tipo de comida ---------- */
    // Primero se elige el tipo (Principal, Guarnición...) y el segundo
    // desplegable queda con las comidas de ese tipo.
    const selectTipo = el("select", { class: "select-tipo" });
    selectTipo.appendChild(el("option", { value: FILTRO_TODOS }, "Todas"));
    tiposComida.forEach((t) => selectTipo.appendChild(el("option", { value: String(t.id) }, t.nombre)));
    selectTipo.value = filtroTipoSlot;

    const select = el("select", { class: "select-tipo" });

    function opcionesComida() {
      clearNode(select);
      const filtradas =
        filtroTipoSlot === FILTRO_TODOS
          ? disponibles
          : disponibles.filter((c) => String(c.tipo_comida_id) === filtroTipoSlot);

      // Las comidas que no son repetibles y ya están en otro día/momento de
      // la semana se muestran igual, pero deshabilitadas y diciendo dónde
      // están, para que se entienda por qué no se pueden elegir.
      const habilitadas = filtradas.filter((c) => !bloqueadaPorRepeticion(c));

      if (habilitadas.length === 0) {
        const texto =
          filtradas.length > 0 || disponibles.length === 0
            ? "Ya están todas agregadas"
            : "No hay comidas de ese tipo";
        select.appendChild(el("option", { value: "" }, texto));
      }
      select.disabled = habilitadas.length === 0;
      filtradas.forEach((c) => {
        const bloqueada = bloqueadaPorRepeticion(c);
        const texto = bloqueada ? `${c.nombre} — ya está ${dondeEsta(c.id)[0]}` : c.nombre;
        select.appendChild(
          el("option", bloqueada ? { value: String(c.id), disabled: true, class: "opcion-en-uso" } : { value: String(c.id) }, texto)
        );
      });
      if (habilitadas.length > 0) select.value = String(habilitadas[0].id);
    }
    opcionesComida();

    selectTipo.addEventListener("change", () => {
      filtroTipoSlot = selectTipo.value;
      opcionesComida();
    });

    // Recién abierto el selector, el foco queda en el desplegable de comidas
    // (ver pintar()). Solo esa vez: si después se redibuja por otra cosa, no
    // se le vuelve a robar el foco a lo que se esté usando.
    if (enfocarSlot) {
      focoPendiente = select;
      enfocarSlot = false;
    }

    const aceptar = botonIcono("guardar", "Agregar al menú");
    const cancelar = botonIcono("cancelar", "Cancelar");

    aceptar.addEventListener("click", async () => {
      if (!select.value) {
        slotAgregando = null;
        pintar();
        return;
      }
      try {
        // Se vuelve a leer el menú antes de agregar, por si mientras tanto la
        // otra persona cargó esa misma comida en otro día.
        menu = await fetchMenuSemanal();
        const comida = comidas.find((c) => c.id === Number(select.value));
        if (comida && bloqueadaPorRepeticion(comida)) {
          showMensaje(
            mensajeBox,
            `"${comida.nombre}" no es repetible y ya está en el menú ${dondeEsta(comida.id).join(", ")}. ` +
              `Si querés poder repetirla, prendé el ícono de repetir (flechas en círculo) en Configuración > Menú.`
          );
          pintar();
          return;
        }
        await agregarComidaAlMenu(dia.id, momento.id, Number(select.value));
        slotAgregando = null;
        clearNode(mensajeBox);
        await recargarMenu();
      } catch (err) {
        showMensaje(mensajeBox, "No se pudo agregar la comida: " + err.message);
      }
    });

    cancelar.addEventListener("click", () => {
      slotAgregando = null;
      pintar();
    });

    return el("div", { class: "form-filtro" }, [
      selectTipo,
      select,
      el("div", { class: "abm-lista__acciones" }, [aceptar, cancelar]),
    ]);
  }

  pintar();
}
