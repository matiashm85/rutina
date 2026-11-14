/* Figuras de los ejercicios: muñeco de perfil con cinemática inversa.
   Mismo código que paginas/rutina-6-patrones.html; los parámetros vienen de rutina.json (fig). */
const TOR=32,TH=24,SH=24,UA=17,FA=16;
function ik(A,B,l1,l2,bend){
  let dx=B[0]-A[0],dy=B[1]-A[1],d=Math.hypot(dx,dy),max=l1+l2-0.4;
  let Bp=B;
  if(d>max){Bp=[A[0]+dx/d*max,A[1]+dy/d*max];dx=Bp[0]-A[0];dy=Bp[1]-A[1];d=max}
  d=Math.max(d,Math.abs(l1-l2)+0.5);
  const base=Math.atan2(dy,dx),a=Math.acos(Math.min(1,Math.max(-1,(l1*l1+d*d-l2*l2)/(2*l1*d))));
  const c1=[A[0]+l1*Math.cos(base+a),A[1]+l1*Math.sin(base+a)],c2=[A[0]+l1*Math.cos(base-a),A[1]+l1*Math.sin(base-a)];
  let J;
  if(bend==='f')J=c1[0]>c2[0]?c1:c2; else if(bend==='b')J=c1[0]<c2[0]?c1:c2;
  else if(bend==='u')J=c1[1]<c2[1]?c1:c2; else J=c1[1]>c2[1]?c1:c2;
  return [J,Bp];
}
const ln=(a,b,w,c)=>`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
function held(kind,p,c){
  if(kind==='db')return `<rect x="${(p[0]-6).toFixed(1)}" y="${(p[1]-2.5).toFixed(1)}" width="12" height="5" rx="1" fill="${c}"/><rect x="${(p[0]-7).toFixed(1)}" y="${(p[1]-4).toFixed(1)}" width="3.5" height="8" rx="1" fill="${c}"/><rect x="${(p[0]+3.5).toFixed(1)}" y="${(p[1]-4).toFixed(1)}" width="3.5" height="8" rx="1" fill="${c}"/>`;
  if(kind==='plate')return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="8.5" fill="none" stroke="${c}" stroke-width="3"/><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2" fill="${c}"/>`;
  return '';
}
function pose(o,ghost){
  const col=ghost?'var(--ghost)':'var(--ink)',hc=ghost?'var(--ghost)':'var(--held)';
  const r=o.t*Math.PI/180,dir=[Math.sin(r),-Math.cos(r)];
  const hip=o.hip,neck=[hip[0]+TOR*dir[0],hip[1]+TOR*dir[1]],head=[neck[0]+10*dir[0],neck[1]+10*dir[1]];
  let s='';
  for(const f of (o.feet||[])){const [k,ft]=ik(hip,f,TH,SH,f[2]||'f');s+=ln(hip,k,5,col)+ln(k,ft,4.5,col)+ln(ft,[ft[0]+(f[3]??6),ft[1]],4,col)}
  s+=ln(hip,neck,6,col)+`<circle cx="${head[0].toFixed(1)}" cy="${head[1].toFixed(1)}" r="6.5" fill="${col}"/>`;
  for(const h of (o.hands||[])){const [e,hd]=ik(neck,h,UA,FA,h[2]||'d');
    if(o.cable)s+=ln(o.cable,hd,1.4,'var(--eq)');
    s+=ln(neck,e,4.5,col)+ln(e,hd,4,col)+held(o.h,hd,hc)}
  return s;
}
function fixtures(list){
  const c='var(--eq)';let s='';
  for(const f of list||[]){
    const [k,...a]=f;
    if(k==='bench')s+=`<rect x="${a[0]}" y="${a[2]}" width="${a[1]-a[0]}" height="5" rx="1.5" fill="${c}"/>`+ln([a[0]+6,a[2]+5],[a[0]+6,100],2.5,c)+ln([a[1]-6,a[2]+5],[a[1]-6,100],2.5,c);
    if(k==='incl')s+=ln([a[0],a[1]],[a[2],a[3]],5,c)+ln([(a[0]+a[2])/2,(a[1]+a[3])/2],[(a[0]+a[2])/2,100],2.5,c);
    if(k==='seat')s+=`<rect x="${a[0]}" y="${a[2]}" width="${a[1]-a[0]}" height="5" rx="1.5" fill="${c}"/>`+ln([(a[0]+a[1])/2,a[2]+5],[(a[0]+a[1])/2,100],2.5,c);
    if(k==='back')s+=ln([a[0],a[1]],[a[0],a[2]],5,c);
    if(k==='rail')s+=ln([a[0],4],[a[0],100],1.6,c)+ln([a[0]+5,4],[a[0]+5,100],1.6,c);
    if(k==='tower')s+=`<rect x="${a[0]}" y="2" width="9" height="98" rx="1.5" fill="none" stroke="${c}" stroke-width="2"/><circle cx="${a[0]}" cy="${a[1]}" r="3" fill="${c}"/>`;
    if(k==='bar')s+=ln([a[0],a[2]],[a[1],a[2]],3.5,c)+(a[3]?ln([a[1],a[2]],[a[1]+6,a[2]],3.5,c)+ln([a[1]+6,a[2]-10],[a[1]+6,a[2]+40],3,c):'');
    if(k==='box')s+=`<rect x="${a[0]}" y="${a[2]}" width="${a[1]-a[0]}" height="${100-a[2]}" rx="1.5" fill="none" stroke="${c}" stroke-width="2.5"/>`;
  }
  return s;
}
function svgFig(F){
  const vb=F.vb||[0,0,160,110];
  let s=`<svg viewBox="${vb.join(' ')}" role="img" aria-label="Figura del ejercicio">`;
  if(F.floor!==false)s+=ln([vb[0]+4,100.5],[vb[0]+vb[2]-4,100.5],1.5,'var(--line)');
  s+=fixtures(F.fx);
  if(F.s)s+=pose(F.s,true);
  if(F.e)s+=pose(F.e,false);
  return s+'</svg>';
}
function frontFig(kind){
  const ink='var(--ink)',g='var(--ghost)',hc='var(--held)';
  let s=`<svg viewBox="0 0 160 110" role="img" aria-label="Figura del ejercicio, vista de frente">`+ln([4,100.5],[156,100.5],1.5,'var(--line)');
  const body=c=>ln([80,22],[80,52],6,c)+`<circle cx="80" cy="12" r="6.5" fill="${c}"/>`+ln([70,22],[90,22],5,c)+ln([76,52],[72,76],5,c)+ln([72,76],[70,100],4.5,c)+ln([84,52],[88,76],5,c)+ln([88,76],[90,100],4.5,c);
  if(kind==='lat'){
    s+=ln([70,22],[64,54],4.5,g)+ln([90,22],[96,54],4.5,g)+held('db',[64,56],g)+held('db',[96,56],g);
    s+=body(ink)+ln([70,22],[40,26],4.5,ink)+ln([90,22],[120,26],4.5,ink)+held('db',[38,26],hc)+held('db',[122,26],hc);
  } else {
    s+=`<rect x="14" y="2" width="9" height="98" rx="1.5" fill="none" stroke="var(--eq)" stroke-width="2"/><circle cx="23" cy="36" r="3" fill="var(--eq)"/>`+ln([23,36],[80,38],1.4,'var(--eq)');
    s+=body(ink)+ln([70,22],[78,38],4.5,ink)+ln([90,22],[82,38],4.5,ink)+`<rect x="76" y="35" width="8" height="6" rx="1.5" fill="${hc}"/>`;
  }
  return s+'</svg>';
}
/* Devuelve el HTML de la figura o foto de un ejercicio de la biblioteca ('' si no tiene). */
export function visual(x){
  const foto=x.foto?`<img src="fotos/${x.foto.split('/').pop()}" alt="" loading="lazy">`:'';
  if(x.front)return frontFig(x.front);
  if(x.fig)return svgFig(x.fig);
  return foto;
}
