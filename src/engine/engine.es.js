// SPDX-License-Identifier: Apache-2.0
// Motor de las pestañas (vanilla JS). Se monta desde Playground.tsx.
export function initEngine(DATA, init) {
let quieto = false;
// ===================== utilidades compartidas =====================
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt2 = x => x.toFixed(2).replace("-", "−").replace(".", ",");
const fmt3 = x => x.toFixed(3).replace("-", "−").replace(".", ",");
const fmt4 = x => x.toFixed(4).replace("-", "−").replace(".", ",");
const pct = x => (100 * x).toFixed(1).replace(".", ",") + "%";
const pct0 = x => Math.round(100 * x) + "%";
const log2 = x => Math.log(x) / Math.LN2;
const NOMBRE = { deuda_activos: "deuda/activos", razon_corriente: "razón corriente", ventas_deuda: "ventas/deuda", ln_activos: "ln activos", roa: "roa", tamano: "tamaño", deuda: "deuda", garantia: "garantía", historial: "historial", paga: "paga" };
const nom = v => NOMBRE[v] || v;
const el = id => document.getElementById(id);
function stagger(root) { root.querySelectorAll(".stage").forEach((s, i) => { s.style.animationDelay = reduced ? "0s" : (i * 0.18) + "s"; }); }
function stepper(prefix, pasos, onGo) {
  const rail = el(prefix + "-rail");
  rail.innerHTML = pasos.map((p, i) => `<button type="button" data-p="${i}"><span class="n">${i}</span>${p}</button>`).join("");
  rail.querySelectorAll("button").forEach(b => b.onclick = () => onGo(+b.dataset.p));
  el(prefix + "-prev").onclick = () => onGo(-1, -1);
  el(prefix + "-next").onclick = () => onGo(-1, +1);
}
function marcarPaso(prefix, i, n) {
  document.querySelectorAll(`#m-${prefix} .panel`).forEach((p, k) => p.classList.toggle("on", k === i));
  document.querySelectorAll(`#${prefix}-rail button`).forEach((b, k) => k === i ? b.setAttribute("aria-current", "step") : b.removeAttribute("aria-current"));
  el(prefix + "-prev").disabled = i === 0; el(prefix + "-next").disabled = i === n - 1;
  document.querySelectorAll(`#m-${prefix} > .controls .ctrl[data-pasos]`).forEach(c => { c.style.display = c.dataset.pasos.split(",").map(Number).includes(i) ? "" : "none"; });
  if (!quieto) { const tb = el("tabs"); if (tb) { const y = tb.getBoundingClientRect().top + window.scrollY - 8; window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" }); } }
}
function segmento(id, attr, cb) {
  const e = el(id);
  e.querySelectorAll("button").forEach(b => b.onclick = () => { e.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); cb(b.dataset[attr]); });
}
function pasoGenerico(prefix, n, st, render) {
  return (i, delta) => {
    if (i < 0) i = Math.max(0, Math.min(n - 1, st.paso + delta));
    st.paso = i; marcarPaso(prefix, i, n);
    render(true); tex(document.getElementById("m-" + prefix));
  };
}
function pasoInicial(prefix) { return 0; }  // siempre se entra desde el paso 0
const Hbits = ps => ps.reduce((s, p) => p > 0 ? s - p * log2(p) : s, 0);
const gini = p => 2 * p * (1 - p);
const barras = (items, o = {}) => `<div class="bars">${items.map(it => `<div class="lab ${it.cls || ""}">${it.lab}</div><div class="bar ${it.cls || ""}"><i style="width:${Math.max(0, Math.min(100, 100 * it.v / (o.max || 1)))}%"></i></div><div class="val">${it.txt}</div>`).join("")}</div>`;
const tabla = (cab, filas, cls = "cmp") => `<div class="mwrap"><table class="${cls}"><tr>${cab.map(c => `<th>${c}</th>`).join("")}</tr>${filas.map(r => `<tr class="${r.cls || ""}">${r.c.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></div>`;
// ---- datos
const CRED = DATA.cred, IMP = DATA.imp, RATIOS = DATA.ratios;
const TRAIN = IMP.filter(r => r.conjunto === "entrenamiento"), TEST = IMP.filter(r => r.conjunto === "prueba");
const ATTRS = ["tamano", "deuda", "garantia", "historial"];
const valores = (rows, a) => [...new Set(rows.map(r => r[a]))];
const ORDEN = { tamano: ["pequena", "mediana", "grande"], deuda: ["baja", "media", "alta"], garantia: ["si", "no"], historial: ["bueno", "malo"], paga: ["si", "no"] };
const vals = (rows, a) => (ORDEN[a] || valores(rows, a)).filter(v => rows.some(r => r[a] === v));
function entropiaDe(rows, a) { const vs = vals(rows, a); return Hbits(vs.map(v => rows.filter(r => r[a] === v).length / rows.length)); }
function condicional(rows, a) {
  return vals(rows, a).map(v => { const g = rows.filter(r => r[a] === v); const si = g.filter(r => r.paga === "si").length; return { v, n: g.length, si, no: g.length - si, H: Hbits([si / g.length, 1 - si / g.length]), w: g.length / rows.length }; });
}
function ganancia(rows, a) { const c = condicional(rows, a); const Hc = c.reduce((s, g) => s + g.w * g.H, 0); return { a, Hy: entropiaDe(rows, "paga"), Hc, gan: entropiaDe(rows, "paga") - Hc, Hx: entropiaDe(rows, a), grupos: c }; }
// recorrer árboles anidados (CART, bagging, RF)
function predArbol(t, r) { while (t.hoja === undefined) t = r[t.var] <= t.umbral ? t.izq : t.der; return t.hoja; }
function svgArbol(t, o = {}) {
  // layout simple: hojas equiespaciadas
  const hojas = []; const prof = n => n.hoja !== undefined ? 0 : 1 + Math.max(prof(n.izq), prof(n.der));
  (function rec(n) { if (n.hoja !== undefined) hojas.push(n); else { rec(n.izq); rec(n.der); } })(t);
  const W = o.w || 640, dy = o.dy || 78, H = (prof(t) + 1) * dy + 10, lw = W / hojas.length; let k = 0;
  const pos = new Map();
  (function place(n, d) { if (n.hoja !== undefined) { pos.set(n, { x: lw * (k + 0.5), y: dy * d + 30 }); k++; } else { place(n.izq, d + 1); place(n.der, d + 1); pos.set(n, { x: (pos.get(n.izq).x + pos.get(n.der).x) / 2, y: dy * d + 30 }); } })(t, 0);
  let s = "";
  pos.forEach((p, n) => {
    if (n.hoja === undefined) {
      const a = pos.get(n.izq), b = pos.get(n.der); const hi = o.camino && o.camino.has(n);
      s += `<line x1="${p.x}" y1="${p.y}" x2="${a.x}" y2="${a.y}" class="${hi && o.camino.has(n.izq) ? "hi" : ""}"/><line x1="${p.x}" y1="${p.y}" x2="${b.x}" y2="${b.y}" class="${hi && o.camino.has(n.der) ? "hi" : ""}"/>`;
      s += `<text x="${(p.x + a.x) / 2 - 6}" y="${(p.y + a.y) / 2}" text-anchor="end" class="lab">${o.eIzq ? o.eIzq(n) : "≤"}</text><text x="${(p.x + b.x) / 2 + 6}" y="${(p.y + b.y) / 2}" class="lab">${o.eDer ? o.eDer(n) : ">"}</text>`;
    }
  });
  pos.forEach((p, n) => {
    const hi = o.camino && o.camino.has(n); const hoja = n.hoja !== undefined;
    const txt = hoja ? (o.hoja ? o.hoja(n) : String(n.hoja)) : (o.nodo ? o.nodo(n) : `${nom(n.var)} ≤ ${fmt3(n.umbral)}`);
    const sub = o.sub ? o.sub(n) : "";
    const w = Math.max(70, txt.length * 7 + 16);
    s += `<g class="nd ${hoja ? "hoja c" + n.hoja : ""} ${hi ? "hi" : ""}"><rect x="${p.x - w / 2}" y="${p.y - 15}" width="${w}" height="${sub ? 40 : 30}" rx="6"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle">${txt}</text>${sub ? `<text x="${p.x}" y="${p.y + 19}" text-anchor="middle" class="sub">${sub}</text>` : ""}</g>`;
  });
  return `<svg class="arbol" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">${s}</svg>`;
}
function caminoArbol(t, r) { const c = new Set(); while (true) { c.add(t); if (t.hoja !== undefined) return c; t = r[t.var] <= t.umbral ? t.izq : t.der; } }
// curva SVG genérica
function curva(series, o) {
  const W = o.w || 420, H = o.h || 200, ml = 44, mb = 30, mt = 12, mr = 12;
  const [x0, x1] = o.xr, [y0, y1] = o.yr;
  const X = x => ml + (x - x0) / (x1 - x0) * (W - ml - mr), Y = y => mt + (y1 - y) / (y1 - y0) * (H - mt - mb);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">`;
  const yt = o.yt || [y0, (y0 + y1) / 2, y1], xt = o.xt || [x0, (x0 + x1) / 2, x1];
  yt.forEach(v => s += `<line x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${ml - 6}" y="${Y(v) + 4}" text-anchor="end" class="tick">${o.yf ? o.yf(v) : v}</text>`);
  xt.forEach(v => s += `<text x="${X(v)}" y="${H - 8}" text-anchor="middle" class="tick">${o.xf ? o.xf(v) : v}</text>`);
  if (o.xl) s += `<text x="${(ml + W - mr) / 2}" y="${H - 20}" text-anchor="middle" class="tick" style="font-weight:600">${o.xl}</text>`;
  series.forEach(se => {
    if (se.pts.length > 1) s += `<polyline points="${se.pts.map(p => X(p[0]) + "," + Y(p[1])).join(" ")}" fill="none" stroke="${se.col}" stroke-width="${se.sw || 2.5}" stroke-linejoin="round" ${se.dash ? 'stroke-dasharray="5 4"' : ""}/>`;
    if (se.marks) se.pts.forEach(p => s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="${se.r || 4}" fill="${se.col}"/>`);
    if (se.lab) s += `<text x="${X(se.pts[se.pts.length - 1][0]) - 4}" y="${Y(se.pts[se.pts.length - 1][1]) - 8}" text-anchor="end" style="fill:${se.col};font-size:12px;font-weight:600">${se.lab}</text>`;
  });
  (o.extra || []).forEach(e => { if (e.tipo === "punto") s += `<circle cx="${X(e.x)}" cy="${Y(e.y)}" r="6" fill="var(--cobre)" stroke="var(--surface)" stroke-width="2"/><text x="${X(e.x) + 9}" y="${Y(e.y) - 8}" class="tick" style="fill:var(--cobre);font-weight:600">${e.txt || ""}</text>`; if (e.tipo === "vline") s += `<line x1="${X(e.x)}" x2="${X(e.x)}" y1="${mt}" y2="${H - mb}" stroke="var(--cobre)" stroke-dasharray="4 3"/>`; });
  return s + "</svg>";
}

// ---- MathJax: volver a componer un panel después de cambiar su HTML
function tex(node) { if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([node]).catch(() => { }); }
// ---- generador aleatorio con semilla
function rng32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// ---- árbol CART de clasificación genérico (Gini), devuelve la misma estructura anidada que DATA.d2
function cartClf(rows, depth, feats, minLeaf = 1) {
  const n = rows.length, p1 = rows.reduce((s, r) => s + r.impago, 0) / n;
  const hoja = () => ({ hoja: p1 > 0.5 ? 1 : 0, n: [1 - p1, p1], cnt: n });
  if (depth === 0 || n < 2 * minLeaf || p1 === 0 || p1 === 1) return hoja();
  let best = null;
  for (const f of feats) {
    const ord = rows.slice().sort((a, b) => a[f] - b[f]); let nl = 0, l1 = 0; const tot1 = ord.reduce((s, r) => s + r.impago, 0);
    for (let i = 0; i + 1 < n; i++) {
      nl++; l1 += ord[i].impago; if (ord[i][f] === ord[i + 1][f]) continue; const nr = n - nl, r1 = tot1 - l1; if (nl < minLeaf || nr < minLeaf) continue;
      const g = (nl * gini(l1 / nl) + nr * gini(r1 / nr)) / n; if (!best || g < best.g - 1e-12) best = { g, f, u: (ord[i][f] + ord[i + 1][f]) / 2 };
    }
  }
  if (!best || best.g >= gini(p1) - 1e-12) return hoja();
  const L = rows.filter(r => r[best.f] <= best.u), R = rows.filter(r => r[best.f] > best.u);
  return { var: best.f, umbral: best.u, izq: cartClf(L, depth - 1, feats, minLeaf), der: cartClf(R, depth - 1, feats, minLeaf), n: [1 - p1, p1], cnt: n };
}
// ---- árbol de regresión genérico sobre una variable (varianza como impureza)
function arbolReg(xs, ys, depth, minLeaf = 1) {
  const n = xs.length, m = ys.reduce((s, y) => s + y, 0) / n;
  if (depth === 0 || n < 2 * minLeaf) return { val: m };
  const ord = xs.map((x, i) => i).sort((a, b) => xs[a] - xs[b]); let best = null, nl = 0, sl = 0; const tot = m * n;
  for (let k = 0; k + 1 < n; k++) {
    nl++; sl += ys[ord[k]]; if (xs[ord[k]] === xs[ord[k + 1]]) continue; const nr = n - nl, sr = tot - sl; if (nl < minLeaf || nr < minLeaf) continue;
    const sse = -(sl * sl / nl + sr * sr / nr); if (!best || sse < best.sse - 1e-12) best = { sse, u: (xs[ord[k]] + xs[ord[k + 1]]) / 2 };
  }
  if (!best) return { val: m };
  const li = [], ri = []; xs.forEach((x, i) => (x <= best.u ? li : ri).push(i));
  return { u: best.u, izq: arbolReg(li.map(i => xs[i]), li.map(i => ys[i]), depth - 1, minLeaf), der: arbolReg(ri.map(i => xs[i]), ri.map(i => ys[i]), depth - 1, minLeaf) };
}
const predReg = (t, x) => { while (t.val === undefined) t = x <= t.u ? t.izq : t.der; return t.val; };

// ===================== pestañas =====================
let modeloActual = "ent";
const GOTO = {};
function irModelo(m) {
  modeloActual = m;
  document.querySelectorAll(".modelo").forEach(e => e.classList.toggle("on", e.id === "m-" + m));
  document.querySelectorAll("#tabs button").forEach(b => b.dataset.m === m ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  GOTO[m](ST[m].paso);
}
document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => irModelo(b.dataset.m));
const ST = { ent: { paso: pasoInicial("ent"), p: 0.5, attr: "deuda", forma: "u", n: 60, q: 0.6 }, id3: { paso: pasoInicial("id3") }, cart: { paso: pasoInicial("cart"), ratio: "ventas_deuda", u: 0 }, poda: { paso: pasoInicial("poda"), d: 4 }, bag: { paso: pasoInicial("bag"), emp: 0, tipo: "bag", eps: 0.35, n: 25 }, ada: { paso: pasoInicial("ada"), r: 1 }, gb: { paso: pasoInicial("gb"), r: 6, lr: 0.5 }, imp: { paso: pasoInicial("imp"), sem: 1 }, c5: { paso: pasoInicial("c5"), attr: "deuda", emp: 0, falta: "ventas_deuda", cf: 0.25 } };

// ===================== 01 ENTROPIA =====================
(function () {
  const st = ST.ent;
  function rInfo() {
    const p = st.p, I = -log2(p);
    const pts = []; for (let q = 0.01; q <= 1.0001; q += 0.01) pts.push([q, -log2(q)]);
    el("ent-info").innerHTML = `<div class="block stage"><div class="t">Información según p</div>${curva([{ pts, col: "var(--q)" }], { xr: [0, 1], yr: [0, 7], xt: [0, 0.25, 0.5, 0.75, 1], yt: [0, 2, 4, 6], xf: v => fmt2(v), yf: v => v + " bits", xl: "probabilidad p", extra: [{ tipo: "punto", x: p, y: I, txt: fmt2(I) + " bits" }] })}</div>
    <div class="block stage"><div class="t">Con p = ${fmt2(p)}</div><div class="kpi" style="max-width:none"><div><div class="t">−log₂(p)</div><div class="v">${fmt3(I)} <small>bits</small></div></div></div>
    <p style="font-size:.92rem">Referencias: una moneda (p = 0,5) informa 1 bit; un dado (p = 1/6) 2,58 bits; sacar un as (p = 1/13) 3,70 bits; un evento seguro (p = 1) 0 bits.</p></div>
    <div class="block stage"><div class="t">Por qué suma</div><p style="font-size:.92rem">Dos monedas: p = 0,25, información 2 bits = 1 + 1. Con cualquier otra función de p, la información de eventos independientes no sumaría. El logaritmo es la única que lo hace.</p></div>`;
  }
  function rH(anim) {
    const g = condicional(CRED, "paga"); // no se usa; entropia de paga
    const si = CRED.filter(r => r.paga === "si").length, n = CRED.length, Hy = Hbits([si / n, 1 - si / n]);
    const pts = []; for (let q = 0.005; q < 1; q += 0.01) pts.push([q, Hbits([q, 1 - q])]);
    const items = [{ lab: "paga", v: Hy, txt: fmt3(Hy), cls: "pred" }].concat(ATTRS.map(a => ({ lab: nom(a), v: entropiaDe(CRED, a), txt: fmt3(entropiaDe(CRED, a)) })));
    el("ent-h").innerHTML = `<div class="block stage"><div class="t">La variable objetivo: paga</div>${tabla(["valor", "empresas", "p", "−p·log₂p"], [["si", si], ["no", n - si]].map(([v, c]) => ({ c: [v, c, fmt3(c / n), fmt3(-c / n * log2(c / n))] })).concat([{ c: ["<b>H(paga)</b>", n, "1", "<b>" + fmt3(Hy) + "</b>"] }]))}</div>
    <div class="block stage"><div class="t">H para dos valores según p</div>${curva([{ pts, col: "var(--q)" }], { xr: [0, 1], yr: [0, 1], xt: [0, 0.5, 1], yt: [0, 0.5, 1], xf: fmt2, yf: fmt2, xl: "p(si)", extra: [{ tipo: "punto", x: si / n, y: Hy, txt: "paga: " + fmt3(Hy) }] })}</div>
    <div class="block stage"><div class="t">Entropía de cada columna de la tabla</div>${barras(items, { max: 1.6 })}<p style="font-size:.88rem;color:var(--muted)">Con tres valores (tamaño, deuda) el máximo es log₂ 3 = 1,585 bits; con dos, 1 bit.</p></div>`;
    el("ent-h-nota").innerHTML = `<b>Cómo leerlo.</b> ${si} de ${n} empresas pagan: p(si) = ${fmt3(si / n)}. H(paga) = ${fmt3(Hy)} bits, casi el máximo de 1 bit: adivinar si una empresa paga es casi una moneda. Cada pregunta que hagamos debería bajar ese número.`;
    if (anim) stagger(el("ent-s1"));
  }
  function rCond(anim) {
    const g = ganancia(CRED, st.attr);
    el("ent-cond").innerHTML = g.grupos.map(gr => `<div class="block stage"><div class="t">${nom(st.attr)} = <b>${gr.v}</b></div><div class="kpi" style="max-width:none;grid-template-columns:1fr 1fr"><div><div class="t">empresas</div><div class="v">${gr.n} <small>${gr.si} si · ${gr.no} no</small></div></div><div><div class="t">H del grupo</div><div class="v">${fmt3(gr.H)}</div></div></div><p style="font-size:.88rem;color:var(--muted);margin-top:6px">peso ${gr.n}/${CRED.length} = ${fmt3(gr.w)} · aporta ${fmt3(gr.w * gr.H)}</p></div>`).join("") +
      `<div class="block stage" style="border-color:var(--cobre)"><div class="t">Resultado</div>${barras([{ lab: "H(paga)", v: g.Hy, txt: fmt3(g.Hy) }, { lab: "H(paga | " + nom(st.attr) + ")", v: g.Hc, txt: fmt3(g.Hc), cls: "pred" }, { lab: "ganancia", v: g.gan, txt: fmt3(g.gan), cls: "real" }], { max: 1 })}</div>`;
    el("ent-cond-nota").innerHTML = `<b>Cómo se calcula.</b> H(paga | ${nom(st.attr)}) = ${g.grupos.map(gr => `${fmt3(gr.w)} × ${fmt3(gr.H)}`).join(" + ")} = ${fmt3(g.Hc)}. Ganancia = ${fmt3(g.Hy)} − ${fmt3(g.Hc)} = <b>${fmt3(g.gan)} bits</b>. ${g.gan > 0.25 ? "Preguntar por la deuda deja casi un tercio menos de incertidumbre: es la mejor pregunta." : g.gan < 0.02 ? "Casi nada: los grupos quedan tan mezclados como la tabla entera." : "Ayuda, pero menos que la deuda."}`;
    if (anim) stagger(el("ent-s2"));
  }
  function rGan(anim) {
    const gs = ATTRS.map(a => ganancia(CRED, a)); const Hid = log2(CRED.length), Hy = gs[0].Hy;
    el("ent-gan").innerHTML = `<div class="block stage"><div class="t">Ganancia de cada atributo</div>${barras(gs.map(g => ({ lab: nom(g.a), v: g.gan, txt: fmt3(g.gan), cls: g.gan === Math.max(...gs.map(x => x.gan)) ? "real" : "" })), { max: 0.35 })}</div>
    <div class="block stage"><div class="t">Gain ratio = ganancia / H(atributo)</div>${tabla(["atributo", "ganancia", "H(atributo)", "gain ratio"], gs.map(g => ({ c: [nom(g.a), fmt3(g.gan), fmt3(g.Hx), fmt3(g.gan / g.Hx)] })).concat([{ c: ["<i>id de la empresa</i>", fmt3(Hy), fmt3(Hid), fmt3(Hy / Hid)], cls: "hi" }]))}</div>`;
    if (anim) stagger(el("ent-s3"));
  }
  function simular(forma, n) {
    const r = rng32(11 + n); const xs = [], ys = [];
    for (let i = 0; i < n; i++) { const x = r(); const e = (r() + r() + r() - 1.5) * 0.16; let y; if (forma === "lineal") y = 0.3 + 0.55 * x + e; else if (forma === "u") y = 0.1 + 0.9 * (x - 0.35) * (x - 0.35) + e; else y = 0.2 + 0.6 * r() + e; xs.push(x); ys.push(y); }
    return { xs, ys };
  }
  const media = a => a.reduce((s, x) => s + x, 0) / a.length;
  const varianza = a => { const m = media(a); return media(a.map(x => (x - m) ** 2)); };
  function correl(xs, ys) { const mx = media(xs), my = media(ys); let sxy = 0, sxx = 0, syy = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; }); return sxy / Math.sqrt(sxx * syy); }
  function clases(a, k) { const lo = Math.min(...a), hi = Math.max(...a); return a.map(x => Math.min(k - 1, Math.floor((x - lo) / (hi - lo) * k))); }
  function infoMutua(xs, ys, k) {
    const cx = clases(xs, k), cy = clases(ys, k), n = xs.length; const J = [...Array(k)].map(() => Array(k).fill(0)); cx.forEach((a, i) => J[a][cy[i]]++);
    const px = J.map(r => r.reduce((s, v) => s + v, 0) / n), py = [...Array(k)].map((_, j) => J.reduce((s, r) => s + r[j], 0) / n); let I = 0;
    J.forEach((r, a) => r.forEach((c, b) => { if (c) I += c / n * log2((c / n) / (px[a] * py[b])); }));
    return { I, J, px, py, Hy: Hbits(py), Hx: Hbits(px) };
  }
  function rVar(anim) {
    const { xs, ys } = simular(st.forma, st.n); const k = 3; const rho = correl(xs, ys), mi = infoMutua(xs, ys, k);
    const W = 420, H = 300; const lo = a => Math.min(...a), hi = a => Math.max(...a); const xl = lo(xs), xh = hi(xs), yl = lo(ys), yh = hi(ys);
    const X = x => 40 + (x - xl) / (xh - xl) * (W - 52), Y = y => 12 + (yh - y) / (yh - yl) * (H - 44);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">`;
    for (let i = 1; i < k; i++) { const gx = xl + (xh - xl) * i / k, gy = yl + (yh - yl) * i / k; s += `<line x1="${X(gx)}" x2="${X(gx)}" y1="12" y2="${H - 32}" class="grid" stroke-dasharray="4 3"/><line x1="40" x2="${W - 12}" y1="${Y(gy)}" y2="${Y(gy)}" class="grid" stroke-dasharray="4 3"/>`; }
    mi.J.forEach((r, a) => r.forEach((c, b) => { s += `<text x="${X(xl + (xh - xl) * (a + 0.5) / k)}" y="${Y(yl + (yh - yl) * (b + 0.5) / k) + 4}" text-anchor="middle" class="tick" style="font-size:18px;fill:var(--cobre);opacity:.55;font-weight:600">${c}</text>`; }));
    xs.forEach((x, i) => s += `<circle cx="${X(x)}" cy="${Y(ys[i])}" r="3.5" fill="var(--q)" opacity=".65"/>`);
    s += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" class="tick" style="font-weight:600">X</text><text transform="translate(12 ${H / 2}) rotate(-90)" text-anchor="middle" class="tick" style="font-weight:600">Y</text></svg>`;
    const ref = { lineal: "recta", u: "U", azar: "azar" }[st.forma];
    el("ent-var").innerHTML = `<div class="block stage"><div class="t">${st.n} empresas simuladas, relación en forma de ${ref} (la cuadrícula: 3 clases por variable; el número, cuántas caen en cada celda)</div>${s}</div>
    <div class="block stage"><div class="t">Las dos medidas</div><div class="kpi" style="max-width:none;grid-template-columns:1fr 1fr"><div><div class="t">correlación de Pearson</div><div class="v">${fmt3(rho)}</div></div><div><div class="t">información mutua I(X; Y)</div><div class="v" style="color:var(--cobre)">${fmt3(mi.I)} <small>bits</small></div></div><div><div class="t">H(Y) con 3 clases</div><div class="v">${fmt3(mi.Hy)}</div></div><div><div class="t">fracción de H(Y) que explica X</div><div class="v">${pct0(mi.I / mi.Hy)}</div></div></div>
    ${tabla(["", "X", "Y"], [{ c: ["promedio", fmt3(media(xs)), fmt3(media(ys))] }, { c: ["varianza", fmt4(varianza(xs)), fmt4(varianza(ys))] }, { c: ["desviación estándar", fmt3(Math.sqrt(varianza(xs))), fmt3(Math.sqrt(varianza(ys)))] }, { c: ["entropía (3 clases)", fmt3(mi.Hx) + " bits", fmt3(mi.Hy) + " bits"] }], "cmp small")}</div>`;
    const lect = { lineal: "Una recta: las dos medidas la ven. La correlación es casi 1 y la información mutua es alta (con 3 clases el máximo posible es log₂ 3 = 1,585 bits).",
      u: `Una U: la correlación queda cerca de cero porque la mitad que sube cancela a la mitad que baja, pero la información mutua es claramente mayor que la del azar: saber X sí dice mucho de Y. Un árbol la encuentra con dos cortes en X; una regresión lineal sobre X no ve nada.`,
      azar: "Sin relación: la correlación oscila cerca de cero y la información mutua también, aunque nunca es exactamente cero: con pocas empresas los conteos de las 9 celdas tienen ruido. Sube el número de empresas y mira cómo baja. Ese es el piso contra el que hay que comparar las otras dos formas." };
    el("ent-var-nota").innerHTML = `<b>Lectura.</b> ${lect[st.forma]}`;
    const dist = [["constante", "0", "0"], ["moneda justa (0 o 1)", "1", "0,25"], ["moneda cargada (0,9 / 0,1)", "0,469", "0,09"], ["dado justo (1 a 6)", "2,585", "2,917"], ["tres clases iguales (1, 2, 3)", "1,585", "0,667"], ["tres clases iguales (10, 20, 30)", "1,585", "66,667"]];
    const dn = [["constante", 0, 0], ["moneda justa", 1, 0.25], ["moneda cargada", 0.469, 0.09], ["dado", 2.585, 2.917], ["clases 1, 2, 3", 1.585, 0.667], ["clases 10, 20, 30", 1.585, 66.667]];
    el("ent-dist").innerHTML = `<div class="block stage"><div class="t">Entropía y varianza en distribuciones conocidas</div>${tabla(["distribución", "entropía (bits)", "varianza"], dist.map(d => ({ c: d })), "cmp small")}</div>
    <div class="block stage"><div class="t">Las mismas seis, como barras</div>${barras(dn.map(d => ({ lab: d[0], v: d[1], txt: fmt2(d[1]) + " bits" })), { max: 2.7 })}<div style="height:8px"></div>${barras(dn.map(d => ({ lab: d[0], v: Math.log10(1 + d[2]), txt: fmt2(d[2]), cls: "pred" })), { max: 2 })}<p style="font-size:.8rem;color:var(--muted)">Arriba la entropía; abajo la varianza en escala logarítmica, porque la última barra vale 100 veces la anterior.</p><p style="font-size:.88rem;color:var(--muted);max-width:52ch">La entropía solo mira las probabilidades: 1-2-3 y 10-20-30 valen lo mismo. La varianza mira los valores y sus unidades: se multiplica por 100. Por eso la entropía sirve para variables sin números (paga sí/no, tamaño chico/mediano/grande), donde la varianza no tiene sentido, y por eso un árbol de clasificación usa entropía o Gini donde uno de regresión usa varianza: como impureza que un buen corte reduce.</p></div>`;
    if (anim) stagger(el("ent-s4"));
  }
  function rCruz(anim) {
    const si = CRED.filter(r => r.paga === "si").length, n = CRED.length, p = si / n, Hp = Hbits([p, 1 - p]);
    const Hpq = q => -p * log2(q) - (1 - p) * log2(1 - q); const q = st.q;
    const pts = []; for (let x = 0.02; x <= 0.98; x += 0.01) pts.push([x, Hpq(x)]);
    const modelos = [["A: bien calibrado", 0.6], ["B: demasiado seguro", 0.95], ["C: no se moja", 0.5], ["el tuyo", q]];
    el("ent-cruz").innerHTML = `<div class="block stage"><div class="t">Sorpresa que paga el modelo según lo que cree</div>${curva([{ pts, col: "var(--q)" }, { pts: [[0.02, Hp], [0.98, Hp]], col: "var(--v)", dash: true, lab: "H(p) = " + fmt3(Hp) }], { xr: [0, 1], yr: [0.8, 3], xt: [0, 0.25, 0.5, 0.75, 1], yt: [1, 2, 3], xf: fmt2, yf: v => v + " bits", xl: "q(paga = sí) que cree el modelo", extra: [{ tipo: "punto", x: q, y: Hpq(q), txt: fmt3(Hpq(q)) }] })}</div>
    <div class="block stage"><div class="t">Realidad: ${si} de ${n} pagan, p = ${fmt3(p)}</div>${tabla(["modelo", "q(sí)", "H(p, q)", "KL(p ‖ q)"], modelos.map(([nm, qq]) => ({ c: [nm, fmt2(qq), fmt3(Hpq(qq)), fmt3(Hpq(qq) - Hp)], cls: nm === "el tuyo" ? "hi" : "" })))}</div>`;
    el("ent-cruz-nota").innerHTML = `<b>Lectura.</b> El mínimo de la curva está en q = p = ${fmt3(p)}, donde H(p, q) = H(p) = ${fmt3(Hp)} bits. ${q > 0.9 ? "Un modelo demasiado seguro paga carísimo cuando se equivoca: la sorpresa de −log₂(0,05) es 4,3 bits." : Math.abs(q - p) < 0.05 ? "Tu modelo cree casi lo correcto y casi no paga de más." : "Alejarse de p en cualquier dirección cuesta, y cuesta más rápido hacia los extremos."} En la práctica, la pérdida de un clasificador es esta cantidad promediada sobre todas las empresas, con p = [1, 0] o [0, 1] para cada una.`;
    if (anim) stagger(el("ent-s5"));
  }
  el("ent-q").oninput = e => { st.q = +e.target.value / 100; el("ent-q-v").textContent = fmt2(st.q); if (st.paso === 5) rCruz(false); };
  function render(anim) { [rInfo, rH, rCond, rGan, rVar, rCruz][st.paso](anim); if (st.paso === 0 && anim) stagger(el("ent-s0")); }
  segmento("ent-forma", "f", f => { st.forma = f; if (st.paso === 4) rVar(true); });
  el("ent-n").oninput = e => { st.n = +e.target.value; el("ent-n-v").textContent = st.n; if (st.paso === 4) rVar(false); };
  el("ent-p").oninput = e => { st.p = +e.target.value / 100; el("ent-p-v").textContent = fmt2(st.p); if (st.paso === 0) rInfo(); };
  el("ent-attr").onchange = e => { st.attr = e.target.value; if (st.paso === 2) rCond(true); };
  el("ent-replay").onclick = () => render(true);
  GOTO.ent = pasoGenerico("ent", 6, st, render);
  stepper("ent", ["Información", "Entropía", "Condicional y ganancia", "Gain ratio", "Varianza y correlación", "Entropía cruzada"], GOTO.ent);
})();

// ===================== 02 ID3 =====================
(function () {
  const st = ST.id3;
  function id3(rows, attrs) {
    const si = rows.filter(r => r.paga === "si").length;
    if (si === rows.length) return { hoja: "si", n: rows.length };
    if (si === 0) return { hoja: "no", n: rows.length };
    if (!attrs.length) return { hoja: si >= rows.length / 2 ? "si" : "no", n: rows.length };
    const gs = attrs.map(a => ganancia(rows, a)); const best = gs.reduce((b, g) => g.gan > b.gan + 1e-12 ? g : b, gs[0]);
    const ramas = {}; vals(rows, best.a).forEach(v => ramas[v] = id3(rows.filter(r => r[best.a] === v), attrs.filter(a => a !== best.a)));
    return { var: best.a, ramas, gs, n: rows.length };
  }
  const ARBOL = id3(CRED, ATTRS);
  function svgId3(t, camino) {
    const hojas = []; (function rec(n) { if (n.hoja) hojas.push(n); else Object.values(n.ramas).forEach(rec); })(t);
    const W = 640, dy = 90, lw = W / hojas.length; let k = 0; const pos = new Map();
    (function place(n, d) { if (n.hoja) { pos.set(n, { x: lw * (k + 0.5), y: dy * d + 30 }); k++; } else { const xs = Object.values(n.ramas).map(c => { place(c, d + 1); return pos.get(c).x; }); pos.set(n, { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: dy * d + 30 }); } })(t, 0);
    let s = "";
    pos.forEach((p, n) => { if (!n.hoja) Object.entries(n.ramas).forEach(([v, c]) => { const q = pos.get(c); const hi = camino.has(n) && camino.has(c); s += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" class="${hi ? "hi" : ""}"/><text x="${(p.x + q.x) / 2}" y="${(p.y + q.y) / 2 + 4}" text-anchor="middle" class="lab" style="paint-order:stroke;stroke:var(--surface);stroke-width:6px">${v}</text>`; }); });
    pos.forEach((p, n) => { const txt = n.hoja ? `paga: ${n.hoja}` : `¿${nom(n.var)}?`; const w = Math.max(80, txt.length * 8 + 16); s += `<g class="nd ${n.hoja ? "hoja c" + (n.hoja === "si" ? 0 : 1) : ""} ${camino.has(n) ? "hi" : ""}"><rect x="${p.x - w / 2}" y="${p.y - 15}" width="${w}" height="40" rx="6"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle">${txt}</text><text x="${p.x}" y="${p.y + 19}" text-anchor="middle" class="sub">${n.n} empresas</text></g>`; });
    return `<svg class="arbol" viewBox="0 0 ${W} ${(2 + 1) * dy + 20}" width="100%" style="max-width:${W}px">${s}</svg>`;
  }
  function nueva() { return { tamano: el("id3-tam").value, deuda: el("id3-deu").value, garantia: el("id3-gar").value, historial: el("id3-his").value }; }
  function rTabla(anim) {
    el("id3-tabla").innerHTML = tabla(["#", ...ATTRS.map(nom), "paga"], CRED.map((r, i) => ({ c: [i + 1, ...ATTRS.map(a => r[a]), `<b style="color:${r.paga === "si" ? "var(--ok)" : "var(--bad)"}">${r.paga}</b>`] })));
    if (anim) stagger(el("id3-s0"));
  }
  function rRaiz(anim) {
    const gs = ARBOL.gs;
    el("id3-raiz").innerHTML = `<div class="block stage"><div class="t">Ganancia sobre las 14 empresas</div>${barras(gs.map(g => ({ lab: nom(g.a), v: g.gan, txt: fmt3(g.gan) + " bits", cls: g.a === ARBOL.var ? "real" : "" })), { max: 0.35 })}</div><div class="block stage" style="border-color:var(--cobre)"><div class="t">Raíz</div><div class="kpi" style="max-width:none"><div><div class="t">primera pregunta</div><div class="v">¿${nom(ARBOL.var)}?</div></div></div></div>`;
    if (anim) stagger(el("id3-s1"));
  }
  function rRamas(anim) {
    el("id3-ramas").innerHTML = Object.entries(ARBOL.ramas).map(([v, c]) => {
      const rows = CRED.filter(r => r[ARBOL.var] === v); const si = rows.filter(r => r.paga === "si").length;
      const cuerpo = c.hoja ? `<p style="font-size:.92rem"><b style="color:var(--ok)">Grupo puro: ${si} de ${rows.length} pagan.</b> Es una hoja: paga = ${c.hoja}.</p>` :
        barras(c.gs.map(g => ({ lab: nom(g.a), v: g.gan, txt: fmt3(g.gan), cls: g.a === c.var ? "real" : "" })), { max: 1 }) + `<p style="font-size:.92rem">Gana <b>${nom(c.var)}</b>; sus ramas quedan puras y son hojas.</p>`;
      return `<div class="block stage" style="flex:1 1 260px"><div class="t">${nom(ARBOL.var)} = <b>${v}</b> · ${rows.length} empresas (${si} si, ${rows.length - si} no)</div>${tabla(["#", ...ATTRS.filter(a => a !== ARBOL.var).map(nom), "paga"], rows.map(r => ({ c: [CRED.indexOf(r) + 1, ...ATTRS.filter(a => a !== ARBOL.var).map(a => r[a]), r.paga] })), "cmp small")}${cuerpo}</div>`;
    }).join("");
    if (anim) stagger(el("id3-s2"));
  }
  function rArbol(anim) {
    const e = nueva(); const camino = new Set(); const pasos = []; let t = ARBOL;
    while (!t.hoja) { camino.add(t); pasos.push(`¿${nom(t.var)}? <b>${e[t.var]}</b>`); t = t.ramas[e[t.var]]; }
    camino.add(t);
    el("id3-arbol").innerHTML = svgId3(ARBOL, camino);
    el("id3-nueva").innerHTML = `<div class="tira" style="flex-direction:column">${pasos.map(p => `<div class="stage">${p}</div>`).join("")}<div class="stage sel"><b style="font-size:1.1rem;color:${t.hoja === "si" ? "var(--ok)" : "var(--bad)"}">paga: ${t.hoja}</b></div></div><p style="font-size:.88rem;color:var(--muted)">Nota que el tamaño (${e.tamano}) no se usa: el árbol lo descartó.</p>`;
    if (anim) stagger(el("id3-s3"));
  }
  function render(anim) { [rTabla, rRaiz, rRamas, rArbol][st.paso](anim); }
  ["id3-tam", "id3-deu", "id3-gar", "id3-his"].forEach(id => el(id).onchange = () => { if (st.paso === 3) rArbol(true); });
  el("id3-replay").onclick = () => render(true);
  GOTO.id3 = pasoGenerico("id3", 4, st, render);
  stepper("id3", ["Los datos", "La raíz", "Las ramas", "El árbol"], GOTO.id3);
})();

// ===================== 03 CART =====================
(function () {
  const st = ST.cart;
  const sel = el("cart-ratio"); sel.innerHTML = RATIOS.map(r => `<option value="${r}">${nom(r)}</option>`).join(""); sel.value = st.ratio;
  const y = TRAIN.map(r => r.impago); const n = TRAIN.length, p0 = y.reduce((a, b) => a + b) / n;
  function cortes(ratio) {
    const xs = [...new Set(TRAIN.map(r => r[ratio]))].sort((a, b) => a - b); const out = [];
    for (let i = 0; i + 1 < xs.length; i++) { const u = (xs[i] + xs[i + 1]) / 2; out.push({ u, ...giniCorte(ratio, u) }); }
    return out;
  }
  function giniCorte(ratio, u) {
    let nl = 0, l1 = 0, nr = 0, r1 = 0;
    TRAIN.forEach(r => { if (r[ratio] <= u) { nl++; l1 += r.impago; } else { nr++; r1 += r.impago; } });
    const gl = nl ? gini(l1 / nl) : 0, gr = nr ? gini(r1 / nr) : 0;
    return { nl, l1, nr, r1, gl, gr, G: (nl * gl + nr * gr) / n };
  }
  const rango = ratio => { const xs = TRAIN.map(r => r[ratio]); return [Math.min(...xs), Math.max(...xs)]; };
  const uDe = v => { const [a, b] = rango(st.ratio); return a + (b - a) * v / 1000; };
  const mejor = ratio => cortes(ratio).reduce((b, c) => c.G < b.G - 1e-12 ? c : b);
  st.conj = "todas";
  function rDatos(anim) {
    const filas = st.conj === "todas" ? IMP : IMP.filter(r => r.conjunto === st.conj);
    const n1 = filas.filter(r => r.impago).length;
    el("cart-datos").innerHTML = `<div class="kpi stage" style="flex:1 1 100%;max-width:none;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><div><div class="t">empresas</div><div class="v">${filas.length}</div></div><div><div class="t">en impago</div><div class="v">${n1} <small>(${pct0(n1 / filas.length)})</small></div></div><div><div class="t">entrenamiento</div><div class="v">${TRAIN.length}</div></div><div><div class="t">prueba</div><div class="v">${TEST.length}</div></div></div>
    <div class="block stage" style="flex:1 1 100%"><div class="t">${st.conj === "todas" ? "Las 219 empresas" : "Empresas de " + st.conj}</div><div class="mwrap" style="max-height:420px;overflow-y:auto">${tabla(["#", ...RATIOS.map(nom), "conjunto", "impago"], filas.map((r, i) => ({ c: [i + 1, ...RATIOS.map(k => fmt3(r[k])), r.conjunto, `<b style="color:${r.impago ? "var(--bad)" : "var(--ok)"}">${r.impago}</b>`] })), "cmp small")}</div></div>`;
    if (anim) stagger(el("cart-s0"));
  }
  el("cart-datos-conj").querySelectorAll("button").forEach(b => b.onclick = () => { st.conj = b.dataset.c; el("cart-datos-conj").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); rDatos(false); });
  function rGini(anim) {
    const pts = []; for (let q = 0; q <= 1.0001; q += 0.02) pts.push([q, gini(q)]); const pe = []; for (let q = 0.005; q < 1; q += 0.01) pe.push([q, Hbits([q, 1 - q]) / 2]);
    el("cart-gini").innerHTML = `<div class="block stage"><div class="t">Gini y entropía (a escala) según p</div>${curva([{ pts, col: "var(--cobre)", lab: "Gini" }, { pts: pe, col: "var(--q)", dash: true, lab: "entropía / 2" }], { xr: [0, 1], yr: [0, 0.55], xt: [0, 0.5, 1], yt: [0, 0.25, 0.5], xf: fmt2, yf: fmt2, xl: "p (fracción de impago)", extra: [{ tipo: "punto", x: p0, y: gini(p0), txt: "raíz: " + fmt3(gini(p0)) }] })}</div>
    <div class="block stage"><div class="t">La raíz, antes de cortar</div><div class="kpi" style="max-width:none;grid-template-columns:1fr 1fr"><div><div class="t">entrenamiento</div><div class="v">${n} <small>empresas</small></div></div><div><div class="t">impago</div><div class="v">${pct(p0)}</div></div><div><div class="t">Gini de la raíz</div><div class="v">${fmt3(gini(p0))}</div></div><div><div class="t">prueba</div><div class="v">${TEST.length} <small>empresas</small></div></div></div><p style="font-size:.88rem;color:var(--muted)">Los cinco ratios: ${RATIOS.map(r => `<b>${nom(r)}</b> (${DATA.desc[r]})`).join("; ")}.</p></div>`;
    if (anim) stagger(el("cart-s1"));
  }
  function rCorte(anim) {
    const ratio = st.ratio, u = uDe(st.u), c = giniCorte(ratio, u), cs = cortes(ratio), b = mejor(ratio); const [a0, a1] = rango(ratio);
    el("cart-u-v").textContent = fmt3(u);
    // tira 1D
    const W = 640, H = 90; const X = x => 10 + (x - a0) / (a1 - a0) * (W - 20);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" class="chart"><rect x="10" y="20" width="${X(u) - 10}" height="50" fill="var(--cobre)" opacity=".08"/>`;
    TRAIN.forEach((r, i) => { s += `<circle cx="${X(r[ratio])}" cy="${r.impago ? 33 + ((i * 7) % 5) * 2.5 : 52 + ((i * 7) % 5) * 2.5}" r="3.2" fill="${r.impago ? "var(--cobre)" : "var(--q)"}" opacity=".75"/>`; });
    s += `<line x1="${X(u)}" x2="${X(u)}" y1="14" y2="76" stroke="var(--ink)" stroke-width="2"/><text x="14" y="34" class="tick" style="fill:var(--cobre)">impago</text><text x="14" y="62" class="tick" style="fill:var(--q)">paga</text><text x="${X(u)}" y="88" text-anchor="middle" class="tick">u = ${fmt3(u)}</text></svg>`;
    const pts = cs.map(x => [x.u, x.G]);
    el("cart-corte").innerHTML = `<div class="block stage" style="flex:1 1 100%"><div class="t">${nom(ratio)} en las ${n} empresas de entrenamiento (izquierda: ≤ u)</div>${s}</div>
    <div class="block stage"><div class="t">A cada lado del umbral</div>${tabla(["lado", "n", "impagos", "p", "Gini"], [{ c: ["≤ " + fmt3(u), c.nl, c.l1, c.nl ? fmt3(c.l1 / c.nl) : "", fmt3(c.gl)] }, { c: ["> " + fmt3(u), c.nr, c.r1, c.nr ? fmt3(c.r1 / c.nr) : "", fmt3(c.gr)] }])}<div class="kpi" style="max-width:none"><div><div class="t">Gini ponderado G(u)</div><div class="v">${fmt3(c.G)}</div></div><div><div class="t">mejor de este ratio</div><div class="v">${fmt3(b.G)} <small>en ${fmt3(b.u)}</small></div></div></div></div>
    <div class="block stage"><div class="t">G(u) para todos los umbrales candidatos</div>${curva([{ pts, col: "var(--q)" }], { xr: [a0, a1], yr: [0.3, 0.5], xt: [a0, (a0 + a1) / 2, a1], yt: [0.3, 0.4, 0.5], xf: fmt2, yf: fmt2, xl: nom(ratio), extra: [{ tipo: "vline", x: u }, { tipo: "punto", x: b.u, y: b.G, txt: "mínimo" }] })}</div>`;
    el("cart-corte-nota").innerHTML = `<b>Lectura.</b> Con u = ${fmt3(u)}: G = (${c.nl} × ${fmt3(c.gl)} + ${c.nr} × ${fmt3(c.gr)}) / ${n} = ${fmt3(c.G)}, contra ${fmt3(gini(p0))} sin cortar. ${Math.abs(u - b.u) < 1e-9 ? "Este es el mejor corte del ratio." : "El mejor umbral de " + nom(ratio) + " es " + fmt3(b.u) + " (G = " + fmt3(b.G) + ")."} Hay ${cs.length} umbrales candidatos: los puntos medios entre valores consecutivos.`;
    if (anim) stagger(el("cart-s2"));
  }
  function rMejores(anim) {
    const ms = RATIOS.map(r => ({ r, ...mejor(r) })); const best = ms.reduce((b, m) => m.G < b.G ? m : b);
    el("cart-mejores").innerHTML = `<div class="block stage"><div class="t">Mejor corte por ratio (Gini de la raíz: ${fmt3(gini(p0))})</div>${tabla(["ratio", "umbral", "n ≤", "impago ≤", "n >", "impago >", "Gini ponderado"], ms.map(m => ({ c: [nom(m.r), fmt3(m.u), m.nl, pct0(m.l1 / m.nl), m.nr, pct0(m.r1 / m.nr), (m === best ? "<b>" : "") + fmt3(m.G) + (m === best ? "</b>" : "")], cls: m === best ? "hi" : "" })))}</div>
    <div class="block stage"><div class="t">Mejora de impureza</div>${barras(ms.map(m => ({ lab: nom(m.r), v: gini(p0) - m.G, txt: fmt3(gini(p0) - m.G), cls: m === best ? "real" : "" })), { max: 0.12 })}</div>`;
    if (anim) stagger(el("cart-s3"));
  }
  function rArbol(anim) {
    const t = DATA.d2; const acc = rows => rows.filter(r => predArbol(t, r) === r.impago).length / rows.length;
    const cm = [[0, 0], [0, 0]]; TEST.forEach(r => cm[r.impago][predArbol(t, r)]++);
    el("cart-arbol").innerHTML = `<div class="block stage" style="flex:1 1 100%"><div class="t">Árbol CART de profundidad 2 (hojas: clase, fracción de impago en entrenamiento)</div>${svgArbol(t, { hoja: nd => nd.hoja ? "impago" : "paga", sub: nd => "impago " + pct0(nd.n[1]) })}</div>
    <div class="kpi stage" style="flex:1 1 300px"><div><div class="t">acierto entrenamiento</div><div class="v">${pct(acc(TRAIN))}</div></div><div><div class="t">acierto prueba</div><div class="v" style="color:var(--cobre)">${pct(acc(TEST))}</div></div><div><div class="t">predecir siempre "paga"</div><div class="v">${pct(TEST.filter(r => !r.impago).length / TEST.length)} <small>en prueba</small></div></div></div>
    <div class="block stage"><div class="t">Matriz de confusión (prueba)</div>${tabla(["real \\ predicho", "paga", "impago"], [{ c: ["paga", cm[0][0], cm[0][1]] }, { c: ["impago", cm[1][0], cm[1][1]] }])}<p style="font-size:.88rem;color:var(--muted)">De ${cm[1][0] + cm[1][1]} impagos reales detecta ${cm[1][1]}; de ${cm[0][0] + cm[0][1]} que pagan, acusa ${cm[0][1]} sin razón.</p></div>`;
    if (anim) stagger(el("cart-s4"));
  }
  function render(anim) { [rDatos, rGini, rCorte, rMejores, rArbol][st.paso](anim); }
  sel.onchange = e => { st.ratio = e.target.value; st.u = 500; el("cart-u").value = 500; if (st.paso === 2) rCorte(true); };
  el("cart-u").oninput = e => { st.u = +e.target.value; if (st.paso === 2) rCorte(false); };
  el("cart-best").onclick = () => { const b = mejor(st.ratio), [a0, a1] = rango(st.ratio); st.u = Math.round((b.u - a0) / (a1 - a0) * 1000); el("cart-u").value = st.u; if (st.paso !== 2) GOTO.cart(2); else rCorte(true); };
  el("cart-replay").onclick = () => render(true);
  st.u = 500;
  GOTO.cart = pasoGenerico("cart", 5, st, render);
  stepper("cart", ["Los datos", "Gini", "Buscar el corte", "Mejor por ratio", "El árbol"], GOTO.cart);
})();

// ===================== 04 PODA =====================
(function () {
  const st = ST.poda; const N = DATA.d4;
  // recorrido por nivel: nodo de cada empresa en cada profundidad
  function nodoEn(r, d) { let k = 0; for (let i = 0; i < d; i++) { const nd = N[k]; if (nd.izq === null) break; k = r[nd.var] <= nd.umbral ? nd.izq : nd.der; } return k; }
  const cuentas = N.map(() => ({ n: 0, n1: 0 }));
  TRAIN.forEach(r => { for (let d = 0; d <= 4; d++) { const k = nodoEn(r, d); if (d === 0 || N[k].prof === d) { cuentas[k].n++; cuentas[k].n1 += r.impago; } } });
  const clase = k => cuentas[k].n1 > cuentas[k].n - cuentas[k].n1 ? 1 : 0;
  const acc = (rows, d) => rows.filter(r => clase(nodoEn(r, d)) === r.impago).length / rows.length;
  const hojasA = d => N.filter(nd => nd.prof === d || (nd.prof < d && nd.izq === null)).length;
  const CURVA = [0, 1, 2, 3, 4].map(d => ({ d, tr: acc(TRAIN, d), te: acc(TEST, d), h: hojasA(d) }));

  st.k = 5; st.semilla = 1;
  const ARBOL_FULL = cartClf(TRAIN, 2, RATIOS);
  function quitar(k, semilla) { const r = rng32(1000 + semilla); const idx = TRAIN.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } const fuera = new Set(idx.slice(0, k)); return TRAIN.filter((_, i) => !fuera.has(i)); }
  function rInest(anim) {
    const sub = quitar(st.k, st.semilla), t2 = cartClf(sub, 2, RATIOS);
    const cuenta = {}; for (let s = 1; s <= 30; s++) { const t = cartClf(quitar(st.k, s), 2, RATIOS); const key = `${nom(t.var)} ≤ ${fmt3(t.umbral)}`; cuenta[key] = (cuenta[key] || 0) + 1; }
    const filas = Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
    const acc = t => TEST.filter(r => predArbol(t, r) === r.impago).length / TEST.length;
    const sub2 = n => n.hoja !== undefined ? `${n.cnt} emp. · impago ${pct0(n.n[1])}` : `${n.cnt} empresas`;
    el("poda-inest").innerHTML = `<div class="block stage" style="flex:1 1 380px"><div class="t">Con las 146 empresas</div>${svgArbol(ARBOL_FULL, { w: 420, hoja: nd => nd.hoja ? "impago" : "paga", sub: sub2 })}<p style="font-size:.88rem;color:var(--muted)">acierto en prueba ${pct(acc(ARBOL_FULL))}</p></div>
    <div class="block stage" style="flex:1 1 380px;border-color:${t2.var === ARBOL_FULL.var && Math.abs(t2.umbral - ARBOL_FULL.umbral) < 1e-9 ? "var(--line)" : "var(--cobre)"}"><div class="t">Quitando ${st.k} empresas al azar (sorteo ${st.semilla})</div>${svgArbol(t2, { w: 420, hoja: nd => nd.hoja ? "impago" : "paga", sub: sub2 })}<p style="font-size:.88rem;color:var(--muted)">acierto en prueba ${pct(acc(t2))}</p></div>
    <div class="block stage"><div class="t">La raíz en 30 sorteos distintos, quitando ${st.k} empresas cada vez</div>${tabla(["raíz elegida", "veces"], filas.map(f => ({ c: [f[0], f[1]] })))}</div>`;
    const cambia = 30 - (cuenta[`${nom(ARBOL_FULL.var)} ≤ ${fmt3(ARBOL_FULL.umbral)}`] || 0);
    el("poda-inest-nota").innerHTML = `<b>Lectura.</b> Quitando ${st.k} de 146 empresas (${pct0(st.k / 146)} de los datos), la raíz cambió en ${cambia} de 30 sorteos${cambia > 0 ? ", y con ella todo lo que cuelga debajo" : ""}. ${st.k <= 3 ? "Sube el número de empresas que se quitan y mira cómo crece la inestabilidad." : st.k >= 15 ? "Con tantas empresas fuera el árbol es casi un sorteo: cada raíz cuenta una historia distinta sobre las mismas empresas." : "Ningún ratio cambió de significado; solo cambió cuáles 146 empresas vimos. Eso es varianza."}`;
    if (anim) stagger(el("poda-s0"));
  }
  function rCurva(anim) {
    el("poda-curva").innerHTML = `<div class="block stage"><div class="t">Acierto según la profundidad a la que se corta</div>${curva([{ pts: CURVA.map(c => [c.d, c.tr]), col: "var(--q)", marks: true, lab: "entrenamiento" }, { pts: CURVA.map(c => [c.d, c.te]), col: "var(--cobre)", marks: true, lab: "prueba" }], { xr: [0, 4], yr: [0.55, 0.9], xt: [0, 1, 2, 3, 4], yt: [0.6, 0.7, 0.8, 0.9], yf: pct0, xl: "profundidad", extra: [{ tipo: "vline", x: st.d }] })}</div>
    <div class="block stage"><div class="t">La misma curva en números</div>${tabla(["profundidad", "hojas", "entrenamiento", "prueba"], CURVA.map(c => ({ c: [c.d, c.h, pct(c.tr), pct(c.te)], cls: c.d === st.d ? "hi" : "" })))}<p style="font-size:.88rem;color:var(--muted)">Y el árbol sin freno (28 hojas): 100% y 76,7%.</p></div>`;
    if (anim) stagger(el("poda-s1"));
  }
  function rArbol(anim) {
    const d = st.d; const porProf = [0, 1, 2, 3, 4].map(p => N.filter(nd => nd.prof === p));
    const W = 900, dy = 72; const pos = {};
    // x: hojas (nodos sin hijos o de prof 4) equiespaciadas en orden
    const term = []; (function rec(k) { const nd = N[k]; if (nd.izq === null) term.push(k); else { rec(nd.izq); rec(nd.der); } })(0);
    const lw = W / term.length; term.forEach((k, i) => pos[k] = { x: lw * (i + 0.5), y: N[k].prof * dy + 30 });
    (function fix(k) { const nd = N[k]; if (nd.izq !== null) { fix(nd.izq); fix(nd.der); pos[k] = { x: (pos[nd.izq].x + pos[nd.der].x) / 2, y: nd.prof * dy + 30 }; } })(0);
    let s = "";
    N.forEach(nd => { if (nd.izq !== null) [nd.izq, nd.der].forEach(h => { s += `<line x1="${pos[nd.id].x}" y1="${pos[nd.id].y}" x2="${pos[h].x}" y2="${pos[h].y}" class="${N[h].prof > d ? "off" : ""}"/>`; }); });
    N.forEach(nd => {
      const c = cuentas[nd.id], p = pos[nd.id]; const esHoja = nd.izq === null || nd.prof === d; const off = nd.prof > d;
      const txt = nd.izq === null || nd.prof >= d ? (clase(nd.id) ? "impago" : "paga") : `${nom(nd.var)} ≤ ${fmt3(nd.umbral)}`;
      const w = Math.max(64, txt.length * 6.4 + 12);
      s += `<g class="nd ${esHoja ? "hoja c" + clase(nd.id) : ""} ${off ? "off" : ""}"><rect x="${p.x - w / 2}" y="${p.y - 14}" width="${w}" height="38" rx="5"/><text x="${p.x}" y="${p.y + 2}" text-anchor="middle" style="font-size:11px">${txt}</text><text x="${p.x}" y="${p.y + 17}" text-anchor="middle" class="sub">${c.n} · ${pct0(c.n1 / c.n)}</text></g>`;
    });
    el("poda-arbol").innerHTML = `<svg class="arbol" viewBox="0 0 ${W} ${5 * dy + 10}" width="100%" style="min-width:700px">${s}</svg>`;
    const c = CURVA[d];
    el("poda-kpi").innerHTML = `<div><div class="t">profundidad</div><div class="v">${d}</div></div><div><div class="t">hojas</div><div class="v">${c.h}</div></div><div><div class="t">acierto entrenamiento</div><div class="v">${pct(c.tr)}</div></div><div><div class="t">acierto prueba</div><div class="v" style="color:var(--cobre)">${pct(c.te)}</div></div>`;
    if (anim) stagger(el("poda-s2"));
  }
  function rCcp(anim) {
    const MSL = [[1, 28, 1.0, 0.767], [3, 19, 0.938, 0.767], [5, 15, 0.877, 0.753], [10, 10, 0.822, 0.712], [20, 6, 0.822, 0.767], [30, 4, 0.753, 0.699]];
    const ccp = DATA.ccp;
    el("poda-ccp").innerHTML = `<div class="block stage"><div class="t">Post-poda: la secuencia de α (cost-complexity)</div>${curva([{ pts: ccp.map(c => [c[1], c[2]]), col: "var(--q)", marks: true, r: 3, lab: "entrenamiento" }, { pts: ccp.map(c => [c[1], c[3]]), col: "var(--cobre)", marks: true, r: 3, lab: "prueba" }], { xr: [0, 30], yr: [0.55, 1.02], xt: [1, 10, 20, 28], yt: [0.6, 0.8, 1], yf: pct0, xl: "hojas que quedan" })}${tabla(["α", "hojas", "entrenamiento", "prueba"], ccp.filter((c, i) => i % 2 === 0 || i === ccp.length - 1).map(c => ({ c: [fmt4(c[0]), c[1], pct(c[2]), pct(c[3])] })), "cmp small")}</div>
    <div class="block stage"><div class="t">Pre-poda: mínimo de empresas por hoja</div>${tabla(["mínimo por hoja", "hojas", "entrenamiento", "prueba"], MSL.map(m => ({ c: [m[0], m[1], pct(m[2]), pct(m[3])] })))}<p style="font-size:.88rem;color:var(--muted)">Con 20 o 30 por hoja cada hoja es un grupo con sentido estadístico. El acierto en prueba no mejora en línea recta: un punto porcentual es menos de una empresa.</p></div>`;
    if (anim) stagger(el("poda-s3"));
  }
  function render(anim) { [rInest, rCurva, rArbol, rCcp][st.paso](anim); }
  el("poda-d").oninput = e => { st.d = +e.target.value; el("poda-d-v").textContent = st.d; if (st.paso === 2) rArbol(false); if (st.paso === 1) rCurva(false); };
  el("poda-k").oninput = e => { st.k = +e.target.value; el("poda-k-v").textContent = st.k; if (st.paso === 0) rInest(false); };
  el("poda-otra").onclick = () => { st.semilla++; if (st.paso !== 0) GOTO.poda(0); else rInest(true); };
  el("poda-replay").onclick = () => render(true);
  GOTO.poda = pasoGenerico("poda", 4, st, render);
  stepper("poda", ["Inestabilidad", "Sobreajuste", "Cortar el árbol", "Poda y pre-poda"], GOTO.poda);
})();

// ===================== 05 BAGGING =====================
(function () {
  const st = ST.bag; const B = 7; const CU = DATA.cuentas; // 146 x 7
  const sel = el("bag-emp"); sel.innerHTML = TEST.map((r, i) => `<option value="${i}">${i + 1}: v/d ${fmt2(r.ventas_deuda)}, d/a ${fmt2(r.deuda_activos)}, rc ${fmt2(r.razon_corriente)} · ${r.impago ? "impago" : "paga"}</option>`).join("");
  const arboles = () => st.tipo === "bag" ? DATA.bag : DATA.rf;
  const voto = (ts, r) => { const v = ts.map(t => predArbol(t, r)); const s = v.reduce((a, b) => a + b); return { v, pred: s > ts.length / 2 ? 1 : 0, s }; };
  const acc = (t, rows) => rows.filter(r => predArbol(t, r) === r.impago).length / rows.length;
  function oob() { let ok = 0, n = 0; TRAIN.forEach((r, i) => { const ts = DATA.bag.filter((t, b) => CU[i][b] === 0); if (!ts.length) return; n++; if (voto(ts, r).pred === r.impago) ok++; }); return { acc: ok / n, n }; }
  function regla(t, ind = 0) {
    if (t.hoja !== undefined) return `<span class="${t.hoja ? "bad" : "ok"}">${t.hoja ? "impago" : "paga"}</span>`;
    const pad = "&nbsp;".repeat(ind * 3);
    return `${nom(t.var)} ≤ ${fmt3(t.umbral)}<br>${pad}&nbsp;&nbsp;sí: ${regla(t.izq, ind + 1)}<br>${pad}&nbsp;&nbsp;no: ${regla(t.der, ind + 1)}`;
  }

  st.svModelo = "profundo"; st.svSem = 1; st.svMulti = false;
  const F_VERDAD = x => 0.1 + 0.9 * (x - 0.35) * (x - 0.35);
  function muestraSV(sem) { const r = rng32(500 + sem); const xs = [], ys = []; for (let i = 0; i < 60; i++) { const x = r(); xs.push(x); ys.push(F_VERDAD(x) + (r() + r() + r() - 1.5) * 0.16); } return { xs, ys, r }; }
  function ajustarSV(m, s) {
    if (m === "recta") { const n = s.xs.length, mx = s.xs.reduce((a, b) => a + b, 0) / n, my = s.ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0; s.xs.forEach((x, i) => { sxy += (x - mx) * (s.ys[i] - my); sxx += (x - mx) ** 2; }); const b1 = sxy / sxx, b0 = my - b1 * mx; return x => b0 + b1 * x; }
    if (m === "profundo") { const t = arbolReg(s.xs, s.ys, 6); return x => predReg(t, x); }
    const ts = []; for (let b = 0; b < 25; b++) { const ix = s.xs.map(() => Math.floor(s.r() * 60)); ts.push(arbolReg(ix.map(i => s.xs[i]), ix.map(i => s.ys[i]), 6)); }
    return x => ts.reduce((a, t) => a + predReg(t, x), 0) / ts.length;
  }
  function rSV(anim) {
    const W = 520, H = 320, X = x => 40 + x * (W - 52), Y = y => 12 + (0.6 - Math.max(-0.1, Math.min(0.6, y))) / 0.7 * (H - 44);
    const grid = []; for (let x = 0; x <= 1.0001; x += 0.005) grid.push(x);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">`;
    [0, 0.2, 0.4, 0.6].forEach(v => s += `<line x1="40" x2="${W - 12}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="34" y="${Y(v) + 4}" text-anchor="end" class="tick">${fmt2(v)}</text>`);
    [0, 0.5, 1].forEach(v => s += `<text x="${X(v)}" y="${H - 18}" text-anchor="middle" class="tick">${fmt2(v)}</text>`);
    s += `<text x="${W / 2}" y="${H - 4}" text-anchor="middle" class="tick" style="font-weight:600">x</text>`;
    const nM = st.svMulti ? 20 : 1; const fits = []; for (let k = 0; k < nM; k++) { const sm = muestraSV(st.svSem + k); fits.push({ f: ajustarSV(st.svModelo, sm), sm }); }
    if (!st.svMulti) fits[0].sm.xs.forEach((x, i) => s += `<circle cx="${X(x)}" cy="${Y(fits[0].sm.ys[i])}" r="3.5" fill="var(--q)" opacity=".55"/>`);
    fits.forEach((ft, k) => s += `<polyline points="${grid.map(x => X(x) + "," + Y(ft.f(x))).join(" ")}" fill="none" stroke="var(--cobre)" stroke-width="${st.svMulti ? 1.2 : 2.5}" opacity="${st.svMulti ? 0.45 : 1}" stroke-linejoin="round"/>`);
    s += `<polyline points="${grid.map(x => X(x) + "," + Y(F_VERDAD(x))).join(" ")}" fill="none" stroke="var(--v)" stroke-width="2.5" stroke-dasharray="6 4"/>`;
    s += `</svg>`;
    // sesgo^2 y varianza estimados con 20 muestras sobre una grilla
    const g2 = []; for (let x = 0.02; x < 1; x += 0.02) g2.push(x);
    const F20 = []; for (let k = 0; k < 20; k++) { const sm = muestraSV(st.svSem + k); const f = ajustarSV(st.svModelo, sm); F20.push(g2.map(f)); }
    let sesgo2 = 0, varz = 0; g2.forEach((x, j) => { const vals = F20.map(v => v[j]); const m = vals.reduce((a, b) => a + b, 0) / 20; sesgo2 += (m - F_VERDAD(x)) ** 2; varz += vals.reduce((a, v) => a + (v - m) ** 2, 0) / 20; }); sesgo2 /= g2.length; varz /= g2.length;
    const nombre = { recta: "recta (regresión lineal)", profundo: "árbol profundo (6 niveles)", bagging: "promedio de 25 árboles profundos (bagging)" }[st.svModelo];
    el("bag-sv").innerHTML = `<div class="block stage" style="flex:1 1 520px"><div class="t">${st.svMulti ? "20 muestras, 20 ajustes del " + nombre : "una muestra de 60 puntos y el ajuste del " + nombre} (verde punteado: la curva verdadera)</div>${s}</div>
    <div class="kpi stage" style="flex:1 1 240px;grid-template-columns:1fr"><div><div class="t">sesgo² (promedio de los ajustes contra la verdad)</div><div class="v">${fmt4(sesgo2)}</div></div><div><div class="t">varianza (cuánto difieren los ajustes entre sí)</div><div class="v" style="color:var(--cobre)">${fmt4(varz)}</div></div><div><div class="t">error total esperado (sesgo² + varianza)</div><div class="v">${fmt4(sesgo2 + varz)}</div></div><p style="font-size:.8rem;color:var(--muted);margin:4px 0 0">Estimados con 20 muestras distintas sobre una grilla de x. Sin contar el ruido irreducible de los datos.</p></div>`;
    const lect = { recta: "Una recta no puede dibujar una U: queda lejos de la verdad en el medio y en los extremos, haga lo que haga. Superpón 20 muestras y verás que todas las rectas son casi iguales (poca varianza) y todas igual de equivocadas (mucho sesgo). Más datos no lo arreglan: el modelo es demasiado simple para la forma que hay que dibujar.",
      profundo: "El árbol profundo pasa cerca de cada punto de su muestra, ruido incluido. Superpón 20 muestras: cada ajuste es distinto, con escalones que aparecen y desaparecen según qué puntos tocaron. En promedio siguen la U (poco sesgo), pero cada uno por separado se equivoca en un lugar distinto (mucha varianza).",
      bagging: "El promedio de 25 árboles profundos, cada uno entrenado en un sorteo con reemplazo de la misma muestra, suaviza los escalones accidentales sin perder la forma. Compáralo con el árbol profundo solo: el sesgo casi no cambia y la varianza baja bastante. Esa es toda la idea de bagging." }[st.svModelo];
    el("bag-sv-nota").innerHTML = `<b>Lectura.</b> ${lect}`;
    if (anim) stagger(el("bag-s0"));
  }
  function rBoot(anim) {
    const fila = CU.map(c => c[0]); const ceros = CU.map((c, i) => c.filter(x => x === 0).length);
    const porMuestra = [...Array(B)].map((_, b) => CU.filter(c => c[b] === 0).length);
    el("bag-boot").innerHTML = `<div class="block stage" style="flex:1 1 100%"><div class="t">Muestra bootstrap 1: cuántas veces sale cada una de las 146 empresas de entrenamiento</div><div class="celdas">${fila.map((c, i) => `<span class="c${Math.min(c, 3)}" title="empresa ${i + 1}: ${c} veces">${c}</span>`).join("")}</div><p style="font-size:.88rem;color:var(--muted)">Sortear 146 con reemplazo deja fuera a ${porMuestra[0]} empresas (${pct0(porMuestra[0] / 146)}); en promedio queda fuera 1/e = 37%. Las que quedan fuera son la "bolsa" con la que se mide el error OOB sin datos de prueba.</p></div>
    <div class="block stage"><div class="t">Fuera de la bolsa por muestra</div>${tabla(["muestra", "empresas fuera", "fracción"], porMuestra.map((c, b) => ({ c: [b + 1, c, pct0(c / 146)] })))}</div>
    <div class="block stage"><div class="t">Dos sorteos, dos ensambles</div>${tabla(["", "bagging", "random forest"], [{ c: ["filas", "bootstrap", "bootstrap"] }, { c: ["variables por corte", "las 5", "2 al azar"] }, { c: ["profundidad aquí", "2", "3"] }, { c: ["árboles aquí", "7", "7"] }])}</div>`;
    if (anim) stagger(el("bag-s1"));
  }
  function rArboles(anim) {
    const ts = arboles(), r = TEST[st.emp], vt = voto(ts, r);
    el("bag-arboles").innerHTML = ts.map((t, b) => `<div class="block stage regla ${vt.v[b] === r.impago ? "" : "err"}" style="flex:1 1 220px"><div class="t">árbol ${b + 1} <b style="color:${vt.v[b] ? "var(--bad)" : "var(--ok)"}">${vt.v[b] ? "impago" : "paga"}</b></div><div style="font-family:'JetBrains Mono',monospace;font-size:.78rem;line-height:1.5">${regla(t)}</div></div>`).join("");
    el("bag-voto").innerHTML = `<div class="block stage" style="border-color:var(--cobre)"><div class="t">Votación para la empresa de prueba ${st.emp + 1}</div><div class="kpi" style="max-width:none;grid-template-columns:repeat(3,1fr)"><div><div class="t">votos impago</div><div class="v">${vt.s} <small>de ${B}</small></div></div><div><div class="t">el conjunto dice</div><div class="v" style="color:${vt.pred ? "var(--bad)" : "var(--ok)"}">${vt.pred ? "impago" : "paga"}</div></div><div><div class="t">realidad</div><div class="v" style="color:${r.impago ? "var(--bad)" : "var(--ok)"}">${r.impago ? "impago" : "paga"} ${vt.pred === r.impago ? "✓" : "✗"}</div></div></div></div>`;
    if (anim) stagger(el("bag-s2"));
  }
  function rKpi(anim) {
    const ts = arboles(); const ind = ts.map(t => ({ tr: acc(t, TRAIN), te: acc(t, TEST) })); const av = ind.reduce((s, x) => s + x.te, 0) / B;
    const accV = rows => rows.filter(r => voto(ts, r).pred === r.impago).length / rows.length; const o = oob();
    el("bag-kpi").innerHTML = `<div><div class="t">árbol típico (promedio de 7), prueba</div><div class="v">${pct(av)}</div></div><div><div class="t">votación, prueba</div><div class="v" style="color:var(--cobre)">${pct(accV(TEST))}</div></div><div><div class="t">votación, entrenamiento</div><div class="v">${pct(accV(TRAIN))}</div></div>${st.tipo === "bag" ? `<div><div class="t">error fuera de la bolsa (OOB)</div><div class="v">${pct(o.acc)} <small>acierto, ${o.n} empresas</small></div></div>` : ""}`;
    el("bag-comp").innerHTML = `<div class="block stage"><div class="t">Cada árbol en prueba</div>${barras(ind.map((x, b) => ({ lab: "árbol " + (b + 1), v: x.te, txt: pct(x.te) })).concat([{ lab: "votación", v: accV(TEST), txt: pct(accV(TEST)), cls: "pred" }]), { max: 1 })}</div>
    <div class="block stage"><div class="t">Comparación en prueba (73 empresas)</div>${tabla(["modelo", "acierto"], [{ c: ["árbol CART profundidad 2 (pestaña 03)", pct(0.822)] }, { c: ["árbol sin freno (28 hojas)", pct(0.767)] }, { c: ["bagging, 7 árboles (esta pestaña)", pct(TEST.filter(r => voto(DATA.bag, r).pred === r.impago).length / 73)] }, { c: ["random forest, 7 árboles (esta pestaña)", pct(TEST.filter(r => voto(DATA.rf, r).pred === r.impago).length / 73)] }, { c: ["bagging, 100 árboles (scikit-learn)", pct(DATA.ref.bag100)] }, { c: ["random forest, 100 árboles (scikit-learn)", pct(DATA.ref.rf100)] }])}<p style="font-size:.88rem;color:var(--muted)">Importancia de variables del random forest de 100 árboles: ${RATIOS.map((r, i) => nom(r) + " " + pct0(DATA.ref.imp[i])).join(", ")}.</p></div>`;
    if (anim) stagger(el("bag-s3"));
  }
  function binom(n, eps) { // P(mayoría se equivoca) para n impar
    const k0 = Math.floor(n / 2) + 1; let lc = 0, s = 0; const dist = [];
    for (let k = 0; k <= n; k++) { const c = Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(eps) + (n - k) * Math.log(1 - eps)); dist.push(c); if (k >= k0) s += c; }
    return { p: s, dist };
  }
  function lgamma(z) { const g = 7, C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z); z -= 1; let x = C[0]; for (let i = 1; i < g + 2; i++) x += C[i] / (z + i); const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); }
  function rBinom(anim) {
    const { p, dist } = binom(st.n, st.eps); const k0 = Math.floor(st.n / 2) + 1;
    const pts = dist.map((d, k) => [k, d]); const ptsN = []; for (let n = 1; n <= 101; n += 2) ptsN.push([n, binom(n, st.eps).p]);
    el("bag-binom").innerHTML = `<div class="block stage"><div class="t">Cuántos se equivocan a la vez (n = ${st.n}, ε = ${fmt2(st.eps)})</div><svg class="chart" viewBox="0 0 420 180" width="100%" style="max-width:420px">${dist.map((d, k) => `<rect x="${40 + k * 360 / (st.n + 1)}" y="${150 - 140 * d / Math.max(...dist)}" width="${Math.max(1, 360 / (st.n + 1) - 1)}" height="${140 * d / Math.max(...dist)}" fill="${k >= k0 ? "var(--bad)" : "var(--q)"}"/>`).join("")}<text x="40" y="170" class="tick">0 equivocados</text><text x="400" y="170" text-anchor="end" class="tick">${st.n}</text><line x1="${40 + k0 * 360 / (st.n + 1)}" x2="${40 + k0 * 360 / (st.n + 1)}" y1="6" y2="152" stroke="var(--ink)" stroke-dasharray="4 3"/><text x="${44 + k0 * 360 / (st.n + 1)}" y="16" class="tick">mayoría (≥ ${k0})</text></svg><div class="kpi" style="max-width:none"><div><div class="t">P(la mayoría se equivoca)</div><div class="v" style="color:var(--cobre)">${pct(p)}</div></div><div><div class="t">un clasificador solo</div><div class="v">${pct(st.eps)}</div></div></div></div>
    <div class="block stage"><div class="t">Según el número de clasificadores (ε = ${fmt2(st.eps)})</div>${curva([{ pts: ptsN, col: "var(--cobre)" }], { xr: [1, 101], yr: [0, Math.max(0.5, st.eps + 0.05)], xt: [1, 25, 51, 75, 101], yt: [0, 0.25, 0.5], yf: pct0, xl: "clasificadores", extra: [{ tipo: "punto", x: st.n, y: p, txt: pct(p) }] })}<p style="font-size:.88rem;color:var(--muted)">${st.eps < 0.5 ? "Con ε < 0,5 la probabilidad de error de la mayoría cae hacia cero al sumar clasificadores." : st.eps === 0.5 ? "Con ε = 0,5 votar no cambia nada: 50% siempre." : "Con ε > 0,5 votar empeora: la mayoría se equivoca cada vez más seguido."} El supuesto fuerte es la independencia: en la práctica los árboles se parecen (ρ > 0) y la mejora es menor.</p></div>`;
    if (anim) stagger(el("bag-s4"));
  }
  function render(anim) { [rSV, rBoot, rArboles, rKpi, rBinom][st.paso](anim); }
  segmento("bag-sv-modelo", "m", m => { st.svModelo = m; if (st.paso === 0) rSV(false); });
  el("bag-sv-otra").onclick = () => { st.svSem += 20; st.svMulti = false; if (st.paso !== 0) GOTO.bag(0); else rSV(false); };
  el("bag-sv-20").onclick = () => { st.svMulti = true; if (st.paso !== 0) GOTO.bag(0); else rSV(false); };
  sel.onchange = e => { st.emp = +e.target.value; if (st.paso === 2) rArboles(true); };
  segmento("bag-tipo", "t", t => { st.tipo = t; render(true); });
  el("bag-eps").oninput = e => { st.eps = +e.target.value / 100; el("bag-eps-v").textContent = fmt2(st.eps); if (st.paso === 4) rBinom(false); };
  el("bag-n").oninput = e => { st.n = +e.target.value; el("bag-n-v").textContent = st.n; if (st.paso === 4) rBinom(false); };
  el("bag-replay").onclick = () => render(true);
  GOTO.bag = pasoGenerico("bag", 5, st, render);
  stepper("bag", ["Qué es un ensamble", "Bootstrap", "Los árboles votan", "Cuánto aciertan", "Por qué funciona"], GOTO.bag);
})();

// ===================== 06 ADABOOST =====================
function r3(x) { const y = x * 1000, f = Math.floor(y), d = y - f; return (Math.abs(d - 0.5) < 1e-9 ? (f % 2 === 0 ? f : f + 1) : Math.round(y)) / 1000; }
function cuantiles(xs) { const s = [...xs].sort((a, b) => a - b), n = s.length, out = new Set(); for (let i = 0; i < 19; i++) { const q = 0.05 + 0.05 * i, pos = q * (n - 1), lo = Math.floor(pos), hi = Math.ceil(pos); out.add(r3(s[lo] + (s[hi] - s[lo]) * (pos - lo))); } return [...out].sort((a, b) => a - b); }
(function () {
  const st = ST.ada; const FEATS = ["ventas_deuda", "deuda_activos"], M = 5;
  const CANDS = Object.fromEntries(FEATS.map(f => [f, cuantiles(TRAIN.map(r => r[f]))]));
  const ytr = TRAIN.map(r => r.impago ? 1 : -1), yte = TEST.map(r => r.impago ? 1 : -1);
  const hval = (r, f, u, d) => (d === 1 ? r[f] <= u : r[f] > u) ? 1 : -1;
  // corre las 5 rondas y guarda pesos por ronda
  const R = []; let w = ytr.map(() => 1 / ytr.length), Ftr = ytr.map(() => 0), Fte = yte.map(() => 0);
  for (let m = 0; m < M; m++) {
    let best = null;
    FEATS.forEach(f => CANDS[f].forEach(u => [1, -1].forEach(d => { let e = 0; TRAIN.forEach((r, i) => { if (hval(r, f, u, d) !== ytr[i]) e += w[i]; }); if (!best || e < best.e - 1e-12) best = { e, f, u, d }; })));
    const a = 0.5 * Math.log((1 - best.e) / best.e); const h = TRAIN.map(r => hval(r, best.f, best.u, best.d)), ht = TEST.map(r => hval(r, best.f, best.u, best.d));
    Ftr = Ftr.map((x, i) => x + a * h[i]); Fte = Fte.map((x, i) => x + a * ht[i]);
    const wAntes = w; w = w.map((x, i) => x * Math.exp(-a * ytr[i] * h[i])); const Z = w.reduce((s, x) => s + x, 0); w = w.map(x => x / Z);
    R.push({ ...best, a, w: wAntes, wDespues: w, h, solo: h.filter((x, i) => x === ytr[i]).length / ytr.length, accTr: Ftr.filter((x, i) => Math.sign(x) === ytr[i]).length / ytr.length, accTe: Fte.filter((x, i) => Math.sign(x) === yte[i]).length / yte.length, Ftr: [...Ftr] });
  }
  window.ADA_R = R;
  window.ADA_R = R;
  function rViz(anim) {
    const m = st.r - 1, ro = R[m]; const W = 560, H = 380; const xr = [0, 8], yr = [0, 1.2];
    const X = x => 46 + (Math.min(x, xr[1]) - xr[0]) / (xr[1] - xr[0]) * (W - 60), Y = y => 12 + (yr[1] - Math.min(y, yr[1])) / (yr[1] - yr[0]) * (H - 46);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">`;
    // sombreado impago
    if (ro.f === "ventas_deuda") { const x0 = ro.d === 1 ? 46 : X(ro.u), x1 = ro.d === 1 ? X(ro.u) : W - 14; s += `<rect x="${x0}" y="12" width="${x1 - x0}" height="${H - 46}" fill="var(--cobre)" opacity=".08"/><line x1="${X(ro.u)}" x2="${X(ro.u)}" y1="12" y2="${H - 34}" stroke="var(--ink)" stroke-width="2"/>`; }
    else { const y0 = ro.d === 1 ? Y(ro.u) : 12, y1 = ro.d === 1 ? H - 34 : Y(ro.u); s += `<rect x="46" y="${y0}" width="${W - 60}" height="${y1 - y0}" fill="var(--cobre)" opacity=".08"/><line x1="46" x2="${W - 14}" y1="${Y(ro.u)}" y2="${Y(ro.u)}" stroke="var(--ink)" stroke-width="2"/>`; }
    [0, 2, 4, 6, 8].forEach(v => s += `<text x="${X(v)}" y="${H - 18}" text-anchor="middle" class="tick">${v}</text>`); [0, 0.4, 0.8, 1.2].forEach(v => s += `<text x="40" y="${Y(v) + 4}" text-anchor="end" class="tick">${fmt2(v)}</text>`);
    s += `<text x="${W / 2}" y="${H - 4}" text-anchor="middle" class="tick" style="font-weight:600">ventas/deuda (tope 8)</text><text transform="translate(12 ${H / 2}) rotate(-90)" text-anchor="middle" class="tick" style="font-weight:600">deuda/activos</text>`;
    const wmax = Math.max(...ro.w);
    TRAIN.forEach((r, i) => { const rad = 2.5 + 14 * Math.sqrt(ro.w[i] / wmax); const mal = ro.h[i] !== ytr[i]; s += `<circle cx="${X(r.ventas_deuda)}" cy="${Y(r.deuda_activos)}" r="${rad}" fill="${r.impago ? "var(--cobre)" : "var(--q)"}" opacity=".6" stroke="${mal ? "var(--bad)" : "none"}" stroke-width="1.5"/>`; });
    s += "</svg>";
    const wmal = ro.h.reduce((sum, h, i) => sum + (h !== ytr[i] ? ro.wDespues[i] : 0), 0);
    el("ada-viz").innerHTML = `<div class="block stage" style="flex:1 1 100%"><div class="t">Ronda ${st.r}: tocón ${nom(ro.f)} ${ro.d === 1 ? "≤" : ">"} ${fmt3(ro.u)} → impago (borde rojo: mal clasificada por este tocón)</div>${s}</div>
    <div class="kpi stage" style="max-width:none;flex:1 1 100%"><div><div class="t">error ponderado ε</div><div class="v">${fmt3(ro.e)}</div></div><div><div class="t">α = ½ ln((1 − ε)/ε)</div><div class="v">${fmt3(ro.a)}</div></div><div><div class="t">peso total de las mal clasificadas, después</div><div class="v">${pct(wmal)}</div></div><div><div class="t">acierto acumulado prueba</div><div class="v" style="color:var(--cobre)">${pct(ro.accTe)}</div></div></div>`;
    el("ada-nota").innerHTML = `<b>Qué pasó.</b> Con los pesos de esta ronda, el tocón de menor error ponderado fue ${nom(ro.f)} ${ro.d === 1 ? "≤" : ">"} ${fmt3(ro.u)} (ε = ${fmt3(ro.e)}, de ${FEATS.reduce((s, f) => s + 2 * CANDS[f].length, 0)} candidatos). Su α es ${fmt3(ro.a)}. Tras reponderar, las ${ro.h.filter((h, i) => h !== ytr[i]).length} empresas que clasificó mal pasan a pesar exactamente la mitad del total (${pct(wmal)}): es la propiedad de AdaBoost, el tocón recién elegido queda "neutralizado" y el siguiente tiene que encontrar otra cosa.${st.r < M ? " Mueve a la ronda siguiente." : " Solo (sin pesos) este tocón acierta " + pct(ro.solo) + " del entrenamiento; la suma ponderada de los cinco, " + pct(ro.accTr) + "."}`;
    if (anim) stagger(el("ada-s1"));
  }
  function rTabla(anim) {
    el("ada-tabla").innerHTML = `<div class="block stage"><div class="t">Las cinco rondas</div>${tabla(["ronda", "tocón", "ε", "α", "tocón solo (entren.)", "acumulado entren.", "acumulado prueba"], R.map((ro, m) => ({ c: [m + 1, `${nom(ro.f)} ${ro.d === 1 ? "≤" : ">"} ${fmt3(ro.u)}`, fmt3(ro.e), fmt3(ro.a), pct(ro.solo), pct(ro.accTr), pct(ro.accTe)], cls: m === st.r - 1 ? "hi" : "" })))}</div>
    <div class="block stage"><div class="t">Acierto acumulado por ronda</div>${curva([{ pts: R.map((ro, m) => [m + 1, ro.accTr]), col: "var(--q)", marks: true, lab: "entrenamiento" }, { pts: R.map((ro, m) => [m + 1, ro.accTe]), col: "var(--cobre)", marks: true, lab: "prueba" }], { xr: [1, 5], yr: [0.6, 0.85], xt: [1, 2, 3, 4, 5], yt: [0.6, 0.7, 0.8], yf: pct0, xl: "ronda" })}<p style="font-size:.88rem;color:var(--muted)">Los tocones 2 a 5 aciertan poco en solitario (fueron elegidos con pesos, para las empresas difíciles) y aun así suben el voto. Compara con el árbol de profundidad 2: ${pct(0.822)} en prueba. Con dos ratios y cinco tocones se ve el mecanismo, no su mejor caso.</p></div>`;
    if (anim) stagger(el("ada-s2"));
  }
  function render(anim) { if (st.paso === 0 && anim) stagger(el("ada-s0")); if (st.paso === 1) rViz(anim); if (st.paso === 2) rTabla(anim); }
  el("ada-r").oninput = e => { st.r = +e.target.value; el("ada-r-v").textContent = st.r; if (st.paso === 1) rViz(false); if (st.paso === 2) rTabla(false); };
  let timer = null;
  el("ada-play").onclick = () => { if (st.paso !== 1) GOTO.ada(1); clearInterval(timer); st.r = 1; el("ada-r").value = 1; el("ada-r-v").textContent = 1; rViz(false); timer = setInterval(() => { if (st.r >= M) { clearInterval(timer); return; } st.r++; el("ada-r").value = st.r; el("ada-r-v").textContent = st.r; rViz(false); }, reduced ? 400 : 1400); };
  el("ada-replay").onclick = () => render(true);
  GOTO.ada = pasoGenerico("ada", 3, st, render);
  stepper("ada", ["La idea", "Ronda a ronda", "Resultado"], GOTO.ada);
})();

// ===================== 07 GRADIENT BOOSTING =====================
(function () {
  const st = ST.gb; const XV = "ventas_deuda", YV = "roa", M = 6;
  const CANDS = cuantiles(TRAIN.map(r => r[XV]));
  const xtr = TRAIN.map(r => r[XV]), ytr = TRAIN.map(r => r[YV]), xte = TEST.map(r => r[XV]), yte = TEST.map(r => r[YV]);
  const mse = (F, y) => F.reduce((s, f, i) => s + (y[i] - f) ** 2, 0) / y.length;
  function correr(lr) {
    const F0 = ytr.reduce((a, b) => a + b) / ytr.length; let Ftr = ytr.map(() => F0), Fte = yte.map(() => F0); const R = [{ Ftr: [...Ftr], mseTr: mse(Ftr, ytr), mseTe: mse(Fte, yte), F0 }]; const pasos = [];
    for (let m = 0; m < M; m++) {
      const res = ytr.map((y, i) => y - Ftr[i]); let best = null;
      CANDS.forEach(u => { let nl = 0, sl = 0, nr = 0, sr = 0; res.forEach((r, i) => { if (xtr[i] <= u) { nl++; sl += r; } else { nr++; sr += r; } }); if (!nl || !nr) return; const ml = sl / nl, mr = sr / nr; const sse = res.reduce((s, r, i) => s + (r - (xtr[i] <= u ? ml : mr)) ** 2, 0); if (!best || sse < best.sse - 1e-12) best = { u, ml, mr, sse }; });
      pasos.push(best); Ftr = Ftr.map((f, i) => f + lr * (xtr[i] <= best.u ? best.ml : best.mr)); Fte = Fte.map((f, i) => f + lr * (xte[i] <= best.u ? best.ml : best.mr));
      R.push({ Ftr: [...Ftr], mseTr: mse(Ftr, ytr), mseTe: mse(Fte, yte), ...best });
    }
    return { R, pasos, F0 };
  }
  const Fx = (run, lr, m, x) => run.F0 + run.pasos.slice(0, m).reduce((s, p) => s + lr * (x <= p.u ? p.ml : p.mr), 0);
  function rViz(anim) {
    const run = correr(st.lr), m = st.r; const W = 600, H = 340, xr = [0, 8], yr = [-0.35, 0.45];
    const X = x => 50 + (Math.min(x, xr[1]) - xr[0]) / (xr[1] - xr[0]) * (W - 64), Y = y => 12 + (yr[1] - Math.max(yr[0], Math.min(y, yr[1]))) / (yr[1] - yr[0]) * (H - 46);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">`;
    [-0.2, 0, 0.2, 0.4].forEach(v => s += `<line x1="50" x2="${W - 14}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="44" y="${Y(v) + 4}" text-anchor="end" class="tick">${fmt2(v)}</text>`); [0, 2, 4, 6, 8].forEach(v => s += `<text x="${X(v)}" y="${H - 18}" text-anchor="middle" class="tick">${v}</text>`);
    s += `<text x="${W / 2}" y="${H - 4}" text-anchor="middle" class="tick" style="font-weight:600">ventas/deuda (tope 8)</text>`;
    TRAIN.forEach(r => s += `<circle cx="${X(r[XV])}" cy="${Y(r[YV])}" r="3" fill="var(--q)" opacity=".5"/>`);
    // escalera anterior (gris) y actual
    const grid = []; for (let x = 0; x <= 8.0001; x += 0.02) grid.push(x);
    if (m > 0) s += `<polyline points="${grid.map(x => X(x) + "," + Y(Fx(run, st.lr, m - 1, x))).join(" ")}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    s += `<polyline points="${grid.map(x => X(x) + "," + Y(Fx(run, st.lr, m, x))).join(" ")}" fill="none" stroke="var(--cobre)" stroke-width="3" stroke-linejoin="round"/>`;
    if (m > 0) { const p = run.pasos[m - 1]; s += `<line x1="${X(p.u)}" x2="${X(p.u)}" y1="12" y2="${H - 34}" stroke="var(--ink)" stroke-dasharray="4 3"/><text x="${X(p.u) + 4}" y="24" class="tick">corte ${fmt3(p.u)}</text>`; }
    s += "</svg>";
    const rr = run.R[m];
    el("gb-viz").innerHTML = `<div class="block stage" style="flex:1 1 100%"><div class="t">F<sub>${m}</sub>(x) con η = ${fmt2(st.lr)} (punteada: la ronda anterior; puntos: entrenamiento)</div>${s}</div>
    <div class="kpi stage" style="max-width:none;flex:1 1 100%"><div><div class="t">rondas sumadas</div><div class="v">${m}</div></div>${m > 0 ? `<div><div class="t">escalón izq / der</div><div class="v" style="font-size:1.1rem">${fmt4(rr.ml)} / ${fmt4(rr.mr)}</div></div>` : `<div><div class="t">F₀ = promedio de roa</div><div class="v">${fmt4(run.F0)}</div></div>`}<div><div class="t">ECM entrenamiento</div><div class="v">${fmt4(rr.mseTr)}</div></div><div><div class="t">ECM prueba</div><div class="v" style="color:var(--cobre)">${fmt4(rr.mseTe)}</div></div></div>`;
    el("gb-nota").innerHTML = m === 0 ? `<b>Ronda 0.</b> La predicción es el promedio de roa, ${fmt4(run.F0)}, para todas las empresas. El ECM de entrenamiento es la varianza de roa: ${fmt4(rr.mseTr)}.` :
      `<b>Ronda ${m}.</b> El residuo r = roa − F<sub>${m - 1}</sub> se explica mejor cortando en ventas/deuda ${fmt3(rr.u)}: a la izquierda el residuo promedio es ${fmt4(rr.ml)}, a la derecha ${fmt4(rr.mr)}. Se suma η × ese escalón: F<sub>${m}</sub> = F<sub>${m - 1}</sub> + ${fmt2(st.lr)} × h<sub>${m}</sub>. El ECM de entrenamiento baja de ${fmt4(run.R[m - 1].mseTr)} a ${fmt4(rr.mseTr)}; el de prueba ${rr.mseTe < run.R[m - 1].mseTe ? "también baja" : "ya no baja"} (${fmt4(run.R[m - 1].mseTe)} → ${fmt4(rr.mseTe)}).`;
    if (anim) stagger(el("gb-s1"));
  }
  function rTabla(anim) {
    const run = correr(st.lr);
    el("gb-tabla").innerHTML = `<div class="block stage"><div class="t">Error cuadrático medio por ronda (η = ${fmt2(st.lr)})</div>${tabla(["ronda", "corte", "escalón izq", "escalón der", "ECM entren.", "ECM prueba"], run.R.map((r, m) => ({ c: [m, m ? fmt3(r.u) : "", m ? fmt4(r.ml) : "", m ? fmt4(r.mr) : "", fmt4(r.mseTr), fmt4(r.mseTe)], cls: m === st.r ? "hi" : "" })))}</div>
    <div class="block stage"><div class="t">ECM según la ronda</div>${curva([{ pts: run.R.map((r, m) => [m, r.mseTr]), col: "var(--q)", marks: true, lab: "entrenamiento" }, { pts: run.R.map((r, m) => [m, r.mseTe]), col: "var(--cobre)", marks: true, lab: "prueba" }], { xr: [0, 6], yr: [0.01, 0.03], xt: [0, 1, 2, 3, 4, 5, 6], yt: [0.01, 0.02, 0.03], yf: v => fmt3(v), xl: "ronda" })}<p style="font-size:.88rem;color:var(--muted)">Con η = 1 el error de entrenamiento cae más rápido; con η chico cada ronda avanza poco. La regla práctica: η chico y muchas rondas, con parada temprana cuando el error de prueba deja de bajar.</p></div>`;
    if (anim) stagger(el("gb-s2"));
  }
  function render(anim) { if (st.paso === 0 && anim) stagger(el("gb-s0")); if (st.paso === 1) rViz(anim); if (st.paso === 2) rTabla(anim); }
  el("gb-r").oninput = e => { st.r = +e.target.value; el("gb-r-v").textContent = st.r; if (st.paso === 1) rViz(false); if (st.paso === 2) rTabla(false); };
  el("gb-lr").oninput = e => { st.lr = +e.target.value / 10; el("gb-lr-v").textContent = fmt2(st.lr); if (st.paso === 1) rViz(false); if (st.paso === 2) rTabla(false); };
  let timer = null;
  el("gb-play").onclick = () => { if (st.paso !== 1) GOTO.gb(1); clearInterval(timer); st.r = 0; el("gb-r").value = 0; el("gb-r-v").textContent = 0; rViz(false); timer = setInterval(() => { if (st.r >= M) { clearInterval(timer); return; } st.r++; el("gb-r").value = st.r; el("gb-r-v").textContent = st.r; rViz(false); }, reduced ? 400 : 1200); };
  el("gb-replay").onclick = () => render(true);
  GOTO.gb = pasoGenerico("gb", 3, st, render);
  stepper("gb", ["La idea", "La escalera", "El error"], GOTO.gb);
})();

// ===================== 08 IMPORTANCIA =====================
(function () {
  const st = ST.imp;
  const N = TRAIN.length;
  // ---- regresión logística (IRLS) con ratios estandarizados
  const mu = {}, sd = {}; RATIOS.forEach(k => { const xs = TRAIN.map(r => r[k]); const m = xs.reduce((s, x) => s + x, 0) / N; mu[k] = m; sd[k] = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / N); });
  const Z = TRAIN.map(r => [1, ...RATIOS.map(k => (r[k] - mu[k]) / sd[k])]), y = TRAIN.map(r => r.impago);
  function solve(A, b) { const n = b.length; const M = A.map((row, i) => [...row, b[i]]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } } return M.map((row, i) => row[n] / row[i]); }
  let beta = new Array(6).fill(0), se = new Array(6).fill(0);
  for (let it = 0; it < 25; it++) {
    const p = Z.map(z => 1 / (1 + Math.exp(-z.reduce((s, v, k) => s + v * beta[k], 0))));
    const H = Array.from({ length: 6 }, () => new Array(6).fill(0)), g = new Array(6).fill(0);
    Z.forEach((z, i) => { const w = p[i] * (1 - p[i]); for (let a = 0; a < 6; a++) { g[a] += z[a] * (y[i] - p[i]); for (let b = 0; b < 6; b++) H[a][b] += w * z[a] * z[b]; } });
    const step = solve(H, g); beta = beta.map((b, k) => b + step[k]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) { const inv = RATIOS.map((_, k) => solve(H, Array.from({ length: 6 }, (_, i) => i === k + 1 ? 1 : 0))[k + 1]); se = [0, ...inv.map(Math.sqrt)]; break; }
  }
  const pLogit = r => 1 / (1 + Math.exp(-(beta[0] + RATIOS.reduce((s, k, i) => s + beta[i + 1] * (r[k] - mu[k]) / sd[k], 0))));
  const accLogit = rows => rows.filter(r => (pLogit(r) > 0.5 ? 1 : 0) === r.impago).length / rows.length;
  // ---- importancia por impureza de un árbol CART anidado con cnt
  function impGini(t, acc = {}, total = t.cnt) {
    if (t.hoja !== undefined) return acc;
    const g = n => gini(n[1]); const red = t.cnt / total * (g(t.n) - (t.izq.cnt / t.cnt) * g(t.izq.n) - (t.der.cnt / t.cnt) * g(t.der.n));
    acc[t.var] = (acc[t.var] || 0) + red; impGini(t.izq, acc, total); impGini(t.der, acc, total); return acc;
  }
  const norm = o => { const s = Object.values(o).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / s])); };
  const ARB = cartClf(TRAIN, 2, RATIOS); const IMP_ARB = norm(impGini(ARB));
  // ---- ID3 sobre las 14 empresas: ganancia ponderada por nodo
  function impId3(rows, attrs, acc = {}, total = rows.length) {
    const si = rows.filter(r => r.paga === "si").length; if (si === 0 || si === rows.length || !attrs.length) return acc;
    const gs = attrs.map(a => ganancia(rows, a)); const best = gs.reduce((b, g) => g.gan > b.gan + 1e-12 ? g : b, gs[0]);
    if (best.gan <= 1e-12) return acc; acc[best.a] = (acc[best.a] || 0) + rows.length / total * best.gan;
    vals(rows, best.a).forEach(v => impId3(rows.filter(r => r[best.a] === v), attrs.filter(a => a !== best.a), acc, total)); return acc;
  }
  const IMP_ID3_RAW = impId3(CRED, ATTRS), IMP_ID3 = norm(IMP_ID3_RAW);
  // ---- bosque: 7 árboles de bagging refit desde las cuentas bootstrap, e importancia promedio
  const BOOT = DATA.cuentas[0].map((_, b) => { const rows = []; TRAIN.forEach((r, i) => { for (let k = 0; k < DATA.cuentas[i][b]; k++) rows.push(r); }); return cartClf(rows, 2, RATIOS); });
  window.IMP_BOOT = BOOT;
  const IMP_BAG = norm(BOOT.reduce((acc, t) => { const im = norm(impGini(t)); RATIOS.forEach(k => acc[k] = (acc[k] || 0) + (im[k] || 0) / BOOT.length); return acc; }, {}));
  const voto = (trees, r) => trees.reduce((s, t) => s + predArbol(t, r), 0) * 2 > trees.length ? 1 : 0;
  const accVoto = rows => rows.filter(r => voto(DATA.bag, r) === r.impago).length / rows.length;
  function permImp(sem) {
    const rnd = rng32(7000 + sem), base = accVoto(TEST), out = {};
    RATIOS.forEach(k => { let s = 0; for (let rep = 0; rep < 20; rep++) { const col = TEST.map(r => r[k]); for (let i = col.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [col[i], col[j]] = [col[j], col[i]]; } const rows = TEST.map((r, i) => ({ ...r, [k]: col[i] })); s += base - accVoto(rows); } out[k] = s / 20; });
    return { base, out };
  }
  const IMP_RF100 = Object.fromEntries(RATIOS.map((k, i) => [k, DATA.ref.imp[i]]));
  const fmtS = x => (x >= 0 ? "+" : "") + fmt2(x);
  function rLogit(anim) {
    const filas = RATIOS.map((k, i) => ({ k, b: beta[i + 1], s: se[i + 1] })).sort((a, b) => Math.abs(b.b) - Math.abs(a.b));
    el("imp-logit").innerHTML = `<div class="block stage"><div class="t">Regresión logística, ratios estandarizados (146 de entrenamiento)</div>${tabla(["ratio", "β estandarizado", "error estándar", "|β| / e.e.", "lectura"], filas.map(f => ({ c: [nom(f.k), fmtS(f.b), fmt2(f.s), fmt2(Math.abs(f.b) / f.s), f.b < 0 ? "más alto, menos riesgo" : "más alto, más riesgo"] })))}<p style="font-size:.88rem;color:var(--muted)">Acierto: ${pct(accLogit(TRAIN))} en entrenamiento, ${pct(accLogit(TEST))} en prueba. Un |β| / e.e. mayor que 2 es, a grandes rasgos, "distinto de cero".</p></div>
    <div class="block stage" style="flex:1 1 340px"><div class="t">|β estandarizado|, ordenado</div>${barras(filas.map(f => ({ lab: nom(f.k), v: Math.abs(f.b), txt: fmtS(f.b), cls: f.b > 0 ? "pred" : "real" })), { max: Math.max(...filas.map(f => Math.abs(f.b))) * 1.1 })}<div class="legend"><span><i style="background:var(--cobre)"></i>sube el riesgo</span><span><i style="background:var(--v)"></i>baja el riesgo</span></div></div>`;
    const top = filas[0], roa = filas.find(f => f.k === "roa");
    el("imp-logit-nota").innerHTML = `<b>Lectura.</b> Según la regresión, el ratio que más mueve el riesgo por desviación estándar es ${nom(top.k)} (β = ${fmtS(top.b)}): ${top.b < 0 ? "más liquidez, menos impago" : "más, más impago"}. Fíjate en el signo de roa (${fmtS(roa.b)}): más rentabilidad asociada a más riesgo no tiene sentido económico, y es el tipo de resultado que aparece cuando los ratios están correlacionados entre sí y la relación no es lineal; la regresión reparte el efecto conjunto como puede. Con 146 empresas, además, varios coeficientes no se distinguen de cero.`;
    if (anim) stagger(el("imp-s0"));
  }
  function rArbol(anim) {
    const ordA = Object.entries(IMP_ARB).sort((a, b) => b[1] - a[1]), ordI = ATTRS.map(a => [a, IMP_ID3[a] || 0]).sort((a, b) => b[1] - a[1]);
    el("imp-arbol").innerHTML = `<div class="block stage"><div class="t">ID3 sobre las 14 empresas (ganancia ponderada por nodo)</div>${tabla(["atributo", "suma ponderada (bits)", "importancia"], ordI.map(([a, v]) => ({ c: [nom(a), fmt3(IMP_ID3_RAW[a] || 0), pct0(v)] })))}<p style="font-size:.88rem;color:var(--muted)">Raíz: deuda con ganancia 0,292 y peso 14/14. Debajo, garantía en la rama de deuda alta (5 de 14) e historial en la de deuda media (5 de 14). Tamaño nunca se preguntó: importancia 0. Fíjate en que garantía e historial superan a deuda: sus preguntas dejan grupos puros (ganancia 0,971 cada una) y, pesadas por 5/14, dan 0,347 contra los 0,292 de la raíz. En un árbol tan chico la raíz no siempre gana.</p></div>
    <div class="block stage"><div class="t">CART de profundidad 2 sobre las 146 (caída del Gini ponderada)</div>${barras(ordA.map(([k, v]) => ({ lab: nom(k), v, txt: pct0(v), cls: "pred" })), { max: 1 })}<p style="font-size:.88rem;color:var(--muted)">Tres nodos internos, tres variables con importancia; las otras dos quedan en cero aunque tal vez hubieran sido segundas por poco en algún nodo.</p></div>`;
    el("imp-arbol-nota").innerHTML = `<b>Lectura.</b> En el árbol de profundidad 2, ${nom(ordA[0][0])} se lleva el ${pct0(ordA[0][1])} porque es la raíz: su corte lo ven las 146 empresas. Compara con la regresión del paso anterior, donde ${nom(ordA[0][0])} no era la primera: no es que uno de los dos se equivoque, es que miden cosas distintas y con datos distintos supuestos.`;
    if (anim) stagger(el("imp-s1"));
  }
  function rBosque(anim) {
    const pm = permImp(st.sem); const ordB = Object.entries(IMP_BAG).sort((a, b) => b[1] - a[1]), ordP = RATIOS.map(k => [k, pm.out[k]]).sort((a, b) => b[1] - a[1]);
    el("imp-bosque").innerHTML = `<div class="block stage"><div class="t">Por impureza: promedio de los 7 árboles de bagging</div>${barras(ordB.map(([k, v]) => ({ lab: nom(k), v, txt: pct0(v), cls: "pred" })), { max: 1 })}<p style="font-size:.88rem;color:var(--muted)">Son los mismos 7 árboles de la pestaña 05 (mismas muestras bootstrap, mismas raíces y umbrales). Random forest de 100 árboles: ${RATIOS.map(k => nom(k) + " " + pct0(IMP_RF100[k])).join(", ")}.</p></div>
    <div class="block stage"><div class="t">Por permutación: caída de acierto en prueba (bagging, 20 barajados)</div>${barras(ordP.map(([k, v]) => ({ lab: nom(k), v: Math.max(0, v), txt: (v >= 0 ? "+" : "") + (100 * v).toFixed(1).replace(".", ",") + " pts", cls: "real" })), { max: Math.max(0.05, ...ordP.map(x => x[1])) * 1.1 })}<p style="font-size:.88rem;color:var(--muted)">Acierto sin barajar: ${pct(pm.base)}. Un valor cercano a cero o negativo significa que barajar esa columna no empeoró la predicción.</p></div>`;
    el("imp-bosque-nota").innerHTML = `<b>Lectura.</b> Por permutación, la variable que más cuesta perder es ${nom(ordP[0][0])}: barajarla baja el acierto en prueba ${(100 * ordP[0][1]).toFixed(1).replace(".", ",")} puntos en promedio. Con 73 empresas de prueba, un punto es menos de una empresa, así que las diferencias chicas entre variables son ruido; lo robusto es qué variables están claramente por encima de cero y cuáles no.`;
    if (anim) stagger(el("imp-s2"));
  }
  function rAda(anim) {
    const R = window.ADA_R || []; const suma = {}; R.forEach(ro => suma[ro.f] = (suma[ro.f] || 0) + ro.a); const tot = Object.values(suma).reduce((a, b) => a + b, 0);
    el("imp-ada").innerHTML = `<div class="block stage"><div class="t">AdaBoost, 5 rondas: suma de α por variable</div>${tabla(["ronda", "tocón", "α"], R.map((ro, m) => ({ c: [m + 1, `${nom(ro.f)} ${ro.d === 1 ? "≤" : ">"} ${fmt3(ro.u)}`, fmt3(ro.a)] })))}</div>
    <div class="block stage"><div class="t">Importancia (α acumulado, normalizado)</div>${barras(Object.entries(suma).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ lab: nom(k), v: v / tot, txt: fmt3(v) + " (" + pct0(v / tot) + ")", cls: "pred" })), { max: 1 })}<p style="font-size:.88rem;color:var(--muted)">Solo dos ratios participaron en esa pestaña, así que la comparación es entre ellos. La ronda 1 pesa más que las cuatro siguientes juntas: es lo normal, los tocones tardíos trabajan sobre las empresas difíciles y ganan poco.</p></div>`;
    if (anim) stagger(el("imp-s3"));
  }
  function rTodo(anim) {
    const pm = permImp(st.sem);
    const filas = RATIOS.map((k, i) => ({ k, b: beta[i + 1], arb: IMP_ARB[k] || 0, rf: IMP_RF100[k], perm: pm.out[k] })).sort((a, b) => b.rf - a.rf);
    const rank = key => { const o = [...filas].sort((a, b) => Math.abs(b[key]) - Math.abs(a[key])); return Object.fromEntries(o.map((f, i) => [f.k, i + 1])); };
    const rb = rank("b"), ra = rank("arb"), rr = rank("rf"), rp = rank("perm");
    el("imp-todo").innerHTML = `<div class="block stage" style="flex:1 1 100%"><div class="t">Los cinco ratios según cuatro medidas (misma partición)</div>${tabla(["ratio", "β logístico estandarizado", "árbol prof. 2 (impureza)", "random forest 100 (impureza)", "bagging 7 (permutación)", "ranking β / árbol / bosque / perm."], filas.map(f => ({ c: [nom(f.k), fmtS(f.b), pct0(f.arb), pct0(f.rf), (f.perm >= 0 ? "+" : "") + (100 * f.perm).toFixed(1).replace(".", ",") + " pts", `${rb[f.k]} / ${ra[f.k]} / ${rr[f.k]} / ${rp[f.k]}`] })))}</div>`;
    const top = filas[0];
    const rfTop = filas[0], bTop = [...filas].sort((a, b) => Math.abs(b.b) - Math.abs(a.b))[0];
    el("imp-todo-nota").innerHTML = `<b>Lectura.</b> El bosque de 100 árboles reparte la importancia entre ${nom(filas[0].k)}, ${nom(filas[1].k)} y ${nom(filas[2].k)} sin que ninguna domine; el árbol chico se la da casi toda a su raíz, ${nom([...filas].sort((a, b) => b.arb - a.arb)[0].k)}; la regresión pone primera a ${nom(bTop.k)}, que en el bosque queda en el lugar ${rr[bTop.k]}. Y roa, con signo económicamente raro en la regresión, tiene ${pct0(filas.find(f => f.k === "roa").rf)} en el bosque y ${pct0(filas.find(f => f.k === "roa").arb)} en el árbol chico: los árboles la usan poco y sin comprometerse con una dirección global.`;
    if (anim) stagger(el("imp-s4"));
  }
  function render(anim) { [rLogit, rArbol, rBosque, rAda, rTodo][st.paso](anim); }
  el("imp-otra").onclick = () => { st.sem++; rBosque(true); };
  el("imp-replay").onclick = () => render(true);
  GOTO.imp = pasoGenerico("imp", 5, st, render);
  stepper("imp", ["Los betas", "En un árbol", "En un bosque", "En boosting", "Todo junto"], GOTO.imp);
})();

// ===================== BONUS C5.0 =====================
(function () {
  const st = ST.c5;
  const Z = { "0.01": 2.33, "0.05": 1.65, "0.10": 1.28, "0.20": 0.84, "0.25": 0.693 };   // tabla de C4.5
  function addErrs(N, E, cf) {
    if (N <= 0) return 0; const z = Z[cf.toFixed(2)];
    if (E < 1e-6) return N * (1 - Math.pow(cf, 1 / N));
    if (E < 1) { const v0 = N * (1 - Math.pow(cf, 1 / N)); return v0 + E * (addErrs(N, 1, cf) - v0); }
    if (E + 0.5 >= N) return 0.67 * (N - E);
    const p = (E + 0.5) / N; let v = p + z * z / (2 * N) + z * Math.sqrt(p / N - p * p / N + z * z / (4 * N * N)); v /= (1 + z * z / N); return v * N - E;
  }
  // ---- paso 1: particiones binarias de un atributo
  function subconjuntos(vs) { const out = []; const k = vs.length; for (let m = 1; m < (1 << k) - 1; m++) { const S = vs.filter((_, i) => m & (1 << i)); const comp = vs.filter((_, i) => !(m & (1 << i))); if (S.length > comp.length || (S.length === comp.length && S[0] !== vs[0] && comp.includes(vs[0]))) continue; out.push([S, comp]); } return out; }
  function rSub(anim) {
    const a = st.attr, vs = vals(CRED, a), Hy = entropiaDe(CRED, "paga"); const g = ganancia(CRED, a);
    const filas = [{ c: ["todos los valores por separado (ID3): " + vs.join(" / "), vs.map(v => CRED.filter(r => r[a] === v).length).join(" / "), fmt3(g.gan), fmt3(g.Hx), fmt3(g.gan / g.Hx)], cls: "" }];
    let best = null;
    subconjuntos(vs).forEach(([S, C]) => {
      const L = CRED.filter(r => S.includes(r[a])), R = CRED.filter(r => !S.includes(r[a])); const pl = L.length / CRED.length;
      const HL = Hbits([L.filter(r => r.paga === "si").length / L.length, L.filter(r => r.paga === "no").length / L.length]), HR = Hbits([R.filter(r => r.paga === "si").length / R.length, R.filter(r => r.paga === "no").length / R.length]);
      const gan = Hy - pl * HL - (1 - pl) * HR, si = Hbits([pl, 1 - pl]), gr = gan / si;
      const fila = { c: [`{${S.join(", ")}} contra {${C.join(", ")}}`, `${L.length} / ${R.length}`, fmt3(gan), fmt3(si), fmt3(gr)], gr }; filas.push(fila); if (!best || gr > best.gr) best = fila;
    });
    if (best) best.cls = "hi";
    el("c5-sub").innerHTML = `<div class="block stage" style="flex:1 1 100%"><div class="t">Cortes posibles para ${nom(a)} sobre las 14 empresas</div>${tabla(["corte", "n por grupo", "ganancia (bits)", "entropía de la partición", "gain ratio"], filas)}</div>`;
    el("c5-sub-nota").innerHTML = a === "deuda" ? `<b>Lectura.</b> Partir {baja} contra {media, alta} tiene exactamente la misma ganancia que partir en tres (0,292 bits): toda la información de la deuda estaba en separar a las cuatro de deuda baja, que pagan todas. Pero la partición binaria reparte 4 contra 10, con entropía 0,863, y la de tres valores tiene entropía 1,577, así que el gain ratio del corte binario casi duplica al de ID3 (0,338 contra 0,185). C5.0 obtiene lo mismo con menos pedazos, y le quedan 10 empresas juntas para seguir preguntando.` : `<b>Lectura.</b> La fila destacada es la partición binaria de mayor gain ratio. Compara su ganancia con la de partir en todos los valores: cuando son iguales, el corte binario se lleva toda la información con menos pedazos; cuando la binaria es menor, el atributo necesitaba más de dos grupos para decir todo lo que sabe.`;
    if (anim) stagger(el("c5-s1"));
  }
  // ---- paso 2: valor faltante en el árbol CART d2 (con conteos)
  const ARB = cartClf(TRAIN, 2, RATIOS);
  function probaFalt(t, r, falta) {
    if (t.hoja !== undefined) return { p: t.n[1], camino: [] };
    if (t.var === falta) {
      const wl = t.izq.cnt / (t.izq.cnt + t.der.cnt), a = probaFalt(t.izq, r, falta), b = probaFalt(t.der, r, falta);
      return { p: wl * a.p + (1 - wl) * b.p, camino: [{ nodo: t, falta: true, wl, pl: a.p, pr: b.p }] };
    }
    const izq = r[t.var] <= t.umbral; const sub = probaFalt(izq ? t.izq : t.der, r, falta);
    return { p: sub.p, camino: [{ nodo: t, falta: false, izq }].concat(sub.camino) };
  }
  const selE = el("c5-emp"); selE.innerHTML = TEST.map((r, i) => `<option value="${i}">empresa de prueba ${i + 1} (${r.impago ? "impago" : "paga"})</option>`).join("");
  const selF = el("c5-falta"); selF.innerHTML = `<option value="">ninguno</option>` + RATIOS.map(r => `<option value="${r}"${r === st.falta ? " selected" : ""}>${nom(r)}</option>`).join("");
  function rFalt(anim) {
    const r = TEST[st.emp]; const con = probaFalt(ARB, r, "__"); const sin = probaFalt(ARB, r, st.falta);
    const svg = svgArbol(ARB, { hoja: nd => nd.hoja ? "impago" : "paga", sub: nd => "n " + nd.cnt + " · " + pct0(nd.n[1]) });
    let pasos = "";
    sin.camino.forEach(c => {
      if (c.falta) pasos += `<p>En el nodo <b>${nom(c.nodo.var)} ≤ ${fmt3(c.nodo.umbral)}</b> falta el valor. De las ${c.nodo.cnt} empresas de entrenamiento que llegaron aquí, ${c.nodo.izq.cnt} fueron a la izquierda y ${c.nodo.der.cnt} a la derecha, así que la empresa baja por las dos con pesos ${fmt3(c.wl)} y ${fmt3(1 - c.wl)}. La rama izquierda (siguiendo con los otros ratios) dice P(impago) = ${fmt3(c.pl)}; la derecha, ${fmt3(c.pr)}.</p><p>P(impago) = ${fmt3(c.wl)} × ${fmt3(c.pl)} + ${fmt3(1 - c.wl)} × ${fmt3(c.pr)} = <b>${fmt3(sin.p)}</b>.</p>`;
      else pasos += `<p>Nodo <b>${nom(c.nodo.var)} ≤ ${fmt3(c.nodo.umbral)}</b>: la empresa tiene ${nom(c.nodo.var)} = ${fmt3(r[c.nodo.var])}, va a la ${c.izq ? "izquierda" : "derecha"}.</p>`;
    });
    el("c5-falt").innerHTML = `<div class="block stage" style="flex:1 1 100%"><div class="t">Árbol CART de profundidad 2 (n de entrenamiento y fracción de impago en cada nodo)</div>${svg}</div>
    <div class="block stage" style="flex:1 1 320px"><div class="t">Los ratios de la empresa</div>${tabla(["ratio", "valor"], RATIOS.map(k => ({ c: [nom(k), k === st.falta ? "<b style='color:var(--bad)'>falta</b>" : fmt3(r[k])] })))}</div>
    <div class="block stage" style="flex:1 1 380px"><div class="t">El recorrido</div>${pasos}<div class="kpi" style="max-width:none"><div><div class="t">P(impago) con el dato</div><div class="v">${fmt3(con.p)}</div></div><div><div class="t">P(impago) sin el dato</div><div class="v" style="color:var(--cobre)">${fmt3(sin.p)}</div></div><div><div class="t">real</div><div class="v">${r.impago ? "impago" : "paga"}</div></div></div></div>`;
    el("c5-falt-nota").innerHTML = st.falta ? `<b>Lectura.</b> Sin el dato, la predicción es una mezcla de las dos ramas, pesada por cuántas empresas fueron por cada lado en el entrenamiento. Si el ratio que falta no está en el camino de esta empresa, la predicción no cambia: solo importan las preguntas que el árbol efectivamente le hace. Con el dato, P(impago) = ${fmt3(con.p)}; sin él, ${fmt3(sin.p)}.` : `<b>Lectura.</b> Con todos los ratios la empresa sigue un solo camino hasta una hoja. Elige arriba un ratio que falte para ver la mezcla.`;
    if (anim) stagger(el("c5-s2"));
  }
  // ---- paso 3: poda pesimista
  function rPoda(anim) {
    const cf = st.cf, z = Z[cf.toFixed(2)]; const N = +el("c5-pN").value || 1, E = Math.min(N, +el("c5-pE").value || 0);
    const hojas = [1, 2, 3].map(k => ({ N: +el(`c5-h${k}N`).value || 0, E: +el(`c5-h${k}E`).value || 0 })).filter(h => h.N > 0).map(h => ({ ...h, E: Math.min(h.N, h.E) }));
    const pHoja = E + addErrs(N, E, cf); const pSub = hojas.reduce((s, h) => s + h.E + addErrs(h.N, h.E, cf), 0); const NT = hojas.reduce((s, h) => s + h.N, 0), ET = hojas.reduce((s, h) => s + h.E, 0);
    const poda = pHoja <= pSub + 0.1;
    el("c5-poda").innerHTML = `<div class="block stage" style="flex:1 1 100%"><div class="t">Con cf = ${fmt2(cf)}, z = ${fmt2(z)}: errores observados y errores pesimistas (E + AddErrs)</div>${tabla(["", "N", "errores E", "AddErrs(N, E)", "errores pesimistas"], [{ c: ["el nodo convertido en hoja", N, E, fmt2(addErrs(N, E, cf)), "<b>" + fmt2(pHoja) + "</b>"], cls: poda ? "hi" : "" }].concat(hojas.map((h, k) => ({ c: [`hoja ${k + 1}`, h.N, h.E, fmt2(addErrs(h.N, h.E, cf)), fmt2(h.E + addErrs(h.N, h.E, cf))] }))).concat([{ c: ["suma de las hojas (el subárbol)", NT, ET, fmt2(pSub - ET), "<b>" + fmt2(pSub) + "</b>"], cls: poda ? "" : "hi" }]))}</div>
    <div class="kpi stage" style="flex:1 1 100%;max-width:none"><div><div class="t">decisión</div><div class="v" style="color:${poda ? "var(--cobre)" : "var(--ok)"}">${poda ? "se poda" : "se mantiene"}</div></div><div><div class="t">errores observados: hoja contra subárbol</div><div class="v">${E} <small>contra</small> ${ET}</div></div></div>`;
    el("c5-poda-nota").innerHTML = `<b>Lectura.</b> Como hoja, el nodo se equivoca en ${E} de ${N}; el subárbol, en ${ET} de ${NT}, siempre menos o igual, porque las hojas se ajustaron a los datos. La poda pesimista le cobra a cada hoja un castigo que crece cuando N es chico, incluso si la hoja es pura: aquí las hojas pagan ${hojas.map(h => fmt2(addErrs(h.N, h.E, cf))).join(" y ")} errores extra. ${poda ? "Con este cf el castigo a las hojas chicas supera lo que el subárbol ganaba: se poda y el nodo queda como hoja." : "Con este cf el subárbol sigue ganando después del castigo: se mantiene. Prueba con un cf de 0,01, o con hojas más chicas."}`;
    if (anim) stagger(el("c5-s3"));
  }
  function rFinal(anim) { if (anim) stagger(el("c5-s4")); }
  const CH = DATA.churn; const selC = el("c5-cli"); selC.innerHTML = CH.clientes.map((c, i) => `<option value="${i}">cliente ${c.id}: ${c.region}, ${c.plan}, ${c.antiguedad} meses${c.churn ? " (se fue)" : " (se quedó)"}</option>`).join("");
  st.cli = 0;
  const fmtN = x => x.toLocaleString("es-CL");
  function rCliente() {
    const c = CH.clientes[st.cli]; const conds = c.regla.split(" AND ");
    const acciones = [];
    if (/region IN \{[^}]*(Arica|Araucan|Tarapac|Los Ríos|Ays|Magallanes)/.test(c.regla)) acciones.push("región con fuga alta: revisar cobertura y calidad de red antes de ofrecer descuentos");
    if (/antiguedad_meses <= 8\.5/.test(c.regla)) acciones.push("cliente nuevo: programa de bienvenida y contacto en el primer trimestre");
    if (/reclamos_12m > 1\.5/.test(c.regla)) acciones.push("reclamos repetidos: derivar a retención con el historial de reclamos resuelto");
    if (/plan IN \{prepago\}/.test(c.regla)) acciones.push("prepago: ofrecer migración a un plan con permanencia y beneficio inmediato");
    if (/MISSING/.test(c.regla)) acciones.push("un dato faltante aparece en la regla: completar el registro del cliente");
    if (!acciones.length) acciones.push("segmento de bajo riesgo: no gastar presupuesto de retención aquí");
    el("c5-cliente").innerHTML = `<div class="block stage" style="flex:1 1 280px"><div class="t">Cliente ${c.id}</div>${tabla(["variable", "valor"], [["región", c.region], ["plan", c.plan], ["antigüedad", c.antiguedad + " meses"], ["gasto mensual", "$" + fmtN(c.gasto)], ["reclamos 12 m", c.reclamos], ["datos (GB)", c.datos === null ? "<b style='color:var(--bad)'>falta</b>" : c.datos], ["edad", c.edad === null ? "<b style='color:var(--bad)'>falta</b>" : c.edad], ["se fue", c.churn ? "sí" : "no"]].map(x => ({ c: x })))}</div>
    <div class="block stage" style="flex:1 1 420px"><div class="t">clf.predict_rule(cliente): la regla que se activó</div><ol style="margin:4px 0 8px 18px;padding:0;font-size:.92rem;line-height:1.45">${conds.map(x => `<li>${x.replace(/\.(\d)000\b/g, ".$1").replace(/\./g, ",").replace("IN {", "en {").replace("NOT en", "no en").replace(" MISSING", " faltante")}</li>`).join("")}</ol><div class="kpi" style="max-width:none"><div><div class="t">P(se va) según la hoja</div><div class="v" style="color:${c.p > 0.3 ? "var(--cobre)" : "var(--ok)"}">${fmt3(c.p)}</div></div><div><div class="t">condiciones</div><div class="v">${conds.length}</div></div></div></div>`;
    el("c5-cliente-nota").innerHTML = `<b>Lectura de negocio.</b> ${acciones.join("; ")}. La regla es la misma frase que se le muestra al cliente o al ejecutivo, y cada hoja del árbol define un segmento con su propia acción: eso es lo que un ensamble o una regresión no entregan.`;
  }
  selC.onchange = e => { st.cli = +e.target.value; rCliente(); };
  function rIntro(anim) {
    const f = CH.filas, b = CH.boost;
    el("c5-churn-tabla").innerHTML = tabla(["modelo", "preprocesamiento", "hojas", "profundidad", "acierto", "AUC"], f.map((r, i) => ({ c: [r.modelo, r.preproceso, r.hojas, r.prof, pct(r.acc), fmt3(r.auc)], cls: i === 0 ? "hi" : "" })).concat(b.map(r => ({ c: [r.modelo, r.modelo.startsWith("c50py") ? "ninguno" : "dummies + mediana", "ensamble", "", pct(r.acc), fmt3(r.auc)] }))));
    el("c5-churn-nota").innerHTML = `<b>Cómo leer la tabla.</b> Con el mismo freno, <code>c50py</code> da un árbol mucho más chico y mejor: con mínimo 25 por hoja, ${f[2].hojas} hojas contra ${f[3].hojas}, acierto ${pct(f[2].acc)} contra ${pct(f[3].acc)} y AUC ${fmt3(f[2].auc)} contra ${fmt3(f[3].auc)}; con mínimo 10, ${f[0].hojas} hojas contra ${f[1].hojas}. Buscando los mejores hiperparámetros de scikit-learn por validación cruzada se llega a ${f[4].hojas} hojas, ${pct(f[4].acc)} y ${fmt3(f[4].auc)}: empata en AUC con el C5.0 de 12 hojas y acierta menos. El AUC mide si el modelo ordena bien a los clientes por riesgo; el acierto, cuántos clasifica bien con el umbral de 0,5. Y la columna de preprocesamiento es la que un equipo de negocio nota: nada contra dummies más imputación.`;
    el("c5-arbol-c5").textContent = CH.arbol_c5; el("c5-arbol-sk").textContent = CH.arbol_sk;
    const opG = t => ({ nodo: n => n.lab, eIzq: n => n.ei, eDer: n => n.ed, hoja: n => n.hoja ? "se va" : "se queda", sub: n => `n ${n.cnt} · ${pct0(n.p1)}`, w: Math.max(640, 96 * (function nh(x) { return x.hoja !== undefined ? 1 : nh(x.izq) + nh(x.der); })(t)), dy: 84 });
    el("c5-g-c5").innerHTML = svgArbol(CH.arbol_c5_g, opG(CH.arbol_c5_g)); el("c5-g-sk").innerHTML = svgArbol(CH.arbol_sk_g, opG(CH.arbol_sk_g)).replace('width="100%"', 'width="' + opG(CH.arbol_sk_g).w + '"');
    const rs = CH.resumen; const muestra = CH.muestra;
    el("c5-datos").innerHTML = `<div class="kpi stage" style="flex:1 1 100%;max-width:none;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))"><div><div class="t">clientes</div><div class="v">${fmtN(rs.n)}</div></div><div><div class="t">se fueron</div><div class="v">${pct(rs.fuga)}</div></div><div><div class="t">regiones</div><div class="v">${rs.regiones}</div></div><div><div class="t">sin dato de uso</div><div class="v">${rs.faltan_datos}</div></div><div><div class="t">sin edad</div><div class="v">${rs.faltan_edad}</div></div></div>
    <div class="block stage" style="flex:1 1 100%"><div class="t">Los primeros 25 clientes (celdas en rojo: dato faltante)</div><div class="mwrap" style="max-height:360px;overflow-y:auto">${tabla(["#", "región", "plan", "antigüedad (meses)", "gasto mensual", "reclamos 12 m", "datos (GB)", "edad", "se fue"], muestra.map((r, i) => ({ c: [i + 1, r.region, r.plan, r.antiguedad_meses, "$" + fmtN(r.gasto_mensual), r.reclamos_12m, r.datos_gb === null ? "<b style='color:var(--bad)'>falta</b>" : r.datos_gb, r.edad === null ? "<b style='color:var(--bad)'>falta</b>" : r.edad, `<b style="color:${r.churn ? "var(--bad)" : "var(--ok)"}">${r.churn ? "sí" : "no"}</b>`] })), "cmp small")}</div></div>
    <div class="block stage" style="flex:1 1 380px"><div class="t">Fracción que se fue, por región (n de clientes)</div>${barras(CH.por_region.map(x => ({ lab: `${x.region} (${x.n})`, v: x.fuga, txt: pct0(x.fuga), cls: x.fuga > 0.3 ? "pred" : "" })), { max: 0.6 })}</div>
    <div class="block stage" style="flex:1 1 260px"><div class="t">Por plan</div>${barras(CH.por_plan.map(x => ({ lab: `${x.plan} (${x.n})`, v: x.fuga, txt: pct0(x.fuga), cls: x.fuga > 0.3 ? "pred" : "" })), { max: 0.6 })}</div>`;
    el("c5-datos-nota").innerHTML = `<b>Lo que se ve a simple vista.</b> Seis regiones (Tarapacá, Arica y Parinacota, Magallanes, La Araucanía, Los Ríos y Aysén) tienen una fuga de entre 45% y 55%, contra 12% a 22% en el resto: la región es la variable más fuerte de la tabla, y es categórica con 16 valores. El prepago se va más que el postpago y la empresa. Lo demás (reclamos, antigüedad) se ve recién al cruzar variables, que es lo que hace un árbol.`;
    rCliente();
    if (anim) stagger(el("c5-s0"));
  }
  function render(anim) { [rIntro, rSub, rFalt, rPoda, rFinal][st.paso](anim); }
  el("c5-attr").onchange = e => { st.attr = e.target.value; if (st.paso === 1) rSub(true); };
  selE.onchange = e => { st.emp = +e.target.value; if (st.paso === 2) rFalt(true); };
  selF.onchange = e => { st.falta = e.target.value; if (st.paso === 2) rFalt(true); };
  el("c5-cf").onchange = e => { st.cf = +e.target.value; el("c5-cf-v").textContent = fmt2(st.cf); if (st.paso === 3) rPoda(false); };
  ["c5-pN", "c5-pE", "c5-h1N", "c5-h1E", "c5-h2N", "c5-h2E", "c5-h3N", "c5-h3E"].forEach(id => el(id).oninput = () => rPoda(false));
  el("c5-replay").onclick = () => render(true);
  GOTO.c5 = pasoGenerico("c5", 5, st, render);
  stepper("c5", ["Por qué C5.0: caso churn", "Categorías y gain ratio", "Valores faltantes", "Poda pesimista", "Boosting y reglas"], GOTO.c5);
})();

let modeloInicial = (init && init.m && GOTO[init.m]) ? init.m : "ent";
if (init && typeof init.paso === "number" && ST[modeloInicial]) ST[modeloInicial].paso = init.paso;
quieto = true; irModelo(modeloInicial); quieto = false;
return { getState: () => ({ m: modeloActual, paso: ST[modeloActual].paso }) };
}
