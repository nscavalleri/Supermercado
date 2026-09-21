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
  // Tilde
  guardar: '<path d="M5 12.5l4.5 4.5L19 7.5" />',
  // Cruz
  cancelar: '<path d="M6 6l12 12M18 6L6 18" />',
};

const ETIQUETAS = {
  editar: "Editar",
  eliminar: "Eliminar",
  guardar: "Guardar",
  cancelar: "Cancelar",
};

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
export function crearInputConAutocompletado({ placeholder, getSugerencias, onSubmit }) {
  const wrapper = el("div", { class: "autocomplete" });
  const input = el("input", {
    type: "text",
    class: "autocomplete__input",
    placeholder,
    autocomplete: "off",
  });
  const lista = el("ul", { class: "autocomplete__lista oculto" });
  const boton = el("button", { class: "btn btn--primario", type: "button" }, "Agregar");

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
  const fila = el("div", { class: "form-agregar" }, [wrapper, boton]);
  return { nodo: fila, input };
}

export function confirmar(mensaje) {
  return window.confirm(mensaje);
}
