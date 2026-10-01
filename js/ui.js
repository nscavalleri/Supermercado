// Helpers de interfaz reutilizados por los distintos módulos de pantallas.

// Crea un elemento DOM de forma compacta: el("div", {class:"x"}, ["texto", otroEl])
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== undefined && value !== null && value !== false) {
      node.setAttribute(key, value === true ? "" : value);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const child of kids) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

// Compara dos nombres ignorando mayúsculas, espacios sobrantes y acentos.
// Se usa para no crear productos/comidas duplicados por diferencias de tipeo.
export function normalizarTexto(texto) {
  return (texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function mismoNombre(a, b) {
  return normalizarTexto(a) === normalizarTexto(b);
}

export function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function showMensaje(container, texto, tipo = "error") {
  clearNode(container);
  if (!texto) return;
  container.appendChild(el("div", { class: `mensaje mensaje--${tipo}` }, texto));
}

/* ---------- Botones con ícono (usados en las listas de Configuración) ---------- */
// Son SVG dibujados a mano (no hay librería de íconos): trazo simple, heredan
// el color del botón con stroke="currentColor" (ver .btn-icono en styles.css).

const ICONOS = {
  // Lápiz
  editar: '<path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M14.5 5.5l4 4" />',
  // Tacho de basura
  eliminar:
    '<path d="M4 7h16" /><path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" />' +
    '<path d="M6.5 7l.9 12a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12" /><path d="M10 11v6M14 11v6" />',
  // Dos hojas superpuestas
  duplicar: '<rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" />',
  // Tilde
  guardar: '<path d="M5 12.5l4.5 4.5L19 7.5" />',
  // Cruz
  cancelar: '<path d="M6 6l12 12M18 6L6 18" />',
  // Más
  agregar: '<path d="M12 5v14M5 12h14" />',
  // Calendario
  calendario:
    '<rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />',
  // Flecha hacia abajo sobre una bandeja: descargar
  descargar: '<path d="M12 4v11" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19h14" />',
  // Hoja de receta con renglones: ver los ingredientes de una comida
  ingredientes:
    '<rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3.5h6v2H9z" />' +
    '<path d="M9 10h6M9 13.5h6M9 17h3.5" />',
  // Dos flechas en círculo (ciclo): comida que se puede repetir en la semana
  repetible:
    '<path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L19.5 9" /><path d="M19.5 4.5V9H15" />' +
    '<path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4.5 15" /><path d="M4.5 19.5V15H9" />',
};

const ETIQUETAS = {
  editar: "Editar",
  duplicar: "Duplicar",
  eliminar: "Eliminar",
  guardar: "Guardar",
  cancelar: "Cancelar",
  agregar: "Agregar",
  descargar: "Descargar",
  calendario: "Elegir en el calendario",
  ingredientes: "Ingredientes",
  repetible: "Repetible",
};

// Botón de ícono que se prende y apaga (ej: "Repetible"). Prendido se ve
// relleno de celeste; apagado, como los demás botones de ícono. El texto de
// ayuda (tooltip) cambia según el estado, así se sabe qué significa cada uno.
//   textos: { si: "...", no: "..." }
export function botonIconoToggle(tipo, activo, textos) {
  const boton = botonIcono(tipo);
  function marcar(valor) {
    boton.classList.toggle("btn-icono--activo", valor);
    boton.setAttribute("aria-pressed", valor ? "true" : "false");
    boton.title = valor ? textos.si : textos.no;
    boton.setAttribute("aria-label", boton.title);
  }
  marcar(!!activo);
  boton.marcar = marcar;
  boton.estaActivo = () => boton.getAttribute("aria-pressed") === "true";
  return boton;
}

// Botón cuadrado con ícono. El texto va en title/aria-label, así se ve el
// tooltip al pasar el mouse y los lectores de pantalla lo siguen leyendo.
export function botonIcono(tipo, etiqueta) {
  const texto = etiqueta || ETIQUETAS[tipo] || tipo;
  const boton = el("button", {
    class: `btn-icono btn-icono--${tipo}`,
    type: "button",
    title: texto,
    "aria-label": texto,
  });
  boton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONOS[tipo] || ""}</svg>`;
  return boton;
}

// Input con autocompletado simple contra una lista de {id, nombre}.
// onSubmit(texto) se llama al elegir una sugerencia, tocar "Agregar" o apretar Enter.
// textoBoton permite cambiar la etiqueta del botón ("Agregar producto", etc.)
// y extras son nodos que se insertan entre el input y el botón (por ejemplo,
// el select de tipo en Configuración > Productos).
export function crearInputConAutocompletado({
  placeholder,
  getSugerencias,
  onSubmit,
  textoBoton = "Agregar",
  extras = [],
}) {
  const wrapper = el("div", { class: "autocomplete" });
  const input = el("input", {
    type: "text",
    class: "autocomplete__input",
    placeholder,
    autocomplete: "off",
  });
  const lista = el("ul", { class: "autocomplete__lista oculto" });
  const boton = el("button", { class: "btn btn--primario", type: "button" }, textoBoton);

  let resaltado = -1;

  function ocultarLista() {
    lista.classList.add("oculto");
    clearNode(lista);
    resaltado = -1;
  }

  function mostrarSugerencias() {
    const texto = input.value.trim();
    clearNode(lista);
    resaltado = -1;
    if (!texto) {
      ocultarLista();
      return;
    }
    const sugerencias = getSugerencias(texto).slice(0, 8);
    if (sugerencias.length === 0) {
      ocultarLista();
      return;
    }
    sugerencias.forEach((item) => {
      const li = el("li", { class: "autocomplete__item" }, item.nombre);
      li.addEventListener("mousedown", (e) => {
        // mousedown (no click) para que dispare antes del blur del input
        e.preventDefault();
        input.value = item.nombre;
        ocultarLista();
        onSubmit(item.nombre);
        input.value = "";
        input.focus();
      });
      lista.appendChild(li);
    });
    lista.classList.remove("oculto");
  }

  function enviar() {
    const texto = input.value.trim();
    if (!texto) return;
    ocultarLista();
    onSubmit(texto);
    input.value = "";
    input.focus();
  }

  input.addEventListener("input", mostrarSugerencias);
  input.addEventListener("keydown", (e) => {
    const items = Array.from(lista.children);
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      resaltado = Math.min(resaltado + 1, items.length - 1);
      items.forEach((it, i) => it.classList.toggle("autocomplete__item--activo", i === resaltado));
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      resaltado = Math.max(resaltado - 1, 0);
      items.forEach((it, i) => it.classList.toggle("autocomplete__item--activo", i === resaltado));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (resaltado >= 0 && items[resaltado]) {
        input.value = items[resaltado].textContent;
      }
      enviar();
    } else if (e.key === "Escape") {
      ocultarLista();
    }
  });
  input.addEventListener("blur", () => setTimeout(ocultarLista, 150));
  boton.addEventListener("click", enviar);

  wrapper.appendChild(input);
  wrapper.appendChild(lista);
  const fila = el("div", { class: "form-agregar" }, [wrapper, ...extras, boton]);
  return { nodo: fila, input };
}

/* ---------- Modales (reemplazan al confirm() del navegador) ---------- */
// El confirm() nativo se ve como un recuadro del sistema (negro en modo
// oscuro) y no se puede estilizar, así que todos los modales de la app se
// arman acá, con el diseño de la app. Hay dos:
//   - confirmar(): pregunta sí/no (ej: "¿Eliminar X?").
//   - abrirFormularioModal(): un formulario (ej: "Agregar stock").

// Lista con viñetas para mostrar adentro de un modal, cortando en `max` para
// que un tipo con muchísimos productos no genere un modal kilométrico.
export function listaParaAviso(textos, max = 15) {
  const visibles = textos.slice(0, max);
  const resto = textos.length - visibles.length;
  return el("ul", { class: "modal__lista" }, [
    ...visibles.map((t) => el("li", {}, t)),
    resto > 0 ? el("li", { class: "modal__lista-resto" }, `… y ${resto} más`) : null,
  ]);
}

// Base común de los modales: arma el fondo oscuro, el recuadro con título y
// ✕, y los botones. Cancelar, la ✕, tocar afuera o Escape llaman a onCancelar.
function montarModal({ titulo, cuerpo, botonAceptar, textoCancelar, onCancelar }) {
  const focoAnterior = document.activeElement;
  const botonCerrar = el("button", { class: "modal__cerrar", type: "button", "aria-label": "Cerrar" }, "✕");
  const botonCancelar = el("button", { class: "btn btn--secundario", type: "button" }, textoCancelar);
  const caja = el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "modal-titulo" }, [
    el("div", { class: "modal__encabezado" }, [el("h3", { id: "modal-titulo", class: "modal__titulo" }, titulo), botonCerrar]),
    cuerpo,
    el("div", { class: "modal__acciones" }, [botonCancelar, botonAceptar]),
  ]);
  const overlay = el("div", { class: "modal-overlay" }, [caja]);

  function cerrar() {
    document.removeEventListener("keydown", onTecla);
    overlay.remove();
    document.body.classList.remove("con-modal");
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  }
  function onTecla(e) {
    if (e.key === "Escape") onCancelar();
  }

  botonCerrar.addEventListener("click", onCancelar);
  botonCancelar.addEventListener("click", onCancelar);
  // Tocar el fondo oscuro (fuera del recuadro) cancela.
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) onCancelar();
  });
  document.addEventListener("keydown", onTecla);

  document.body.appendChild(overlay);
  document.body.classList.add("con-modal");
  return { cerrar, botonCancelar };
}

const aNodos = (contenido) =>
  (Array.isArray(contenido) ? contenido : [contenido]).map((m) => (typeof m === "string" ? el("p", {}, m) : m));

// Pregunta sí/no. Devuelve una promesa: true si se tocó el botón de aceptar,
// false si se canceló (botón Cancelar, la ✕, tocar afuera o la tecla Escape).
//   titulo:       título del modal (ej: "Eliminar producto")
//   mensaje:      texto o nodo(s) del cuerpo (acepta un array de nodos)
//   textoAceptar: texto del botón de aceptar (por defecto "Eliminar")
//   peligro:      true = botón de aceptar en rojo (acciones que borran algo)
// También acepta un string suelto: confirmar("¿Seguro?").
export function confirmar(opciones) {
  const {
    titulo = "Confirmar",
    mensaje = "",
    textoAceptar = "Eliminar",
    textoCancelar = "Cancelar",
    peligro = true,
  } = typeof opciones === "string" ? { mensaje: opciones } : opciones;

  return new Promise((resolve) => {
    const botonAceptar = el(
      "button",
      { class: `btn ${peligro ? "btn--peligro-lleno" : "btn--primario"}`, type: "button" },
      textoAceptar
    );
    const modal = montarModal({
      titulo,
      cuerpo: el("div", { class: "modal__cuerpo" }, aNodos(mensaje)),
      botonAceptar,
      textoCancelar,
      onCancelar: () => {
        modal.cerrar();
        resolve(false);
      },
    });
    botonAceptar.addEventListener("click", () => {
      modal.cerrar();
      resolve(true);
    });
    // El foco arranca en Cancelar: un Enter apurado no borra nada.
    modal.botonCancelar.focus();
  });
}

// Modal con un formulario. `campos` son los nodos del formulario (labels,
// inputs...). Al tocar el botón de aceptar (o Enter) se llama a guardar():
//   - si devuelve un texto, es un error: se muestra arriba del formulario y
//     el modal queda abierto, con lo que se había escrito;
//   - si no devuelve nada, se cierra.
// Devuelve una promesa que se resuelve en true si se guardó, false si se canceló.
export function abrirFormularioModal({ titulo, campos, textoAceptar = "Guardar", textoCancelar = "Cancelar", guardar }) {
  return new Promise((resolve) => {
    const errorBox = el("div", { class: "mensaje-box" });
    const botonAceptar = el("button", { class: "btn btn--primario", type: "submit" }, textoAceptar);
    // novalidate: la validación la hace guardar(), con mensajes en castellano
    // y con el diseño de la app, en vez de los globitos del navegador.
    const form = el("form", { class: "modal__cuerpo modal__form", novalidate: true }, [errorBox, ...aNodos(campos)]);
    // El botón de aceptar está fuera del <form> (en la fila de botones), así
    // que se lo asocia al form por id para que Enter y el click lo envíen.
    const formId = "modal-form-" + Date.now();
    form.id = formId;
    botonAceptar.setAttribute("form", formId);

    const modal = montarModal({
      titulo,
      cuerpo: form,
      botonAceptar,
      textoCancelar,
      onCancelar: () => {
        modal.cerrar();
        resolve(false);
      },
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      botonAceptar.disabled = true;
      try {
        const error = await guardar();
        if (error) {
          showMensaje(errorBox, error);
          return;
        }
        modal.cerrar();
        resolve(true);
      } catch (err) {
        showMensaje(errorBox, "No se pudo guardar: " + err.message);
      } finally {
        botonAceptar.disabled = false;
      }
    });

    // El foco arranca en el primer campo del formulario.
    const primero = form.querySelector("input, select, textarea");
    if (primero) primero.focus();
  });
}

// Campo de texto con sugerencias del catálogo, para usar adentro de un
// formulario: elegir una sugerencia solo completa el campo (no envía nada),
// a diferencia de crearInputConAutocompletado que agrega al elegir.
export function crearCampoAutocompletado({ placeholder, getSugerencias, id }) {
  const wrapper = el("div", { class: "autocomplete" });
  const input = el("input", { type: "text", class: "autocomplete__input", placeholder, autocomplete: "off", id });
  const lista = el("ul", { class: "autocomplete__lista oculto" });
  let resaltado = -1;

  function ocultar() {
    lista.classList.add("oculto");
    clearNode(lista);
    resaltado = -1;
  }
  function elegir(nombre) {
    input.value = nombre;
    ocultar();
  }
  function mostrar() {
    clearNode(lista);
    resaltado = -1;
    const texto = input.value.trim();
    const sugerencias = texto ? getSugerencias(texto).slice(0, 8) : [];
    if (sugerencias.length === 0) return ocultar();
    sugerencias.forEach((item) => {
      const li = el("li", { class: "autocomplete__item" }, item.nombre);
      li.addEventListener("mousedown", (e) => {
        e.preventDefault(); // antes del blur del input
        elegir(item.nombre);
      });
      lista.appendChild(li);
    });
    lista.classList.remove("oculto");
  }

  input.addEventListener("input", mostrar);
  input.addEventListener("keydown", (e) => {
    const items = Array.from(lista.children);
    if (lista.classList.contains("oculto") || !items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      resaltado = e.key === "ArrowDown" ? Math.min(resaltado + 1, items.length - 1) : Math.max(resaltado - 1, 0);
      items.forEach((it, i) => it.classList.toggle("autocomplete__item--activo", i === resaltado));
    } else if (e.key === "Enter" && resaltado >= 0) {
      // Enter sobre una sugerencia resaltada la elige (no envía el formulario).
      e.preventDefault();
      elegir(items[resaltado].textContent);
    } else if (e.key === "Escape") {
      // Cierra las sugerencias sin cerrar el modal.
      e.stopPropagation();
      ocultar();
    }
  });
  // Al salir del campo se cierran las sugerencias (con una pausa corta para
  // que un toque sobre una sugerencia llegue a registrarse), salvo que para
  // entonces el foco ya haya vuelto al campo.
  input.addEventListener("blur", () =>
    setTimeout(() => {
      if (document.activeElement !== input) ocultar();
    }, 150)
  );

  wrapper.append(input, lista);
  return { nodo: wrapper, input };
}

/* ---------- Campo de fecha en formato dd/mm/aaaa ---------- */
// El <input type="date"> del navegador muestra la fecha en el formato del
// idioma del navegador (en inglés: mm/dd/yyyy) y no se puede cambiar. Este
// campo siempre se escribe y se ve como dd/mm/aaaa: se tipean los números y
// las barras se ponen solas. El botón del calendario abre el calendario del
// navegador y la fecha elegida se pasa a dd/mm/aaaa.
// Devuelve { nodo, input, getISO(), setISO(iso) }:
//   getISO() → "AAAA-MM-DD" si es una fecha válida, "" si está vacío, null si es inválida.
export function crearCampoFecha({ id } = {}) {
  const input = el("input", {
    type: "text",
    id,
    class: "campo-fecha__input",
    placeholder: "dd/mm/aaaa",
    inputmode: "numeric",
    autocomplete: "off",
    maxlength: "10",
  });
  // Calendario del navegador, invisible: solo se usa para elegir con el botón.
  const nativo = el("input", { type: "date", class: "campo-fecha__nativo", tabindex: "-1", "aria-hidden": "true" });
  const boton = botonIcono("calendario");
  boton.classList.add("campo-fecha__boton");

  const dosDig = (n) => String(n).padStart(2, "0");

  function getISO() {
    const texto = input.value.trim();
    if (!texto) return "";
    const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const f = new Date(a, mes - 1, d);
    if (f.getFullYear() !== a || f.getMonth() !== mes - 1 || f.getDate() !== d) return null; // ej: 31/02
    return `${a}-${dosDig(mes)}-${dosDig(d)}`;
  }
  function setISO(iso) {
    const [a, m, d] = (iso || "").split("-");
    input.value = a && m && d ? `${d}/${m}/${a}` : "";
  }

  // Mientras se escribe: solo números, y las barras se agregan solas (dd/mm/aaaa).
  input.addEventListener("input", (e) => {
    const borrando = e.inputType && e.inputType.startsWith("delete");
    const numeros = input.value.replace(/\D/g, "").slice(0, 8);
    let texto = numeros.slice(0, 2);
    if (numeros.length > 2 || (!borrando && numeros.length === 2)) texto += "/";
    texto += numeros.slice(2, 4);
    if (numeros.length > 4 || (!borrando && numeros.length === 4)) texto += "/";
    texto += numeros.slice(4, 8);
    input.value = texto;
  });

  boton.addEventListener("click", () => {
    nativo.value = getISO() || "";
    try {
      nativo.showPicker();
    } catch {
      nativo.focus();
      nativo.click();
    }
  });
  nativo.addEventListener("change", () => {
    setISO(nativo.value);
    input.focus();
  });

  const nodo = el("div", { class: "campo-fecha" }, [input, boton, nativo]);
  return { nodo, input, getISO, setISO };
}
