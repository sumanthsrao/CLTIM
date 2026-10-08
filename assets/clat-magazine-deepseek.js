/* DeepSeek CLAT GK Magazine Builder — external scripts / exported content remains standalone */
const MAG_ASSETS = {pdf:'assets/clat-magazine-deepseek.css',epub:'assets/clat-magazine-deepseek-epub.css'};
const exportCssCache = {};
async function getExportCss(mode){
 if(exportCssCache[mode]) return exportCssCache[mode];
 const response = await fetch(MAG_ASSETS[mode],{cache:'no-store'});
 if(!response.ok) throw new Error('Unable to load '+MAG_ASSETS[mode]);
 return (exportCssCache[mode] = await response.text());
}

/* ══════════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════════ */
let loadedFiles = {};          // { filename: text }
let builtParts = [];           // [{ part, articles:[{title, sourceId, body}] }]
let currentMode = 'pdf';
let currentTheme = 'editorial';
let includeQuiz = true;

const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const statusEl  = document.getElementById('status');
const stylePdf  = document.getElementById('base-pdf');
const styleEpub = document.getElementById('base-epub');
const modeToggle  = document.getElementById('modeToggle');
const themeToggle = document.getElementById('themeToggle');
const quizToggle  = document.getElementById('quizToggle');
const printBtn    = document.getElementById('printBtn');
const epubBtn     = document.getElementById('epubBtn');
const htmlBtn     = document.getElementById('htmlBtn');

/* ══════════════════════════════════════════════════════════════
   MODE / THEME / QUIZ TOGGLES
   ══════════════════════════════════════════════════════════════ */
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
  quizToggle.classList.toggle('secondary', !includeQuiz);
  if (Object.keys(loadedFiles).length) buildMagazine();
});

/* ══════════════════════════════════════════════════════════════
   FILE LOADING
   ══════════════════════════════════════════════════════════════ */
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('hover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('hover'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('hover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', e => handleFiles(e.target.files));

async function handleFiles(files){
  statusEl.textContent = `Loading ${files.length} file(s)…`;
  loadedFiles = {};
  const arr = Array.from(files);
  for (const f of arr){
    try { loadedFiles[f.name] = await f.text(); }
    catch (err){ console.warn('read fail', f.name, err); }
  }
  if (!Object.keys(loadedFiles).length){ statusEl.textContent = 'No readable files.'; return; }
  buildMagazine();
}

/* ══════════════════════════════════════════════════════════════
   DISCOVERY — extract topic metadata from filename + content
   ══════════════════════════════════════════════════════════════ */
function discoverTopic(filename, html){
  const doc = new DOMParser().parseFromString(html, 'text/html');

  /* Topic ID — prefer <code class="ds-src">, kicker, meta, then filename */
  let topicId = '';
  const dsSrc = doc.querySelector('.ds-src, #ds-filename');
  if (dsSrc) {
    const m = dsSrc.textContent.match(/([A-Z]{2}\d{5,}[A-Z]?\d*)/);
    if (m) topicId = m[1];
  }
  if (!topicId){
    const kicker = doc.querySelector('.kicker');
    if (kicker){
      const m = kicker.textContent.match(/([A-Z]{2}\d{5,}[A-Z]?\d*)/);
      if (m) topicId = m[1];
    }
  }
  if (!topicId){
    const metaOn = doc.querySelector('.meta.on');
    if (metaOn){
      const m = metaOn.textContent.match(/([A-Z]{2}\d{5,}[A-Z]?\d*)/);
      if (m) topicId = m[1];
    }
  }
  if (!topicId){
    const m = filename.match(/([A-Z]{2}\d{5,}[A-Z]?\d*)/);
    if (m) topicId = m[1];
  }

  /* Title — cover h1 > document title > filename */
  let title = '';
  const coverH1 = doc.querySelector('.cover h1, header.cover h1, header h1');
  if (coverH1) title = coverH1.textContent.trim();
  if (!title){
    const t = (doc.title || '').replace(/^DS-/, '').trim();
    if (t) title = t.replace(/_/g, ' ');
  }
  if (!title){
    title = filename.replace(/^DS-/, '').replace(/\.html?$/i, '').replace(/_/g, ' ');
  }

  /* Publisher prefix → default part */
  const prefixMatch = (topicId || filename).match(/\b(CL|LE)/);
  let part = 'Part Three · General';
  if (prefixMatch){
    part = prefixMatch[1] === 'LE'
      ? 'Part Two · Legal & Constitutional'
      : 'Part One · National Affairs';
  }

  /* Sort key — numeric suffix after T in topic_id, else numeric in filename */
  let sortKey = 9999;
  const tMatch = topicId.match(/T(\d+)/);
  if (tMatch) sortKey = parseInt(tMatch[1], 10);
  else {
    const nM = filename.match(/(\d{3,})/);
    if (nM) sortKey = parseInt(nM[1], 10);
  }

  return { topicId: topicId || filename, title, part, sortKey, filename };
}

/* ══════════════════════════════════════════════════════════════
   BODY EXTRACTION — strip source chrome, keep content sections
   ══════════════════════════════════════════════════════════════ */
function extractBody(html){
  const doc = new DOMParser().parseFromString(html, 'text/html');

  /* Prefer .doc wrapper; else body */
  const container = doc.querySelector('.doc') || doc.body;
  if (!container) return '';

  /* Remove chrome */
  container.querySelectorAll(
    'script, noscript, style, .dsbanner, .bar, .status-float, .top-fixed, .chrome, ' +
    '.objview, .ds-copy-btn, button[onclick*="dsCopy"]'
  ).forEach(el => el.remove());

  let out = container.innerHTML;
  if (!includeQuiz) out = stripQuiz(out);
  return out;
}

function stripQuiz(html){
  if (includeQuiz) return html;
  const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
  const root = doc.querySelector('div');

  /* Remove .qs blocks */
  root.querySelectorAll('.qs').forEach(qs => {
    const sec = qs.closest('section');
    if (sec) sec.remove(); else qs.remove();
  });
  /* Remove sections whose header mentions "Practice" */
  root.querySelectorAll('section').forEach(sec => {
    const h2 = sec.querySelector('.sec-head h2');
    if (h2 && /practice\s*questions?/i.test(h2.textContent)) sec.remove();
  });
  /* Remove stray "Practice Questions" section headers */
  root.querySelectorAll('.sec-head').forEach(sh => {
    const h2 = sh.querySelector('h2');
    if (h2 && /practice/i.test(h2.textContent)) sh.remove();
  });
  return root.innerHTML;
}

/* ══════════════════════════════════════════════════════════════
   INFOGRAPHIC EXTRACTION — auto-build "At a Glance" cards
   ══════════════════════════════════════════════════════════════ */
function extractInfographicData(bodyHtml){
  const doc = new DOMParser().parseFromString('<div>' + bodyHtml + '</div>', 'text/html');
  const root = doc.querySelector('div');

  let oneLine = '', shortSum = '', fullSum = '', topicName = '';

  root.querySelectorAll('.summary-block').forEach(sb => {
    const k = (sb.querySelector('.summary-k')?.textContent || '').trim().toLowerCase();
    const v = (sb.querySelector('.summary-v')?.textContent || '').trim();
    if (/topic name/.test(k) && !topicName) topicName = v;
    else if (/one line/.test(k) && !oneLine) oneLine = v;
    else if (/^short/.test(k) && !shortSum) shortSum = v;
    else if (/^full/.test(k) && !fullSum) fullSum = v;
  });

  /* Fallback: cover .lede */
  if (!oneLine){
    const lede = root.querySelector('.cover .lede, header.cover .lede');
    if (lede) oneLine = lede.textContent.trim();
  }

  const text = [oneLine, shortSum, fullSum].join(' ');
  return {
    topicName, oneLine, shortSum,
    numbers:  extractNumbers(text),
    dates:    extractDates(text),
    acronyms: extractAcronyms(text)
  };
}

function extractNumbers(text){
  const out = [];
  const seen = new Set();
  /* Priority-ordered patterns */
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
      /* Skip pure years when we already have plenty of data */
      if (/^(?:19|20)\d{2}$/.test(raw) && out.length >= 4) continue;
      const key = raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(raw);
      if (out.length >= 6) return out;
    }
  }
  return out;
}

function extractDates(text){
  const out = [];
  const seen = new Set();
  const re = /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*,?\s*\d{4}\b/g;
  let m;
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
  const out = [];
  const seen = new Set();
  const stop = new Set([
    'THE','AND','FOR','BUT','NOT','ALL','NEW','ONE','TWO','THREE',
    'INDIA','USA','US','UK','EU','IT','OF','ON','IN','AT','AS','BY',
    'TO','SO','NO','WE','BE','OR','IF','DO','GO','UP','IS','AM','AN',
    'PER','VIA','NEW','PPP','GDP','NPR','USD','INR','CEO','PM','MP'
  ]);
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
  const d = extractInfographicData(art.body);
  const lede = d.oneLine || d.shortSum || '';
  const trunc = lede.length > 260
    ? lede.substring(0, 260).replace(/\s+\S*$/, '') + '…'
    : lede;

  /* Build up to 4 tiles from numbers, then dates */
  const tileSources = [...d.numbers, ...d.dates].slice(0, 4);
  const tiles = tileSources.map(t => {
    const m = t.match(/^((?:USD|INR|EUR|₹|\$|Rs\.?|NPR|GBP|€)?\s*[\d.,]+\s*(?:%|billion|trillion|million|crore|lakh|thousand|bn|tn|kg|km|GW|MW|metres?|meters?|years?|days?)?)\s*(.*)$/i);
    const val = m ? m[1].trim() : t;
    const lab = (m && m[2] ? m[2].trim() : '') || guessLabel(t);
    return `<div class="info-tile"><div class="info-tile-n">${esc(val)}</div>${lab ? `<div class="info-tile-l">${esc(lab)}</div>` : ''}</div>`;
  }).join('');

  const chips = d.acronyms.slice(0, 8)
    .map(a => `<span class="info-chip acro">${esc(a)}</span>`).join('');
  const dateChips = d.dates.slice(0, 3)
    .map(dt => `<span class="info-chip date">${esc(dt)}</span>`).join('');

  return `<div class="info-card">
    <div class="info-num">TOPIC ${String(num).padStart(2, '0')}</div>
    <h3 class="info-title">${esc(art.title)}</h3>
    <p class="info-lede">${esc(trunc)}</p>
    ${tiles ? `<div class="info-tiles">${tiles}</div>` : ''}
    ${(chips || dateChips) ? `<div class="info-chips">${chips}${dateChips}</div>` : ''}
  </div>`;
}

function buildInfographic(articles){
  const cards = articles.map((a, i) => buildInfoCard(a, i + 1)).join('');
  return `<section class="mag-infographic">
    <div class="mag-part-label">Visual Digest</div>
    <h2>At a Glance</h2>
    <p class="lede">Every topic in this magazine, distilled to its key numbers, dates and acronyms. A visual map of what's inside.</p>
    <div class="info-grid">${cards}</div>
  </section>`;
}

/* ══════════════════════════════════════════════════════════════
   BUILD MAGAZINE
   ══════════════════════════════════════════════════════════════ */
function buildMagazine(){
  if (!Object.keys(loadedFiles).length){ statusEl.textContent = 'No files loaded.'; return; }

  /* Discover all topics */
  const discovered = [];
  for (const [fname, content] of Object.entries(loadedFiles)){
    try {
      const meta = discoverTopic(fname, content);
      const body = extractBody(content);
      if (!body || body.trim().length < 50) continue; /* skip empty/unparseable */
      discovered.push({ ...meta, body });
    } catch (err){
      console.warn('discover failed', fname, err);
    }
  }

  if (!discovered.length){
    statusEl.textContent = 'No parseable topics found. Check that files contain .doc or topic content.';
    return;
  }

  /* Sort by topic_id suffix, then filename */
  discovered.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.topicId.localeCompare(b.topicId);
  });

  /* Group by part, preserving sorted order */
  const partMap = new Map();
  for (const t of discovered){
    if (!partMap.has(t.part)) partMap.set(t.part, []);
    partMap.get(t.part).push(t);
  }

  /* Renumber topics sequentially across the whole magazine */
  let counter = 0;
  const matched = discovered.map(t => { counter++; return { ...t, index: counter }; });

  statusEl.textContent =
    `${matched.length} topics loaded · ${partMap.size} part(s)` +
    (includeQuiz ? '' : ' · quiz hidden');

  /* Build output */
  builtParts = [];
  for (const [part, items] of partMap){
    builtParts.push({
      part,
      articles: items.map(t => ({
        title: t.title,
        sourceId: t.topicId,
        body: t.body,
        index: t.index
      }))
    });
  }

  const out = [];
  out.push(buildCover(matched.length, builtParts.length));
  out.push(buildTOC(matched));
  out.push(`<section class="mag-divider"><div class="k">Digest</div><h2>At a Glance</h2></section>`);
  out.push(buildInfographic(matched));

  for (const p of builtParts){
    out.push(buildDivider(p.part));
    for (const a of p.articles){
      out.push(buildArticle(a.index, p.part, a));
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

function esc(s){
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
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
  if (part.includes('·')){ const parts = part.split('·'); k = parts[0]; n = parts.slice(1).join('·'); }
  return `<section class="mag-divider"><div class="k">${esc(k.trim())}</div><h2>${esc(n.trim())}</h2></section>`;
}

function buildArticle(num, part, a){
  return `<article class="mag-article" id="art-${num}">
    <div class="mag-part-label">${esc(part)}</div>
    <h1 class="mag-title">${num}. ${esc(a.title)}</h1>
    ${a.body}
  </article>`;
}

/* ══════════════════════════════════════════════════════════════
   XHTML CLEANUP (for EPUB)
   ══════════════════════════════════════════════════════════════ */
function cleanXhtml(html){
  let c = html;
  c = c.replace(/<script[\s\S]*?<\/script>/gi, '');
  c = c.replace(/<style[\s\S]*?<\/style>/gi, '');
  c = c.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  c = c.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  c = c.replace(/<(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)([^>]*?)(?<!\/)>/gi, '<$1$2/>');
  return c;
}

/* ══════════════════════════════════════════════════════════════
   EPUB DOWNLOAD
   ══════════════════════════════════════════════════════════════ */
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

    /* CSS */
    const baseCss = await getExportCss('epub');
    const themeCss = ''; // theme overrides already included in complete EPUB CSS
    zip.file('OEBPS/style.css', baseCss + '\n\n/* THEME: ' + currentTheme + ' */\n' + themeCss);

    /* Cover XHTML */
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
<p style="margin-top:5em;font-size:.9em;color:#888">${builtParts.reduce((n,p)=>n+p.articles.length,0)} topics · ${builtParts.length} section(s)${includeQuiz ? '' : ' · quiz hidden'}</p>
</div>
</body></html>`);

    /* TOC / nav.xhtml */
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
    <li><a href="infographic.xhtml">At a Glance (Infographic)</a></li>
${navItems}
  </ol>
</nav>
</body></html>`);

    /* Infographic XHTML */
    zip.file('OEBPS/infographic.xhtml',
`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="UTF-8"/><title>At a Glance</title>
<link rel="stylesheet" type="text/css" href="style.css"/></head>
<body data-theme="${currentTheme}">
${buildInfographic(allArticles)}
</body></html>`);

    /* Manifest + spine */
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

    /* Parts + articles */
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
        c += `<section id="sec-${a.index}">
          <h1>${esc(a.title)}</h1>
          ${cleanXhtml(a.body)}
        </section>`;
      }
      c += '</body></html>';
      zip.file(`OEBPS/${fname}`, c);
      manifestItems.push(`<item id="${id}" href="${fname}" media-type="application/xhtml+xml"/>`);
      spineItems.push(`<itemref idref="${id}"/>`);
    });

    /* content.opf */
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

/* ══════════════════════════════════════════════════════════════
   HTML DOWNLOAD — save full magazine as standalone HTML
   ══════════════════════════════════════════════════════════════ */
async function downloadHtml(){
  const mag = document.getElementById('magazine');
  if (!mag) return;

  /* Gather all relevant stylesheets: base-pdf (as all), all themes */
  const baseCss = await getExportCss('pdf');
  const themes = ''; // theme overrides already included in complete PDF CSS

  const currentThemeAttr = currentTheme;
  const title = 'CLAT GK Current Affairs 2026';
  const toolbarNote = `<!-- Standalone magazine · theme: ${currentTheme} · ${includeQuiz ? 'quiz included' : 'quiz hidden'} -->`;

  const html =
`<!DOCTYPE html>
<html lang="en" data-theme="${currentThemeAttr}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
${toolbarNote}
<style>
${baseCss}
${themes}
@media print{
  body{background:#fff!important;font-size:10pt}
  .mag-cover,.mag-toc,.mag-divider,.mag-article,.mag-infographic{margin:0;box-shadow:none;padding:0;max-width:none;border-radius:0}
  .mag-cover{padding:28mm 22mm;min-height:250mm;page-break-after:always}
  .mag-toc{padding:0;page-break-after:always}
  .mag-infographic{padding:0;page-break-before:always;page-break-after:always}
  .mag-divider{padding:55mm 28mm;page-break-before:always;page-break-after:always}
  .mag-article{padding:0;page-break-before:always}
  .mag-article .node,.mag-article .lawcard,.mag-article .q,.mag-article .tl-i,
  .mag-article ol.bl>li,.mag-article .facts ol>li,.info-card{break-inside:avoid}
  a{color:inherit;text-decoration:none}
}
</style>
</head>
<body data-theme="${currentThemeAttr}">
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
