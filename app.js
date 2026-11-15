import { visual } from './figuras.js';
import { iso, deIso, lunes, diasEntre, UNIDADES, sigUnidad, fmtNum, fmtRx, fmtSets, validar, consejo, metrica, mejorMarca, records, sigRot, semanas, diasSinActividad, csv, nombreArchivo } from './logica.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'rfb.v1';
const DEF = { v: 1, ajustes: { descanso: 75, edad: 41, fcmax: null, sonido: true, aviso: 3 }, ciclo: { inicio: null, sesiones: null }, ciclosPrevios: [], logs: [], unidades: {}, notasEj: {}, descansos: [], draft: null, cardio: null, timerEnd: null, respaldo: null };
let DATA, st;

/* ---------- Estado ---------- */
function cargar() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { o = {}; }
  st = { ...structuredClone(DEF), ...o, ajustes: { ...DEF.ajustes, ...(o.ajustes || {}) }, ciclo: { ...DEF.ciclo, ...(o.ciclo || {}) } };
}
function guardar() {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { toast('No se pudo guardar en este navegador'); }
}

/* ---------- Fechas ---------- */
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const corta = s => { const d = deIso(s); return `${d.getDate()}/${d.getMonth() + 1}`; };
const conDia = s => `${DIAS[deIso(s).getDay()].slice(0, 3)} ${corta(s)}`;
const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const semCiclo = () => st.ciclo.inicio ? Math.floor(diasEntre(lunes(deIso(st.ciclo.inicio)), lunes(new Date())) / 7) + 1 : 0;

/* ---------- Rutina ---------- */
const PATRONES = { sentadilla: 'Sentadilla', bisagra: 'Bisagra', empuje: 'Empuje', tiron: 'Tirón', una_pierna: 'Una pierna', core_brazos: 'Core / brazos' };
const EQUIPO = { smith: 'Smith', polea: 'polea', step: 'step', banco_plano: 'banco plano', banco_regulable: 'banco regulable', mancuernas: 'mancuernas', barra: 'barra', barra_ez: 'barra EZ', discos: 'discos', estacion_dominadas_fondos: 'estación de dominadas' };
const eqTxt = x => x.equipo.length ? x.equipo.map(q => EQUIPO[q] || 'máquina').join(' + ') : 'peso corporal';
const ses = () => st.ciclo.sesiones || DATA.sesiones;
const lib = id => DATA.ejercicios[id];
const bloques = k => { const s = ses()[k]; return [...s.superseries, ...(s.opcional ? [s.opcional] : [])]; };
const esOpc = (k, bi) => bi >= ses()[k].superseries.length;
const items = k => bloques(k).flatMap((b, bi) => b.map(it => ({ ...it, bi, opc: esOpc(k, bi) })));
const totalCardio = v => v.seg.reduce((a, s) => a + s[0], 0);

const LARGOS = ['T1', 'S1', 'T2', 'S2'];
const ultimoDe = f => { for (let i = st.logs.length - 1; i >= 0; i--) if (f(st.logs[i])) return st.logs[i]; return null; };
const proxFuerza = () => sigRot(Object.keys(ses()), ultimoDe(l => l.tipo === 'fuerza')?.sesion);
const proxCardio = () => sigRot(LARGOS, ultimoDe(l => l.tipo === 'cardio' && LARGOS.includes(l.sesion))?.sesion);
const elipticaHecha = l => l.eliptica || st.logs.some(x => x.tipo === 'cardio' && x.sesion === 'Z15' && x.fecha === l.fecha);

const fcmax = () => st.ajustes.fcmax || 220 - st.ajustes.edad;
function zona(z) {
  const f = fcmax(), r = p => Math.round(f * p);
  if (z === 1) return { n: 'Suave', c: 'z1', lpm: `menos de ${r(.6)} lpm` };
  if (z === 2) return { n: 'Zona 2', c: 'z2', lpm: `${r(.6)}–${r(.7)} lpm` };
  return { n: 'Fuerte', c: 'z4', lpm: `${r(.85)}–${r(.9)} lpm` };
}

/* ---------- Progresión ---------- */
const fmtKg = fmtNum;
const uEx = id => st.unidades[id] || 'kg';
function ultima(it) {
  for (let i = st.logs.length - 1; i >= 0; i--) {
    const l = st.logs[i];
    if (l.tipo !== 'fuerza') continue;
    const e = l.ejercicios.find(e => e.id === it.ejercicio && e.unidad === it.unidad);
    if (e) return { fecha: l.fecha, sets: e.sets, u: e.u || 'kg', consejo: consejo(e.sets, it, e.u || 'kg') };
  }
  return null;
}

/* ---------- Sonido, vibración, pantalla ---------- */
let ac, wl = null;
function audio() { try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch { } }
function beep(n = 2) {
  try { navigator.vibrate?.(n > 2 ? [300, 150, 300, 150, 300] : [250, 120, 250]); } catch { }
  if (!st.ajustes.sonido) return;
  try {
    audio();
    for (let i = 0; i < n; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * .3;
      o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .22);
      o.start(t); o.stop(t + .25);
    }
  } catch { }
}
async function despierto(on) {
  try {
    if (on && !wl && navigator.wakeLock && document.visibilityState === 'visible') { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); }
    else if (!on && wl) { await wl.release(); wl = null; }
  } catch { }
}
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3500); }

/* ---------- Temporizador de descanso ---------- */
let sono = false;
function iniciarDescanso() { st.timerEnd = Date.now() + st.ajustes.descanso * 1000; sono = false; guardar(); tick(); }
function pararDescanso() { st.timerEnd = null; guardar(); tick(); }
function tick() {
  const el = $('#timer');
  if (!st.timerEnd) { el.hidden = true; return; }
  const r = Math.ceil((st.timerEnd - Date.now()) / 1000);
  if (r > 0) { el.hidden = false; el.classList.remove('listo'); $('#tl').textContent = 'Descanso'; $('#tt').textContent = mmss(r); return; }
  if (r < -8) { st.timerEnd = null; guardar(); el.hidden = true; return; }
  if (!sono) { sono = true; if (r > -3) beep(2); }
  el.hidden = false; el.classList.add('listo'); $('#tl').textContent = 'Listo'; $('#tt').textContent = '¡Dale!';
}

/* ---------- Vista: Hoy ---------- */
function perfil(v, marcador) {
  return `<div><div class="prof" aria-label="Perfil de intensidad">${v.seg.map(([m, z]) => `<div class="p${z}" style="flex:${m}"></div>`).join('')}${marcador ? '<div id="pm"></div>' : ''}</div>
  <div class="escala"><span>0</span><span>${Math.round(totalCardio(v) / 2)}</span><span>${totalCardio(v)} min</span></div></div>`;
}
function listaSesion(k) {
  return `<ul class="lista">${items(k).map(it => `<li><span class="code">${it.codigo}</span><span>${esc(lib(it.ejercicio).n)}</span><span class="rx">${fmtRx(it)}</span></li>`).join('')}</ul>`;
}
function vHoy() {
  const hoy = new Date(), f = iso(hoy), n = semCiclo(), C = DATA.cardio_largo;
  const k = st.draft?.sesion || proxFuerza(), otras = Object.keys(ses()).filter(x => x !== k);
  const hoyF = st.logs.filter(l => l.fecha === f && l.tipo === 'fuerza');
  let h = `<header class="top"><span class="eyebrow">${n ? `Ciclo actual · semana ${n}` : 'Rutina Full Body · 6 patrones'}</span><h1>${DIAS[hoy.getDay()]} ${hoy.getDate()} de ${MESES[hoy.getMonth()]}</h1></header>`;
  if (st.cardio) h += `<section class="card aviso"><p>Tenés <b>${esc(C[st.cardio.key].name)}</b> en curso.</p><a class="btn" href="#cardio/${st.cardio.key}">Volver al cardio</a></section>`;
  if (n >= 8) h += `<section class="card aviso"><p>${n > 12 ? 'Pasaron más de 12 semanas con los mismos ejercicios: toca rotar.' : `Vas por la semana ${n}: entre la 8 y la 12 conviene rotar ejercicios.`}</p><a class="btn" href="#rutina">Ver rutina</a></section>`;
  const sin = diasSinActividad(st.logs, st.descansos, hoy);
  if (st.ajustes.aviso && sin !== null && sin >= st.ajustes.aviso && !st.draft && !st.cardio) h += `<section class="card aviso"><p>Pasaron ${sin} días desde tu última actividad registrada. Cuando quieras, sigue Fuerza ${k}.</p><button type="button" class="sec" data-a="silenciar">No recordarme</button></section>`;
  const pend = !st.draft && hoyF.find(l => !elipticaHecha(l));
  if (pend) h += `<section class="card aviso"><p>Hoy hiciste <b>Fuerza ${pend.sesion}</b>. Te falta la elíptica de 15 min.</p><div class="fila"><button type="button" class="pri" data-a="e-ini">Empezar elíptica</button><button type="button" data-a="e-hecha" data-id="${pend.id}">Ya la hice</button></div></section>`;
  h += `<section class="card plan"><span class="eyebrow">${st.draft ? 'Sesión en curso' : hoyF.length ? 'La próxima fuerza' : 'Fuerza · unos 35 min + 15 de elíptica'}</span><h3>Fuerza ${k}</h3>${listaSesion(k)}
    <a class="btn pri" href="#entrenar/${k}">${st.draft ? 'Continuar' : 'Empezar Fuerza ' + k}</a>
    ${st.draft ? '' : `<div class="fila"><span class="nota">O hacer otra:</span>${otras.map(o => `<a class="btn sec" href="#entrenar/${o}">Fuerza ${o}</a>`).join('')}</div>`}</section>`;
  const c = proxCardio(), v = C[c];
  h += `<section class="card plan"><span class="eyebrow">Cardio largo · opcional · ${totalCardio(v)} min</span><h3>${esc(v.name)}</h3>${perfil(v)}
    <p class="nota">Si la semana te lo permite, sumá un día de cardio largo. <b>${esc(v.equip)}.</b> ${esc(v.desc)}</p>
    <a class="btn" href="#cardio/${c}">Empezar ${esc(v.name)}</a>
    <div class="fila"><span class="nota">O elegir otro:</span>${LARGOS.filter(x => x !== c).map(o => `<a class="btn sec" href="#cardio/${o}">${esc(C[o].name)}</a>`).join('')}</div></section>`;
  const a = iso(lunes(hoy)), sem = st.logs.filter(l => l.fecha >= a), desc = st.descansos.filter(x => x >= a);
  const nf = new Set(sem.filter(l => l.tipo === 'fuerza').map(l => l.fecha)).size, nl = sem.filter(l => l.tipo === 'cardio' && LARGOS.includes(l.sesion)).length;
  const min = sem.reduce((s, l) => s + (l.tipo === 'cardio' ? l.min : l.eliptica ? 15 : 0), 0);
  h += `<h2>Esta semana</h2><section class="card"><div class="fila fin"><span>Días de fuerza</span><b class="num">${nf} de 3</b></div><div class="fila fin"><span>Cardio largo</span><b class="num">${nl}</b></div><div class="fila fin"><span>Cardio en total</span><b class="num">${min} min</b></div>`;
  if (!sem.length && !desc.length) h += '<p class="nota">Todavía no entrenaste esta semana. El método pide 2 o 3 días de fuerza, los que puedas.</p>';
  if (!sem.some(l => l.fecha === f)) h += `<button type="button" class="sec" data-a="desc-hoy">${st.descansos.includes(f) ? 'Quitar el descanso de hoy' : 'Marcar hoy como descanso'}</button>`;
  h += '</section>';
  const filas = [...sem.map(l => ({ f: l.fecha, t: l.tipo === 'fuerza' ? `Fuerza ${l.sesion}${l.eliptica ? ' + elíptica' : ''}` : (C[l.sesion]?.name || 'Cardio'), d: `${l.min} min`, c: '' })), ...desc.map(x => ({ f: x, t: 'Descanso', d: '', c: 'descanso' }))].sort((p, q) => p.f.localeCompare(q.f));
  if (filas.length) h += `<div class="semana">${filas.map(r => `<div class="dia ${r.c}"><span class="dn">${DIAS[deIso(r.f).getDay()].slice(0, 3)} ${deIso(r.f).getDate()}</span><span>${esc(r.t)}</span><span class="de">${r.d}</span></div>`).join('')}</div>`;
  return h;
}

/* ---------- Vista: Entrenar ---------- */
function siguiente(k) {
  const d = st.draft?.sesion === k ? st.draft : null;
  for (const b of bloques(k)) {
    const max = Math.max(...b.map(it => it.series));
    for (let r = 0; r < max; r++) for (const it of b) if (r < it.series && !d?.sets[it.codigo]?.[r]?.ok) return { codigo: it.codigo, r };
  }
  return null;
}
function exCard(it, d, sig) {
  const x = lib(it.ejercicio), u = uEx(it.ejercicio), U = UNIDADES[u], ult = ultima(it), conPeso = x.equipo.length > 0, mis = d?.sets[it.codigo] || [];
  const vis = visual(x), hechas = mis.filter(s => s?.ok).length, misma = ult && ult.u === u;
  const mejor = mejorMarca(st.logs, it.ejercicio, it.unidad, u);
  let rows = '';
  for (let i = 0; i < it.series; i++) {
    const s = mis[i] || {}, prev = ult?.sets[Math.min(i, ult.sets.length - 1)];
    const kg = s.kg ?? (misma ? prev?.kg : null) ?? '', reps = s.reps ?? '';
    const ph = prev ? prev.reps : (it.min === it.max ? it.min : `${it.min}–${it.max}`);
    const dis = s.ok ? 'disabled' : '';
    rows += `<div class="set ${s.ok ? 'ok' : ''} ${sig && sig.codigo === it.codigo && sig.r === i ? 'sig' : ''}" data-c="${it.codigo}" data-i="${i}"><span class="sn">${i + 1}</span>
      ${conPeso ? `<label><input class="kg" type="number" inputmode="decimal" step="0.5" min="0" max="${U.max}" value="${kg}" ${dis} aria-label="Carga en ${U.nombre}, serie ${i + 1}"><span>${U.t}</span></label>` : '<span class="sinpeso">sin peso</span>'}
      <label><input class="reps" type="number" inputmode="numeric" min="1" max="${it.unidad === 's' ? 600 : 100}" value="${reps}" placeholder="${ph}" ${dis} aria-label="${it.unidad === 's' ? 'Segundos' : 'Repeticiones'}, serie ${i + 1}"><span>${it.unidad === 's' ? 's' : 'reps'}</span></label>
      <button type="button" class="chk" data-a="chk" aria-label="${s.ok ? 'Desmarcar' : 'Marcar'} serie ${i + 1}">${s.ok ? '✓' : ''}</button></div>`;
  }
  return `<article class="ex ${hechas >= it.series ? 'listo' : ''}"><div class="exh ${vis ? '' : 'sinvis'}">${vis ? `<div class="vis">${vis}</div>` : ''}<div>
    <div class="nm"><span class="code">${it.codigo}</span>${esc(x.n)}</div><div class="rxl">${fmtRx(it)}</div>
    ${ult ? `<div class="ult">Última (${corta(ult.fecha)}): ${esc(fmtSets(ult.sets, it.unidad, ult.u))}</div>` : '<div class="ult">Primera vez: elegí una carga que te deje 1–2 repeticiones en reserva.</div>'}
    ${mejor && ult ? `<div class="ult">Mejor marca: ${esc(fmtSets([mejor.set], it.unidad, u))} (${corta(mejor.fecha)})</div>` : ''}
    ${ult?.consejo ? `<span class="sube">${esc(ult.consejo)}</span>` : ''}</div></div>
    <div class="sets">${rows}</div>
    ${conPeso ? `<button type="button" class="sec uni" data-a="unidad" data-ex="${it.ejercicio}" ${hechas ? 'disabled' : ''}>Carga en ${U.nombre} · cambiar</button>` : ''}
    <input class="campo nota-ej" data-ex="${it.ejercicio}" maxlength="140" value="${esc(st.notasEj[it.ejercicio] || '')}" placeholder="Nota fija: asiento, agarre, molestias…" aria-label="Nota fija de ${esc(x.n)}">
    <details class="cue"><summary>Cómo se hace</summary><p>${esc(x.cue)}</p><a class="vid" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`cómo hacer ${x.n}${x.machine ? ' en máquina' : ''} técnica`)}" target="_blank" rel="noopener">Ver videos en YouTube ↗</a></details></article>`;
}
function vEntrenar(k) {
  const S = ses()[k];
  if (!S) return vHoy();
  if (st.draft && st.draft.sesion !== k) return `<header class="top"><a class="back" href="#hoy">‹ Hoy</a><h1>Fuerza ${k}</h1></header>
    <section class="card aviso"><p>Tenés la sesión <b>Fuerza ${st.draft.sesion}</b> sin terminar. Terminala o descartala antes de empezar otra.</p>
    <div class="fila"><a class="btn pri" href="#entrenar/${st.draft.sesion}">Ir a Fuerza ${st.draft.sesion}</a><button type="button" class="peligro" data-a="descartar" data-k="${k}">Descartarla</button></div></section>`;
  const d = st.draft, sig = siguiente(k);
  let h = `<header class="top"><a class="back" href="#hoy">‹ Hoy</a><span class="eyebrow">Descanso de ${st.ajustes.descanso} s entre vueltas</span><h1>Fuerza ${k}</h1></header>
  <p class="nota">Calentamiento: 4 min de elíptica suave y una serie liviana del primer ejercicio. En cada bloque alternás los dos ejercicios; el descanso arranca solo al completar la vuelta.</p>`;
  bloques(k).forEach((b, bi) => {
    h += `<section class="bloque" data-k="${k}"><h2>Bloque ${'ABCD'[bi]}<small>${esOpc(k, bi) ? 'opcional · unos 5 min' : `superserie · ${b[0].series} vueltas`}</small></h2>${b.map(it => exCard(it, d, sig)).join('')}</section>`;
  });
  h += `<section class="card" data-k="${k}"><label class="campo-l">Nota de la sesión (opcional)<textarea class="campo nota-ses" rows="2" maxlength="300" placeholder="Cómo salió, qué cambiarías…">${esc(d?.nota || '')}</textarea></label>
  <p class="nota">Al guardar te ofrece los 15 min de elíptica en zona 2 con temporizador.</p>
  <button type="button" class="pri ancho" data-a="terminar" data-k="${k}">Terminar y guardar</button>
  ${d ? `<button type="button" class="peligro ancho" data-a="descartar" data-k="${k}">Descartar sesión</button>` : ''}</section>`;
  return h;
}
const borrador = k => (st.draft ??= { sesion: k, inicio: Date.now(), sets: {}, eliptica: false });
function marcar(btn) {
  const row = btn.closest('.set'), k = btn.closest('[data-k]').dataset.k, c = row.dataset.c, i = +row.dataset.i;
  const it = items(k).find(x => x.codigo === c), d = borrador(k), arr = (d.sets[c] ??= []), s = (arr[i] ??= {});
  if (s.ok) { s.ok = false; guardar(); render(); return; }
  const kgEl = $('.kg', row), rEl = $('.reps', row), reps = parseFloat(rEl.value), kg = kgEl ? parseFloat(kgEl.value) : null;
  const u = uEx(it.ejercicio);
  if (kgEl && !validar('peso', kg, u)) { kgEl.classList.add('falta'); kgEl.focus(); if (kgEl.value !== '') toast(`Revisá la carga: tiene que estar entre 0 y ${UNIDADES[u].max}`); return; }
  if (!validar(it.unidad === 's' ? 's' : 'reps', reps)) { rEl.classList.add('falta'); rEl.focus(); if (rEl.value !== '') toast(it.unidad === 's' ? 'Revisá los segundos: entre 1 y 600' : 'Revisá las repeticiones: un número entero entre 1 y 100'); return; }
  Object.assign(s, { kg, reps, ok: true });
  if (kgEl) for (let j = i + 1; j < it.series; j++) { const t = (arr[j] ??= {}); if (!t.ok) t.kg = kg; }
  const b = bloques(k)[it.bi];
  const vuelta = b.every(x => i >= x.series || d.sets[x.codigo]?.[i]?.ok), quedan = b.some(x => x.series > i + 1);
  if (vuelta && quedan) iniciarDescanso(); else if (vuelta) pararDescanso();
  guardar(); render();
  $('.set.sig')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function terminar(k) {
  const d = st.draft;
  if (!d || d.sesion !== k) { toast('Todavía no marcaste ninguna serie'); return; }
  const ej = [];
  let faltan = 0;
  for (const it of items(k)) {
    const sets = (d.sets[it.codigo] || []).filter(s => s?.ok).map(s => ({ kg: s.kg, reps: s.reps }));
    if (!it.opc) faltan += it.series - Math.min(sets.length, it.series);
    if (sets.length) ej.push({ id: it.ejercicio, patron: it.patron, unidad: it.unidad, ...(sets.some(s => s.kg != null) ? { u: uEx(it.ejercicio) } : {}), series: it.series, min: it.min, max: it.max, sets });
  }
  if (!ej.length && !d.eliptica) { if (confirm('No marcaste ninguna serie. ¿Descartar la sesión?')) { st.draft = null; pararDescanso(); location.hash = '#hoy'; } return; }
  if (faltan && !confirm(`Te ${faltan === 1 ? 'queda 1 serie' : `quedan ${faltan} series`} sin marcar. ¿Terminar igual?`)) return;
  const log = { id: Date.now().toString(36), fecha: iso(new Date(d.inicio)), tipo: 'fuerza', sesion: k, min: Math.max(1, Math.round((Date.now() - d.inicio) / 6e4)), eliptica: !!d.eliptica, ejercicios: ej };
  const nota = (d.nota || '').trim(), prs = records(log, st.logs);
  if (nota) log.nota = nota;
  if (prs.length) log.prs = prs;
  st.logs.push(log); st.ciclo.inicio ??= log.fecha; st.draft = null; st.timerEnd = null; guardar();
  location.hash = '#resumen/' + log.id;
}
function vResumen(id) {
  const l = st.logs.find(l => l.id === id);
  if (!l) return vHoy();
  const nom = e => esc(lib(e.id)?.n || e.id), subir = l.ejercicios.filter(e => consejo(e.sets, e, e.u)), B = l.bien || {};
  const recs = l.ejercicios.filter(e => l.prs?.includes(e.id));
  const escala = (c, t) => `<div class="bien"><span>${t}</span><div class="seg5">${[1, 2, 3, 4, 5].map(v => `<button type="button" data-a="bien" data-id="${l.id}" data-c="${c}" data-v="${v}" class="${B[c] === v ? 'on' : ''}" aria-label="${t}: ${v} de 5" aria-pressed="${B[c] === v}">${v}</button>`).join('')}</div></div>`;
  return `<header class="top"><span class="eyebrow">${conDia(l.fecha)} · ${l.min} min${l.eliptica ? ' + 15 de elíptica' : ''}</span><h1>Fuerza ${l.sesion} guardada</h1></header>
  ${recs.length ? `<section class="card"><h3>${recs.length === 1 ? 'Récord personal' : 'Récords personales'}</h3>${recs.map(e => `<p><b>${nom(e)}:</b> <span class="num">${esc(fmtSets([mejorMarca([l], e.id, e.unidad, e.u || 'kg').set], e.unidad, e.u))}</span>, tu mejor marca hasta ahora.</p>`).join('')}</section>` : ''}
  ${subir.length ? `<section class="card"><h3>Para la próxima</h3>${subir.map(e => `<p><b>${nom(e)}:</b> ${esc(consejo(e.sets, e, e.u).replace(/^[^:]+: /, ''))}.</p>`).join('')}</section>` : ''}
  <section class="card"><h3>Lo que hiciste</h3>${l.ejercicios.map(e => `<div class="fila fin"><span>${nom(e)}</span><span class="num nota">${esc(fmtSets(e.sets, e.unidad, e.u))}</span></div>`).join('') || '<p class="nota">Solo elíptica.</p>'}${l.nota ? `<p class="nota">Nota: ${esc(l.nota)}</p>` : ''}</section>
  <section class="card"><h3>¿Cómo estuviste?</h3><p class="nota">Opcional. 1 es bajo y 5 es alto. Queda anotado junto a la sesión.</p>${escala('energia', 'Energía')}${escala('sueno', 'Sueño de anoche')}${escala('animo', 'Ánimo')}</section>
  ${elipticaHecha(l) ? '<a class="btn pri" href="#hoy">Listo</a>' : `<section class="card"><h3>Elíptica · 15 min</h3><p class="nota">Zona 2 (${zona(2).lpm}): ritmo cómodo, podés conversar.</p>
    <button type="button" class="pri" data-a="e-ini">Empezar elíptica</button><button type="button" data-a="e-hecha" data-id="${l.id}">Ya la hice</button><a class="btn" href="#hoy">Hoy no</a></section>`}`;
}

/* ---------- Vista: Cardio ---------- */
function vCardio(key) {
  const v = DATA.cardio_largo[key];
  if (!v) return vHoy();
  if (st.cardio && st.cardio.key !== key) { location.replace('#cardio/' + st.cardio.key); return ''; }
  const d = st.cardio;
  let h = `<header class="top"><a class="back" href="#hoy">‹ Hoy</a><span class="eyebrow">${key === 'Z15' ? 'Después de la fuerza' : 'Cardio largo'} · ${totalCardio(v)} min</span><h1>${esc(v.name)}</h1></header>`;
  if (d) h += `<div class="ahora z1" id="cnow" data-k="${key}"><span id="cz"></span><b id="ct">0:00</b><span id="cl"></span></div><p class="nota" id="cnext"></p>`;
  h += `<section class="card">${perfil(v, !!d)}${d ? '<p class="nota num" id="ctot"></p>' : ''}<p class="nota"><b>${esc(v.equip)}.</b> ${esc(v.desc)}</p></section>`;
  if (d) h += `<div class="fila"><button type="button" class="pri" data-a="c-pausa">${d.pausa ? 'Reanudar' : 'Pausar'}</button><button type="button" data-a="c-fin">Terminar antes</button><button type="button" class="peligro" data-a="c-desc">Descartar</button></div>`;
  else h += `<section class="card"><div class="zonas">${[1, 2, 4].map(z => { const q = zona(z); return `<span><i class="sw" style="background:var(--${q.c})"></i><b>${q.n}</b> ${q.lpm}</span>`; }).join('')}</div>
    <p class="nota">Suena y vibra en cada cambio de tramo. La pantalla queda encendida mientras dura.</p></section>
    <button type="button" class="pri" data-a="c-ini" data-k="${key}">Empezar</button>`;
  return h;
}
let segPrev = null;
function finCardio(min) {
  const d = st.cardio;
  st.logs.push({ id: Date.now().toString(36), fecha: iso(new Date(d.inicio)), tipo: 'cardio', sesion: d.key, min });
  st.cardio = null; segPrev = null; guardar(); beep(3); toast(`Cardio guardado: ${min} min`);
  if (location.hash.startsWith('#cardio')) location.hash = '#hoy'; else render();
}
function tickCardio() {
  const d = st.cardio;
  if (!d) { segPrev = null; return; }
  const v = DATA.cardio_largo[d.key], el = ((d.pausa ?? Date.now()) - d.inicio) / 1000, tot = totalCardio(v) * 60;
  if (el >= tot) { finCardio(tot / 60); return; }
  let acc = 0, i = 0;
  for (; i < v.seg.length - 1; i++) { if (el < acc + v.seg[i][0] * 60) break; acc += v.seg[i][0] * 60; }
  if (segPrev !== null && segPrev !== i) beep(3);
  segPrev = i;
  const now = $('#cnow');
  if (!now || now.dataset.k !== d.key) return;
  const sg = v.seg[i], z = zona(sg[1]), nx = v.seg[i + 1];
  now.className = 'ahora ' + z.c;
  $('#cz').textContent = z.n + (sg[2] ? ' · ' + sg[2] : '') + (d.pausa ? ' · en pausa' : '');
  $('#ct').textContent = mmss(acc + sg[0] * 60 - el);
  $('#cl').textContent = z.lpm;
  $('#cnext').textContent = nx ? `Después: ${zona(nx[1]).n.toLowerCase()}, ${nx[0]} min${nx[2] && nx[2] !== sg[2] ? ' · ' + nx[2] : ''}` : 'Último tramo';
  $('#ctot').textContent = `${mmss(el)} de ${tot / 60} min · tramo ${i + 1} de ${v.seg.length}`;
  $('#pm').style.left = (el / tot * 100) + '%';
}

/* ---------- Vista: Progreso ---------- */
let selEx = null, selSem = 0, selPt = null;
function puntos(id) {
  const out = [], u = uEx(id);
  for (const l of st.logs) if (l.tipo === 'fuerza') { const e = l.ejercicios.find(e => e.id === id && (e.u || 'kg') === u); if (e) out.push({ fecha: l.fecha, e, rec: !!l.prs?.includes(id), ...metrica(e) }); }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
function grafico(pts) {
  const W = 340, H = 170, L = 36, R = 16, T = 14, B = 24;
  let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * .15; lo = Math.max(0, lo - pad); hi += pad;
  const d0 = deIso(pts[0].fecha), span = Math.max(1, diasEntre(d0, deIso(pts.at(-1).fecha)));
  const X = p => pts.length === 1 ? (L + W - R) / 2 : L + diasEntre(d0, deIso(p.fecha)) / span * (W - L - R);
  const Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(pts[0].t)} por sesión">`;
  for (let i = 0; i <= 2; i++) { const v = lo + (hi - lo) * i / 2, y = Y(v); s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${y + 3}" text-anchor="end">${fmtKg(Math.round(v * 10) / 10)}</text>`; }
  s += `<text x="${L}" y="${H - 6}">${corta(pts[0].fecha)}</text>`;
  if (pts.length > 1) s += `<text x="${W - R}" y="${H - 6}" text-anchor="end">${corta(pts.at(-1).fecha)}</text><polyline fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p => `${X(p).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')}"/>`;
  const sel = selPt ?? pts.length - 1;
  pts.forEach((p, i) => { s += `<circle cx="${X(p).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${i === sel ? 6 : 4}" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`; });
  pts.forEach((p, i) => { s += `<circle class="hit" data-a="pt" data-i="${i}" cx="${X(p).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="16"><title>${corta(p.fecha)}: ${fmtKg(p.v)} ${p.u}</title></circle>`; });
  return s + '</svg>';
}
function volumen() {
  const l = lunes(new Date()); l.setDate(l.getDate() + selSem * 7);
  const fin = new Date(l); fin.setDate(l.getDate() + 6);
  const a = iso(l), b = iso(fin), hechas = {}, meta = {};
  let cardio = 0;
  for (const k of Object.keys(ses())) for (const it of items(k)) if (!it.opc) meta[it.patron] = (meta[it.patron] || 0) + it.series;
  for (const lg of st.logs) if (lg.fecha >= a && lg.fecha <= b) {
    if (lg.tipo === 'cardio') cardio += lg.min;
    else { if (lg.eliptica) cardio += 15; for (const e of lg.ejercicios) hechas[e.patron] = (hechas[e.patron] || 0) + e.sets.length; }
  }
  const max = Math.max(1, ...Object.keys(PATRONES).map(p => Math.max(hechas[p] || 0, meta[p] || 0)));
  return `<div class="fila fin"><button type="button" class="sec" data-a="sem" data-d="-1" aria-label="Semana anterior">‹</button><span class="eyebrow">Semana del ${corta(a)} al ${corta(b)}</span><button type="button" class="sec" data-a="sem" data-d="1" ${selSem >= 0 ? 'disabled' : ''} aria-label="Semana siguiente">›</button></div>
  <div class="vol">${Object.entries(PATRONES).map(([p, n]) => `<span>${n}</span><div class="pista"><div class="barra" style="width:${(hechas[p] || 0) / max * 100}%"></div><div class="meta" style="left:calc(${(meta[p] || 0) / max * 100}% - 1px)"></div></div><span class="val">${hechas[p] || 0} / ${meta[p] || 0}</span>`).join('')}</div>
  <div class="leyenda"><span><i style="width:16px;height:10px;background:var(--accent);border-radius:0 3px 3px 0"></i>series hechas</span><span><i style="width:2px;height:14px;background:var(--ink)"></i>series planificadas</span></div>
  <p class="nota">Cardio en la semana: <b class="num">${cardio} min</b>.</p>`;
}
let selWk = null;
function barras(vals, sel, nombre, S) {
  const W = 340, H = 76, L = 26, R = 4, T = 10, B = 2, max = Math.max(1, ...vals), bw = (W - L - R) / vals.length, y0 = H - B;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${nombre} por semana, últimas ${vals.length} semanas"><text x="${L - 6}" y="${T + 3}" text-anchor="end">${max}</text><text x="${L - 6}" y="${y0}" text-anchor="end">0</text><line x1="${L}" x2="${W - R}" y1="${y0}" y2="${y0}" stroke="var(--line)" stroke-width="1"/>`;
  vals.forEach((v, i) => {
    const x = L + i * bw + 2, w = bw - 4, hh = v / max * (y0 - T), r = Math.min(4, hh), y = y0 - hh;
    if (v > 0) s += `<path d="M${x.toFixed(1)},${y0}V${(y + r).toFixed(1)}Q${x.toFixed(1)},${y.toFixed(1)} ${(x + r).toFixed(1)},${y.toFixed(1)}H${(x + w - r).toFixed(1)}Q${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + r).toFixed(1)}V${y0}Z" fill="var(--accent)" opacity="${i === sel ? 1 : .5}"/>`;
    s += `<rect class="hit" data-a="wk" data-i="${i}" x="${(L + i * bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}"><title>Semana del ${corta(S[i].desde)}: ${v}</title></rect>`;
  });
  return s + '</svg>';
}
function constancia() {
  const S = semanas(st.logs, st.descansos, new Date(), 12, LARGOS), i = selWk ?? S.length - 1, w = S[i];
  return `<span class="eyebrow">Días de fuerza por semana</span><div class="chart">${barras(S.map(x => x.fuerza), i, 'Días de fuerza', S)}</div>
  <span class="eyebrow">Minutos de cardio por semana</span><div class="chart">${barras(S.map(x => x.cardio), i, 'Minutos de cardio', S)}</div>
  <div class="escala"><span>semana del ${corta(S[0].desde)}</span><span>semana del ${corta(S.at(-1).desde)}</span></div>
  <p class="lectura"><b>Semana del ${corta(w.desde)}:</b> ${w.fuerza} ${w.fuerza === 1 ? 'día' : 'días'} de fuerza · ${w.cardio} min de cardio${w.largos ? ` (${w.largos} ${w.largos === 1 ? 'largo' : 'largos'})` : ''}${w.descansos ? ` · ${w.descansos} de descanso` : ''}</p>
  <p class="nota">Últimas 12 semanas. Tocá una barra para ver esa semana.</p>`;
}
const BIEN = { energia: 'Energía', sueno: 'Sueño', animo: 'Ánimo' };
function vProgreso() {
  const fuerza = st.logs.filter(l => l.tipo === 'fuerza');
  const conDatos = [...new Set(fuerza.flatMap(l => l.ejercicios.map(e => e.id)))].filter(id => lib(id));
  let h = `<header class="top"><span class="eyebrow">${st.logs.length} ${st.logs.length === 1 ? 'sesión registrada' : 'sesiones registradas'}</span><h1>Progreso</h1></header>`;
  h += '<section class="card"><h3>Por ejercicio</h3>';
  if (!conDatos.length) h += '<p class="nota">Cuando guardes tu primera sesión de fuerza vas a ver acá la evolución de cada ejercicio.</p>';
  else {
    if (!conDatos.includes(selEx)) { selEx = conDatos[0]; selPt = null; }
    const pts = puntos(selEx), p = pts[Math.min(selPt ?? pts.length - 1, pts.length - 1)];
    h += `<select data-s="ex" aria-label="Ejercicio">${conDatos.map(id => `<option value="${id}" ${id === selEx ? 'selected' : ''}>${esc(lib(id).n)}</option>`).join('')}</select>`;
    if (!p) h += `<p class="nota">Todavía no hay sesiones de este ejercicio cargadas en ${UNIDADES[uEx(selEx)].nombre}. Las anteriores, en otra unidad, siguen en el historial.</p>`;
    else h += `<span class="eyebrow">${p.t}, en ${p.u}</span><div class="chart">${grafico(pts)}</div>
    <p class="lectura"><b>${conDia(p.fecha)}:</b> ${fmtKg(p.v)} ${p.u} · ${esc(fmtSets(p.e.sets, p.e.unidad, p.e.u))}${p.rec ? ' · récord personal' : ''}${pts.length === 1 ? '<br><span class="nota">Con la segunda sesión aparece la línea.</span>' : ''}</p>`;
  }
  h += `</section><section class="card"><h3>Constancia</h3>${st.logs.length ? constancia() : '<p class="nota">Acá vas a ver cuántos días entrenaste cada semana.</p>'}</section>`;
  h += `<section class="card"><h3>Volumen semanal por patrón</h3>${volumen()}</section>`;
  h += '<section class="card"><h3>Historial</h3>';
  if (!st.logs.length) h += '<p class="nota">Todavía no hay sesiones.</p>';
  else h += [...st.logs].reverse().map(l => `<details class="log"><summary><b>${conDia(l.fecha)}</b> ${l.tipo === 'fuerza' ? `Fuerza ${l.sesion}` : esc(DATA.cardio_largo[l.sesion]?.name || 'Cardio')} · ${l.min} min${l.prs?.length ? ' · récord' : ''}</summary><div class="cuerpo">
    ${l.tipo === 'fuerza' ? l.ejercicios.map(e => `<div><span>${esc(lib(e.id)?.n || e.id)}${l.prs?.includes(e.id) ? ' (récord)' : ''}</span><span>${esc(fmtSets(e.sets, e.unidad, e.u))}</span></div>`).join('') + (l.eliptica ? '<div><span>Elíptica en zona 2</span><span>15 min</span></div>' : '') : ''}
    ${l.bien && Object.keys(l.bien).length ? `<div><span>${Object.keys(BIEN).filter(c => l.bien[c]).map(c => `${BIEN[c]} ${l.bien[c]}/5`).join(' · ')}</span><span></span></div>` : ''}
    ${l.nota ? `<p class="nota">Nota: ${esc(l.nota)}</p>` : ''}
    <button type="button" class="sec peligro" data-a="borrar-log" data-id="${l.id}">Borrar esta sesión</button></div></details>`).join('');
  return h + '</section>';
}

/* ---------- Vista: Rutina y generador ---------- */
const equipoOk = x => x.equipo.every(q => DATA.equipo_disponible.includes(q));
const tipoOk = (it, x) => it.patron !== 'core_brazos' ? x.tipo === 'compuesto' : it.opc ? x.tipo === 'aislamiento' : x.tipo === 'core' || x.tipo === 'cargada';
const esEstacion = q => q === 'smith' || q === 'polea' || q.startsWith('maquina') || q.startsWith('estacion');
function cambiarItem(it, id) {
  const x = lib(id), era = lib(it.ejercicio);
  const rx = x.rx || (it.unidad === 's' || era.rx ? { unidad: 'reps', min: 8, max: 12 } : { unidad: 'reps', min: it.min, max: it.max });
  Object.assign(it, { ejercicio: id, ...rx });
  if (x.por_lado) it.por_lado = x.por_lado; else delete it.por_lado;
  it.series_reps = fmtRx(it);
}
const buscar = (S, k, c) => [...S[k].superseries.flat(), ...(S[k].opcional || [])].find(it => it.codigo === c);
function proponer() {
  const S = structuredClone(ses()), usados = new Set(), actuales = new Set(Object.keys(S).flatMap(k => items(k).map(it => it.ejercicio)));
  for (const k of Object.keys(S)) {
    const s = S[k], grupos = [...s.superseries, ...(s.opcional ? [s.opcional] : [])];
    grupos.forEach((b, bi) => b.forEach((it, ii) => {
      const opc = bi >= s.superseries.length, pareja = ii > 0 ? lib(b[0].ejercicio) : null;
      const cands = Object.entries(DATA.ejercicios).filter(([, x]) => x.categoria === it.patron && tipoOk({ ...it, opc }, x) && equipoOk(x))
        .map(([id, x]) => [id, (id === it.ejercicio ? 6 : 0) + (usados.has(id) ? 30 : 0) + (actuales.has(id) ? 2 : 0) + (pareja && x.equipo.some(q => esEstacion(q) && pareja.equipo.includes(q)) ? 8 : 0) + Math.random() * 3])
        .sort((a, b) => a[1] - b[1]);
      const id = cands.length ? cands[0][0] : it.ejercicio;
      usados.add(id);
      if (id !== it.ejercicio) cambiarItem(it, id);
    }));
  }
  return S;
}
function vRutina() {
  const n = semCiclo(), propia = !!st.ciclo.sesiones;
  let h = `<header class="top"><span class="eyebrow">${n ? `Ciclo iniciado el ${corta(st.ciclo.inicio)} · semana ${n}` : 'El ciclo arranca con tu primera sesión'}</span><h1>Rutina</h1></header>
  <p class="nota">Mantené los mismos ejercicios 8–12 semanas y después rotalos por otros del mismo patrón. La rotación solo usa equipos que hay en tu gimnasio.</p>`;
  for (const k of Object.keys(ses())) {
    h += `<section class="card"><h3>Fuerza ${k}</h3><div>`;
    bloques(k).forEach((b, bi) => {
      h += `<div class="sep">Bloque ${'ABCD'[bi]}${esOpc(k, bi) ? ' · opcional' : ''}</div>` + b.map(it => `<div class="slot"><span class="code">${it.codigo}</span><span>${esc(lib(it.ejercicio).n)}<small>${PATRONES[it.patron]} · ${fmtRx(it)}</small></span><button type="button" class="sec" data-a="cambiar" data-k="${k}" data-c="${it.codigo}">Cambiar</button></div>`).join('');
    });
    h += '</div></section>';
  }
  h += `<button type="button" class="pri" data-a="rotar">Proponer rotación completa</button>`;
  if (propia) h += `<button type="button" data-a="original">Volver a la rutina original</button>`;
  if (st.ciclosPrevios.length) h += `<p class="nota">Ciclos anteriores: ${st.ciclosPrevios.map(c => `${c.inicio ? corta(c.inicio) : '—'} a ${corta(c.fin)}`).join(', ')}.</p>`;
  return h;
}
let propuesta = null;
function dlgCambiar(k, c) {
  const it = items(k).find(x => x.codigo === c), enUso = {};
  for (const kk of Object.keys(ses())) for (const x of items(kk)) enUso[x.ejercicio] = kk;
  const cands = Object.entries(DATA.ejercicios).filter(([id, x]) => x.categoria === it.patron && equipoOk(x) && id !== it.ejercicio)
    .sort((a, b) => (tipoOk(it, b[1]) - tipoOk(it, a[1])) || a[1].n.localeCompare(b[1].n));
  abrir(`<span class="eyebrow">${it.codigo} · ${PATRONES[it.patron]}</span><h3>Cambiar ${esc(lib(it.ejercicio).n)}</h3>
  <div class="dl">${cands.map(([id, x]) => `<button type="button" class="op" data-a="elegir" data-k="${k}" data-c="${c}" data-id="${id}">${esc(x.n)}<small>${esc(eqTxt(x))}${x.tipo === 'aislamiento' ? ' · aislamiento' : ''}${enUso[id] ? ` · ya está en Fuerza ${enUso[id]}` : ''}</small></button>`).join('')}</div>
  <button type="button" class="ancho" data-a="cerrar">Cancelar</button>`);
}
function dlgRotar() {
  propuesta = proponer();
  let h = '<span class="eyebrow">Propuesta de rotación</span><h3>Ciclo nuevo</h3>', cambios = 0;
  for (const k of Object.keys(propuesta)) {
    h += `<div class="sep">Fuerza ${k}</div>`;
    for (const it of items(k)) {
      const nu = buscar(propuesta, k, it.codigo), igual = nu.ejercicio === it.ejercicio;
      if (!igual) cambios++;
      h += `<div class="cambio ${igual ? 'igual' : ''}"><span class="code">${it.codigo}</span>${igual ? `${esc(lib(it.ejercicio).n)} (sigue)` : `${esc(lib(it.ejercicio).n)} → <b>${esc(lib(nu.ejercicio).n)}</b> <span class="num">${fmtRx(nu)}</span>`}</div>`;
    }
  }
  abrir(`${h}<p class="nota" style="margin:10px 0">${cambios} cambios. Al aplicar empieza un ciclo nuevo desde hoy; tu historial se conserva.</p>
  <div class="dl"><button type="button" class="pri" data-a="aplicar">Aplicar</button><button type="button" data-a="rotar">Otra propuesta</button><button type="button" data-a="cerrar">Cancelar</button></div>`);
}
function abrir(html) { const d = $('#dlg'); d.innerHTML = html; if (!d.open) d.showModal(); d.scrollTop = 0; }
const enCurso = () => { if (st.draft) { toast('Terminá o descartá la sesión en curso antes de cambiar la rutina'); return true; } return false; };

/* ---------- Vista: Ajustes ---------- */
function vAjustes() {
  const a = st.ajustes;
  return `<header class="top"><span class="eyebrow">Los datos se guardan solo en este celular</span><h1>Ajustes</h1></header>
  <section class="card"><h3>Entrenamiento</h3>
    <div class="campo-l">Descanso entre vueltas<div class="seg">${[60, 75, 90].map(s => `<button type="button" data-a="descanso" data-v="${s}" class="${a.descanso === s ? 'on' : ''}">${s} s</button>`).join('')}</div></div>
    <div class="campo-l">Recordatorio al abrir la app si pasaron varios días sin registrar nada<div class="seg">${[[0, 'No'], [3, '3 días'], [5, '5 días']].map(([v, n]) => `<button type="button" data-a="aviso" data-v="${v}" class="${a.aviso === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    <label class="check"><input type="checkbox" data-s="sonido" ${a.sonido ? 'checked' : ''}><span>Sonido al terminar el descanso y al cambiar de tramo</span></label>
  </section>
  <section class="card"><h3>Cardio</h3>
    <label class="campo-l">Edad<input class="campo" type="number" inputmode="numeric" min="15" max="90" data-s="edad" value="${a.edad}"></label>
    <label class="campo-l">FC máxima medida (opcional)<input class="campo" type="number" inputmode="numeric" min="120" max="220" data-s="fcmax" value="${a.fcmax ?? ''}" placeholder="${220 - a.edad} estimada por edad"></label>
    <p class="nota">Zona 2: <b class="num">${zona(2).lpm}</b> · Fuerte: <b class="num">${zona(4).lpm}</b>. La estimación por edad puede variar ±10 lpm; guiate también por la sensación.</p>
  </section>
  <section class="card"><h3>Respaldo</h3>
    <p class="nota">Si se borran los datos del navegador o cambiás de celular, los registros se pierden. Exportá un respaldo cada tanto${st.respaldo ? ` (último: ${corta(st.respaldo)})` : ''}.</p>
    <button type="button" data-a="exportar">Exportar respaldo</button>
    <button type="button" data-a="csv">Exportar planilla (CSV)</button>
    <label class="btn">Importar respaldo<input type="file" accept="application/json,.json" data-s="importar" hidden></label>
    <button type="button" class="peligro" data-a="borrar-todo">Borrar todos los datos</button>
  </section>
  <section class="card"><h3>Cargas</h3><p class="nota">Cada ejercicio se carga en lo que muestra el equipo: kilos, libras o el número de placa si la máquina no dice cuánto pesa. Se cambia desde el ejercicio, con "Carga en… · cambiar". No se convierte nada: la progresión siempre compara contra ese mismo equipo.</p></section>
  <p class="nota">Esta app es un registro personal de entrenamiento. No es atención médica ni reemplaza el consejo de un profesional de la salud.</p>`;
}
function exportar() {
  st.respaldo = iso(new Date()); guardar();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(st, null, 1)], { type: 'application/json' }));
  a.download = nombreArchivo('rutina-respaldo', st.respaldo, 'json'); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000); render();
}
function exportarCsv() {
  if (!st.logs.length) { toast('Todavía no hay sesiones para exportar'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv(st.logs, id => lib(id)?.n || id, id => DATA.cardio_largo[id]?.name || id)], { type: 'text/csv;charset=utf-8' }));
  a.download = nombreArchivo('rutina-registros', iso(new Date()), 'csv'); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function importar(file) {
  try {
    const o = JSON.parse(await file.text());
    if (o.v !== 1 || !Array.isArray(o.logs)) throw 0;
    if (!confirm(`El respaldo tiene ${o.logs.length} sesiones. Reemplaza todo lo que hay ahora en este celular. ¿Seguir?`)) return;
    localStorage.setItem(KEY, JSON.stringify(o)); cargar(); toast('Respaldo importado'); render();
  } catch { toast('Ese archivo no es un respaldo válido'); }
}

/* ---------- Acciones ---------- */
const A = {
  chk: b => marcar(b),
  unidad: b => { const id = b.dataset.ex; st.unidades[id] = sigUnidad(uEx(id)); guardar(); render(); toast(`${lib(id).n}: ahora en ${UNIDADES[uEx(id)].nombre}`); },
  bien: b => { const l = st.logs.find(l => l.id === b.dataset.id); if (!l) return; const c = b.dataset.c, v = +b.dataset.v; l.bien ??= {}; if (l.bien[c] === v) delete l.bien[c]; else l.bien[c] = v; guardar(); render(); },
  'desc-hoy': () => { const f = iso(new Date()); st.descansos = st.descansos.includes(f) ? st.descansos.filter(x => x !== f) : [...st.descansos, f]; guardar(); render(); },
  silenciar: () => { st.ajustes.aviso = 0; guardar(); render(); toast('Recordatorio apagado. Se vuelve a prender en Ajustes.'); },
  aviso: b => { st.ajustes.aviso = +b.dataset.v; guardar(); render(); },
  wk: b => { selWk = +b.dataset.i; render(); },
  csv: exportarCsv,
  terminar: b => terminar(b.dataset.k),
  descartar: b => { if (confirm('¿Descartar la sesión en curso? Se pierden las series marcadas.')) { st.draft = null; st.timerEnd = null; guardar(); render(); tick(); } },
  't-mas': () => { if (st.timerEnd) { st.timerEnd = Math.max(st.timerEnd, Date.now()) + 15000; sono = false; guardar(); tick(); } },
  't-fin': () => pararDescanso(),
  'e-ini': () => { if (st.cardio && st.cardio.key !== 'Z15') { toast('Ya tenés un cardio en curso'); return; } st.cardio ??= { key: 'Z15', inicio: Date.now(), pausa: null }; segPrev = null; guardar(); location.hash = '#cardio/Z15'; },
  'e-hecha': b => { const l = st.logs.find(l => l.id === b.dataset.id); if (l) { l.eliptica = true; guardar(); render(); } },
  'c-ini': b => { st.cardio = { key: b.dataset.k, inicio: Date.now(), pausa: null }; segPrev = null; guardar(); render(); },
  'c-pausa': () => { const d = st.cardio; if (d.pausa) { d.inicio += Date.now() - d.pausa; d.pausa = null; } else d.pausa = Date.now(); guardar(); render(); },
  'c-fin': () => { const d = st.cardio, min = Math.round(((d.pausa ?? Date.now()) - d.inicio) / 6e4); if (min < 1) { toast('Todavía no pasó ni un minuto'); return; } if (confirm(`¿Terminar ahora y guardar ${min} min?`)) finCardio(min); },
  'c-desc': () => { if (confirm('¿Descartar este cardio sin guardarlo?')) { st.cardio = null; guardar(); location.hash = '#hoy'; } },
  pt: b => { selPt = +b.dataset.i; render(); },
  sem: b => { selSem = Math.min(0, selSem + +b.dataset.d); render(); },
  'borrar-log': b => { if (confirm('¿Borrar esta sesión del historial? No se puede deshacer.')) { st.logs = st.logs.filter(l => l.id !== b.dataset.id); guardar(); render(); } },
  cambiar: b => { if (!enCurso()) dlgCambiar(b.dataset.k, b.dataset.c); },
  elegir: b => { const S = (st.ciclo.sesiones ??= structuredClone(DATA.sesiones)); cambiarItem(buscar(S, b.dataset.k, b.dataset.c), b.dataset.id); guardar(); $('#dlg').close(); render(); },
  rotar: () => { if (!enCurso()) dlgRotar(); },
  aplicar: () => { const hoy = iso(new Date()); st.ciclosPrevios.push({ inicio: st.ciclo.inicio, fin: hoy, sesiones: st.ciclo.sesiones }); st.ciclo = { inicio: hoy, sesiones: propuesta }; propuesta = null; guardar(); $('#dlg').close(); render(); toast('Ciclo nuevo aplicado'); },
  original: () => { if (!enCurso() && confirm('¿Volver a los ejercicios originales de la rutina?')) { st.ciclo.sesiones = null; guardar(); render(); } },
  cerrar: () => $('#dlg').close(),
  descanso: b => { st.ajustes.descanso = +b.dataset.v; guardar(); render(); },
  exportar,
  'borrar-todo': () => { if (confirm('Se borran todas las sesiones, la rutina modificada y los ajustes de este celular. No se puede deshacer. ¿Borrar?')) { localStorage.removeItem(KEY); cargar(); tick(); location.hash = '#hoy'; render(); } },
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b || b.matches('input')) return;
  audio();
  A[b.dataset.a]?.(b);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('.nota-ej')) { if (t.value.trim()) st.notasEj[t.dataset.ex] = t.value.slice(0, 140); else delete st.notasEj[t.dataset.ex]; guardar(); return; }
  if (t.matches('.nota-ses')) { borrador(t.closest('[data-k]').dataset.k).nota = t.value.slice(0, 300); guardar(); return; }
  if (t.matches('.set input')) {
    const row = t.closest('.set'), k = t.closest('[data-k]').dataset.k, d = borrador(k), arr = (d.sets[row.dataset.c] ??= []), s = (arr[+row.dataset.i] ??= {});
    const v = parseFloat(t.value);
    s[t.classList.contains('kg') ? 'kg' : 'reps'] = Number.isFinite(v) ? v : null;
    t.classList.remove('falta'); guardar();
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.a === 'eliptica') { borrador(t.closest('[data-k]').dataset.k).eliptica = t.checked; guardar(); return; }
  const s = t.dataset.s;
  if (!s) return;
  if (s === 'ex') { selEx = t.value; selPt = null; }
  else if (s === 'sonido') { st.ajustes.sonido = t.checked; if (t.checked) beep(1); }
  else if (s === 'edad') { const v = parseInt(t.value); if (v >= 15 && v <= 90) st.ajustes.edad = v; }
  else if (s === 'fcmax') { const v = parseInt(t.value); st.ajustes.fcmax = v >= 120 && v <= 220 ? v : null; }
  else if (s === 'importar') { if (t.files[0]) importar(t.files[0]); return; }
  guardar(); render();
});

/* ---------- Router ---------- */
const V = { hoy: vHoy, entrenar: vEntrenar, cardio: vCardio, resumen: vResumen, progreso: vProgreso, rutina: vRutina, ajustes: vAjustes };
function render() {
  const [r, arg] = (location.hash.slice(1) || 'hoy').split('/');
  $('#v').innerHTML = (V[r] || vHoy)(arg);
  const tab = V[r] && ['progreso', 'rutina', 'ajustes'].includes(r) ? r : 'hoy';
  for (const a of document.querySelectorAll('#tabs a')) a.classList.toggle('on', a.dataset.tab === tab);
  despierto(!!(st.draft || st.cardio));
  tickCardio();
}
window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { despierto(!!(st.draft || st.cardio)); tick(); tickCardio(); } });

(async () => {
  cargar();
  try { DATA = await (await fetch('rutina.json')).json(); }
  catch { $('#v').innerHTML = '<p class="nota">No se pudo cargar la rutina. Abrí la app una vez con conexión.</p>'; return; }
  DATA.cardio_largo.Z15 = { name: 'Elíptica en zona 2', equip: 'Elíptica', seg: [[15, 2]], desc: 'Ritmo constante y cómodo después de la fuerza.' };
  // si la rutina guardada referencia ejercicios que ya no existen, vuelve a la original
  if (st.ciclo.sesiones && !Object.values(st.ciclo.sesiones).every(s => [...s.superseries.flat(), ...(s.opcional || [])].every(it => lib(it.ejercicio)))) st.ciclo.sesiones = null;
  if (st.draft && !ses()[st.draft.sesion]) st.draft = null;
  if (st.cardio && !DATA.cardio_largo[st.cardio.key]) st.cardio = null;
  render();
  setInterval(() => { tick(); tickCardio(); }, 250);
  navigator.storage?.persist?.();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
