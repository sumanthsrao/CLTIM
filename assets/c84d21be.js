(function(){
"use strict";
var body = document.body;

async function getTopicJson(){
if (window.TOPIC_JSON) return window.TOPIC_JSON;

var inline = document.getElementById("topic-json");
if (inline && inline.textContent.trim()) {
return JSON.parse(inline.textContent);
}

var qs = new URLSearchParams(window.location.search);
var jsonUrl = qs.get("json");
if (jsonUrl) {
var r = await fetch(jsonUrl);
if (!r.ok) throw new Error("Unable to load JSON1: " + r.status);
return await r.json();
}

throw new Error("No TOPIC JSON supplied.");
}

function esc(v){
return String(v == null ? "" : v)
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/'/g, "&#039;");
}

function arr(v){ return Array.isArray(v) ? v : []; }

function friendlyRole(v){
var s = String(v == null ? "" : v).trim();
if (!s) return "";
if (/^subtopic$/i.test(s)) return "Sub Topic";
return s.replace(/[_-]+/g, " ").replace(/\b\w/g, function(ch){ return ch.toUpperCase(); });
}

function roleKey(v){
var s = friendlyRole(v);
if (!s) return "";
return s.charAt(0).toUpperCase();
}

function pick(obj, keys, fallback){
for (var i = 0; i < keys.length; i++) {
if (obj && obj[keys[i]] != null) return obj[keys[i]];
}
return fallback;
}

function textValue(v){
if (v == null) return "";
if (typeof v === "string" || typeof v === "number") return String(v);
if (typeof v === "object") return String(v.text || v.value || v.content || v.summary || "");
return String(v);
}

function sectionHeader(title, tagHtml){
return `<div class="node section-heading-card">
<div class="node-head node-head-role">
<h3><span class="nid nid-empty" aria-hidden="true">&nbsp;</span> ${title}</h3>
${tagHtml || ""}
</div>
</div>`;
}

function renderSummary(topic){
var s = pick(topic, ["summaries", "summary_levels"], {}) || {};
var one = textValue(pick(s, ["one_line", "single_line"], ""));
var shortv = textValue(pick(s, ["short"], ""));
var full = textValue(pick(s, ["full", "summary"], ""));

if (!one && !shortv && !full) return "";

return `
<section class="topic-summary">
${sectionHeader("The Topic at a Glance", `<span class="sectag">JSON1</span>`)}
${one ? `<div class="summary-block topic"><div class="summary-k">One Line</div><div class="summary-v">${esc(one)}</div></div>` : ""}
${shortv ? `<div class="summary-block topic"><div class="summary-k">Short</div><div class="summary-v">${esc(shortv)}</div></div>` : ""}
${full ? `<div class="summary-block topic"><div class="summary-k">Full</div><div class="summary-v">${esc(full)}</div></div>` : ""}
</section>`;
}

function renderList(items, cls){
if (!items.length) return "";
return `<ol class="bl ${cls || ""}">` + items.map(function(it){
return `<li>${esc(textValue(it))}</li>`;
}).join("") + `</ol>`;
}

function renderNodes(topic){
var nodes = arr(pick(topic, ["nodes", "sections", "objects"], []));
if (!nodes.length) return "";

var html = `<section>${sectionHeader("Topic Content", `<span class="sectag">${nodes.length} objects</span>`)}`;

nodes.forEach(function(n, idx){
var nodeId = pick(n, ["node_id", "id", "ref"], "N" + String(idx + 1).padStart(2, "0"));
var displayNodeId = String(nodeId);
var topicPrefix = String(pick(topic, ["topic_id", "id"], ""));
if (topicPrefix && displayNodeId.indexOf(topicPrefix) === 0) displayNodeId = displayNodeId.slice(topicPrefix.length);
displayNodeId = displayNodeId.replace(/^S0+(\d+)$/i, "S$1");
var title = pick(n, ["title", "heading", "name"], "Untitled");
var role = textValue(pick(n, ["role", "structure_role"], ""));
var summary = textValue(pick(n, ["summary", "section_summary"], ""));
var subtpl = textValue(pick(n, ["sub_template", "subtemplate", "template"], ""));
var content = arr(pick(n, ["content", "bullets", "items"], []));
var sourceOrder = Number(pick(n, ["source_order"], idx + 1));
var learningOrder = Number(pick(n, ["learning_order"], sourceOrder));
if (!Number.isFinite(sourceOrder)) sourceOrder = idx + 1;
if (!Number.isFinite(learningOrder)) learningOrder = sourceOrder;

var lists = renderList(content, "");

html += `
<div class="node topic-node" data-objview="all" data-source-order="${sourceOrder}" data-learning-order="${learningOrder}" data-original-order="${idx + 1}">
<div class="node-head node-head-role">
<h3><span class="nid" title="${esc(nodeId)}">${esc(displayNodeId)}</span> ${esc(title)}</h3>
${role ? `<span class="role-key" title="${esc(friendlyRole(role))}">${esc(roleKey(role))}</span>` : ""}
<div class="objview">
<button type="button" data-objview="all" class="active">All</button>
<button type="button" data-objview="summary">Sum</button>
<button type="button" data-objview="content">Con</button>
</div>
</div>
${summary ? `<div class="summary-block"><div class="summary-k">Summary</div><div class="summary-v">${esc(summary)}</div></div>` : ""}
${subtpl ? `<div class="subtpl">Sub-template: <strong>${esc(subtpl)}</strong></div>` : ""}
${lists}
</div>`;
});

html += "</section>";
return html;
}

function renderLegal(topic){
var items = []
.concat(arr(pick(topic, ["legal_instruments"], [])))
.concat(arr(pick(topic, ["cases"], [])))
.concat(arr(pick(topic, ["bills"], [])));

if (!items.length) return "";

return `
<section>
${sectionHeader("Cases, Acts &amp; Laws", `<span class="sectag law">${items.length} instruments</span>`)}
<div class="lawgrid">
${items.map(function(x){
var name = pick(x, ["name", "title"], "");
var year = pick(x, ["year", "date"], "");
var summary = textValue(pick(x, ["summary", "role", "text"], ""));
var src = pick(x, ["source"], "");
var citation = pick(x, ["citation", "url"], "");
var kind = String(pick(x, ["kind", "type"], "")).toLowerCase();
var cls = kind === "case" ? "lawcard case" : "lawcard";
return `<div class="${cls}" ${src === "web" ? 'data-src="web"' : ""}>
<div class="law-head">
<span class="law-name">${esc(name)}</span>
${year ? `<span class="law-year">${esc(year)}</span>` : ""}
</div>
<ul class="law-provisions">
${summary ? `<li>${esc(summary)} ${citation ? `<a href="${esc(citation)}" target="_blank" rel="noopener">[source]</a>` : ""}</li>` : ""}
</ul>
</div>`;
}).join("")}
</div>
</section>`;
}

function renderReference(topic){
var keywords = arr(pick(topic, ["keywords"], []));
var tags = arr(pick(topic, ["tags"], []));
if (!keywords.length && !tags.length) return "";

return `
<section>
${sectionHeader("Reference Apparatus", `<span class="sectag">keywords · tags</span>`)}
${keywords.length ? `<div class="chips" style="margin-bottom:8px">${keywords.map(function(x){return `<span class="chip">${esc(textValue(x))}</span>`;}).join("")}</div>` : ""}
${tags.length ? `<div class="chips">${tags.map(function(x){return `<span class="tagc">${esc(textValue(x))}</span>`;}).join("")}</div>` : ""}
</section>`;
}

function renderTimeline(topic){
var items = arr(pick(topic, ["timeline"], []));
if (!items.length) return "";

return `
<section>
${sectionHeader("Timeline", `<span class="sectag fact">Facts toggle</span>`)}
<div class="tl">
${items.map(function(x){
var date = pick(x, ["date"], "");
var event = textValue(pick(x, ["event", "text"], ""));
var src = pick(x, ["source"], "");
var citation = pick(x, ["citation", "url"], "");
return `<div class="tl-i ${src === "web" ? "web" : ""}" ${src === "web" ? 'data-src="web"' : ""}>
<span class="tl-d">${esc(date)}</span>
<span class="tl-e">${esc(event)} ${citation ? `<a class="fact-cite" href="${esc(citation)}" target="_blank" rel="noopener">[source]</a>` : ""}</span>
</div>`;
}).join("")}
</div>
</section>`;
}

function renderFacts(topic){
var facts = arr(pick(topic, ["facts", "source_facts"], []));
if (!facts.length) return "";

return `
<section>
${sectionHeader("Fact Bank", `<span class="sectag fact">${facts.length} facts</span>`)}
<div class="fact-legend"><span>Rendered from JSON1. Source facts stay visible; web-enriched facts carry citations and can be hidden with the Web toggle.</span></div>
<div class="facts"><ol>
${facts.map(function(x){
var text = textValue(x);
var src = typeof x === "object" && x ? pick(x, ["source"], "") : "";
var citation = typeof x === "object" && x ? pick(x, ["citation", "url"], "") : "";
var label = typeof x === "object" && x ? pick(x, ["label"], "") : "";
return `<li ${src === "web" ? 'data-src="web"' : ""}>${label ? `<strong>${esc(label)}:</strong> ` : ""}${esc(text)} ${citation ? `<a class="fact-cite" href="${esc(citation)}" target="_blank" rel="noopener">[source]</a>` : ""}</li>`;
}).join("")}
</ol></div>
</section>`;
}

function renderInfographics(topic){
var items = arr(pick(topic, ["infographics","images"], []));
if (!items.length) return "";

items = items.slice().sort(function(a,b){
return Number(pick(a,["order"],0)) - Number(pick(b,["order"],0));
});

return `
<section class="infographic-section" id="infographic-section">
${sectionHeader("Infographics", `<span class="sectag">${items.length} images</span>`)}

<div class="ig-shell" data-ig-count="${items.length}">
<div class="ig-stage">
<button class="ig-nav ig-prev" type="button" aria-label="Previous infographic">&#10094;</button>

<div class="ig-track-wrap">
<div class="ig-track">
${items.map(function(x, idx){
var title = pick(x,["title","file_name","name"],"Infographic " + (idx+1));
var url = pick(x,["image_url","url","src"],"");
var sourceUrl = pick(x,["source_url"],"");
return `<figure class="ig-slide" data-ig-index="${idx}">
<div class="ig-image-wrap">
<img src="${esc(url)}" alt="${esc(title)}" loading="lazy">
</div>
<figcaption>
<span class="ig-caption-title">${esc(title)}</span>
${sourceUrl ? `<a class="fact-cite" href="${esc(sourceUrl)}" target="_blank" rel="noopener">Open source</a>` : ""}
</figcaption>
</figure>`;
}).join("")}
</div>
</div>

<button class="ig-nav ig-next" type="button" aria-label="Next infographic">&#10095;</button>
</div>

<div class="ig-status">
<div class="ig-dots" aria-label="Infographic position">
${items.map(function(_, idx){
return `<button type="button" class="ig-dot ${idx===0 ? "active" : ""}" data-ig-go="${idx}" aria-label="Go to infographic ${idx+1}"></button>`;
}).join("")}
</div>
<div class="ig-count"><span class="ig-current">1</span> / ${items.length}</div>
</div>
</div>
</section>`;
}

function renderTopic(topic){
var topicId = pick(topic, ["topic_id", "id"], "UNKNOWN");
var title = pick(topic, ["title", "topic_name", "name"], "Untitled Topic");
var lede = textValue(pick(topic, ["lede", "description", "one_line"], ""));

var nodes = arr(pick(topic, ["nodes", "sections", "objects"], []));
var facts = arr(pick(topic, ["facts", "source_facts"], []));
var webFacts = facts.filter(function(x){ return x && typeof x === "object" && x.source === "web"; }).length;
var legalCount =
arr(pick(topic, ["legal_instruments"], [])).length +
arr(pick(topic, ["cases"], [])).length +
arr(pick(topic, ["bills"], [])).length;

var html = `
<header class="cover">
<div class="cover-main">
<div class="kicker">CLAT GK · Student Reader · ${esc(topicId)}</div>
<h1>${esc(title)}</h1>
${lede ? `<p class="lede">${esc(lede)}</p>` : ""}
</div>
<div class="metas">
<span class="meta on">${esc(topicId)}</span>
<span class="meta">${nodes.length} objects</span>
<span class="meta ok">${facts.length} facts · ${webFacts} web</span>
<span class="meta">${legalCount} legal</span>
</div>
</header>`;

html += renderSummary(topic);
html += renderNodes(topic);
html += renderLegal(topic);
html += renderReference(topic);
html += renderTimeline(topic);
html += renderFacts(topic);

html += renderInfographics(topic);

html += `<footer>
<span><code>JSONTOPIC RENDER</code> · <code>${esc(topicId)}</code></span>
<span>${nodes.length} objects · ${facts.length} facts · ${legalCount} legal</span>
</footer>`;

document.getElementById("reader-root").innerHTML = html;
}

function initControls(){
var segs = {
mode: { el: document.getElementById("ct-mode"), state: "full", attr: "mode" },
sum: { el: document.getElementById("ct-sum"), state: "on", attr: "sum" },
content: { el: document.getElementById("ct-content"), state: "on", attr: "content" },
facts: { el: document.getElementById("ct-facts"), state: "on", attr: "facts" },
web: { el: document.getElementById("ct-web"), state: "on", attr: "web" },
view: { el: document.getElementById("ct-view"), state: "learning", attr: "view" }
};
var status = document.getElementById("status");

function applyNodeOrder(orderMode){
document.querySelectorAll("section").forEach(function(section){
var nodes = Array.from(section.querySelectorAll(":scope > .topic-node"));
if (nodes.length < 2) return;
var key = orderMode === "source" ? "sourceOrder" : "learningOrder";
nodes.sort(function(a,b){
var av = Number(a.dataset[key]);
var bv = Number(b.dataset[key]);
if (!Number.isFinite(av)) av = Number(a.dataset.originalOrder) || 999999;
if (!Number.isFinite(bv)) bv = Number(b.dataset.originalOrder) || 999999;
if (av !== bv) return av - bv;
return (Number(a.dataset.originalOrder) || 0) - (Number(b.dataset.originalOrder) || 0);
});
nodes.forEach(function(node){ section.appendChild(node); });
});
}

function update(){
body.classList.toggle("mode-headings", segs.mode.state === "headings");
body.classList.toggle("mode-full", segs.mode.state === "full");
body.classList.toggle("summaries-off", segs.sum.state === "off");
body.classList.toggle("content-off", segs.content.state === "off");
body.classList.toggle("facts-off", segs.facts.state === "off");
body.classList.toggle("web-off", segs.web.state === "off");
body.classList.toggle("view-source", segs.view.state === "source");
body.classList.toggle("view-learning", segs.view.state === "learning");
applyNodeOrder(segs.view.state);

Object.keys(segs).forEach(function(key){
var s = segs[key];
if (!s.el) return;
s.el.querySelectorAll("button").forEach(function(b){
b.classList.toggle("active", b.dataset[s.attr] === s.state);
});
});

if (status) {
status.textContent =
segs.mode.state +
" · sum " + segs.sum.state +
" · con " + segs.content.state +
" · facts " + segs.facts.state +
" · web " + segs.web.state +
" · " + segs.view.state;
}
}

Object.keys(segs).forEach(function(key){
var s = segs[key];
if (!s.el) return;
s.el.querySelectorAll("button").forEach(function(b){
b.addEventListener("click", function(){
s.state = b.dataset[s.attr];
update();
});
});
});

document.addEventListener("click", function(ev){
var b = ev.target.closest(".objview button");
if (!b) return;
var node = b.closest(".node");
if (!node) return;
var v = b.dataset.objview;
node.dataset.objview = v;
node.dataset.localOverride = "1";
node.querySelectorAll(".objview button").forEach(function(x){
x.classList.toggle("active", x.dataset.objview === v);
});
});

update();
}

function initInfographicCarousels(){
document.querySelectorAll(".ig-shell").forEach(function(shell){
var track = shell.querySelector(".ig-track");
var slides = Array.from(shell.querySelectorAll(".ig-slide"));
var dots = Array.from(shell.querySelectorAll(".ig-dot"));
var prev = shell.querySelector(".ig-prev");
var next = shell.querySelector(".ig-next");
var current = shell.querySelector(".ig-current");
if (!track || !slides.length) return;

var index = 0;
var startX = null;

function show(i){
index = Math.max(0, Math.min(slides.length - 1, i));
track.style.transform = "translateX(" + (-index * 100) + "%)";
dots.forEach(function(d, n){ d.classList.toggle("active", n === index); });
if (current) current.textContent = String(index + 1);
if (prev) prev.disabled = index === 0;
if (next) next.disabled = index === slides.length - 1;
}

if (prev) prev.addEventListener("click", function(){ show(index - 1); });
if (next) next.addEventListener("click", function(){ show(index + 1); });
dots.forEach(function(d){ d.addEventListener("click", function(){ show(Number(d.dataset.igGo)); }); });

var wrap = shell.querySelector(".ig-track-wrap");
if (wrap){
wrap.addEventListener("touchstart", function(e){
startX = e.touches && e.touches[0] ? e.touches[0].clientX : null;
}, {passive:true});
wrap.addEventListener("touchend", function(e){
if (startX == null || !e.changedTouches || !e.changedTouches[0]) return;
var dx = e.changedTouches[0].clientX - startX;
if (Math.abs(dx) > 45) show(index + (dx < 0 ? 1 : -1));
startX = null;
}, {passive:true});
}

shell.tabIndex = 0;
shell.addEventListener("keydown", function(e){
if (e.key === "ArrowLeft") show(index - 1);
if (e.key === "ArrowRight") show(index + 1);
});

show(0);
});
}

async function loadSharedInfographics(topic){
var manifestUrl = "";
if (!manifestUrl) return topic;
try {
var r = await fetch(manifestUrl, {cache:"no-store"});
if (!r.ok) return topic;
var manifest = await r.json();
var byTopic = manifest && manifest.topics ? manifest.topics : {};
var images = byTopic[String(topic.topic_id || topic.id || "")];
if (Array.isArray(images)) topic.infographics = images;
} catch (e) {
// Images are optional and asynchronous; reader remains usable if manifest is unavailable.
}
return topic;
}

async function boot(){
try {
var topic = await getTopicJson();
topic = await loadSharedInfographics(topic);
renderTopic(topic);
initInfographicCarousels();
} catch (e) {
document.getElementById("reader-root").innerHTML =
`<section><div class="node"><div class="summary-block"><div class="summary-k">Renderer error</div><div class="summary-v">${esc(e.message)}</div></div></div></section>`;
}
initControls();
}

boot();
})();
