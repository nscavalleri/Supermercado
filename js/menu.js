// Pantalla Menú: el menú semanal como TABLA — una columna por día (arrancando
// por hoy) y una fila por momento (Almuerzo / Cena). Es una plantilla fija que
// se repite todas las semanas. En la computadora ocupa todo el ancho; en el
// celular la tabla se desplaza de costado.
// Se agrega con el "+" de cada casillero o arrastrando desde "Más opciones";
// las comidas se mueven arrastrándolas; desde cada comida se mandan sus
// ingredientes a una lista de compra.
// (Fue la "versión B" de una prueba A/B; la versión anterior, en lista
// vertical, se eliminó el 30/09/2026. Las clases CSS siguen con prefijo
// "menuB-" para no tocar estilos que ya funcionan.)
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
  moverComidaDelMenu,
  vaciarMenuSemanal,
  agregarProductosALista,
  ordenarPorTipoComida,
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

// Mientras se arrastra una comida con el dedo, se frena el desplazamiento del
// navegador (si no, se movería la página en vez de la comida). Se registra una
// sola vez para toda la app, no cada vez que se abre la solapa.
let arrastrandoAhora = false;
document.addEventListener(
  "touchmove",
  (e) => {
    if (arrastrandoAhora) e.preventDefault();
  },
  { passive: false }
);

export async function renderMenu(container) {
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
    // Se arma todo aparte y se reemplaza de una
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

    contenido.replaceChildren(...[renderMasOpciones(), scroll, panel].filter(Boolean));
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
    // Primero los platos principales y después las guarniciones.
    const items = ordenarPorTipoComida(menu.filter((m) => m.dia_id === dia.id && m.momento_id === momento.id));
    const clave = `${dia.id}-${momento.id}`;
    const abierto = slotAgregando === clave;

    const celda = el("td", {
      class: "menuB-celda" + (esHoy ? " menuB-celda--hoy" : ""),
      "data-dia": String(dia.id),
      "data-momento": String(momento.id),
    });
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

    const tarjeta = el(
      "div",
      {
        class: "menuB-comida" + (abierto ? " menuB-comida--activa" : ""),
        title: "Arrastrala para moverla a otro día (en el celular: mantenela apretada y arrastrá)",
      },
      [
        el("span", { class: "menuB-comida__nombre" }, item.comida ? item.comida.nombre : "(comida eliminada)"),
        el("div", { class: "menuB-comida__acciones" }, [verIngredientes, quitar]),
      ]
    );
    habilitarArrastre(tarjeta, { item });
    return tarjeta;
  }

  /* ---------- Arrastrar y soltar (mover una comida a otro día / momento) ---------- */
  // Funciona con mouse y con el dedo (Pointer Events, sin librerías):
  // - Mouse: se aprieta sobre la comida y se arrastra (arranca al moverse unos píxeles).
  // - Celular: hay que MANTENERLA APRETADA un momento (~0,35 s) y recién ahí
  //   arrastrar. Así, deslizar el dedo rápido sigue sirviendo para mover la
  //   tabla de costado o la página, sin agarrar comidas sin querer.
  // Mientras se arrastra: la comida sigue al dedo/mouse, el casillero de
  // destino se resalta y, cerca de los bordes, la tabla/página se desplaza sola.
  const ESPERA_TOQUE_MS = 350;
  const TOLERANCIA_PX = 8;
  let arrastre = null; // { item, tarjeta, fantasma, destino, ... } mientras se arrastra
  let ignorarClick = false;

  // origen: { item } = una comida que ya está en la tabla (se MUEVE),
  //         { comida } = una comida de "Más opciones" (se AGREGA a la tabla).
  function habilitarArrastre(tarjeta, origen) {
    tarjeta.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button") || arrastre) return;
      const inicio = { x: e.clientX, y: e.clientY };
      const esTactil = e.pointerType !== "mouse";
      let temporizador = null;
      let empezado = false;

      const empezar = (x, y) => {
        empezado = true;
        iniciarArrastre(origen, tarjeta, x, y);
        if (esTactil && navigator.vibrate) navigator.vibrate(15);
      };
      const alMover = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        const lejos = Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) > TOLERANCIA_PX;
        if (!empezado) {
          if (esTactil) {
            // Se movió antes de tiempo: es un desplazamiento normal, no un arrastre.
            if (lejos) terminar();
          } else if (lejos) {
            empezar(ev.clientX, ev.clientY);
          }
          return;
        }
        moverArrastre(ev.clientX, ev.clientY);
      };
      const alSoltar = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        const habia = empezado;
        terminar();
        if (habia) soltarArrastre(ev.type === "pointercancel");
      };
      function terminar() {
        clearTimeout(temporizador);
        document.removeEventListener("pointermove", alMover);
        document.removeEventListener("pointerup", alSoltar);
        document.removeEventListener("pointercancel", alSoltar);
      }

      document.addEventListener("pointermove", alMover);
      document.addEventListener("pointerup", alSoltar);
      document.addEventListener("pointercancel", alSoltar);
      if (esTactil) temporizador = setTimeout(() => empezar(inicio.x, inicio.y), ESPERA_TOQUE_MS);
    });
    // En el celular, mantener apretado abre el menú del sistema (copiar, etc.): se evita.
    tarjeta.addEventListener("contextmenu", (e) => e.preventDefault());
  }


  function iniciarArrastre(origen, tarjeta, x, y) {
    const caja = tarjeta.getBoundingClientRect();
    const fantasma = tarjeta.cloneNode(true);
    fantasma.classList.add("menuB-fantasma");
    fantasma.style.width = caja.width + "px";
    document.body.appendChild(fantasma);
    tarjeta.classList.add("menuB-comida--arrastrando");
    document.body.classList.add("menuB-arrastrando");
    arrastre = {
      origen,
      tarjeta,
      fantasma,
      destino: null,
      dx: x - caja.left,
      dy: y - caja.top,
      x,
      y,
      autoScroll: null,
    };
    arrastrandoAhora = true;
    moverArrastre(x, y);
    arrastre.autoScroll = setInterval(desplazarCercaDeBordes, 16);
  }

  function moverArrastre(x, y) {
    if (!arrastre) return;
    arrastre.x = x;
    arrastre.y = y;
    arrastre.fantasma.style.transform = `translate(${x - arrastre.dx}px, ${y - arrastre.dy}px)`;
    // El fantasma no recibe eventos (pointer-events: none), así se ve qué hay debajo.
    const debajo = document.elementFromPoint(x, y);
    const celda = debajo ? debajo.closest("#tab-menu .menuB-celda") : null;
    if (celda !== arrastre.destino) {
      if (arrastre.destino) arrastre.destino.classList.remove("menuB-celda--destino");
      arrastre.destino = celda;
      if (celda) celda.classList.add("menuB-celda--destino");
    }
  }

  // Cerca de los bordes, se desplaza la tabla (de costado) o la página (arriba/abajo).
  function desplazarCercaDeBordes() {
    if (!arrastre) return;
    const { x, y } = arrastre;
    const margen = 48;
    const paso = 14;
    const scroll = contenido.querySelector(".menuB-scroll");
    if (scroll) {
      const r = scroll.getBoundingClientRect();
      if (x < r.left + margen + 90) scroll.scrollLeft -= paso; // 90 = columna fija ALMUERZO/CENA
      else if (x > r.right - margen) scroll.scrollLeft += paso;
    }
    if (y < margen) window.scrollBy(0, -paso);
    else if (y > window.innerHeight - margen) window.scrollBy(0, paso);
    moverArrastre(x, y);
  }

  async function soltarArrastre(cancelado) {
    if (!arrastre) return;
    const { origen, tarjeta, fantasma, destino, autoScroll } = arrastre;
    clearInterval(autoScroll);
    fantasma.remove();
    tarjeta.classList.remove("menuB-comida--arrastrando");
    document.body.classList.remove("menuB-arrastrando");
    if (destino) destino.classList.remove("menuB-celda--destino");
    arrastre = null;
    arrastrandoAhora = false;
    // El "click" que el navegador dispara al soltar no tiene que abrir nada.
    ignorarClick = true;
    setTimeout(() => (ignorarClick = false), 0);

    if (cancelado || !destino) return;
    const diaId = Number(destino.dataset.dia);
    const momentoId = Number(destino.dataset.momento);
    if (origen.item) await moverAlSoltar(origen.item, diaId, momentoId);
    else await agregarAlSoltar(origen.comida, diaId, momentoId);
  }

  function textoLugar(diaId, momentoId) {
    const dia = dias.find((d) => d.id === diaId);
    const momento = momentos.find((m) => m.id === momentoId);
    return `el ${dia?.nombre} (${momento?.nombre})`;
  }

  // Mover una comida que ya estaba en la tabla a otro casillero.
  async function moverAlSoltar(item, diaId, momentoId) {
    if (diaId === item.dia_id && momentoId === item.momento_id) return; // mismo lugar
    const nombre = item.comida ? item.comida.nombre : "La comida";
    // Si en el destino ya está esa misma comida, no se mueve (quedaría repetida
    // en el mismo día y momento). Se chequea acá porque la base puede no tener
    // una regla que lo impida.
    const yaEsta = menu.some(
      (m) => m.id !== item.id && m.dia_id === diaId && m.momento_id === momentoId && m.comida?.id === item.comida?.id
    );
    if (yaEsta) {
      showMensaje(mensajeBox, `"${nombre}" ya está ${textoLugar(diaId, momentoId)}.`, "info");
      return;
    }
    try {
      const movida = await moverComidaDelMenu(item.id, diaId, momentoId);
      if (!movida) {
        showMensaje(mensajeBox, `"${nombre}" ya está ${textoLugar(diaId, momentoId)}.`, "info");
        return;
      }
      clearNode(mensajeBox);
      await recargarMenu();
    } catch (err) {
      showMensaje(mensajeBox, "No se pudo mover la comida: " + err.message);
      await recargarMenu();
    }
  }

  // Agregar a la tabla una comida arrastrada desde "Más opciones".
  async function agregarAlSoltar(comida, diaId, momentoId) {
    try {
      // Se relee el menú por si la otra persona cambió algo mientras tanto.
      menu = await fetchMenuSemanal();
      if (menu.some((m) => m.dia_id === diaId && m.momento_id === momentoId && m.comida?.id === comida.id)) {
        showMensaje(mensajeBox, `"${comida.nombre}" ya está ${textoLugar(diaId, momentoId)}.`, "info");
        pintar();
        return;
      }
      if (bloqueadaPorRepeticion(comida)) {
        showMensaje(
          mensajeBox,
          `"${comida.nombre}" no es repetible y ya está en el menú ${dondeEsta(comida.id).join(", ")}.`
        );
        pintar();
        return;
      }
      await agregarComidaAlMenu(diaId, momentoId, comida.id);
      clearNode(mensajeBox);
      await recargarMenu();
    } catch (err) {
      showMensaje(mensajeBox, "No se pudo agregar la comida: " + err.message);
      await recargarMenu();
    }
  }

  /* ---------- "Más opciones": platos principales disponibles para arrastrar ---------- */
  // Desplegable arriba de la tabla con los platos PRINCIPALES (no guarniciones)
  // que se pueden poner: los repetibles, y los no repetibles que todavía no
  // están en la semana. Como se vuelve a calcular cada vez que se dibuja, si se
  // quita de la tabla un no repetible, vuelve a aparecer acá.
  let opcionesAbiertas = false; // se recuerda abierto/cerrado al redibujar

  function esPrincipal(comida) {
    const nombre = (comida.tipo_comida?.nombre || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return nombre === "principal";
  }

  function renderMasOpciones() {
    const disponibles = comidas
      .filter((c) => esPrincipal(c) && !bloqueadaPorRepeticion(c))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

    const detalles = el("details", { class: "menuB-opciones" });
    detalles.open = opcionesAbiertas;
    detalles.addEventListener("toggle", () => (opcionesAbiertas = detalles.open));
    detalles.appendChild(
      el("summary", { class: "menuB-opciones__titulo" }, [
        "Más opciones",
        el("span", { class: "menuB-opciones__cantidad" }, ` (${disponibles.length})`),
      ])
    );

    if (disponibles.length === 0) {
      detalles.appendChild(
        el("p", { class: "texto-ayuda menuB-opciones__vacio" }, "No quedan platos principales disponibles para esta semana.")
      );
      return detalles;
    }
    const lista = el("div", { class: "menuB-opciones__lista" });
    disponibles.forEach((comida) => {
      const chip = el(
        "div",
        { class: "menuB-comida menuB-opcion", title: "Arrastralo a un día de la tabla", "data-comida": String(comida.id) },
        [
          el("span", { class: "menuB-comida__nombre" }, comida.nombre),
          comida.repetible ? el("span", { class: "menuB-opcion__repetible", title: "Repetible" }, "↻") : null,
        ]
      );
      habilitarArrastre(chip, { comida });
      lista.appendChild(chip);
    });
    detalles.appendChild(lista);
    return detalles;
  }

  // Evita que el click que sigue a un arrastre active un botón de la celda de destino.
  contenido.addEventListener(
    "click",
    (e) => {
      if (ignorarClick) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true
  );

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
