# Supermercado

App para gestionar los pedidos del supermercado: catálogo de productos y
supermercados, y listas de compra (online y presencial por supermercado).

## Estructura del proyecto

```
index.html            Estructura de la página y las solapas
css/
  styles.css          Estilos (colores, layout responsive)
js/
  config.js           URL y clave pública de Supabase
  supabaseClient.js    Cliente de Supabase (usa el SDK vía CDN, sin build)
  auth.js              Login / registro / logout
  db.js                Todas las consultas a la base de datos
  ui.js                Helpers de interfaz (crear elementos, autocompletado, mensajes)
  productos.js         Pantalla Configuración > Productos (ABM)
  supermercados.js      Pantalla Configuración > Supermercados (ABM)
  listaCompras.js       Lógica común de una lista de compra (reutilizada)
  listaOnline.js         Pantalla Lista > Online
  listaPresencial.js     Pantalla Lista > Presencial (subsolapas por supermercado + "Todos")
  app.js                 Arranque de la app y navegación entre solapas
```

No hay paso de build: es HTML/CSS/JS plano con módulos ES (`<script type="module">`),
así que funciona igual abriendo `index.html` en el navegador o publicado en
GitHub Pages.

## Base de datos (Supabase)

Ya está configurada en el proyecto **Supermercado** de Supabase:

- Tablas: `productos`, `supermercados`, `lista_online`, `lista_presencial`.
- Todos los `id` son numéricos autoincrementales (no UUID). Ninguna tabla
  tiene columna `created_at`.
- `lista_online` y `lista_presencial` no tienen cantidad ni un estado
  "comprado" guardado: agregar un producto crea una fila, y comprarlo
  (tildar el check) directamente la elimina de la lista.
- Row Level Security activado en las 4 tablas: cualquier usuario **logueado**
  puede leer y escribir (no hay separación por usuario, porque la lista es
  compartida).
- Autenticación por email/password (Supabase Auth), **sin confirmación por
  email**: crear una cuenta y entrar es inmediato, solo con usuario y
  contraseña.
- La app usa la "publishable key" (clave pública, segura para el navegador)
  configurada en `js/config.js`.

## Publicado en GitHub Pages

El código está subido a https://github.com/nscavalleri/Supermercado y
publicado con GitHub Pages en:

`https://nscavalleri.github.io/Supermercado/`

Esa es la dirección para abrir desde el celular (y agregar a la pantalla de
inicio como si fuera una app). Cada vez que se suban cambios nuevos al
repositorio, esa misma URL se actualiza sola (puede tardar uno o dos minutos
en reflejarse).

## Primer uso

1. Abrí la app y creá tu cuenta con "¿No tenés cuenta? Creá una" (solo pide
   usuario/email y contraseña, entra directo).
2. Una vez adentro: cargá tus supermercados y productos en la solapa
   **Configuración**, y después armá tus listas en **Lista**.

La sesión queda guardada en el navegador hasta que toques "Cerrar sesión".
