# Publicar PetCity en Vercel

## Opción recomendada: GitHub → Vercel

1. Crear un repositorio propio y subir el contenido de la carpeta petcity-cursor, con package.json y vercel.json en la raíz. No subir un ZIP como único archivo del repositorio.
2. En Vercel, Add New → Project → importar ese repositorio.
3. Framework Preset: Other. Root Directory: raíz del repositorio. Build Command: npm run build. Output Directory: public. El archivo vercel.json ya define esa configuración.
4. Publicar y comprobar que abran la portada, Comunidad y Mi perfil.
5. En Supabase → Authentication → URL Configuration:
   - Site URL: https://TU-PROYECTO.vercel.app
   - Redirect URLs: https://TU-PROYECTO.vercel.app/** y http://localhost:3000/**.
   - Si necesitás que el sitio antiguo siga confirmando emails, conservar también https://petcity.thrilogia.chatgpt.site/**.
6. Solicitar un email de confirmación nuevo y comprobar el retorno. No probar solamente con enlaces antiguos: pueden tener la URL anterior o haber expirado.

La versión actual utiliza una clave publicable en el frontend: no requiere secretos de Vercel para abrirse. Los pagos requerirán backend y secretos adicionales cuando se implementen. Nunca incluir credenciales privadas en public/.

## Opción CLI

Desde la carpeta del proyecto, con una cuenta Vercel propia:

```sh
npx vercel
npx vercel --prod
```

El CLI solicitará acceso a la cuenta y la selección del proyecto. Esta entrega no hace ese acceso por vos.

## Referencias oficiales verificadas al preparar la entrega

- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/builds/configure-a-build
- https://supabase.com/docs/guides/auth/redirect-urls

## Límites de la validación

Se verifica localmente sintaxis JavaScript, presencia de archivos y servicio HTTP. No se ha realizado un despliegue en tu cuenta Vercel ni una prueba integral con datos de Supabase. Marcar una función como lista solo tras probarla en el dominio desplegado.
