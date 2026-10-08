/* DeepSeek Magazine Builder v1.2: structured extraction fixes; external style assets. */
const MAGAZINE_CSS_URLS={pdf:'assets/clat-magazine-deepseek-v1.2.css',epub:'assets/clat-magazine-deepseek-v1.2-epub.css'};
const MAGAZINE_CSS_CACHE={};
async function loadMagazineCss(kind){
 if(MAGAZINE_CSS_CACHE[kind])return MAGAZINE_CSS_CACHE[kind];
 const res=await fetch(MAGAZINE_CSS_URLS[kind]);
 if(!res.ok)throw Error('Unable to fetch '+MAGAZINE_CSS_URLS[kind]);
 return MAGAZINE_CSS_CACHE[kind]=await res.text();
}

/* ═══════════════ STATE ═══════════════ */
let loadedFiles = {};
let builtParts = [];
let currentMode = 'pdf';
let currentTheme = 'editorial';
let includeQuiz = true;

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const stylePdf = document.getElementById('base-pdf');
const styleEpub = document.getElementById('base-epub');
const modeToggle = document.getElementById('modeToggle');
const themeToggle = document.getElementById('themeToggle');
const quizToggle = document.getElementById('quizToggle');
const printBtn = document.getElementById('printBtn');
const epubBtn = document.getElementById('epubBtn');
const htmlBtn = document.getElementById('htmlBtn');

/* ═══════════════ TOGGLES ═══════════════ */
modeToggle.addEventListener('click', e => {
  const b = e.target.closest('button[data-mode]'); if (!b) return;
  setMode(b.dataset.mode);
});
function setMode(m){
  currentMode = m;
  stylePdf.setAttribute('media', m === 'pdf' ? 'all' : 'not all');
  styleEpub.setAttribute('media', m === 'epub' ? 'all' : 'not all');
  modeToggle.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.mode === m));
  if (!printBtn.disabled) printBtn.textContent = m === 'pdf' ? '🖨️ Print Magazine PDF' : '🖨️ Print Book PDF';
}

themeToggle.addEventListener('click', e => {
  const b = e.target.closest('button[data-theme]'); if (!b) return;
  currentTheme = b.dataset.theme;
  document.documentElement.dataset.theme = currentTheme;
  document.body.dataset.theme = currentTheme;
  themeToggle.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.theme === currentTheme));
});

quizToggle.addEventListener('click', () => {
  includeQuiz = !includeQuiz;
  quizToggle.textContent = includeQuiz ? '📝 Quiz: On' : '📝 Quiz: Off';
  quizToggle.classList.toggle('toggle-on', includeQuiz);
  if (Object.keys(loadedFiles).length) buildMagazine();
});

/* ═══════════════ FILE LOADING ═══════════════ */
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('hover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('hover'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('hover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', e => handleFiles(e.target.files));

async function handleFiles(files){
  statusEl.textContent = `Loading ${files.length} file(s)…`;
  loadedFiles = {};
  for (const f of Array.from(files)){
    try { loadedFiles[f.name] = await f.text(); }
    catch (err){ console.warn('read fail', f.name, err); }
  }
  if (!Object.keys(loadedFiles).length){ statusEl.textContent = 'No readable files.'; return; }
  buildMagazine();
}

/* ═══════════════ HTML ESCAPE ═══════════════ */
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ═══════════════ SOURCE PARSER — extract everything at discovery ═══════════════ */
function parseSource(filename, html){
  const doc = new DOMParser().parseFromString(html, 'text/html');

  /* ID */
  let topicId = '';
  const idSources = [
    doc.querySelector('.ds-src')?.textContent,
    doc.querySelector('#ds-filename')?.textContent,
    doc.querySelector('.kicker')?.textContent,
    doc.querySelector('.meta.on')?.textContent,
    filename
  ];
  for (const s of idSources){
    if (!s) continue;
    const m = String(s).match(/([A-Z]{2}\d{5,}[A-Z]?\d*)/);
    if (m){ topicId = m[1]; break; }
  }
  if (!topicId) topicId = filename.replace(/^DS-/, '').replace(/\.html?$/i, '');

  /* Title */
  let title = '';
  const h1 = doc.querySelector('header.cover h1, .cover h1, header h1');
  if (h1) title = h1.textContent.trim();
  if (!title){
    const dt = (doc.title || '').replace(/^DS-/, '').trim();
    if (dt) title = dt.replace(/_/g, ' ');
  }
  if (!title) title = filename.replace(/^DS-/, '').replace(/\.html?$/i, '').replace(/_/g, ' ');

  /* Part */
  const prefix = (topicId.match(/^(CL|LE)/) || [])[1];
  const part = prefix === 'LE'
    ? 'Part Two · Legal & Constitutional'
    : 'Part One · National Affairs';

  /* Sort key */
  let sortKey = 9999;
  const tm = topicId.match(/T(\d+)/);
  if (tm) sortKey = parseInt(tm[1], 10);
  else {
    const nm = filename.match(/(\d{3,})/);
    if (nm) sortKey = parseInt(nm[1], 10);
  }

  /* Summaries — only from .topic-summary section (top-level) */
  const summaries = { oneLine: '', short: '', full: '' };
  doc.querySelectorAll('.topic-summary .summary-block, .topic-summary .summary-block.topic').forEach(sb => {
    const k = (sb.querySelector('.summary-k')?.textContent || '').toLowerCase().trim();
    const v = (sb.querySelector('.summary-v')?.textContent || '').trim();
    if (!v) return;
    if (/one\s*line/.test(k)) summaries.oneLine = v;
    else if (/^short/.test(k)) summaries.short = v;
    else if (/^full/.test(k)) summaries.full = v;
  });

  /* Fallback — look anywhere */
  if (!summaries.oneLine || !summaries.short || !summaries.full){
    doc.querySelectorAll('.summary-block').forEach(sb => {
      const k = (sb.querySelector('.summary-k')?.textContent || '').toLowerCase().trim();
      const v = (sb.querySelector('.summary-v')?.textContent || '').trim();
      if (!v) return;
      if (/one\s*line/.test(k) && !summaries.oneLine) summaries.oneLine = v;
      else if (/^short/.test(k) && !summaries.short) summaries.short = v;
      else if (/^full/.test(k) && !summaries.full) summaries.full = v;
    });
  }

  /* Lede from cover as fallback for oneLine */
  if (!summaries.oneLine){
    const lede = doc.querySelector('header.cover .lede, .cover .lede');
    if (lede) summaries.oneLine = lede.textContent.trim();
  }

  /* Content sections with nodes */
  const sections = [];
  doc.querySelectorAll('section').forEach(sec => {
    const nodes = sec.querySelectorAll('.node');
    if (!nodes.length) return;
    const sh = sec.querySelector('.sec-head');
    const secTitle = sh?.querySelector('h2')?.textContent.trim() || '';
    const secTag = sh?.querySelector('.sectag')?.textContent.trim() || '';
    const nodeArr = Array.from(nodes).map(n => extractNode(n)).filter(n => n.title || n.content.length);
    if (nodeArr.length) sections.push({ title: secTitle, tag: secTag, nodes: nodeArr });
  });

  /* Laws */
  const laws = [];
  doc.querySelectorAll('.lawcard').forEach(lc => {
    const name = lc.querySelector('.law-name')?.textContent.trim() || '';
    const year = lc.querySelector('.law-year')?.textContent.trim() || '';
    const provisions = [];
    lc.querySelectorAll('.law-provisions > li').forEach(li => provisions.push(li.textContent.trim()));
    if (!name && !provisions.length) return;
    const kind = lc.classList.contains('code') ? 'code' : lc.classList.contains('case') ? 'case' : '';
    laws.push({ name, year, provisions, kind });
  });

  /* Timeline */
  const timeline = [];
  doc.querySelectorAll('.tl-i').forEach(tl => {
    const d = tl.querySelector('.tl-d')?.textContent.trim() || '';
    const e = tl.querySelector('.tl-e')?.textContent.trim() || '';
    if (!d && !e) return;
    timeline.push({ date: d, event: e, hot: tl.classList.contains('hot'), web: tl.classList.contains('web') });
  });

  /* Facts */
  const facts = [];
  doc.querySelectorAll('.facts ol > li').forEach(f => {
    const cite = f.querySelector('.fact-cite')?.textContent.trim() || '';
    const clone = f.cloneNode(true);
    clone.querySelectorAll('.fact-cite').forEach(c => c.remove());
    const txt = clone.textContent.replace(/\s+/g, ' ').trim();
    if (txt) facts.push({ text: txt, cite });
  });

  /* Quiz */
  const quiz = [];
  doc.querySelectorAll('.q').forEach(q => {
    const stem = q.querySelector('.q-stem')?.textContent.replace(/\s+/g, ' ').trim() || '';
    if (stem) quiz.push({ stem });
  });

  /* Keywords & tags */
  const keywords = [];
  doc.querySelectorAll('.chip').forEach(c => { const t = c.textContent.trim(); if (t) keywords.push(t); });
  const tags = [];
  doc.querySelectorAll('.tagc').forEach(t => { const s = t.textContent.trim(); if (s) tags.push(s); });

  return { topicId, title, part, sortKey, filename, summaries, sections, laws, timeline, facts, quiz, keywords, tags };
}

function extractNode(n){
  const head = n.querySelector('.node-head');
  let title = '', nid = '';
  if (head){
    nid = head.querySelector('.nid')?.textContent.trim() || '';
    const h3 = head.querySelector('h3');
    if (h3){
      const clone = h3.cloneNode(true);
      clone.querySelectorAll('.nid').forEach(e => e.remove());
      title = clone.textContent.replace(/\s+/g, ' ').trim();
    }
  }
  const summary = n.querySelector('.summary-block .summary-v')?.textContent.replace(/\s+/g, ' ').trim() || '';
  const content = [];
  n.querySelectorAll('ol.bl > li').forEach(li => {
    const t = li.textContent.replace(/\s+/g, ' ').trim();
    if (t) content.push(t);
  });
  const why = n.querySelector('.why')?.textContent.replace(/^Note\s*/i, '').replace(/\s+/g, ' ').trim() || '';
  return { nid, title, summary, content, why };
}

/* ═══════════════ INFOGRAPHIC DATA EXTRACTION ═══════════════ */
function extractNumbers(text){
  const out = [], seen = new Set();
  const patterns = [
    /(?:USD|INR|EUR|₹|\$|Rs\.?|NPR|GBP|€)\s*\d{1,6}(?:[.,]\d+)?(?:\s*(?:billion|trillion|million|crore|lakh|thousand|bn|tn))?/gi,
    /\b\d{1,6}(?:[.,]\d+)?\s*(?:%|per cent|percent)\b/gi,
    /\b\d{1,6}(?:[.,]\d+)?\s*(?:billion|trillion|million|crore|lakh|thousand|bn|tn|kg|km|GW|MW|metres?|meters?|years?|days?|months?)\b/gi,
    /\b\d{2,6}(?:[.,]\d+)?\b/g
  ];
  for (const re of patterns){
    let m;
    while ((m = re.exec(text))){
      const raw = m[0].trim().replace(/\s+/g, ' ');
      if (!/\d/.test(raw)) continue;
      if (/^(?:19|20)\d{2}$/.test(raw) && out.length >= 4) continue;
      const key = raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key); out.push(raw);
      if (out.length >= 6) return out;
    }
  }
  return out;
}
function extractDates(text){
  const out = [], seen = new Set();
  let m;
  const re = /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*,?\s*\d{4}\b/g;
  while ((m = re.exec(text))){
    const t = m[0].trim();
    if (!seen.has(t)){ seen.add(t); out.push(t); }
    if (out.length >= 4) return out;
  }
  const yRe = /\b(?:19|20)\d{2}\b/g;
  while ((m = yRe.exec(text))){
    const t = m[0];
    if (!seen.has(t)){ seen.add(t); out.push(t); }
    if (out.length >= 4) return out;
  }
  return out;
}
function extractAcronyms(text){
  const out = [], seen = new Set();
  const stop = new Set(['THE','AND','FOR','BUT','NOT','ALL','NEW','ONE','TWO','THREE','INDIA','USA','US','UK','EU','IT','OF','ON','IN','AT','AS','BY','TO','SO','NO','WE','BE','OR','IF','DO','GO','UP','IS','AM','AN','PER','VIA']);
  const re = /\b[A-Z][A-Z0-9]{1,7}\b/g;
  let m;
  while ((m = re.exec(text))){
    const a = m[0];
    if (stop.has(a)) continue;
    if (seen.has(a)) continue;
    seen.add(a); out.push(a);
    if (out.length >= 8) return out;
  }
  return out;
}
function guessLabel(t){
  if (/%|percent/i.test(t)) return 'percentage';
  if (/billion|trillion|million|crore|lakh|bn|tn/i.test(t)) return 'scale';
  if (/\bkg\b/.test(t)) return 'weight';
  if (/\bkm\b/.test(t)) return 'distance';
  if (/\bGW\b|\bMW\b/.test(t)) return 'power';
  if (/^20\d{2}$/.test(t)) return 'year';
  if (/^19\d{2}$/.test(t)) return 'year';
  if (/day/i.test(t)) return 'duration';
  if (/year|month/i.test(t)) return 'duration';
  return 'key figure';
}

function buildInfoCard(art, num){
  const s = art.summaries || {};
  const lede = s.oneLine || s.short || '';
  const trunc = lede.length > 260 ? lede.substring(0, 260).replace(/\s+\S*$/, '') + '…' : lede;

  const text = [s.oneLine, s.short, s.full].filter(Boolean).join(' ') +
               ' ' + (art.facts || []).slice(0, 8).map(f => f.text).join(' ');

  const numbers = extractNumbers(text).slice(0, 4);
  const dates = extractDates(text).slice(0, 3);
  const acronyms = extractAcronyms(text).slice(0, 8);

  const tiles = numbers.map(n => {
    const label = guessLabel(n);
    const val = n.length > 12 ? n : n;
    return `<div class="info-tile"><div class="info-tile-n">${esc(val)}</div><div class="info-tile-l">${esc(label)}</div></div>`;
  }).join('');

  const chips =
    acronyms.map(a => `<span class="info-chip acro">${esc(a)}</span>`).join('') +
    dates.map(d => `<span class="info-chip date">${esc(d)}</span>`).join('');

  return `<div class="info-card">
    <div class="info-num">TOPIC ${String(num).padStart(2, '0')}</div>
    <h3 class="info-title">${esc(art.title)}</h3>
    ${trunc ? `<p class="info-lede">${esc(trunc)}</p>` : ''}
    ${tiles ? `<div class="info-tiles">${tiles}</div>` : ''}
    ${chips ? `<div class="info-chips">${chips}</div>` : ''}
  </div>`;
}

function buildInfographic(articles){
  const cards = articles.map((a, i) => buildInfoCard(a, i + 1)).join('');
  return `<section class="mag-infographic">
    <div class="mag-part-label">Visual Digest</div>
    <h2>At a Glance</h2>
    <p class="lede">Every topic in this magazine, distilled to its key numbers, dates and acronyms.</p>
    <div class="info-grid">${cards}</div>
  </section>`;
}

/* ═══════════════ BUILD MAGAZINE ═══════════════ */
function buildMagazine(){
  if (!Object.keys(loadedFiles).length){ statusEl.textContent = 'No files loaded.'; return; }

  const discovered = [];
  for (const [fname, content] of Object.entries(loadedFiles)){
    try {
      const data = parseSource(fname, content);
      const hasContent = data.summaries.oneLine || data.summaries.short || data.summaries.full ||
                         data.sections.length || data.facts.length || data.laws.length;
      if (!hasContent) continue;
      discovered.push(data);
    } catch (err){
      console.warn('parse failed', fname, err);
    }
  }

  if (!discovered.length){
    statusEl.textContent = 'No parseable topics found — check files contain topic-summary / nodes / facts.';
    return;
  }

  /* Sort */
  discovered.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.topicId.localeCompare(b.topicId);
  });

  /* Renumber sequentially */
  let counter = 0;
  const matched = discovered.map(t => {
    counter++;
    return { ...t, index: counter };
  });

  /* Group by part — USING matched (has index) */
  const partMap = new Map();
  for (const t of matched){
    if (!partMap.has(t.part)) partMap.set(t.part, []);
    partMap.get(t.part).push(t);
  }

  statusEl.textContent =
    `${matched.length} topics loaded · ${partMap.size} part(s)` +
    (includeQuiz ? '' : ' · quiz hidden');

  /* Build */
  const out = [];
  out.push(buildCover(matched.length, partMap.size));
  out.push(buildTOC(matched));
  out.push(`<section class="mag-divider"><div class="k">Digest</div><h2>At a Glance</h2></section>`);
  out.push(buildInfographic(matched));

  builtParts = [];
  for (const [part, items] of partMap){
    builtParts.push({ part, articles: items });
    out.push(buildDivider(part));
    for (const a of items){
      out.push(buildArticle(a.index, part, a));
    }
  }

  const mag = document.getElementById('magazine');
  mag.innerHTML = out.join('\n');
  mag.classList.add('visible');
  dropZone.style.display = 'none';

  printBtn.disabled = false;
  epubBtn.disabled = false;
  htmlBtn.disabled = false;
  epubBtn.onclick = downloadEpub;
  htmlBtn.onclick = downloadHtml;
  setMode(currentMode);
}

function buildCover(nT, nP){
  return `<section class="mag-cover">
  <div>
    <div class="k">CLAT GK · Current Affairs · Annual Digest 2026</div>
    <h1>The <em>Current Affairs</em> Review</h1>
    <p class="lede">India and the world in 2026 — trade deals, border disputes, West Asian conflicts, international law and national milestones.</p>
  </div>
  <div class="stats">
    <div><span class="n">${nT}</span><span class="l">Topics</span></div>
    <div><span class="n">${nP}</span><span class="l">Sections</span></div>
  </div>
  <div class="bottom">
    <div>Compiled from source-grounded study readers<br>CLAT GK · Student Edition · Vol. 1</div>
    <div class="mono">ISSN 2026 · CLAT/GK/01</div>
  </div>
</section>`;
}

function buildTOC(items){
  const out = ['<section class="mag-toc"><h2>Contents</h2>'];
  let lastPart = null;
  for (const it of items){
    if (it.part !== lastPart){
      if (lastPart !== null) out.push('</ol>');
      lastPart = it.part;
      out.push(`<h3 class="part">${esc(it.part)}</h3><ol>`);
    }
    out.push(`<li><span class="num">${String(it.index).padStart(2, '0')}</span><span>${esc(it.title)}</span><span class="id">${esc(it.topicId)}</span></li>`);
  }
  if (lastPart !== null) out.push('</ol>');
  out.push('</section>');
  return out.join('');
}

function buildDivider(part){
  let k = '', n = part;
  if (part.includes('·')){ const p = part.split('·'); k = p[0].trim(); n = p.slice(1).join('·').trim(); }
  return `<section class="mag-divider"><div class="k">${esc(k)}</div><h2>${esc(n)}</h2></section>`;
}

function buildArticle(num, part, a){
  const H = [];
  H.push(`<article class="mag-article" id="art-${num}">`);
  H.push(`  <div class="mag-part-label">${esc(part)}</div>`);
  H.push(`  <h1 class="mag-title">${num}. ${esc(a.title)}</h1>`);

  /* Summaries */
  const s = a.summaries || {};
  if (s.oneLine || s.short || s.full){
    H.push(`<div class="sec-head"><h2>The Topic at a Glance</h2></div>`);
    if (s.oneLine) H.push(`<div class="summary-block"><div class="summary-k">One Line</div><div class="summary-v">${esc(s.oneLine)}</div></div>`);
    if (s.short)   H.push(`<div class="summary-block"><div class="summary-k">Short Summary</div><div class="summary-v">${esc(s.short)}</div></div>`);
    if (s.full)    H.push(`<div class="summary-block"><div class="summary-k">Full Summary</div><div class="summary-v">${esc(s.full)}</div></div>`);
  }

  /* Sections with nodes */
  if (a.sections && a.sections.length){
    for (const sec of a.sections){
      const sh = sec.title ? esc(sec.title) : 'Key Points';
      H.push(`<div class="sec-head"><h2>${sh}</h2>${sec.tag ? `<span class="sectag">${esc(sec.tag)}</span>` : ''}</div>`);
      for (const n of sec.nodes){
        H.push(`<div class="node">`);
        H.push(`  <div class="node-head"><h3>${esc(n.title)}</h3>${n.nid ? `<span class="nid">${esc(n.nid)}</span>` : ''}</div>`);
        if (n.summary) H.push(`  <div class="summary-block"><div class="summary-k">Summary</div><div class="summary-v">${esc(n.summary)}</div></div>`);
        if (n.content.length) H.push(`  <ol class="bl">${n.content.map(c => `<li>${esc(c)}</li>`).join('')}</ol>`);
        if (n.why) H.push(`  <div class="why">${esc(n.why)}</div>`);
        H.push(`</div>`);
      }
    }
  }

  /* Laws */
  if (a.laws && a.laws.length){
    H.push(`<div class="sec-head"><h2>Legal Instruments &amp; Cases</h2></div>`);
    H.push(`<div class="lawgrid">`);
    for (const l of a.laws){
      H.push(`  <div class="lawcard ${l.kind || ''}">`);
      H.push(`    <div class="law-head"><span class="law-name">${esc(l.name)}</span>${l.year ? `<span class="law-year">${esc(l.year)}</span>` : ''}</div>`);
      if (l.provisions.length) H.push(`    <ul class="law-provisions">${l.provisions.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`);
      H.push(`  </div>`);
    }
    H.push(`</div>`);
  }

  /* Timeline */
  if (a.timeline && a.timeline.length){
    H.push(`<div class="sec-head"><h2>Timeline</h2></div>`);
    H.push(`<div class="tl">`);
    for (const t of a.timeline){
      const cls = ['tl-i']; if (t.hot) cls.push('hot'); if (t.web) cls.push('web');
      H.push(`  <div class="${cls.join(' ')}"><span class="tl-d">${esc(t.date)}</span><span class="tl-e">${esc(t.event)}</span></div>`);
    }
    H.push(`</div>`);
  }

  /* Facts — NUMBERED */
  if (a.facts && a.facts.length){
    H.push(`<div class="facts">`);
    H.push(`  <div class="sec-head"><h2>Fact File</h2></div>`);
    H.push(`  <div class="fact-legend"><strong>${a.facts.length} verified facts</strong> · all source-grounded</div>`);
    H.push(`  <ol>${a.facts.map(f => `<li>${esc(f.text)}${f.cite ? `<span class="fact-cite">${esc(f.cite)}</span>` : ''}</li>`).join('')}</ol>`);
    H.push(`</div>`);
  }

  /* Quiz */
  if (includeQuiz && a.quiz && a.quiz.length){
    H.push(`<div class="sec-head"><h2>Practice Questions</h2></div>`);
    H.push(`<div class="qs">`);
    for (const q of a.quiz){
      H.push(`  <div class="q"><div class="q-stem">${esc(q.stem)}</div></div>`);
    }
    H.push(`</div>`);
  }

  /* Keywords */
  if ((a.keywords && a.keywords.length) || (a.tags && a.tags.length)){
    H.push(`<div class="sec-head"><h2>Keywords &amp; Tags</h2></div>`);
    H.push(`<div class="chips">`);
    for (const k of (a.keywords || [])) H.push(`<span class="chip">${esc(k)}</span>`);
    for (const t of (a.tags || [])) H.push(`<span class="tagc">${esc(t)}</span>`);
    H.push(`</div>`);
  }

  H.push(`</article>`);
  return H.join('\n');
}

/* ═══════════════ XHTML CLEANUP ═══════════════ */
function cleanXhtml(html){
  let c = html;
  c = c.replace(/<script[\s\S]*?<\/script>/gi, '');
  c = c.replace(/<style[\s\S]*?<\/style>/gi, '');
  c = c.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  c = c.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  c = c.replace(/<(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)([^>]*?)(?<!\/)>/gi, '<$1$2/>');
  return c;
}

/* ═══════════════ EPUB DOWNLOAD ═══════════════ */
async function downloadEpub(){
  if (typeof JSZip === 'undefined'){
    statusEl.textContent = 'Loading JSZip…';
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  statusEl.textContent = 'Building EPUB…';

  try {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.file('META-INF/container.xml',
`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);

    const baseCss = await loadMagazineCss('epub');
    const themeCssEl = document.getElementById('theme-epub-' + currentTheme);
    const themeCss = ''; // theme overrides included in external EPUB CSS
    zip.file('OEBPS/style.css', baseCss + '\n\n/* THEME: ' + currentTheme + ' */\n' + themeCss);

    zip.file('OEBPS/cover.xhtml',
`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="UTF-8"/><title>Cover</title>
<link rel="stylesheet" type="text/css" href="style.css"/></head>
<body data-theme="${currentTheme}">
<div style="text-align:center;padding:4em 1em">
<h1 style="border:none;font-size:2.2em;margin-top:5em;font-weight:400">CLAT GK Current Affairs 2026</h1>
<p style="font-size:1.1em;color:#666;margin-top:1em;letter-spacing:.15em;text-transform:uppercase;font-weight:700">Student Magazine</p>
</div>
</body></html>`);

    const allArticles = builtParts.flatMap(p => p.articles);
    const navItems = builtParts.map((p, i) =>
      `<li><a href="part-${i+1}.xhtml">${esc(p.part)}</a><ol>${p.articles.map(a =>
        `<li><a href="part-${i+1}.xhtml#sec-${a.index}">${esc(a.title)}</a></li>`
      ).join('')}</ol></li>`
    ).join('\n');
    zip.file('OEBPS/nav.xhtml',
`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="UTF-8"/><title>Contents</title>
<link rel="stylesheet" type="text/css" href="style.css"/></head>
<body data-theme="${currentTheme}">
<nav epub:type="toc" id="toc">
  <h1>Contents</h1>
  <ol>
    <li><a href="infographic.xhtml">At a Glance</a></li>
    ${navItems}
  </ol>
</nav>
</body></html>`);

    zip.file('OEBPS/infographic.xhtml',
`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="UTF-8"/><title>At a Glance</title>
<link rel="stylesheet" type="text/css" href="style.css"/></head>
<body data-theme="${currentTheme}">
${buildInfographic(allArticles)}
</body></html>`);

    const manifestItems = [
      '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>',
      '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
      '<item id="infographic" href="infographic.xhtml" media-type="application/xhtml+xml"/>',
      '<item id="css" href="style.css" media-type="text/css"/>'
    ];
    const spineItems = [
      '<itemref idref="cover"/>',
      '<itemref idref="nav"/>',
      '<itemref idref="infographic"/>'
    ];

    builtParts.forEach((p, i) => {
      const id = `part-${i+1}`;
      const fname = `${id}.xhtml`;
      let c = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="UTF-8"/><title>${esc(p.part)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/></head>
<body data-theme="${currentTheme}">
<h1>${esc(p.part)}</h1>`;
      for (const a of p.articles){
        const articleHtml = buildArticle(a.index, p.part, a);
        c += `<div id="sec-${a.index}">${cleanXhtml(articleHtml)}</div>`;
      }
      c += '</body></html>';
      zip.file(`OEBPS/${fname}`, c);
      manifestItems.push(`<item id="${id}" href="${fname}" media-type="application/xhtml+xml"/>`);
      spineItems.push(`<itemref idref="${id}"/>`);
    });

    zip.file('OEBPS/content.opf',
`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:clat-gk-2026-${currentTheme}-${Date.now()}</dc:identifier>
    <dc:title>CLAT GK Current Affairs 2026 — ${currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)} Edition</dc:title>
    <dc:creator>CLAT GK Study Reader</dc:creator>
    <dc:language>en</dc:language>
    <dc:date>2026-01-01</dc:date>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine>
    ${spineItems.join('\n    ')}
  </spine>
</package>`);

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CLAT_GK_2026_${currentTheme}${includeQuiz ? '' : '_noquiz'}.epub`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    statusEl.textContent = `✅ EPUB saved · ${currentTheme}${includeQuiz ? '' : ' · no quiz'} (${(blob.size/1024).toFixed(0)} KB)`;
  } catch (err){
    console.error(err);
    statusEl.textContent = 'EPUB failed: ' + err.message;
  }
}

/* ═══════════════ HTML DOWNLOAD ═══════════════ */
async function downloadHtml(){
  const mag = document.getElementById('magazine');
  if (!mag) return;

  const baseCss = await loadMagazineCss('pdf');
  const themes = ''; // theme overrides included in external PDF CSS

  const html =
`<!DOCTYPE html>
<html lang="en" data-theme="${currentTheme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CLAT GK Current Affairs 2026</title>
<style>
${baseCss}
${themes}
</style>
</head>
<body data-theme="${currentTheme}">
${mag.outerHTML}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CLAT_GK_2026_${currentTheme}${includeQuiz ? '' : '_noquiz'}.html`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  statusEl.textContent = `✅ HTML saved · ${currentTheme} (${(blob.size/1024).toFixed(0)} KB)`;
}
