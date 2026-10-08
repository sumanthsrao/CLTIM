(() => {
  const scriptEl = document.currentScript;
  const JSON_FILE = scriptEl?.dataset?.json || 'DEEPSEEK_VISUAL.json';
  const $ = (s, el=document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const accentLetter = a => ({saffron:'s',navy:'n',green:'g',violet:'v',teal:'t',move:'m'}[a] || 'k');
  const safeInline = html => String(html ?? ''); // JSON is trusted build data; supports <b>/<em>/<span yes/no>

  function th(g){ return `<div class="th ${accentLetter(g.accent)}">${esc(g.title)}</div>`; }
  function wrap(g, body){ return `<div class="tile accent-${esc(g.accent||'navy')} ${g.quiz?'quiz-hidden':''}" style="grid-column:span ${Number(g.span)||12}">${th(g)}${body}</div>`; }
  function list(items, cls=''){ return `<ul class="b ${cls}">${(items||[]).map(x=>`<li>${safeInline(x)}</li>`).join('')}</ul>`; }

  const renderers = {
    stats:g=>`<div class="stats">${(g.items||[]).map(x=>`<div class="stat"><div class="n">${esc(x.value)}</div><div class="l">${esc(x.label)}</div></div>`).join('')}</div>`,
    bullets:g=>list(g.items, `${accentLetter(g.accent)} ${g.columns===2?'cols-2':''}`),
    numbered:g=>`<ol class="n">${(g.items||[]).map(x=>`<li>${safeInline(x)}</li>`).join('')}</ol>`,
    chips:g=>`<div class="chips">${(g.items||[]).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>`,
    people:g=>`<div class="people">${(g.items||[]).map(x=>`<div class="np"><div class="r">${esc(x.role)}</div><div class="nm">${esc(x.name)}</div></div>`).join('')}</div>`,
    steps:g=>`<div class="steps">${(g.items||[]).map(x=>`<div class="step ${x.hot?'hot':''}"><div class="sn">${esc(x.n)}</div><div class="st">${esc(x.t)}</div><div class="sd">${esc(x.d)}</div></div>`).join('')}</div>`,
    timeline:g=>`<div class="night">${(g.events||[]).map(x=>`<div class="ev ${x.hot?'hot':''} ${x.warn?'warn':''}"><div class="when">${esc(x.date)}</div><div class="what">${safeInline(x.text)}</div></div>`).join('')}</div>`,
    stages:g=>`<div class="stages">${(g.items||[]).map(x=>`<div class="stage"><div class="sh">${esc(x.label)}</div><ul>${(x.bullets||[]).map(y=>`<li>${safeInline(y)}</li>`).join('')}</ul></div>`).join('')}</div>`,
    acts:g=>`<div class="acts">${(g.items||[]).map(x=>`<div class="act ${esc(x.variant||'default')}"><div class="yr">${esc(x.yr)}</div><div class="bd"><div class="nm">${esc(x.name)}</div><div class="de">${esc(x.desc)}</div></div></div>`).join('')}</div>`,
    symblocks:g=>(g.items||[]).map((x,i)=>`<div class="symblock s${i+1}"><div class="sh">${esc(x.label)}</div><ul>${(x.bullets||[]).map(y=>`<li>${safeInline(y)}</li>`).join('')}</ul></div>`).join(''),
    table:g=>`<table class="cmp"><thead><tr>${(g.headers||[]).map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${(g.rows||[]).map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>${g.note?`<div class="note">${safeInline(g.note)}</div>`:''}`,
    lanes:g=>`<div class="lanes">${(g.items||[]).map((x,i)=>`<div class="lane l${i+1}"><div class="lh">${esc(x.label)}</div><div class="evs">${(x.chips||[]).map(y=>`<span class="chip">${esc(y)}</span>`).join('')}</div></div>`).join('')}</div>`,
    webgroups:g=>`<div class="webgroups">${(g.items||[]).map(x=>`<div class="wg"><div class="gh">${esc(x.label)}</div><ul>${(x.items||[]).map(y=>`<li>${safeInline(y)}</li>`).join('')}</ul></div>`).join('')}</div>`,
    traps:g=>`<div class="traps">${(g.items||[]).map(x=>`<div class="tc"><div class="tt">${esc(x.title)}</div><div class="tb">${safeInline(x.body)}</div></div>`).join('')}</div>`,
    key:g=>`<div class="key">${(g.items||[]).map(x=>`<div class="ki"><div class="q">${esc(x.q)}</div><div class="a">${esc(x.a)}</div><div class="x">${esc(x.x)}</div></div>`).join('')}</div>`
  };

  function group(g){ const r=renderers[g.type] || (x=>list(x.items||[])); return wrap(g,r(g)); }
  function panel(p){
    return `<section class="panel"><header class="panel-head"><div class="kick">${esc(p.kicker)}</div><h2>${esc(p.title)}</h2><div class="sub">${esc(p.subtitle)}</div>${p.lede?`<div class="lede">${esc(p.lede)}</div>`:''}</header><div class="wall">${(p.groups||[]).map(group).join('')}</div></section>`;
  }
  function meta(m){
    const labels={objects:'objects',bullets:'bullets',facts:'facts',webFacts:'webFacts',mcqs:'mcqs',instruments:'instruments'};
    return Object.entries(labels).filter(([k])=>m?.[k]!==undefined).map(([k,l])=>`<span>${esc(m[k])} ${l}</span>`).join('');
  }
  function render(data){
    document.title = `${data.document?.title || 'VISUAL'} · Export`;
    $('#app').innerHTML = `<header class="doc-head"><div class="kick">${esc(data.document?.kicker)}</div><h1>${esc(data.document?.title)}</h1><div class="sub">${esc(data.document?.subtitle)}</div><div class="doc-meta">${meta(data.document?.meta)}</div></header>${(data.panels||[]).map(panel).join('')}`;
    $('#status').textContent = `${data.document?.id || ''} · ${data.panels?.length || 0} panels · JSON loaded`;
    $('#status').className='load-status ok';
  }
  async function boot(){
    try{
      const res=await fetch(JSON_FILE,{cache:'no-store'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      render(await res.json());
    }catch(err){
      $('#status').textContent='JSON load failed'; $('#status').className='load-status err';
      $('#app').innerHTML=`<div class="load-error"><h2>Could not load ${esc(JSON_FILE)}</h2><p>${esc(err.message)}</p><p>Open this published page through its normal hosted location so the JSON can be fetched.</p></div>`;
    }
  }
  window.addEventListener('DOMContentLoaded',boot);
})();