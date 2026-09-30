# Prompt para continuar PetCity en Cursor

Actuá como desarrollador senior responsable de llevar este proyecto existente a un MVP funcional. Soy el creador de PetCity, un marketplace argentino de cuidadores de mascotas. Quiero continuar el trabajo anterior en Cursor y desplegar en mi cuenta de Vercel para probarlo online.

## Primero leé y verificá

Leé README.md, docs/STATUS.md, docs/VERCEL.md, supabase/README.md y los archivos public/index.html, public/account.js y public/refined.css. No asumás que una pantalla visual es una función real. Hay código real con Supabase y muchos recorridos de demostración mezclados. Inventariá cada circuito y separá: implementado, probado, simulado y pendiente.

El frontend actual es HTML/CSS/JS estático, no Next.js. public/index.html contiene lógica inline demo; public/account.js contiene flujos reales. package.json y vercel.json permiten probar y publicar esta versión sin instalar dependencias. Primero ejecutá npm run build y npm run dev. Conservá una versión funcionando antes de cualquier refactor. No reescribas todo para cambiar de framework ni reemplaces el diseño por una plantilla genérica. Si proponés una migración a React/Next.js, justificá el beneficio y hacela incrementalmente, preservando comportamiento y datos.

## Objetivo de producto

Cada circuito debe guardar datos reales y funcionar de punta a punta: dueño registra mascotas; cuidador se postula, carga fotos/servicios/precios y recibe aprobación; dueño encuentra ofertas, solicita fechas, cuidador acepta; ambos conversan, comparten novedades/fotos; servicio inicia/finaliza y recibe reseña. Agregar pagos de prueba con comisión y shop de insumos pet. Tracking real del paseo en una etapa posterior, con permiso y privacidad.

El cuidador fija el precio. Alojamiento/vacaciones tienen check-in y check-out. La comisión de 10% es una referencia visual; verificar y documentar el esquema final y los costos de Mercado Pago antes de implementarlo. No hay pagos ni liquidaciones actuales.

Comunidad: cualquier visitante ve fotos/historias aprobadas; solo usuarios con sesión publican; publicaciones y comentarios pasan por moderación. Vigencia 30 días desde creación; hoy no hay borrado físico automático. Las publicaciones simuladas tienen etiqueta de ejemplo.

Roles: dueño, cuidador validado, postulante y administrador. La aprobación humana verifica identidad, experiencia y condiciones; una checkbox no acredita formación profesional. El administrador debe tener panel privado real. Separar el acceso real de los recorridos demo.

## Seguridad y datos

Mantener el proyecto Supabase actual para conservar cuentas y datos. El usuario informó haber ejecutado migraciones hasta 005. Verificar estado, no repetir ni borrar migraciones/tablas. 003 y 003_v2 son alternativas, no ejecutar ambas. Nuevas migraciones numeradas desde 006, transaccionales y revisadas.

La clave sb_publishable del frontend es pública. Nunca pedir ni colocar service_role, secretos de Mercado Pago o contraseñas en frontend, logs, Git o chat. Si necesitás secretos, indicar cómo configurarlos en Vercel/Supabase. Usar permisos RLS y validar autorización en servidor. No permitir que el usuario se autoasigne admin/cuidador ni acceda a registros ajenos. Verificar políticas con cuentas separadas.

Los pagos deben implementarse con backend, credenciales de prueba, webhooks autenticados, idempotencia y cálculo de importe/comisión en servidor. No marcar pago exitoso por retorno del navegador. Verificar documentación oficial actual de Mercado Pago para Argentina y explicar requisitos que requieran mi intervención. No prometer split ni liquidaciones automáticas sin una integración verificada.

## Estética

Conservar nombre PetCity, disposición actual y la evolución inspirada en Airbnb: blanco, texto oscuro, bordes finos, botones sutiles, acento verde petróleo. Responsive con hamburguesa; buena jerarquía, imágenes y controles claros. No saturar de botones ni emojis. Mantener indicación de ejemplos para datos simulados. No cambiar branding sin consultarme.

## Orden de ejecución

1. Probar la copia actual, publicar en Vercel y configurar Site URL/Redirect URLs en Supabase para localhost y dominio nuevo. Si necesitás acceso a mi cuenta, completar primero el trabajo revisable y explicar el paso manual.
2. Limpiar navegación: entrada real por roles; perfil/mascotas/mis cuidados; separar demos. Corregir alta, confirmación de email, sesión y recuperación de contraseña.
3. Probar dueño + cuidador + administrador: postulación, aprobación, mascota/foto, oferta, solicitud, aceptación, chat y novedades. Reportar fallos y corregirlos.
4. Completar oferta/fotos, edición de precios y servicios, agenda/horarios/capacidad; inicio/finalización/reseñas.
5. Pagos y reembolsos de prueba; luego shop con catálogo/stock/pedidos persistentes. No olvidar shop.
6. Tracking real con permisos, privacidad y límites de la ubicación en segundo plano.

Trabajá por entregas pequeñas funcionales. Para cada una: implementá, validá, enumerá qué se probó y qué requiere prueba externa. Usá pruebas que cubran permisos y circuitos, no solo capturas ni tests que copien la implementación. Mantener el sitio desplegable en cada entrega. No afirmar que todos los circuitos funcionan hasta comprobarlos con cuentas y datos reales. Las reseñas y ofertas ficticias nunca deben mezclarse con reputación real.

Respondeme en español, breve y concreto. No vuelvas a preguntarme decisiones que ya figuran acá. Empezá ahora leyendo archivos, ejecutando la versión local y revisando la primera publicación en Vercel; después avanzá en el primer circuito real que esté roto o incompleto.
