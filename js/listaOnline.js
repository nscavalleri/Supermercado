// Pantalla Lista > Online: una única lista de compra (no depende de supermercado).
import { crearListaComprasView } from "./listaCompras.js";
import { fetchListaOnline, agregarItemOnline, eliminarItemOnline } from "./db.js";

export const renderListaOnline = crearListaComprasView({
  fetchItems: fetchListaOnline,
  agregarItem: (productoId) => agregarItemOnline(productoId),
  eliminarItem: (id) => eliminarItemOnline(id),
});
