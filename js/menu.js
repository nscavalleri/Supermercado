// Pantalla Menú: el menú semanal, empezando siempre por el día de hoy.
// Es una plantilla fija que se repite todas las semanas (lo que ponés en
// "Lunes > Cena" queda ahí hasta que lo cambies).
// Desde cada comida se pueden mandar sus ingredientes a una lista de compra.
import { el, clearNode, showMensaje, botonIcono, mismoNombre } from "./ui.js";
import {
  fetchDiasSemana,
  fetchMomentosComida,
  fetchMenuSemanal,
  fetchComidas,
  fetchTiposComida,
  fetchSupermercados,
  agregarComidaAlMenu,
  quitarComidaDelMenu,
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

export async function renderMenu(container) {
  clearNode(container);

  const mensajeBox = el("div", { class: "mensaje-box" });
  const contenido = el("div", {}, "Cargando...");
  container.appendChild(mensajeBox);
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

  async function recargarMenu() {
    menu = await fetchMenuSemanal();
    pintar();
  }

  function pintar() {
    clearNode(contenido);
    const hoy = diaDeHoy();

    ordenDesdeHoy(dias).forEach((dia) => {
      const titulo = el("h3", { class: "dia__titulo" }, dia.nombre);
      if (dia.id === hoy) titulo.appendChild(el("span", { class: "dia__hoy" }, "Hoy"));

      const caja = el("section", { class: "dia" }, [titulo]);
      momentos.forEach((momento) => caja.appendChild(renderMomento(dia, momento)));
      contenido.appendChild(caja);
    });
  }

  function renderMomento(dia, momento) {
    const items = menu.filter((m) => m.dia_id === dia.id && m.momento_id === momento.id);
    const caja = el("div", { class: "momento" }, [
      el("h4", { class: "momento__titulo" }, momento.nombre),
    ]);

    if (items.length === 0) {
      caja.appendChild(el("p", { class: "texto-ayuda" }, "Sin comidas todavía."));
    } else {
      const ul = el("ul", { class: "item-lista" });
      items.forEach((item) => ul.appendChild(renderItem(item)));
      caja.appendChild(ul);
    }

    caja.appendChild(renderAgregarComida(dia, momento));
    return caja;
  }

  function renderItem(item) {
    const nombre = el(
      "span",
      { class: "item-lista__nombre" },
      item.comida ? item.comida.nombre : "(comida eliminada)"
    );
    const tipoChip = item.comida?.tipo_comida
      ? el("span", { class: "abm-lista__tipo" }, item.comida.tipo_comida.nombre)
      : null;
    const verIngredientes = el(
      "button",
      {
        class: `btn btn--secundario btn--chico${panelIngredientes === item.id ? " btn--activo" : ""}`,
        type: "button",
      },
      "Ingredientes"
    );
    const quitar = botonIcono("eliminar", "Quitar del menú");

    const fila = el("div", { class: "item-lista__fila item-lista__fila--menu" }, [
      nombre,
      tipoChip,
      el("div", { class: "abm-lista__acciones" }, [verIngredientes, quitar]),
    ]);

    verIngredientes.addEventListener("click", () => {
      panelIngredientes = panelIngredientes === item.id ? null : item.id;
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

    const contenedor = el("li", { class: "item-lista__contenedor" }, [fila]);
    if (panelIngredientes === item.id) contenedor.appendChild(renderPanelIngredientes(item));
    return contenedor;
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
        "Destildá los que ya tenés y elegí a qué lista va cada uno:"
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
      const check = el("input", { type: "checkbox" });
      check.checked = true;
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

  // Botón "+ Agregar comida" que se convierte en un selector con el catálogo.
  function renderAgregarComida(dia, momento) {
    const clave = `${dia.id}-${momento.id}`;

    if (slotAgregando !== clave) {
      const boton = el("button", { class: "btn btn--secundario btn--chico", type: "button" }, "+ Agregar comida");
      boton.addEventListener("click", () => {
        slotAgregando = clave;
        filtroTipoSlot = FILTRO_TODOS;
        panelIngredientes = null;
        pintar();
      });
      return boton;
    }

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

      if (filtradas.length === 0) {
        const texto =
          disponibles.length === 0 ? "Ya están todas agregadas" : "No hay comidas de ese tipo";
        select.appendChild(el("option", { value: "" }, texto));
        select.disabled = true;
      } else {
        select.disabled = false;
        filtradas.forEach((c) => select.appendChild(el("option", { value: String(c.id) }, c.nombre)));
      }
    }
    opcionesComida();

    selectTipo.addEventListener("change", () => {
      filtroTipoSlot = selectTipo.value;
      opcionesComida();
    });

    const aceptar = botonIcono("guardar", "Agregar al menú");
    const cancelar = botonIcono("cancelar", "Cancelar");

    aceptar.addEventListener("click", async () => {
      if (!select.value) {
        slotAgregando = null;
        pintar();
        return;
      }
      try {
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
