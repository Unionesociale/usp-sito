/* Raccoglie gli eventi per la Palestina e contro la guerra dai calendari esterni,
   trova la posizione sulla mappa e li restituisce in un formato unico.
   Lo usa aggiorna-notizie.mjs (GitHub Actions, ogni ora). */

const GIORNI_AVANTI = 21;          // eventi salvati: da ieri a 3 settimane (il sito ne mostra 2)
const UA = { "User-Agent": "Mozilla/5.0 (USP Unione Sociale Pinerolo; sito github.com/Unionesociale/usp-sito)",
             "Accept-Language": "it-IT,it;q=0.9" };
const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", egrave: "è", agrave: "à", ograve: "ò", ugrave: "ù", igrave: "ì", eacute: "é", hellip: "…" };
const testo = (s = "") => s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
  .replace(/\s+/g, " ").trim();

async function scarica(url, tipo = "text") {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return tipo === "json" ? r.json() : r.text();
}

/* data/ora "locale" (Italia) in formato 2026-10-24T15:00 */
const due = (n) => String(n).padStart(2, "0");
const locale = (y, m, d, hh = null, mm = 0) => `${y}-${due(m)}-${due(d)}` + (hh === null ? "" : `T${due(hh)}:${due(mm)}`);
function daISO(iso) {
  const d = new Date(iso); if (isNaN(d)) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}
const oggi = () => daISO(new Date().toISOString()).slice(0, 10);
const traGiorni = (n) => daISO(new Date(Date.now() + n * 864e5).toISOString()).slice(0, 10);

/* ---------- 1. PeaceLink: servizio dati JSON ufficiale ----------
   Si tengono solo gli eventi di mobilitazione e discussione: un evento passa se titolo, tipo
   o descrizione contengono una di queste parole. */
export const PL_TIENI = new RegExp("\\b(" + [
  "corte[oi]", "mobilitazion\\w*", "manifestazion\\w*", "occupazion\\w*", "occupat\\w*", "presidi\\w*", "piazza",
  "sciopero", "scioperi", "fiaccolat\\w*", "sit-?in", "flash ?mob", "marcia", "marce", "picchett\\w*", "blocc\\w*",
  "boicott\\w*", "bds", "volantinaggi\\w*", "banchett\\w*", "catena umana", "carovana", "staffetta", "veglia", "digiun\\w*",
  "camminata", "biciclettata", "raccolta firme", "campagna", "lotta", "lotte", "resistenza", "solidariet\\w*",
  "dibattit\\w*", "assemble\\w*", "discussion\\w*", "confronto", "incontro pubblico", "incontro", "conferenz\\w*",
  "tavola rotonda", "presentazion\\w*", "testimonianz\\w*", "seminari\\w*", "convegn\\w*", "forum",
  "film", "cinema", "cineforum", "documentari\\w*", "proiezion\\w*", "rassegna"
].join("|") + ")\\b", "i");
async function peacelink() {
  const ieri = traGiorni(-1).split("-").reverse().join("-");
  const lista = await scarica(`https://www.peacelink.it/js/events.php?start=${ieri}&days=${GIORNI_AVANTI + 1}`, "json");
  return (Array.isArray(lista) ? lista : []).map((e) => {
    let inizio = null;
    const sd = String(e.start_date || ""), st = String(e.start_time || "");
    const md = sd.match(/^(\d{4})-(\d{2})-(\d{2})/) || sd.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
    const mt = st.match(/(\d{1,2})[:.](\d{2})/);
    if (md && mt) {
      const [y, m, d] = md[1].length === 4 ? [md[1], md[2], md[3]] : [md[3], md[2], md[1]];
      inizio = locale(+y, +m, +d, +mt[1], +mt[2]);
    } else if (e.start) inizio = daISO(e.start);
    const tutto = !!(e.allday || e.allDay);
    if (inizio && tutto) inizio = inizio.slice(0, 10);
    const lat = parseFloat(e.latitude), lon = parseFloat(e.longitude);
    const citta = testo(e.geo_name || e.province_name || e.province || "");
    return {
      id: "pl-" + (e.id_event || e.id), fonte: "PeaceLink", titolo: testo(e.title || ""),
      tipo: testo(e.type || ""), inizio, luogo: [testo(e.place || ""), testo(e.address || ""), citta].filter(Boolean).join(", "),
      citta, regione: testo(e.region_name || e.region || ""),
      coord: isFinite(lat) && isFinite(lon) && (lat || lon) ? [+lat.toFixed(5), +lon.toFixed(5)] : null,
      link: e.url || `https://www.peacelink.it/calendario/event.php?id=${e.id_event || e.id}`,
      online: !!+e.is_online,
      _testo: [e.title, e.type, e.description, e.place_details].map((x) => testo(String(x || ""))).join(" "),
    };
  }).filter((e) => e.titolo && e.inizio && !e.online && PL_TIENI.test(e._testo))
    .map(({ _testo, ...e }) => e);
}

/* ---------- 2. Amicizia Italo-Palestinese: calendario Joomla (JEvents) ---------- */
const AIP = "https://www.amiciziaitalo-palestinese.org";
async function amicizia() {
  const trovati = new Map();
  for (const salto of [0, 7, 14, 21]) {
    const [y, m, d] = traGiorni(salto).split("-");
    let html;
    try { html = await scarica(`${AIP}/calendario-attivita/eventidellasettimana/${y}/${m}/${d}/-`); }
    catch (e) { console.log(`  Amicizia settimana ${y}-${m}-${d}: ${e.message}`); continue; }
    let giorno = null;
    const re = /eventidelgiorno\/(\d{4})\/(\d{1,2})\/(\d{1,2})|<a[^>]+href="([^"]*dettaglievento\/(\d+)\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const x of html.matchAll(re)) {
      if (x[1]) { giorno = [+x[1], +x[2], +x[3]]; continue; }
      if (!giorno) continue;
      const id = x[5]; if (trovati.has(id)) continue;
      const titolo = testo(x[6]); if (!titolo) continue;
      trovati.set(id, { id, giorno, titolo, link: new URL(x[4].replace(/&amp;/g, "&"), AIP).href });
    }
    await pausa(400);
  }
  const out = [];
  for (const ev of trovati.values()) {
    let titolo = ev.titolo, ora = null, luogo = "";
    try {
      const html = await scarica(ev.link);
      const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
      if (og && (/\.\.\.|…/.test(titolo) || titolo.length < 15)) titolo = testo(og[1]).replace(/\s*[-|–]\s*Associazione[\s\S]*$/i, "");
      const corpo = testo(html.slice(html.search(/dettaglievento|jev_evdt|ev_detail|contentheading/i) || 0));
      const t = corpo.match(/\b(?:ore|h\.?|alle)\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\b/i) || corpo.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
      if (t) ora = [+t[1], +(t[2] || 0)];
      const l = corpo.match(/\b(?:Luogo|Dove|Location)\s*:?\s*([^|]{4,90}?)(?:\s{2}|Contatto|Categoria|Data|$)/i);
      if (l) luogo = l[1].trim();
      await pausa(300);
    } catch (e) { /* si tiene il titolo della lista */ }
    titolo = titolo.replace(/\s*\.\.\.$/, "…");
    const cittaRaw = (titolo.split(":")[0] || "").trim();
    const citta = cittaRaw.length <= 45 ? cittaRaw : "";
    out.push({ id: "aip-" + ev.id, fonte: "Amicizia Italo-Palestinese", titolo, tipo: "",
      inizio: locale(...ev.giorno, ...(ora || [null])), luogo: luogo || citta, citta, regione: "", coord: null, link: ev.link });
  }
  return out;
}

/* ---------- 3. Invictapalestina: articolo "Gli appuntamenti della settimana" ---------- */
const INVICTA = "https://www.invictapalestina.org/archives/55281";
async function invicta() {
  const html = await scarica(INVICTA);
  const pezzi = [...html.matchAll(/<(strong|b|h[2-5])[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => testo(m[2])).filter((t) => t.length > 6 && t.length < 160);
  const anno = +oggi().slice(0, 4), meseOra = +oggi().slice(5, 7);
  const out = [], visti = new Set();
  for (const riga of pezzi) {
    const m = riga.match(/^([A-ZÀ-Ý][A-Za-zÀ-ÿ'’.\s()]{1,45}?)\s*[–—-]\s*(.+)$/);
    if (!m) continue;
    const citta = m[1].trim(), resto = m[2];
    if (/varie|diverse|tutta italia|online|ogni giorno|tutti i giorni/i.test(citta + " " + resto.slice(0, 30))) continue;
    const d = resto.match(new RegExp(`(\\d{1,2})(?:[^\\d]{1,25}?\\d{1,2})?\\s+(${MESI.join("|")})`, "i"));
    if (!d) continue;
    const mese = MESI.indexOf(d[2].toLowerCase()) + 1;
    const y = mese < meseOra - 2 ? anno + 1 : anno;
    const o = resto.match(/\b(?:ore|h\.?|alle)\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\b/i) || resto.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    const chiave = citta.toLowerCase() + d[1] + mese; if (visti.has(chiave)) continue; visti.add(chiave);
    const nomeCitta = citta.toLowerCase().replace(/(^|[\s'’(])([a-zà-ÿ])/g, (x, a, b) => a + b.toUpperCase());
    out.push({ id: "inv-" + chiave.replace(/\W+/g, ""), fonte: "Invictapalestina", titolo: `${nomeCitta}: iniziativa per la Palestina`,
      descrizione: riga, tipo: "", inizio: locale(y, mese, +d[1], ...(o ? [+o[1], +(o[2] || 0)] : [null])),
      luogo: nomeCitta, citta: nomeCitta, regione: "", coord: null, link: INVICTA });
  }
  return out;
}

/* ---------- posizione sulla mappa (OpenStreetMap Nominatim, con memoria) ---------- */
export async function geocodifica(eventi, cache) {
  let richieste = 0;
  const cerca = async (q) => {
    const k = q.toLowerCase(); if (k in cache) return cache[k];
    if (richieste >= 40) return null;            // al massimo 40 ricerche nuove per giro
    richieste++; await pausa(1100);              // regola di Nominatim: 1 richiesta al secondo
    try {
      const j = await scarica("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=it&addressdetails=1&accept-language=it&q=" + encodeURIComponent(q), "json");
      cache[k] = j[0] ? { coord: [+(+j[0].lat).toFixed(5), +(+j[0].lon).toFixed(5)], regione: j[0].address?.state || "" } : null;
    } catch { return null; }
    return cache[k];
  };
  for (const e of eventi) {
    if (e.coord && e.regione) continue;
    const prove = [e.luogo && e.citta && e.luogo !== e.citta ? `${e.luogo}, ${e.citta}` : null, e.citta || e.luogo]
      .filter(Boolean).map((q) => q.replace(/\(([A-Z]{2})\)/, "$1"));
    for (const q of prove) {
      const g = await cerca(q);
      if (g) { e.coord = e.coord || g.coord; e.regione = e.regione || g.regione; break; }
    }
  }
}

/* ---------- tutto insieme ---------- */
export async function raccogliEventi(precedenti = [], cache = {}, extra = []) {
  const stato = [], tutti = [];
  for (const [nome, fn] of [["PeaceLink", peacelink], ["Amicizia Italo-Palestinese", amicizia], ["Invictapalestina", invicta]]) {
    try { const e = await fn(); tutti.push(...e); stato.push({ fonte: nome, ok: true, eventi: e.length }); console.log(`${nome}: ${e.length} eventi`); }
    catch (err) {
      stato.push({ fonte: nome, ok: false, errore: err.message }); console.log(`${nome}: non letto (${err.message})`);
      tutti.push(...precedenti.filter((p) => p.fonte === nome));   // se un sito non risponde si tengono i suoi eventi già salvati
    }
  }
  tutti.push(...extra);                       // mobilitazioni trovate sui giornali (Google News)
  await geocodifica(tutti, cache);
  const da = traGiorni(-1), a = traGiorni(GIORNI_AVANTI);
  const eventi = tutti.filter((e) => e.coord && e.inizio && e.inizio.slice(0, 10) >= da && e.inizio.slice(0, 10) <= a)
    .sort((x, y) => x.inizio.localeCompare(y.inizio));
  return { eventi, stato, senzaPosizione: tutti.filter((e) => !e.coord).length };
}
