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
import { renderConfigMenu } from "./configMenu.js";
import { renderMenu } from "./menu.js";
import { renderListaOnline } from "./listaOnline.js";
import { renderPresencial, resetSeleccionPresencial } from "./listaPresencial.js";

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
  // Al ingresar, la app siempre arranca en Lista > Presencial, y dentro de
  // Presencial en el supermercado por defecto (Mercadona si existe, si no "Todos").
  subtabListaActiva = "presencial";
  subtabConfigActiva = "productos";
  resetSeleccionPresencial();
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

/* ---------- Navegación: solapas Lista / Menú / Configuración ---------- */

const botonesTab = {
  lista: document.getElementById("btn-tab-lista"),
  menu: document.getElementById("btn-tab-menu"),
  configuracion: document.getElementById("btn-tab-configuracion"),
};
const panelesTab = {
  lista: document.getElementById("tab-lista"),
  menu: document.getElementById("tab-menu"),
  configuracion: document.getElementById("tab-configuracion"),
};

function activarTab(tab) {
  Object.keys(panelesTab).forEach((nombre) => {
    botonesTab[nombre].classList.toggle("tab-btn--activo", nombre === tab);
    panelesTab[nombre].classList.toggle("oculto", nombre !== tab);
  });

  if (tab === "lista") activarSubtabLista(subtabListaActiva);
  else if (tab === "menu") renderMenu(panelesTab.menu);
  else activarSubtabConfiguracion(subtabConfigActiva);
}

Object.keys(botonesTab).forEach((nombre) => {
  botonesTab[nombre].addEventListener("click", () => activarTab(nombre));
});

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

/* ---------- Subsolapas de Configuración: Productos / Supermercados / Tipos de producto / Menú ---------- */

const botonesConfig = {
  productos: document.getElementById("btn-subtab-productos"),
  supermercados: document.getElementById("btn-subtab-supermercados"),
  "tipos-producto": document.getElementById("btn-subtab-tipos-producto"),
  menu: document.getElementById("btn-subtab-menu"),
};
const panelesConfig = {
  productos: document.getElementById("config-productos"),
  supermercados: document.getElementById("config-supermercados"),
  "tipos-producto": document.getElementById("config-tipos-producto"),
  menu: document.getElementById("config-menu"),
};
let subtabConfigActiva = "productos";

function activarSubtabConfiguracion(subtab) {
  subtabConfigActiva = subtab;
  Object.keys(panelesConfig).forEach((nombre) => {
    botonesConfig[nombre].classList.toggle("subtab-btn--activo", nombre === subtab);
    panelesConfig[nombre].classList.toggle("oculto", nombre !== subtab);
  });

  if (subtab === "productos") renderProductos(panelesConfig.productos);
  else if (subtab === "supermercados") renderSupermercados(panelesConfig.supermercados, () => {});
  else if (subtab === "tipos-producto") renderTiposProducto(panelesConfig["tipos-producto"]);
  else renderConfigMenu(panelesConfig.menu);
}

Object.keys(botonesConfig).forEach((nombre) => {
  botonesConfig[nombre].addEventListener("click", () => activarSubtabConfiguracion(nombre));
});
