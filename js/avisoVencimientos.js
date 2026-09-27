// Aviso de vencimientos: la franja que aparece arriba de todo (entre el
// encabezado y las solapas) cuando hay productos del stock que vencen en los
// próximos N días, o que ya vencieron.
// N sale de la tabla "configuracion" (clave "dias_aviso_vencimiento"), que se
// edita solo desde Supabase. Si no está cargada o no se puede leer, se usa 30.
import { el, clearNode } from "./ui.js";
import { fetchConfiguracion, fetchStockPorVencer } from "./db.js";

const CLAVE_DIAS = "dias_aviso_vencimiento";
const DIAS_POR_DEFECTO = 30;
const MAX_NOMBRES = 4;

// Fecha en "AAAA-MM-DD" según el reloj del dispositivo, sumando `dias`.
function fechaISO(dias = 0) {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

async function leerDias() {
  try {
    const texto = await fetchConfiguracion(CLAVE_DIAS);
    // Ojo: Number(null) y Number("") dan 0, así que "no cargado" se chequea aparte.
    if (texto === null || String(texto).trim() === "") return DIAS_POR_DEFECTO;
    const valor = Number(texto);
    return Number.isInteger(valor) && valor >= 0 ? valor : DIAS_POR_DEFECTO;
  } catch (err) {
    console.error("No se pudo leer la configuración de días de aviso:", err);
    return DIAS_POR_DEFECTO;
  }
}

// Vuelve a calcular y dibujar el aviso. Se llama al entrar a la app y cada
// vez que cambia el stock (agregar, consumir, eliminar un producto).
export async function actualizarAvisoVencimientos() {
  const caja = document.getElementById("aviso-vencimientos");
  if (!caja) return;

  let items = [];
  let dias = DIAS_POR_DEFECTO;
  try {
    dias = await leerDias();
    items = await fetchStockPorVencer(fechaISO(dias));
  } catch (err) {
    // Si falla, simplemente no se muestra el aviso (no bloquea la app).
    console.error("No se pudo calcular el aviso de vencimientos:", err);
    items = [];
  }

  clearNode(caja);
  if (items.length === 0) {
    caja.classList.add("oculto");
    return;
  }

  const hoy = fechaISO(0);
  const vencidos = items.filter((i) => i.fecha_vencimiento < hoy);
  const porVencer = items.length - vencidos.length;

  const partes = [];
  if (porVencer > 0)
    partes.push(
      porVencer === 1
        ? `1 producto del stock vence en los próximos ${dias} días`
        : `${porVencer} productos del stock vencen en los próximos ${dias} días`
    );
  if (vencidos.length > 0)
    partes.push(vencidos.length === 1 ? "1 ya venció" : `${vencidos.length} ya vencieron`);
  let titulo = partes.join(" y ");
  if (porVencer === 0) titulo = vencidos.length === 1 ? "1 producto del stock ya venció" : `${vencidos.length} productos del stock ya vencieron`;

  const detalle = items.slice(0, MAX_NOMBRES).map((i) => {
    const [, m, d] = i.fecha_vencimiento.split("-");
    const nombre = i.producto?.nombre || "(producto eliminado)";
    return i.fecha_vencimiento < hoy ? `${nombre} (vencido)` : `${nombre} (${d}/${m})`;
  });
  if (items.length > MAX_NOMBRES) detalle.push(`y ${items.length - MAX_NOMBRES} más`);

  const botonVer = el("button", { class: "btn btn--chico aviso-vencimientos__ver", type: "button" }, "Ver stock");
  botonVer.addEventListener("click", () => document.getElementById("btn-tab-stock")?.click());

  caja.append(
    el("div", { class: "aviso-vencimientos__inner" }, [
      el("span", { class: "aviso-vencimientos__icono", "aria-hidden": "true" }, "⏰"),
      el("div", { class: "aviso-vencimientos__texto" }, [
        el("strong", {}, titulo),
        el("span", { class: "aviso-vencimientos__detalle" }, detalle.join(" · ")),
      ]),
      botonVer,
    ])
  );
  caja.classList.remove("oculto");
}
