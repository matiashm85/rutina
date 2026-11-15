# Rutina Full Body

App web instalable para seguir una rutina de fuerza de cuerpo completo (6 patrones, 2 o 3 días por semana, sin días fijos) y el cardio de la semana.

- **Hoy:** la próxima sesión de fuerza por rotación (A, B, C), para hacerla el día que quieras, y un cardio largo opcional.
- **Entrenar:** carga y repeticiones por serie, descanso automático entre vueltas, aviso de subir la carga, récords personales, nota fija por ejercicio y nota de la sesión.
- **Cargas por equipo:** cada ejercicio se registra en kilos, libras o número de placa, según lo que muestre la máquina. No se convierte entre unidades.
- **Cardio:** guía por tramos con zona, pulsaciones y cuenta regresiva.
- **Progreso:** gráfico por ejercicio, volumen semanal por patrón e historial.
- **Rutina:** cambio de ejercicios y rotación completa con el equipo disponible.

Funciona sin conexión y guarda los registros solo en el dispositivo (`localStorage`). No tiene servidor, cuentas ni dependencias: son archivos estáticos.

## Probar en la computadora

Necesita servirse por http (el service worker no funciona abriendo el archivo). Con Node:

```bash
npx serve .
```

## Pruebas

La lógica (progresión, récords, rotación, unidades, validación, planilla) está en `logica.js` y se prueba sin navegador:

```bash
node --test pruebas/logica.test.mjs
```

## Datos y respaldo

Todo queda en el `localStorage` del navegador, bajo la clave `rfb.v1`. Desde Ajustes se exporta un respaldo completo (JSON, se puede volver a importar) o una planilla (CSV) y se borra todo. No hay cuentas, servidor ni telemetría.

Esta app es un registro personal de entrenamiento. No es atención médica ni reemplaza el consejo de un profesional de la salud.

## Actualizar

Al cambiar cualquier archivo, subir `VERSION` en `sw.js` para que los dispositivos tomen la versión nueva.
