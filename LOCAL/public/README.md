# La Choza del Tarugo

Aplicación compartida para llevar las cuentas, gastos, recibos y turnos de limpieza del local.

## Arranque

Necesitas instalar Node.js LTS en el equipo que hará de servidor. Después, desde esta carpeta:

```bash
npm install
npm start
```

La aplicación estará disponible en `http://localhost:3000`.

Para que los móviles se sincronicen, conecta todos los dispositivos a la misma red Wi-Fi y abre en ellos la dirección IP local del ordenador, por ejemplo `http://192.168.1.25:3000`. El servidor debe mantenerse encendido.

## Publicarla para usarla fuera de casa

Puedes subir este proyecto a [Render](https://render.com) conectando un repositorio de GitHub. Render detectará el archivo `render.yaml`, instalará las dependencias y te dará una dirección pública `https://...onrender.com` para abrir desde cualquier lugar.

La versión actual guarda los datos en `data.json`. Para una prueba personal funciona, pero el almacenamiento gratuito de algunos servicios puede reiniciarse al desplegar de nuevo. Para usarla como aplicación definitiva conviene conectar los datos a una base de datos externa, como Supabase, antes de introducir información importante.

## Datos

Los datos se guardan en `data.json`. Cada cambio se difunde automáticamente a todos los navegadores conectados mediante WebSocket.