/* ============== MARKETING (Meta Ads + Instagram orgánico) ==============
   Lee data/marketing.json (generado por boticlick-analytics/export_marketing.py)
   y las miniaturas de data/media/. El JSON no contiene costos ni inversión.
   Reglas de presentación:
   - null = la API no entregó el dato → se muestra "—", nunca 0.
   - El alcance de anuncios no se suma entre anuncios (una persona puede ver varios):
     el KPI usa el alcance único de la cuenta que viene en anuncios.resumen.
   - Todo texto se escapa; imágenes y permalinks se validan contra patrones fijos. */
(function(){
  'use strict';
  const root = document.getElementById('seccion-marketing');
  if (!root) return;

  const DATA_URL = 'data/marketing.json';
  const PERIODS = {'7d':7, '30d':30, '90d':90};
  const IMG_RE = /^media\/[pa]_[0-9a-f]{16}\.webp$/;
  const PERMALINK_RE = /^https:\/\/www\.instagram\.com\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+\/?$/;
  const NO_TEXT = 'Creatividad sin texto disponible';
  const MIN_REACH_FOR_ER = 50;            // igual que marketing/analysis.py
  const GALLERY_STEP = 12;
  const FORMAT_LABEL = {reel:'Reel', carrusel:'Carrusel', imagen:'Imagen', video:'Video', catalogo:'Catálogo', desconocido:'Otro'};
  const FORMAT_COLOR = {reel:'var(--gold)', carrusel:'var(--slate)', imagen:'var(--sage)', video:'var(--gold)', catalogo:'var(--muted)', desconocido:'var(--muted-dim)'};
  const ORG_RANKS = [
    ['alcance','Alcance','alcance',fmtInt],
    ['visualizaciones','Visualizaciones','visualizaciones',fmtInt],
    ['tasa_interaccion','Tasa de interacción','tasa_interaccion',fmtRatio],
    ['compartidos','Compartidos','compartidos',fmtInt],
    ['guardados','Guardados','guardados',fmtInt],
  ];

  const state = {period:'30d', view:'ads', adSort:'alcance', orgSort:'fecha', orgRank:'alcance', adLimit:GALLERY_STEP, orgLimit:GALLERY_STEP};
  let data = null, dataBase = null, adById = new Map(), postById = new Map();

  /* ---------- utilidades ---------- */
  const NA = '<span class="mk-na" title="Dato no disponible en la API">—</span>';
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtInt(n){ return n == null ? NA : Math.round(n).toLocaleString('es-CL'); }
  function fmtPct(n){ return n == null ? NA : n.toLocaleString('es-CL',{minimumFractionDigits:2, maximumFractionDigits:2}) + '%'; }   // ya viene en %
  function fmtRatio(n){ return n == null ? NA : (n*100).toLocaleString('es-CL',{minimumFractionDigits:1, maximumFractionDigits:1}) + '%'; } // 0–1
  function nonNull(arr){ return arr.filter(v => v != null); }
  function median(arr){ const v = nonNull(arr).sort((a,b)=>a-b); if (!v.length) return null; const m = v.length>>1; return v.length%2 ? v[m] : (v[m-1]+v[m])/2; }
  function sumOrNull(arr){ const v = nonNull(arr); return v.length ? v.reduce((a,b)=>a+b,0) : null; }
  function imgUrl(p){ return p && IMG_RE.test(p) ? new URL(p, dataBase).href : null; }
  function permalink(u){ return u && PERMALINK_RE.test(u) ? u : null; }
  function parseDay(s){ const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
  function dayStr(dt){ return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0'); }
  function fmtDay(s){ return parseDay(s).toLocaleDateString('es-CL',{day:'numeric', month:'short'}); }
  function refDay(){ return new Date(data.generado); }
  function cutoff(period){ const d = refDay(); d.setDate(d.getDate() - PERIODS[period]); return dayStr(d); }
  function periodLabel(p){ return 'últimos ' + PERIODS[p] + ' días'; }

  function thumbHTML(item, chips){
    const src = imgUrl(item.imagen), link = permalink(item.permalink);
    const inner = (src
        ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" width="320" height="400">`
        : '<span class="mk-noimg">Vista previa no disponible</span>') + chips;
    return link
      ? `<a class="mk-thumb" href="${esc(link)}" target="_blank" rel="noopener noreferrer" title="Abrir en Instagram">${inner}</a>`
      : `<div class="mk-thumb">${inner}</div>`;
  }
  function linkHTML(item){
    const link = permalink(item.permalink);
    return link
      ? `<a class="mk-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Ver en Instagram ↗</a>`
      : '<span class="mk-link off">Sin enlace público</span>';
  }
  function metricsHTML(rows){
    // [etiqueta corta, valor, etiqueta completa]: la corta cabe en tarjetas angostas, la completa va en title
    return '<dl class="mk-metrics">' + rows.map(([l,v,full]) => `<div title="${esc(full || l)}"><dt>${esc(l)}</dt><dd>${v}</dd></div>`).join('') + '</dl>';
  }
  function kpi(label, value, sub){
    return `<div class="mk-kpi"><div class="l">${esc(label)}</div><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  }
  function moreButton(shown, total, key){
    return total > shown ? `<button class="ghost mk-more" data-more="${key}">Ver más (${total - shown} restantes)</button>` : '';
  }
  function rankList(entries, lookup, fmt){
    if (!entries.length) return '<p class="empty-msg">Sin datos suficientes en este periodo.</p>';
    return '<ol class="mk-rank-list">' + entries.map(e => {
      const it = lookup.get(e.id); if (!it) return '';
      const src = imgUrl(it.imagen), link = permalink(it.permalink);
      const title = it.titulo ?? (it.caption ? it.caption.split('\n').find(l => l.trim()) : null) ?? 'Publicación sin caption';
      const sub = it.fecha ? fmtDay(it.fecha) + ' · ' + FORMAT_LABEL[it.formato] : FORMAT_LABEL[it.formato];
      const t = link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>` : esc(title);
      return `<li><span class="pos">${e.posicion}</span>${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : '<span class="ph"></span>'}
        <span class="t">${t}<small>${esc(sub)}</small></span><span class="val">${fmt(e.valor)}</span></li>`;
    }).join('') + '</ol>';
  }
  function topN(items, key, filter){
    return items.filter(i => i[key] != null && (!filter || filter(i)))
      .sort((a,b) => b[key] - a[key]).slice(0,10)
      .map((i,idx) => ({id:i.id, valor:i[key], posicion:idx+1}));
  }

  /* ---------- gráficos SVG (sin librerías, igual que el resto del panel) ---------- */
  function barChart({points, start, end, height=200, line=null, lineFmt=null, legend=''}){
    // points: [{day:'YYYY-MM-DD', value:number|null, color, title}] — días sin punto quedan vacíos (no cero)
    const W = 800, H = height, padL = 58, padR = line ? 44 : 10, padT = 14, padB = 24;
    const d0 = parseDay(start), d1 = parseDay(end);
    const days = Math.max(1, Math.round((d1 - d0) / 864e5) + 1);
    const slot = (W - padL - padR) / days, bw = Math.max(2, Math.min(18, slot * .7));
    // Un valor atípico (p. ej. un reel viral) aplastaría el resto: si el mayor supera 4× al
    // segundo, el eje se corta en el segundo y esa barra se marca como recortada con su valor.
    const vals = nonNull(points.filter(p => p.day >= start && p.day <= end).map(p => p.value)).sort((a,b) => b-a);
    const clipped = vals.length > 2 && vals[1] > 0 && vals[0] > 4 * vals[1];
    const maxV = Math.max(1, clipped ? vals[1] * 1.25 : (vals[0] ?? 1));
    const x = day => padL + ((parseDay(day) - d0) / 864e5) * slot + slot / 2;
    const y = v => padT + (H - padT - padB) * (1 - v / maxV);
    let svg = `<svg class="mk-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(legend)}">`;
    for (let i = 0; i <= 3; i++){
      const v = maxV * i / 3, yy = y(v);
      svg += `<line x1="${padL}" x2="${W-padR}" y1="${yy}" y2="${yy}" stroke="var(--border)" stroke-width="1"/>`;
      svg += `<text x="${padL-6}" y="${yy+3}" text-anchor="end">${esc(Math.round(v).toLocaleString('es-CL'))}</text>`;
    }
    const ticks = Math.min(6, days);
    for (let i = 0; i < ticks; i++){
      const dt = new Date(d0); dt.setDate(d0.getDate() + Math.round(i * (days - 1) / Math.max(1, ticks - 1)));
      svg += `<text x="${x(dayStr(dt))}" y="${H-6}" text-anchor="middle">${esc(fmtDay(dayStr(dt)))}</text>`;
    }
    points.filter(p => p.value != null && p.day >= start && p.day <= end).forEach(p => {
      const over = p.value > maxV, top = over ? padT : y(p.value), cx = x(p.day);
      svg += `<rect x="${cx-bw/2}" y="${top}" width="${bw}" height="${Math.max(1, H-padB-top)}" rx="2" fill="${p.color}"><title>${esc(p.title)}</title></rect>`;
      if (over){
        svg += `<path d="M${cx-bw/2-2} ${padT+16} l${bw+4} -5 M${cx-bw/2-2} ${padT+21} l${bw+4} -5" stroke="var(--surface)" stroke-width="2.5"/>`;
        svg += `<text x="${cx + bw/2 + 4}" y="${padT+8}" style="fill:var(--text);font-weight:700">${esc(Math.round(p.value).toLocaleString('es-CL'))} (eje recortado)</text>`;
      }
    });
    if (line){
      const lp = line.filter(p => p.value != null && p.day >= start && p.day <= end);
      const maxL = Math.max(0.0001, ...lp.map(p => p.value));
      const yl = v => padT + (H - padT - padB) * (1 - v / maxL);
      // Segmentos solo entre días consecutivos con dato: un hueco no se interpola.
      let path = '', prev = null;
      lp.forEach(p => {
        const consecutive = prev && (parseDay(p.day) - parseDay(prev.day)) / 864e5 === 1;
        path += (consecutive ? 'L' : 'M') + x(p.day).toFixed(1) + ' ' + yl(p.value).toFixed(1) + ' ';
        prev = p;
      });
      svg += `<path d="${path}" fill="none" stroke="var(--text)" stroke-width="1.6" stroke-linejoin="round"/>`;
      lp.forEach(p => { svg += `<circle cx="${x(p.day)}" cy="${yl(p.value)}" r="2.2" fill="var(--text)"><title>${esc(fmtDay(p.day) + ': ' + lineFmt(p.value))}</title></circle>`; });
      svg += `<text x="${W-padR+6}" y="${padT+8}">${esc(lineFmt(maxL))}</text><text x="${W-padR+6}" y="${H-padB}">0</text>`;
    }
    return svg + '</svg>';
  }

  /* ---------- Meta Ads ---------- */
  function renderAds(){
    const p = state.period;
    const all = data.anuncios.lista;
    const ads = all.filter(a => a.metricas[p]);
    const sum = data.anuncios.resumen[p];
    const ranks = data.anuncios.rankings[p];
    const relByAd = new Map();
    ranks.rendimiento_relativo.forEach(g => g.anuncios.forEach(e => relByAd.set(e.id, e)));

    let h = `<div class="mk-block-head"><h3>Meta Ads · anuncios pagados</h3>
      <span class="mk-note">${ads.length} de ${all.length} anuncios con entrega en los ${periodLabel(p)} · sin costos ni inversión</span></div>`;

    h += '<div class="mk-kpis">'
      + kpi('Alcance', fmtInt(sum?.alcance), 'personas únicas (cuenta)')
      + kpi('Impresiones', fmtInt(sum?.impresiones), 'veces que se mostraron')
      + kpi('CTR del enlace', fmtPct(sum?.ctr_enlace), sum ? 'CTR total ' + fmtPct(sum.ctr) : '')
      + kpi('Interacciones', fmtInt(sum?.interacciones), 'con las publicaciones')
      + '</div>';
    if (!sum) h += '<p class="mk-callout">Sin entrega de anuncios en este periodo.</p>';

    // Galería
    const sortKey = {alcance:'alcance', impresiones:'impresiones', ctr:'ctr_enlace', interacciones:'interacciones'}[state.adSort];
    const sorted = ads.slice().sort((a,b) => (b.metricas[p][sortKey] ?? -1) - (a.metricas[p][sortKey] ?? -1));
    h += `<div class="card mk-card"><div class="mk-card-head"><div><h3>Galería de anuncios</h3>
        <p class="card-sub">Creatividades reales con métricas de los ${periodLabel(p)}. Toca la imagen para abrir la publicación cuando existe enlace público.</p></div>
        <select class="mk-select" data-sort="ads" aria-label="Ordenar anuncios">
          ${[['alcance','Mayor alcance'],['impresiones','Más impresiones'],['ctr','Mayor CTR del enlace'],['interacciones','Más interacciones']]
            .map(([v,l]) => `<option value="${v}"${state.adSort===v?' selected':''}>${l}</option>`).join('')}
        </select></div>`;
    h += ads.length ? '<div class="mk-gallery">' + sorted.slice(0, state.adLimit).map(a => {
      const m = a.metricas[p], rel = relByAd.get(a.id);
      const chips = `<span class="mk-chip">${esc(FORMAT_LABEL[a.formato])}</span>`
        + (rel ? `<span class="mk-chip mk-rank ${rel.clasificacion}" title="Rendimiento relativo dentro de ${esc(a.grupo_objetivo)} · ${esc(a.resultado ?? '')}">${esc(rel.clasificacion)} · ${rel.posicion}/${rel.total}</span>` : '');
      return `<article class="mk-item">${thumbHTML(a, chips)}<div class="mk-body">
        <div class="mk-title${a.titulo === NO_TEXT ? ' muted' : ''}">${esc(a.titulo)}</div>
        <div class="mk-date">${esc(a.grupo_objetivo)}${a.resultado ? ' · ' + esc(a.resultado) : ''}</div>
        ${metricsHTML([['Alcance', fmtInt(m.alcance)], ['Impr.', fmtInt(m.impresiones), 'Impresiones'], ['CTR enl.', fmtPct(m.ctr_enlace), 'CTR del enlace'], ['Interac.', fmtInt(m.interacciones), 'Interacciones']])}
        ${linkHTML(a)}</div></article>`;
    }).join('') + '</div>' + moreButton(Math.min(state.adLimit, ads.length), ads.length, 'ads')
      : '<p class="empty-msg">Sin anuncios con entrega en este periodo.</p>';
    h += '</div>';

    // Rankings
    h += '<div class="mk-grid2">';
    h += `<div class="card mk-card"><h3>Top 10 por alcance</h3><p class="card-sub">Volumen: depende también de cuánto se promocionó cada anuncio.</p>${rankList(ranks.alcance, adById, fmtInt)}</div>`;
    h += ranks.ctr_por_objetivo.length ? ranks.ctr_por_objetivo.map(g =>
      `<div class="card mk-card"><h3>Top CTR · ${esc(g.grupo_objetivo)}</h3><p class="card-sub">${g.metrica === 'ctr_enlace' ? 'CTR del enlace' : 'CTR'}, solo anuncios del mismo objetivo con ≥ 500 impresiones.</p>${rankList(g.ranking, adById, fmtPct)}</div>`).join('')
      : '<div class="card mk-card"><h3>Top CTR</h3><p class="empty-msg">Ningún anuncio alcanza 500 impresiones en este periodo.</p></div>';
    h += '</div>';

    // Rendimiento relativo
    h += `<div class="card mk-card"><h3>Rendimiento relativo</h3>
      <p class="card-sub">Ordena por eficiencia en conseguir el resultado buscado, solo entre anuncios con el mismo objetivo y el mismo tipo de resultado (≥ 3 anuncios con ≥ 1.000 impresiones). Los costos se usan para ordenar, pero no se publican.</p>`;
    h += ranks.rendimiento_relativo.length ? '<div class="mk-grid2" style="margin-bottom:0">' + ranks.rendimiento_relativo.map(g => {
      const entries = g.anuncios.map(e => {
        const a = adById.get(e.id); if (!a) return '';
        const src = imgUrl(a.imagen);
        return `<li><span class="pos">${e.posicion}</span>${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : '<span class="ph"></span>'}
          <span class="t">${esc(a.titulo)}<small>${esc(FORMAT_LABEL[a.formato])}</small></span>
          <span class="mk-chip ${e.clasificacion}">${esc(e.clasificacion)}</span></li>`;
      }).join('');
      return `<div><p class="card-sub" style="margin:0 0 4px"><b>${esc(g.grupo_objetivo)} · ${esc(g.resultado)}</b> — ${g.anuncios.length} anuncios comparados</p><ol class="mk-rank-list">${entries}</ol></div>`;
    }).join('') + '</div>' : '<p class="empty-msg">No hay comparaciones válidas en este periodo.</p>';
    if (ranks.comparaciones_omitidas.length){
      h += '<ul class="mk-notes">' + ranks.comparaciones_omitidas.map(o =>
        `<li>Sin comparación para ${esc(o.grupo_objetivo)}${o.resultado ? ' · ' + esc(o.resultado) : ''}: ${esc(o.motivo)}.</li>`).join('') + '</ul>';
    }
    h += '</div>';

    // Formatos + tendencia
    const groups = new Map();
    ads.forEach(a => { const k = a.grupo_objetivo + '|' + a.formato; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a.metricas[p]); });
    const rows = [...groups.entries()].sort((a,b) => b[1].length - a[1].length).map(([k, ms]) => {
      const [g, f] = k.split('|');
      const w = ms.filter(m => m.ctr_enlace != null && m.impresiones);
      const wImp = w.reduce((s,m) => s + m.impresiones, 0);
      const ctr = wImp ? w.reduce((s,m) => s + m.ctr_enlace * m.impresiones, 0) / wImp : null;
      return `<tr><td>${esc(g)} · ${esc(FORMAT_LABEL[f])}</td><td>${ms.length}</td><td>${fmtInt(sumOrNull(ms.map(m => m.impresiones)))}</td>
        <td>${fmtInt(median(ms.map(m => m.alcance)))}</td><td>${fmtPct(ctr)}</td><td>${fmtInt(sumOrNull(ms.map(m => m.interacciones)))}</td></tr>`;
    }).join('');
    h += '<div class="mk-grid2">';
    h += `<div class="card mk-card"><h3>Formatos</h3><p class="card-sub">Por objetivo y formato. CTR del enlace ponderado por impresiones.</p>
      ${rows ? `<div class="mk-table-wrap"><table class="mk-table"><thead><tr><th>Objetivo · formato</th><th>Anuncios</th><th>Impr.</th><th>Alcance med.</th><th>CTR enlace</th><th>Interac.</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="empty-msg">Sin datos.</p>'}</div>`;
    const daily = data.anuncios.tendencia_diaria;
    const end = dayStr(refDay()), start = cutoff(p);
    const inRange = daily.filter(d => d.fecha >= start && d.fecha <= end);
    h += `<div class="card mk-card"><h3>Tendencia diaria</h3><p class="card-sub">Impresiones por día (barras) y CTR del enlace (línea). Los días sin entrega quedan vacíos.</p>
      <div class="mk-legend"><span><i style="background:var(--gold)"></i>Impresiones</span><span><i style="background:var(--text);height:2px;vertical-align:3px"></i>CTR del enlace</span></div>
      ${inRange.length ? barChart({
        points: daily.map(d => ({day:d.fecha, value:d.impresiones, color:'var(--gold)', title: fmtDay(d.fecha) + ': ' + (d.impresiones ?? '—').toLocaleString('es-CL') + ' impresiones'})),
        line: daily.map(d => ({day:d.fecha, value:d.ctr_enlace})), lineFmt: v => v.toLocaleString('es-CL',{maximumFractionDigits:2}) + '%',
        start, end, legend:'Impresiones diarias de anuncios',
      }) : '<p class="empty-msg">Sin entrega en este periodo.</p>'}</div>`;
    h += '</div>';
    return h;
  }

  /* ---------- Instagram orgánico ---------- */
  function renderOrganic(){
    const p = state.period, org = data.organico;
    const start = cutoff(p), end = dayStr(refDay());
    const posts = org.publicaciones.filter(x => x.fecha >= start);
    const fmts = {}; posts.forEach(x => fmts[x.formato] = (fmts[x.formato] || 0) + 1);

    let h = `<div class="mk-block-head"><h3>Instagram orgánico · @${esc(org.cuenta.usuario)}</h3>
      <span class="mk-note">${org.cuenta.seguidores != null ? fmtInt(org.cuenta.seguidores) + ' seguidores hoy · ' : ''}publicaciones de los ${periodLabel(p)} · métricas acumuladas desde su publicación</span></div>`;
    h += '<div class="mk-kpis">'
      + kpi('Publicaciones', String(posts.length), Object.entries(fmts).map(([f,n]) => n + ' ' + FORMAT_LABEL[f].toLowerCase()).join(' · ') || 'ninguna')
      + kpi('Alcance mediano', fmtInt(median(posts.map(x => x.alcance))), 'por publicación')
      + kpi('Visualizaciones', fmtInt(sumOrNull(posts.map(x => x.visualizaciones))), 'suma de las publicaciones')
      + kpi('Tasa de interacción', fmtRatio(median(posts.map(x => x.tasa_interaccion))), 'mediana · interacciones ÷ alcance')
      + '</div>';

    // Galería
    const sortKey = {fecha:'fecha', alcance:'alcance', visualizaciones:'visualizaciones', tasa:'tasa_interaccion', compartidos:'compartidos', guardados:'guardados'}[state.orgSort];
    const sorted = posts.slice().sort((a,b) => sortKey === 'fecha' ? b.fecha.localeCompare(a.fecha) : (b[sortKey] ?? -1) - (a[sortKey] ?? -1));
    h += `<div class="card mk-card"><div class="mk-card-head"><div><h3>Galería de publicaciones</h3>
        <p class="card-sub">Portadas reales. Toca una publicación para abrirla en Instagram.</p></div>
        <select class="mk-select" data-sort="org" aria-label="Ordenar publicaciones">
          ${[['fecha','Más recientes'],['alcance','Mayor alcance'],['visualizaciones','Más visualizaciones'],['tasa','Mayor tasa de interacción'],['compartidos','Más compartidas'],['guardados','Más guardadas']]
            .map(([v,l]) => `<option value="${v}"${state.orgSort===v?' selected':''}>${l}</option>`).join('')}
        </select></div>`;
    h += posts.length ? '<div class="mk-gallery">' + sorted.slice(0, state.orgLimit).map(x => {
      const cap = x.caption ? x.caption.split('\n').find(l => l.trim()) : null;
      return `<article class="mk-item">${thumbHTML(x, `<span class="mk-chip">${esc(FORMAT_LABEL[x.formato])}</span>`)}<div class="mk-body">
        <div class="mk-title${cap ? '' : ' muted'}">${esc(cap ?? 'Sin caption')}</div>
        <div class="mk-date">${esc(fmtDay(x.fecha))}</div>
        ${metricsHTML([['Alcance', fmtInt(x.alcance)], ['Vistas', fmtInt(x.visualizaciones), 'Visualizaciones'], ['Me gusta', fmtInt(x.me_gusta)], ['Coment.', fmtInt(x.comentarios), 'Comentarios'],
                       ['Compart.', fmtInt(x.compartidos), 'Compartidos'], ['Guard.', fmtInt(x.guardados), 'Guardados'], ['Interac.', fmtRatio(x.tasa_interaccion), 'Tasa de interacción (interacciones ÷ alcance)']])}
        ${linkHTML(x)}</div></article>`;
    }).join('') + '</div>' + moreButton(Math.min(state.orgLimit, posts.length), posts.length, 'org')
      : '<p class="empty-msg">Sin publicaciones en este periodo.</p>';
    h += '</div>';

    // Rankings (calculados sobre el periodo con las mismas reglas que el exportador)
    const [rk, rkLabel, rkField, rkFmt] = ORG_RANKS.find(r => r[0] === state.orgRank);
    const entries = topN(posts, rkField, rk === 'tasa_interaccion' ? x => (x.alcance ?? 0) >= MIN_REACH_FOR_ER : null);
    h += '<div class="mk-grid2">';
    h += `<div class="card mk-card"><h3>Top 10 publicaciones</h3>
      <p class="card-sub">${rk === 'tasa_interaccion' ? 'Solo publicaciones con alcance ≥ 50, para evitar tasas infladas por muestras mínimas.' : 'Publicaciones de los ' + periodLabel(p) + '.'}</p>
      <div class="mk-tabs">${ORG_RANKS.map(r => `<button data-rank="${r[0]}" class="${r[0]===rk?'on':''}">${r[1]}</button>`).join('')}</div>
      ${rankList(entries, postById, rkFmt)}</div>`;

    // Formatos
    const byF = {}; posts.forEach(x => (byF[x.formato] = byF[x.formato] || []).push(x));
    const fRows = Object.entries(byF).sort((a,b) => b[1].length - a[1].length).map(([f, xs]) =>
      `<tr><td><i style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;background:${FORMAT_COLOR[f]}"></i>${esc(FORMAT_LABEL[f])}</td><td>${xs.length}</td>
       <td>${fmtInt(median(xs.map(x => x.alcance)))}</td><td>${fmtInt(median(xs.map(x => x.visualizaciones)))}</td>
       <td>${fmtRatio(median(xs.map(x => x.tasa_interaccion)))}</td><td>${fmtInt(sumOrNull(xs.map(x => x.compartidos)))}</td><td>${fmtInt(sumOrNull(xs.map(x => x.guardados)))}</td></tr>`).join('');
    h += `<div class="card mk-card"><h3>Formatos</h3><p class="card-sub">Medianas por publicación; compartidos y guardados suman el periodo.</p>
      ${fRows ? `<div class="mk-table-wrap"><table class="mk-table"><thead><tr><th>Formato</th><th>Publ.</th><th>Alcance med.</th><th>Vistas med.</th><th>Interacción med.</th><th>Compartidos</th><th>Guardados</th></tr></thead><tbody>${fRows}</tbody></table></div>` : '<p class="empty-msg">Sin datos.</p>'}
      <p class="mk-callout" style="margin-top:12px">${availabilityText(org)}</p></div>`;
    h += '</div>';

    // Tendencia
    h += `<div class="card mk-card"><h3>Alcance por publicación en el tiempo</h3>
      <p class="card-sub">Cada barra es una publicación, en su fecha. Las más recientes llevan menos tiempo acumulando alcance.</p>
      <div class="mk-legend">${Object.keys(byF).map(f => `<span><i style="background:${FORMAT_COLOR[f]}"></i>${esc(FORMAT_LABEL[f])}</span>`).join('')}</div>
      ${posts.length ? barChart({
        points: posts.map(x => ({day:x.fecha, value:x.alcance, color:FORMAT_COLOR[x.formato],
          title: fmtDay(x.fecha) + ' · ' + FORMAT_LABEL[x.formato] + ': ' + (x.alcance == null ? 'alcance no disponible' : x.alcance.toLocaleString('es-CL') + ' de alcance')})),
        start, end, legend:'Alcance por publicación',
      }) : '<p class="empty-msg">Sin publicaciones en este periodo.</p>'}</div>`;

    h += analysisHTML(org.patrones);
    return h;
  }

  function availabilityText(org){
    const missing = org.metricas_disponibles.flatMap(m => m.metricas_sin_dato.map(x => `${x.metrica} (${x.publicaciones} de ${m.publicaciones} ${m.tipo_contenido})`));
    const total = org.metricas_disponibles.reduce((s,m) => s + m.publicaciones, 0);
    return missing.length
      ? 'Métricas no disponibles en algunas publicaciones: ' + esc(missing.join(', ')) + '. Se muestran como —.'
      : `Alcance, vistas, me gusta, comentarios, compartidos y guardados disponibles en las ${total} publicaciones de los últimos ${org.ventana_dias} días. Instagram ya no entrega «impresiones» ni «reproducciones».`;
  }

  function analysisHTML(pt){
    const statTable = (rows, label) => `<div class="mk-table-wrap"><table class="mk-table"><thead><tr><th>${label}</th><th>Publ.</th><th>Alcance med.</th><th>Interacción med.</th></tr></thead><tbody>`
      + rows.map(r => `<tr><td>${esc(String(r.grupo).replace(/_/g,' '))}</td><td>${r.n}</td><td>${fmtInt(r.mediana_alcance)}</td><td>${fmtRatio(r.mediana_tasa_interaccion)}</td></tr>`).join('')
      + '</tbody></table></div>';
    const claims = kind => pt.afirmaciones.filter(a => a.tipo === kind);
    let h = `<div class="card mk-card"><h3>Análisis de contenido · últimos ${data.organico.ventana_dias} días</h3>
      <p class="card-sub">${esc(pt.metodo)}</p><div class="mk-grid2" style="margin-bottom:12px">
      <div><p class="card-sub" style="margin:0 0 6px"><b>Comprobado en los datos</b></p><ul class="mk-claims">${claims('comprobado').map(a => `<li class="comprobado"><b>Dato</b>${esc(a.texto)}</li>`).join('') || '<li>Sin diferencias relevantes.</li>'}</ul></div>
      <div><p class="card-sub" style="margin:0 0 6px"><b>Hipótesis para probar</b></p><ul class="mk-claims">${claims('hipotesis').map(a => `<li class="hipotesis"><b>Hipótesis</b>${esc(a.texto)}</li>`).join('') || '<li>Sin hipótesis.</li>'}</ul></div>
      </div><div class="mk-grid2" style="margin-bottom:12px">
      <div><p class="card-sub" style="margin:0 0 6px"><b>Temáticas</b> (una publicación puede tener varias)</p>${statTable(pt.estadisticas.tematica, 'Temática')}</div>
      <div><p class="card-sub" style="margin:0 0 6px"><b>Tipo de hook</b> (primera línea del caption)</p>${statTable(pt.estadisticas.tipo_hook, 'Hook')}
        <p class="card-sub" style="margin:12px 0 6px"><b>Franja horaria</b></p>${statTable(pt.estadisticas.franja_horaria, 'Franja')}</div>
      </div>
      <p class="card-sub" style="margin:0 0 6px"><b>Hooks de las 5 publicaciones con más alcance</b></p>
      <ol class="mk-rank-list">${pt.hooks_top_alcance.map((x,i) => {
        const post = postById.get(x.id), src = post && imgUrl(post.imagen);
        return `<li><span class="pos">${i+1}</span>${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<span class="t">${esc(x.hook || 'Sin caption')}<small>${post ? esc(fmtDay(post.fecha) + ' · ' + FORMAT_LABEL[post.formato]) : ''}</small></span><span class="val">${post ? fmtInt(post.alcance) : NA}</span></li>`;
      }).join('')}</ol>
      <ul class="mk-notes">${pt.limitaciones.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`;
    return h;
  }

  /* ---------- montaje ---------- */
  function render(){
    const body = root.querySelector('#mkBody');
    body.innerHTML = (state.view === 'ads' ? renderAds() : renderOrganic())
      + '<ul class="mk-notes">' + data.notas.map(n => `<li>${esc(n)}</li>`).join('') + '<li>— indica un dato no disponible.</li></ul>';
    root.querySelectorAll('#mkPeriod button').forEach(b => b.classList.toggle('on', b.dataset.p === state.period));
    root.querySelectorAll('.mk-switch button').forEach(b => { b.classList.toggle('on', b.dataset.v === state.view); b.setAttribute('aria-pressed', b.dataset.v === state.view); });
  }

  function shell(){
    root.innerHTML = `<div class="rc-top"><div><div class="eyebrow">Meta Ads · Instagram</div><h2>Marketing</h2>
        <p class="rc-period" id="mkUpdated">Cargando datos de marketing…</p></div>
      <div class="rc-win" id="mkPeriod" role="group" aria-label="Periodo">${Object.keys(PERIODS).map(p => `<button data-p="${p}">${PERIODS[p]} días</button>`).join('')}</div></div>
      <div class="mk-switch" role="group" aria-label="Fuente"><button data-v="ads">Meta Ads<span class="mk-src">pagado</span></button><button data-v="org">Instagram orgánico<span class="mk-src">@boticlick.cl</span></button></div>
      <div id="mkBody"><div class="card mk-status">Cargando…</div></div>`;
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !data) return;
      if (b.dataset.p){ state.period = b.dataset.p; state.adLimit = state.orgLimit = GALLERY_STEP; render(); }
      else if (b.dataset.v){ state.view = b.dataset.v; render(); }
      else if (b.dataset.rank){ state.orgRank = b.dataset.rank; render(); }
      else if (b.dataset.more){ state[b.dataset.more === 'ads' ? 'adLimit' : 'orgLimit'] += GALLERY_STEP; render(); }
    });
    root.addEventListener('change', e => {
      const s = e.target.closest('select[data-sort]'); if (!s) return;
      state[s.dataset.sort === 'ads' ? 'adSort' : 'orgSort'] = s.value; render();
    });
  }

  async function boot(){
    shell();
    dataBase = new URL(DATA_URL, location.href);
    try {
      const r = await fetch(dataBase.href + '?v=' + Date.now(), {cache:'no-store'});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      data = await r.json();
      if (data.version !== 1 || !data.anuncios || !data.organico) throw new Error('formato no reconocido');
    } catch (err){
      root.querySelector('#mkUpdated').textContent = 'Datos de marketing no disponibles';
      root.querySelector('#mkBody').innerHTML = `<div class="card mk-status">No se pudo cargar <code>${esc(DATA_URL)}</code> (${esc(err.message)}).<br>
        Si abriste el archivo directamente desde el disco, ábrelo con un servidor local (los navegadores bloquean la lectura de archivos con <code>file://</code>).</div>`;
      return;
    }
    data.anuncios.lista.forEach(a => adById.set(a.id, a));
    data.organico.publicaciones.forEach(x => postById.set(x.id, x));
    const gen = new Date(data.generado);
    root.querySelector('#mkUpdated').textContent = 'Actualizado el ' + gen.toLocaleString('es-CL',{day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'}) + ' · ' + data.fuente;
    render();
  }

  boot();
})();
