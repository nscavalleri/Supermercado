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
