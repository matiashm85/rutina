# Rutina Full Body

App web instalable para seguir una rutina de fuerza de cuerpo completo (6 patrones, 3 días por semana) y el cardio de la semana.

- **Hoy:** la sesión que toca según el día.
- **Entrenar:** peso y repeticiones por serie, descanso automático entre vueltas y aviso de subir peso.
- **Cardio:** guía por tramos con zona, pulsaciones y cuenta regresiva.
- **Progreso:** gráfico por ejercicio, volumen semanal por patrón e historial.
- **Rutina:** cambio de ejercicios y rotación completa con el equipo disponible.

Funciona sin conexión y guarda los registros solo en el dispositivo (`localStorage`). No tiene servidor, cuentas ni dependencias: son archivos estáticos.

## Probar en la computadora

Necesita servirse por http (el service worker no funciona abriendo el archivo). Con Node:

```bash
npx serve .
```

## Actualizar

Al cambiar cualquier archivo, subir `VERSION` en `sw.js` para que los dispositivos tomen la versión nueva.
