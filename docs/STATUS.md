# Estado verificable de PetCity

## Producto y decisiones

Marketplace argentino de cuidado de mascotas: paseos, cuidado en casa, alojamiento y vacaciones. El cuidador define su tarifa. Alojamiento/vacaciones requieren check-in y check-out. PetCity debe aprobar la postulación antes de publicar ofertas. Dueño, cuidador y administrador tienen necesidades distintas; nunca decidir permisos solo desde la UI.

La comisión del 10% aparece en la demostración, pero NO existe motor de pagos ni liquidaciones. El esquema final de cargos al dueño/cuidador no debe darse por cerrado; faltan costos reales del procesador. Mantener la moneda ARS y revisar números monetarios en el servidor.

Estética aprobada: disposición actual, blanco, texto oscuro, botones sutiles y bordes finos, acento verde petróleo, referencia Airbnb. Mantener responsive y menú hamburguesa. El usuario es diseñador: no cambiar la identidad ni el nombre PetCity sin pedido.

## Implementado en código real, con validación integral pendiente

- Supabase Auth por email/password; creación de perfiles con trigger.
- Perfil privado: nombre, teléfono, dirección, ciudad; salida de sesión.
- Mascotas: crear/editar nombre, especie, raza, peso, tamaño, indicaciones y foto privada.
- Postulaciones: nombre público, ciudad, descripción, experiencia, un servicio/precio por envío; moderación administrativa mediante RPC.
- Ofertas reales: solo aprobadas; filtro por ciudad textual y categoría.
- Solicitudes: mascota, fechas, precio calculado en RPC; aceptación/rechazo por cuidador y cancelación del dueño mientras pendiente. No cobran ni bloquean un calendario de disponibilidad.
- Novedades: mensajes y fotos del cuidador en solicitudes aceptadas.
- Mensajería: tabla privada por solicitud; dueño/cuidador, actualización cada 8 segundos mientras el panel está abierto. No es Supabase Realtime, no tiene notificaciones push ni indicador de lectura.
- Comunidad: publicaciones, likes, comentarios, compartir enlace; fotos y comentarios requieren moderación. Feed público; publicar requiere cuenta. Tres ejemplos visuales identificados. Migración 004 limita visibilidad a 30 días desde creación; no borra los archivos físicamente.
- Almacenamiento: bucket privado petcity-media, fotos JPG/PNG/WebP hasta 5 MB; URLs firmadas con duración de una hora.

Estas capacidades están en el código y migraciones; no todas fueron probadas con dos usuarios reales. El usuario confirma haber aplicado SQL hasta 005. La prueba automatizada local anterior cubrió guardado de mascotas, foto opcional y estados básicos del chat; no demuestra las políticas RLS remotas.

## Demostración / pendientes concretos

- Gran parte de index.html sigue usando funciones demo y datos en memoria: login por roles, dashboards demo, cuidadores, reseñas, favoritos, reservas, chats, shop y tracking ilustrativo.
- El mapa Leaflet es un mapa real, pero muestra ubicaciones aproximadas de perfiles de ejemplo. Las ofertas reales aún no tienen coordenadas ni búsqueda real por cercanía.
- No hay fotos validadoras de la oferta del cuidador ni ficha pública real completa con pestañas. El cuidador aprobado tampoco tiene UI real completa para editar tarifas, varios servicios o disponibilidad.
- Faltan hora del servicio, agenda, capacidad, prevención de solapamientos y notificaciones.
- Estados de bookings: pending, accepted, rejected, cancelled. Faltan in_progress, completed y flujo de confirmación/finalización.
- Faltan reseñas verificadas vinculadas a servicios completados.
- No hay checkout, pagos, webhook, reembolso, comisión efectiva ni liquidación. No llamar 'pagado' a un dato cambiado desde el cliente.
- Shop: demostración visual; faltan catálogo persistente, inventario, pedidos, cobro y estados.
- Tracking: no se transmite ubicación del teléfono al dueño de una reserva real.
- Google/Facebook login no están configurados. Instagram no debe prometerse como login general sin verificar soporte.
- No hay recuperación de contraseña completa ni tratamiento robusto de todos los errores de confirmación.
- index.html mezcla estilos históricos y JS inline; refined.css sobrescribe la estética; account.js es un IIFE aparte. No hay React/Next.js ni backend de pagos en esta entrega.

## Primeras tareas en Cursor

1. Abrir localmente y desplegar una copia sin cambios en Vercel; actualizar URLs de Supabase.
2. Separar el recorrido real de los recorridos demo. El acceso principal debe conducir a cuentas reales; los ejemplos deben identificarse y no aparentar reservas o cobros reales.
3. Probar con dueño, cuidador aprobado y administrador. Corregir fallos antes de ampliar funcionalidades.
4. Completar fotos/oferta, edición de tarifas, agenda y cierre/reseñas; nueva migración incremental 006 en adelante.
5. Implementar pagos de prueba con Mercado Pago después de verificar documentación oficial actual, integración marketplace aplicable a Argentina y costos. Usar backend, webhooks verificados e idempotencia; nunca claves secretas ni service_role en frontend. No cobrar dinero real para probar.
6. Completar shop con pedidos persistentes y checkout de prueba.
7. Tracking real con consentimiento, acceso por participantes, inicio/finalización y explicación de límites del navegador en segundo plano.

## Criterios de aceptación

- A no puede ver mascotas, dirección, mensajes o novedades de B sin la relación autorizada.
- Un postulante no se autoaprueba ni publica una oferta antes de aprobación.
- Precio calculado en servidor; no aceptar precio total enviado por el navegador.
- Dueño solicita → cuidador recibe → acepta → ambos pueden conversar y ver novedades → finaliza → dueño reseña (los dos últimos pendientes).
- Público ve historias aprobadas vigentes; usuario manda contenido pendiente; administrador revisa foto antes de aprobar.
- Visitantes no pueden publicar por API ni desde UI sin sesión.
- Shop conserva pedido e inventario después de recargar (pendiente).
- Pagos de prueba verifican aprobación, rechazo, webhook repetido y devolución antes de uso real (pendiente).
- Pruebas en móvil y escritorio, con teclado y sin desbordamiento horizontal.
