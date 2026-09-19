// Punto de entrada de la app: maneja login/logout y la navegación entre
// solapas y subsolapas, delegando el contenido de cada pantalla a su módulo.
import {
  getSession,
  onAuthStateChange,
  ingresar,
  signOut,
  getUsuarioActual,
} from "./auth.js";
import { showMensaje, clearNode } from "./ui.js";
import { renderProductos } from "./productos.js";
import { renderSupermercados } from "./supermercados.js";
import { renderTiposProducto } from "./tiposProducto.js";
import { renderListaOnline } from "./listaOnline.js";
import { renderPresencial } from "./listaPresencial.js";

const pantallaLogin = document.getElementById("pantalla-login");
const pantallaApp = document.getElementById("pantalla-app");

/* ---------- Ingreso (usuario + código) ---------- */

const loginMensaje = document.getElementById("login-mensaje");
const formLogin = document.getElementById("form-login");
const loginUsuario = document.getElementById("login-usuario");
const loginCodigo = document.getElementById("login-codigo");
const headerUsuario = document.getElementById("header-usuario");

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearNode(loginMensaje);
  const nombre = loginUsuario.value;
  const codigo = loginCodigo.value.trim();
  try {
    await ingresar(nombre, codigo);
    mostrarApp();
  } catch (err) {
    showMensaje(loginMensaje, err.message);
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  try {
    await signOut();
  } catch (err) {
    console.error(err);
  }
});

/* ---------- Mostrar login o app según la sesión ---------- */

function mostrarApp() {
  pantallaLogin.classList.add("oculto");
  pantallaApp.classList.remove("oculto");
  headerUsuario.textContent = getUsuarioActual() || "";
  activarTab("lista");
}

function mostrarLogin() {
  pantallaApp.classList.add("oculto");
  pantallaLogin.classList.remove("oculto");
  formLogin.reset();
  clearNode(loginMensaje);
}

(async function iniciar() {
  const session = await getSession();
  const usuario = getUsuarioActual();
  if (session && usuario) mostrarApp();
  else mostrarLogin();
})();

onAuthStateChange((session) => {
  const usuario = getUsuarioActual();
  if (session && usuario) mostrarApp();
  else if (!session) mostrarLogin();
});

/* ---------- Navegación: solapas Lista / Configuración ---------- */

const btnTabLista = document.getElementById("btn-tab-lista");
const btnTabConfiguracion = document.getElementById("btn-tab-configuracion");
const tabLista = document.getElementById("tab-lista");
const tabConfiguracion = document.getElementById("tab-configuracion");

function activarTab(tab) {
  const esLista = tab === "lista";
  btnTabLista.classList.toggle("tab-btn--activo", esLista);
  btnTabConfiguracion.classList.toggle("tab-btn--activo", !esLista);
  tabLista.classList.toggle("oculto", !esLista);
  tabConfiguracion.classList.toggle("oculto", esLista);

  if (esLista) activarSubtabLista(subtabListaActiva);
  else activarSubtabConfiguracion(subtabConfigActiva);
}

btnTabLista.addEventListener("click", () => activarTab("lista"));
btnTabConfiguracion.addEventListener("click", () => activarTab("configuracion"));

/* ---------- Subsolapas de Lista: Presencial / Online ---------- */

const btnSubtabPresencial = document.getElementById("btn-subtab-presencial");
const btnSubtabOnline = document.getElementById("btn-subtab-online");
const panelPresencial = document.getElementById("lista-presencial");
const panelOnline = document.getElementById("lista-online");
let subtabListaActiva = "presencial";

function activarSubtabLista(subtab) {
  subtabListaActiva = subtab;
  const esPresencial = subtab === "presencial";
  btnSubtabPresencial.classList.toggle("subtab-btn--activo", esPresencial);
  btnSubtabOnline.classList.toggle("subtab-btn--activo", !esPresencial);
  panelPresencial.classList.toggle("oculto", !esPresencial);
  panelOnline.classList.toggle("oculto", esPresencial);

  if (esPresencial) renderPresencial(panelPresencial);
  else renderListaOnline(panelOnline);
}

btnSubtabPresencial.addEventListener("click", () => activarSubtabLista("presencial"));
btnSubtabOnline.addEventListener("click", () => activarSubtabLista("online"));

/* ---------- Subsolapas de Configuración: Productos / Supermercados / Tipos de producto ---------- */

const btnSubtabProductos = document.getElementById("btn-subtab-productos");
const btnSubtabSupermercados = document.getElementById("btn-subtab-supermercados");
const btnSubtabTiposProducto = document.getElementById("btn-subtab-tipos-producto");
const panelProductos = document.getElementById("config-productos");
const panelSupermercados = document.getElementById("config-supermercados");
const panelTiposProducto = document.getElementById("config-tipos-producto");
let subtabConfigActiva = "productos";

function activarSubtabConfiguracion(subtab) {
  subtabConfigActiva = subtab;
  btnSubtabProductos.classList.toggle("subtab-btn--activo", subtab === "productos");
  btnSubtabSupermercados.classList.toggle("subtab-btn--activo", subtab === "supermercados");
  btnSubtabTiposProducto.classList.toggle("subtab-btn--activo", subtab === "tipos-producto");
  panelProductos.classList.toggle("oculto", subtab !== "productos");
  panelSupermercados.classList.toggle("oculto", subtab !== "supermercados");
  panelTiposProducto.classList.toggle("oculto", subtab !== "tipos-producto");

  if (subtab === "productos") renderProductos(panelProductos);
  else if (subtab === "supermercados") renderSupermercados(panelSupermercados, () => {});
  else renderTiposProducto(panelTiposProducto);
}

btnSubtabProductos.addEventListener("click", () => activarSubtabConfiguracion("productos"));
btnSubtabSupermercados.addEventListener("click", () => activarSubtabConfiguracion("supermercados"));
btnSubtabTiposProducto.addEventListener("click", () => activarSubtabConfiguracion("tipos-producto"));
