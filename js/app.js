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
import { renderStock } from "./stock.js";
import { actualizarAvisoVencimientos } from "./avisoVencimientos.js";
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
    // Recién ingresado: siempre arranca en el default.
    mostrarApp({ restaurar: false });
  } catch (err) {
    showMensaje(loginMensaje, err.message);
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  borrarNavegacion();
  try {
    await signOut();
  } catch (err) {
    console.error(err);
  }
});

/* ---------- Mostrar login o app según la sesión ---------- */

/* ---------- Recordar en qué pantalla estabas ---------- */
// Al ABRIR la app (pestaña nueva, o la app instalada que estaba cerrada)
// arranca siempre en Lista > Presencial > Mercadona. Pero si ya estaba abierta
// y te vas a otra pestaña/app y volvés, sigue donde estabas — también si el
// navegador recargó la pestaña por su cuenta (pasa en el celular). Para eso
// se guarda la pantalla en sessionStorage, que dura lo que dura la pestaña.
const CLAVE_NAVEGACION = "supermercado_navegacion";
let appVisible = false;
let tabActiva = "lista";

function guardarNavegacion() {
  try {
    sessionStorage.setItem(
      CLAVE_NAVEGACION,
      JSON.stringify({ tab: tabActiva, lista: subtabListaActiva, config: subtabConfigActiva })
    );
  } catch {
    // Sin sessionStorage: se recuerda solo mientras la página no se recargue.
  }
}

function leerNavegacion() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_NAVEGACION) || "null");
  } catch {
    return null;
  }
}

function borrarNavegacion() {
  try {
    sessionStorage.removeItem(CLAVE_NAVEGACION);
  } catch {
    /* nada */
  }
  resetSeleccionPresencial();
}

// restaurar: true = volver a la pantalla guardada de esta pestaña (si hay).
function mostrarApp({ restaurar = true } = {}) {
  // Supabase avisa "sesión iniciada" otra vez cada vez que volvés a la
  // pestaña. Antes eso hacía que la app saltara al inicio: ahora, si ya está
  // en pantalla, no se toca nada.
  if (appVisible) return;
  appVisible = true;
  pantallaLogin.classList.add("oculto");
  pantallaApp.classList.remove("oculto");
  headerUsuario.textContent = getUsuarioActual() || "";

  const guardada = restaurar ? leerNavegacion() : null;
  if (guardada && botonesTab[guardada.tab]) {
    subtabListaActiva = guardada.lista === "online" ? "online" : "presencial";
    subtabConfigActiva = botonesConfig[guardada.config] ? guardada.config : "productos";
    activarTab(guardada.tab);
  } else {
    // Default al abrir: Lista > Presencial, y dentro de Presencial el
    // supermercado por defecto (Mercadona si existe, si no "Todos").
    borrarNavegacion();
    subtabListaActiva = "presencial";
    subtabConfigActiva = "productos";
    activarTab("lista");
  }
  actualizarAvisoVencimientos();
}

function mostrarLogin() {
  appVisible = false;
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
  stock: document.getElementById("btn-tab-stock"),
  configuracion: document.getElementById("btn-tab-configuracion"),
};
const panelesTab = {
  lista: document.getElementById("tab-lista"),
  menu: document.getElementById("tab-menu"),
  stock: document.getElementById("tab-stock"),
  configuracion: document.getElementById("tab-configuracion"),
};

function activarTab(tab) {
  tabActiva = tab;
  Object.keys(panelesTab).forEach((nombre) => {
    botonesTab[nombre].classList.toggle("tab-btn--activo", nombre === tab);
    panelesTab[nombre].classList.toggle("oculto", nombre !== tab);
  });

  guardarNavegacion();
  if (tab === "lista") activarSubtabLista(subtabListaActiva);
  else if (tab === "menu") renderMenu(panelesTab.menu);
  else if (tab === "stock") renderStock(document.getElementById("panel-stock"));
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
  guardarNavegacion();
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
  guardarNavegacion();
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
