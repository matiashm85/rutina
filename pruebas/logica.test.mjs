// Correr desde app/:  node --test pruebas/logica.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { iso, deIso, lunes, diasEntre, fmtRx, fmtSets, fmtPeso, sigUnidad, validar, completo, consejo, metrica, mejorMarca, records, sigRot, csv, nombreArchivo } from '../logica.js';

const rx = { series: 3, min: 8, max: 10, unidad: 'reps' };
const fuerza = (fecha, sesion, ejercicios, extra = {}) => ({ id: fecha + sesion, fecha, tipo: 'fuerza', sesion, min: 35, ejercicios, ...extra });
const ej = (id, sets, extra = {}) => ({ id, patron: 'sentadilla', unidad: 'reps', series: 3, min: 8, max: 10, sets, ...extra });

test('fechas: lunes de la semana y días entre fechas', () => {
  assert.equal(iso(lunes(deIso('2026-11-15'))), '2026-11-09');   // domingo
  assert.equal(iso(lunes(deIso('2026-11-09'))), '2026-11-09');   // lunes
  assert.equal(diasEntre(deIso('2026-10-30'), deIso('2026-11-02')), 3);
});

test('prescripción y series se muestran en la unidad del equipo', () => {
  assert.equal(fmtRx({ series: 3, min: 8, max: 12, unidad: 'reps', por_lado: 'pierna' }), '3 × 8–12 c/p');
  assert.equal(fmtRx({ series: 3, min: 40, max: 40, unidad: 's' }), '3 × 40 s');
  assert.equal(fmtSets([{ kg: 40, reps: 10 }, { kg: 40, reps: 9 }], 'reps'), '40 kg × 10, 9');
  assert.equal(fmtSets([{ kg: 90, reps: 10 }], 'reps', 'lb'), '90 lb × 10');
  assert.equal(fmtSets([{ kg: 7, reps: 12 }, { kg: 8, reps: 10 }], 'reps', 'n'), '7×12, 8×10 (placa)');
  assert.equal(fmtSets([{ kg: null, reps: 8 }], 'reps'), '8');
  assert.equal(fmtPeso(12.5, 'kg'), '12,5 kg');
  assert.equal(fmtPeso(6, 'n'), 'placa 6');
});

test('las unidades rotan kilos, libras, placa', () => {
  assert.deepEqual(['kg', 'lb', 'n'].map(sigUnidad), ['lb', 'n', 'kg']);
});

test('validación ataja valores imposibles', () => {
  assert.ok(validar('peso', 0, 'kg'));
  assert.ok(validar('peso', 220, 'lb'));
  assert.ok(!validar('peso', 600, 'kg'));
  assert.ok(!validar('peso', 80, 'n'));
  assert.ok(!validar('peso', NaN, 'kg'));
  assert.ok(validar('reps', 12));
  assert.ok(!validar('reps', 0));
  assert.ok(!validar('reps', 500));
  assert.ok(!validar('reps', 8.5));
  assert.ok(validar('s', 40));
  assert.ok(!validar('s', 3600));
});

test('progresión: avisa solo cuando todas las series llegan al tope', () => {
  const tope = [{ kg: 40, reps: 10 }, { kg: 40, reps: 10 }, { kg: 40, reps: 10 }];
  assert.ok(completo(tope, rx));
  assert.match(consejo(tope, rx), /subí el peso/);
  assert.match(consejo(tope, rx, 'n'), /subí una placa/);
  assert.equal(consejo([{ kg: 40, reps: 10 }, { kg: 40, reps: 10 }, { kg: 40, reps: 9 }], rx), null);
  assert.equal(consejo(tope.slice(0, 2), rx), null);                       // faltó una serie
  assert.match(consejo([{ kg: null, reps: 10 }, { kg: null, reps: 10 }, { kg: null, reps: 10 }], rx), /más lento/);
});

test('métrica del gráfico según unidad', () => {
  assert.deepEqual(metrica(ej('a', [{ kg: 60, reps: 10 }])), { v: 80, u: 'kg', t: 'Fuerza estimada (1RM)' });
  assert.equal(metrica(ej('a', [{ kg: 90, reps: 10 }], { u: 'lb' })).u, 'lb');
  assert.equal(metrica(ej('a', [{ kg: 6, reps: 10 }], { u: 'n' })).u, 'puntos');
  assert.deepEqual(metrica(ej('a', [{ kg: null, reps: 8 }, { kg: null, reps: 11 }])), { v: 11, u: 'reps', t: 'Mejor serie' });
  assert.equal(metrica(ej('a', [{ kg: 22, reps: 40 }], { unidad: 's' })).v, 22);
});

test('récords: superan la marca previa en la misma unidad, y la primera vez no cuenta', () => {
  const previos = [fuerza('2026-11-02', 'A', [ej('sq', [{ kg: 40, reps: 10 }])])];
  assert.deepEqual(records(fuerza('2026-11-09', 'A', [ej('sq', [{ kg: 40, reps: 11 }]), ej('nuevo', [{ kg: 10, reps: 10 }])]), previos), ['sq']);
  assert.deepEqual(records(fuerza('2026-11-09', 'A', [ej('sq', [{ kg: 40, reps: 10 }])]), previos), []);
  // 90 lb no se compara con 40 kg: en libras es la primera vez
  assert.deepEqual(records(fuerza('2026-11-09', 'A', [ej('sq', [{ kg: 90, reps: 10 }], { u: 'lb' })]), previos), []);
  assert.equal(mejorMarca(previos, 'sq', 'reps', 'kg').set.reps, 10);
  assert.equal(mejorMarca(previos, 'sq', 'reps', 'lb'), null);
});

test('rotación: sigue con la próxima y arranca por la primera', () => {
  assert.equal(sigRot(['A', 'B', 'C'], undefined), 'A');
  assert.equal(sigRot(['A', 'B', 'C'], 'A'), 'B');
  assert.equal(sigRot(['A', 'B', 'C'], 'C'), 'A');
});

test('planilla CSV: una fila por serie, coma decimal y sin fórmulas', () => {
  const out = csv([
    fuerza('2026-11-09', 'A', [ej('sq', [{ kg: 42.5, reps: 10 }], { u: 'lb' })], { nota: '=SUMA(A1); "ojo"' }),
    { id: 'c', fecha: '2026-11-10', tipo: 'cardio', sesion: 'T1', min: 45 },
  ], id => 'Sentadilla', id => 'Zona 2');
  const filas = out.replace('﻿', '').trim().split('\r\n');
  assert.equal(filas.length, 3);
  assert.equal(filas[1], `2026-11-09;fuerza;A;Sentadilla;1;42,5;lb;10;repeticiones;35;"'=SUMA(A1); ""ojo"""`);
  assert.equal(filas[2], '2026-11-10;cardio;Zona 2;;;;;;;45;');
});

test('nombres de archivo seguros', () => {
  assert.equal(nombreArchivo('rutina-respaldo', '2026-11-15', 'json'), 'rutina-respaldo-2026-11-15.json');
  assert.equal(nombreArchivo('../Mi Rutina', '2026-11-15', 'csv'), 'mi-rutina-2026-11-15.csv');
});

test('camino completo: registrar dos sesiones y ver sugerencia, récord y rotación', () => {
  const s1 = fuerza('2026-11-09', 'A', [ej('sq', [{ kg: 40, reps: 10 }, { kg: 40, reps: 10 }, { kg: 40, reps: 10 }])]);
  assert.match(consejo(s1.ejercicios[0].sets, rx), /subí/);              // la próxima vez sube
  const s2 = fuerza('2026-11-11', sigRot(['A', 'B', 'C'], s1.sesion), [ej('sq', [{ kg: 42.5, reps: 8 }, { kg: 42.5, reps: 8 }, { kg: 42.5, reps: 8 }])]);
  assert.equal(s2.sesion, 'B');
  assert.deepEqual(records(s2, [s1]), ['sq']);                           // 42,5 × 8 supera a 40 × 10
  assert.equal(consejo(s2.ejercicios[0].sets, rx), null);                // con el peso nuevo todavía no llegó al tope
});
