# PetCity — continuar en Cursor y desplegar en Vercel

Entrega: 30/09/2026. Código exportado del sitio PetCity publicado, commit `c1f88b6f6e10f530794df1b53bc3c25f58bec73f`.

## Inicio en Windows / Cursor

1. Descomprimir el ZIP y abrir la carpeta `petcity-cursor` en Cursor (File → Open Folder).
2. Instalar Node.js 22 o superior si aún no está instalado.
3. Abrir Terminal → New Terminal y ejecutar `npm run dev`.
4. Abrir http://localhost:3000. No se necesitan dependencias npm para esta versión.
5. Ejecutar `npm run build` para comprobar sintaxis y archivos. Es una validación, no una compilación de React.
6. Copiar `CURSOR_PROMPT.md` completo al chat Agent de Cursor.

## Archivos

- `public/index.html`: web, estilos históricos y lógica de demostración.
- `public/account.js`: cuentas reales, mascotas, postulaciones, ofertas aprobadas, solicitudes, chat, novedades y comunidad mediante Supabase.
- `public/refined.css`: estética más limpia inspirada en la referencia Airbnb.
- `public/demo-*.webp`: tres fotos originales generadas para publicaciones simuladas, identificadas como ejemplo.
- `supabase/`: todo el SQL producido. Leer las instrucciones; no ejecutar todo indiscriminadamente.
- `docs/STATUS.md`: estado real, pendientes y criterios de prueba.
- `docs/VERCEL.md`: publicación y ajuste de confirmación de email.
- `docs/SOURCE_HISTORY.txt`: historial de commits del trabajo anterior.
- `docs/SOURCE_SHA256.json`: hashes de archivos recibidos para verificar que la exportación conserva el código.

## Base de datos actual

Se conserva la conexión al mismo proyecto de Supabase, por lo que las cuentas y registros existentes pueden seguir usándose. URL: `https://ifvfadgcyevmsklotrql.supabase.co`. La clave del frontend es una clave pública `sb_publishable_...` y permanece en `public/account.js`. El paquete NO contiene `service_role`, claves secretas, contraseñas ni un volcado de datos.

El usuario informó haber ejecutado todas las migraciones hasta 005. Es una confirmación del usuario, no una auditoría de la base remota. No volver a ejecutarlas sobre el mismo proyecto sin comprobar el esquema; no son todas idempotentes. Ver `supabase/README.md`.

El sitio actual continúa en https://petcity.thrilogia.chatgpt.site. Esta entrega no lo reemplaza ni despliega nada en tu cuenta de Vercel.

## Publicación

Primero publicar esta misma versión estática en Vercel para verificar continuidad. Después evolucionar de forma incremental; no hace falta reescribir toda la aplicación para probarla online. Ver `docs/VERCEL.md`.

## Qué incluye y qué no

Incluye el código completo del frontend actual, sus imágenes locales, migraciones SQL y configuración de Vercel. Las fuentes, Leaflet, Supabase JS y algunas imágenes ilustrativas de fichas demo se cargan desde servicios externos; se necesita conexión a Internet. No incluye datos ni fotos privadas alojadas en Supabase. La geolocalización de ofertas reales, pagos, liquidaciones, pedidos del shop, cierre de servicios y reseñas aún requieren desarrollo. Ver el detalle en `docs/STATUS.md`.
