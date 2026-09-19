// Punto de entrada de la app: maneja login/logout y la navegación entre
// solapas y subsolapas, delegando el contenido de cada pantalla a su módulo.
import { getSession, onAuthStateChange, signIn, signUp, signOut } from "./auth.js";
import { showMensaje, clearNode } from "./ui.js";
import { renderProductos } from "./productos.js";
import { renderSupermercados } from "./supermercados.js";
import { renderTiposProducto } from "./tiposProducto.js";
import { renderListaOnline } from "./listaOnline.js";
import { renderPresencial } from "./listaPresencial.js";

const pantallaLogin = document.getElementById("pantalla-login");
const pantallaApp = document.getElementById("pantalla-app");

/* ---------- Login / registro ---------- */

const loginMensaje = document.getElementById("login-mensaje");
const formLogin = document.getElementById("form-login");
const formRegistro = document.getElementById("form-registro");
const btnMostrarRegistro = document.getElementById("btn-mostrar-registro");
const btnMostrarLogin = document.getElementById("btn-mostrar-login");
const loginSubtitulo = document.getElementById("login-subtitulo");

function mostrarVistaRegistro() {
  formLogin.classList.add("oculto");
  btnMostrarRegistro.classList.add("oculto");
  formRegistro.classList.remove("oculto");
  btnMostrarLogin.classList.remove("oculto");
  loginSubtitulo.textContent = "Creá tu cuenta para empezar";
  clearNode(loginMensaje);
}

function mostrarVistaLogin() {
  formRegistro.classList.add("oculto");
  btnMostrarLogin.classList.add("oculto");
  formLogin.classList.remove("oculto");
  btnMostrarRegistro.classList.remove("oculto");
  loginSubtitulo.textContent = "Iniciá sesión para continuar";
  clearNode(loginMensaje);
}

btnMostrarRegistro.addEventListener("click", mostrarVistaRegistro);
btnMostrarLogin.addEventListener("click", mostrarVistaLogin);

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearNode(loginMensaje);
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  try {
    await signIn(email, password);
  } catch (err) {
    showMensaje(loginMensaje, "No se pudo iniciar sesión: " + err.message);
  }
});

formRegistro.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearNode(loginMensaje);
  const email = document.getElementById("registro-email").value.trim();
  const password = document.getElementById("registro-password").value;
  try {
    const { session } = await signUp(email, password);
    if (!session) {
      showMensaje(
        loginMensaje,
        "Cuenta creada. Revisá tu email para confirmarla y después iniciá sesión.",
        "info"
      );
      btnMostrarLogin.click();
    }
  } catch (err) {
    showMensaje(loginMensaje, "No se pudo crear la cuenta: " + err.message);
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
  activarTab("lista");
}

function mostrarLogin() {
  pantallaApp.classList.add("oculto");
  pantallaLogin.classList.remove("oculto");
  formLogin.reset();
  formRegistro.reset();
  mostrarVistaLogin();
}

(async function iniciar() {
  const session = await getSession();
  if (session) mostrarApp();
  else mostrarLogin();
})();

onAuthStateChange((session) => {
  if (session) mostrarApp();
  else mostrarLogin();
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
