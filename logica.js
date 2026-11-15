/* Lógica pura de la app: sin DOM ni almacenamiento, para poder probarla con `node --test pruebas/logica.test.mjs`. */

/* ---------- Fechas ---------- */
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const deIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const lunes = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const diasEntre = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);

/* ---------- Unidades de carga ----------
   Cada ejercicio se carga en la unidad que muestra el equipo: kilos, libras o el número de placa
   cuando la máquina no dice cuánto pesa. Nunca se convierte: la progresión compara contra el mismo equipo. */
export const UNIDADES = {
  kg: { t: 'kg', nombre: 'kilos', max: 500 },
  lb: { t: 'lb', nombre: 'libras', max: 1100 },
  n: { t: 'placa', nombre: 'número de placa', max: 60 },
};
export const sigUnidad = u => ({ kg: 'lb', lb: 'n', n: 'kg' })[u] || 'lb';
export const fmtNum = k => String(Math.round(k * 100) / 100).replace('.', ',');
export const fmtPeso = (k, u = 'kg') => u === 'n' ? `placa ${fmtNum(k)}` : `${fmtNum(k)} ${u}`;

/* ---------- Prescripción y series ---------- */
export const fmtRx = it => `${it.series} × ${it.min === it.max ? it.min : it.min + '–' + it.max}${it.unidad === 's' ? ' s' : ''}${it.por_lado ? (it.por_lado === 'pierna' ? ' c/p' : ' c/l') : ''}`;
export function fmtSets(sets, unidad, u = 'kg') {
  const s = unidad === 's' ? ' s' : '';
  const ks = sets.map(x => x.kg).filter(k => k != null);
  if (!ks.length) return sets.map(x => x.reps + s).join(', ');
  if (ks.every(k => k === ks[0])) return `${fmtPeso(ks[0], u)} × ${sets.map(x => x.reps + s).join(', ')}`;
  return sets.map(x => `${fmtNum(x.kg)}×${x.reps}`).join(', ') + ` (${UNIDADES[u].t}${s ? ', s' : ''})`;
}

/* Límites razonables para atajar un dedo de más. tipo: 'peso' | 'reps' | 's' */
export function validar(tipo, v, u = 'kg') {
  if (!Number.isFinite(v)) return false;
  if (tipo === 'peso') return v >= 0 && v <= UNIDADES[u].max;
  if (tipo === 's') return v >= 1 && v <= 600;
  return Number.isInteger(v) && v >= 1 && v <= 100;
}

/* ---------- Progresión ---------- */
export const completo = (sets, rx) => sets.length >= rx.series && sets.slice(0, rx.series).every(s => s.reps >= rx.max);
export function consejo(sets, rx, u = 'kg') {
  if (!completo(sets, rx)) return null;
  if (!sets.some(s => s.kg != null)) return 'Llegaste al tope: hacelo más lento o con pausa';
  const subi = u === 'n' ? 'subí una placa' : 'subí el peso un escalón';
  return rx.unidad === 's' ? `Aguantaste el tiempo completo: ${subi}` : `Llegaste al tope del rango: ${subi}`;
}

/* Valor comparable de una serie: con carga, carga × (1 + reps/30) (Epley); sin carga, repeticiones o segundos. */
const valorSet = (s, unidad, conPeso) => !conPeso ? s.reps : unidad === 's' ? (s.kg || 0) : (s.kg || 0) * (1 + s.reps / 30);
export function metrica(e) {
  const u = e.u || 'kg', conPeso = e.sets.some(s => s.kg > 0);
  const v = Math.round(Math.max(...e.sets.map(s => valorSet(s, e.unidad, conPeso))) * 10) / 10;
  if (!conPeso) return e.unidad === 's' ? { v, u: 's', t: 'Mejor tiempo' } : { v, u: 'reps', t: 'Mejor serie' };
  if (e.unidad === 's') return { v, u: UNIDADES[u].t, t: 'Carga usada' };
  return u === 'n' ? { v, u: 'puntos', t: 'Índice de carga (placa y repeticiones)' } : { v, u, t: 'Fuerza estimada (1RM)' };
}
const mismoEq = (e, id, unidad, u) => e.id === id && e.unidad === unidad && (e.u || 'kg') === u;
/* Mejor marca histórica de un ejercicio en una unidad: { v, fecha, set } o null. */
export function mejorMarca(logs, id, unidad, u = 'kg') {
  let m = null;
  for (const l of logs) if (l.tipo === 'fuerza') for (const e of l.ejercicios) if (mismoEq(e, id, unidad, u)) {
    const conPeso = e.sets.some(s => s.kg > 0);
    for (const s of e.sets) { const v = valorSet(s, e.unidad, conPeso); if (!m || v > m.v) m = { v, fecha: l.fecha, set: s }; }
  }
  return m;
}
/* Ejercicios de una sesión que superan la mejor marca previa. La primera vez de un ejercicio no cuenta. */
export function records(log, previos) {
  const out = [];
  for (const e of log.ejercicios) {
    const antes = mejorMarca(previos, e.id, e.unidad, e.u || 'kg');
    const hoy = mejorMarca([{ tipo: 'fuerza', fecha: log.fecha, ejercicios: [e] }], e.id, e.unidad, e.u || 'kg');
    if (antes && hoy && hoy.v > antes.v + 1e-9) out.push(e.id);
  }
  return out;
}

/* ---------- Rotación y constancia ---------- */
export const sigRot = (orden, ultimo) => orden[(orden.indexOf(ultimo) + 1) % orden.length];
const minCardio = l => l.tipo === 'cardio' ? l.min : l.eliptica ? 15 : 0;
/* Últimas n semanas (de lunes a domingo), de la más vieja a la actual. */
export function semanas(logs, descansos, hoy, n = 12, largos = []) {
  const l0 = lunes(hoy), out = [];
  for (let i = n - 1; i >= 0; i--) {
    const a = new Date(l0); a.setDate(l0.getDate() - i * 7);
    const b = new Date(a); b.setDate(a.getDate() + 6);
    const ia = iso(a), ib = iso(b), en = logs.filter(l => l.fecha >= ia && l.fecha <= ib);
    out.push({
      desde: ia,
      fuerza: new Set(en.filter(l => l.tipo === 'fuerza').map(l => l.fecha)).size,
      cardio: en.reduce((s, l) => s + minCardio(l), 0),
      largos: en.filter(l => l.tipo === 'cardio' && largos.includes(l.sesion)).length,
      descansos: descansos.filter(f => f >= ia && f <= ib).length,
    });
  }
  return out;
}
/* Días desde la última actividad registrada (sesión o descanso marcado); null si no hay nada. */
export function diasSinActividad(logs, descansos, hoy) {
  const fechas = [...logs.map(l => l.fecha), ...descansos];
  if (!fechas.length) return null;
  return diasEntre(deIso(fechas.reduce((a, b) => a > b ? a : b)), hoy);
}

/* ---------- Exportar a planilla ---------- */
const celda = v => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;   // que la planilla no lo tome como fórmula
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/* Una fila por serie de fuerza y una por sesión de cardio. Separador ; y coma decimal, como espera una planilla en español. */
export function csv(logs, nombreEj = id => id, nombreCardio = id => id) {
  const filas = [['fecha', 'tipo', 'sesion', 'ejercicio', 'serie', 'carga', 'unidad_carga', 'repeticiones_o_segundos', 'medida', 'minutos', 'energia', 'sueno', 'animo', 'nota']];
  const dec = v => v == null ? '' : String(v).replace('.', ',');
  for (const l of logs) {
    const b = l.bien || {};
    if (l.tipo === 'cardio') { filas.push([l.fecha, 'cardio', nombreCardio(l.sesion), '', '', '', '', '', '', l.min, '', '', '', l.nota || '']); continue; }
    if (!l.ejercicios.length) filas.push([l.fecha, 'fuerza', l.sesion, '', '', '', '', '', '', l.min, b.energia, b.sueno, b.animo, l.nota || '']);
    for (const e of l.ejercicios) e.sets.forEach((s, i) => filas.push([l.fecha, 'fuerza', l.sesion, nombreEj(e.id), i + 1, dec(s.kg), s.kg == null ? '' : UNIDADES[e.u || 'kg'].t, s.reps, e.unidad === 's' ? 'segundos' : 'repeticiones', l.min, b.energia, b.sueno, b.animo, l.nota || '']));
  }
  return '﻿' + filas.map(f => f.map(celda).join(';')).join('\r\n') + '\r\n';
}
export const nombreArchivo = (base, fecha, ext) => `${base}-${fecha}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') + '.' + ext;
