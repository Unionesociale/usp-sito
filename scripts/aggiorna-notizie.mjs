/* Legge i feed dei giornali, tiene le notizie su Gaza e la Palestina e le salva in notizie.json.
   Lo fa partire da solo GitHub Actions ogni ora (file .github/workflows/sito.yml). */
import { readFile, writeFile } from "node:fs/promises";

/* ===== IMPOSTAZIONI =====
   FONTI: per aggiungere un giornale basta una riga con il nome e l'indirizzo del suo feed RSS. */
const FONTI = [
  { fonte: "Il Post", url: "https://www.ilpost.it/feed/",
    /* riserva: se il Post blocca GitHub, le stesse notizie del Post prese da Google News */
    riserva: "https://news.google.com/rss/search?q=" +
      encodeURIComponent("(gaza OR palestina OR palestinese OR palestinesi OR cisgiordania OR rafah OR flotilla) site:ilpost.it when:14d") +
      "&hl=it&gl=IT&ceid=IT:it" },
  // { fonte: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
];
/* PAROLE: una notizia viene presa se titolo, sommario o categorie contengono una di queste parole. */
const PAROLE = /\b(gaza|palestin\w*|cisgiordania|west bank|rafah|khan yunis|flotilla)\b/i;
/* MASSIMO: quante notizie tenere in archivio. */
const MASSIMO = 200;
const FILE = new URL("../notizie.json", import.meta.url);
const STATO = new URL("../stato.json", import.meta.url);
const BROWSER = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
  "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
  "Accept-Language": "it-IT,it;q=0.9",
};

/* ===== da qui in giù non serve toccare niente ===== */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const pulisci = (s = "") => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
  .replace(/\s+/g, " ").trim();
const re = (n, g) => new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, g);
const tag = (b, n) => { const m = b.match(re(n, "i")); return m ? pulisci(m[1]) : ""; };
const tutti = (b, n) => [...b.matchAll(re(n, "gi"))].map((m) => pulisci(m[1]));

function leggiFeed(xml, fonte) {
  const blocchi = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocchi.map((b) => {
    let link = tag(b, "link");
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? m[1] : ""; }
    const d = new Date(tag(b, "pubDate") || tag(b, "updated") || tag(b, "published") || Date.now());
    const titolo = tag(b, "title").replace(new RegExp("\\s+[-–]\\s+" + fonte + "$", "i"), "");
    return { titolo, link: link.trim(), fonte,
      data: (isNaN(d) ? new Date() : d).toISOString(),
      testo: [tag(b, "title"), tag(b, "description"), tag(b, "summary"), ...tutti(b, "category")].join(" ") };
  });
}

let archivio = { aggiornato: null, notizie: [] };
try { archivio = JSON.parse(await readFile(FILE, "utf8")); } catch {}

async function scarica(url) {
  const r = await fetch(url, { headers: BROWSER, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const xml = await r.text();
  if (!/<(item|entry)[\s>]/i.test(xml)) throw new Error("risposta senza notizie");
  return xml;
}

const nuove = [], stato = { controllo: new Date().toISOString(), fonti: [] };
for (const { fonte, url, riserva } of FONTI) {
  let xml = null, via = "diretto", errore = null;
  try { xml = await scarica(url); }
  catch (e) {
    errore = e.message;
    console.log(`${fonte}: feed non letto (${e.message})`);
    if (riserva) {
      try { xml = await scarica(riserva); via = "Google News"; console.log(`${fonte}: uso la riserva (Google News)`); }
      catch (e2) { errore += " / riserva: " + e2.message; console.log(`${fonte}: anche la riserva non va (${e2.message})`); }
    }
  }
  if (!xml) { stato.fonti.push({ fonte, ok: false, errore }); continue; }
  const trovate = leggiFeed(xml, fonte)
    .filter((n) => n.titolo && /^https?:\/\//.test(n.link) && PAROLE.test(n.testo))
    .map(({ testo, ...n }) => n);
  console.log(`${fonte} (${via}): ${trovate.length} notizie su Gaza/Palestina`);
  stato.fonti.push({ fonte, ok: true, via, trovate: trovate.length });
  nuove.push(...trovate);
}
await writeFile(STATO, JSON.stringify(stato, null, 1) + "\n");

/* la stessa notizia può arrivare dal feed diretto e da Google News: si tiene una sola volta */
const chiave = (n) => n.titolo.toLowerCase().replace(/[^a-z0-9àèéìòù]+/g, " ").trim();
const perLink = new Map();
const visti = new Set();
for (const n of [...(archivio.notizie || []), ...nuove]) {
  if (perLink.has(n.link) || visti.has(chiave(n))) continue;
  perLink.set(n.link, n); visti.add(chiave(n));
}
const notizie = [...perLink.values()].sort((a, b) => b.data.localeCompare(a.data)).slice(0, MASSIMO);

if (JSON.stringify(notizie) === JSON.stringify(archivio.notizie || [])) {
  console.log("Nessuna notizia nuova.");
} else {
  await writeFile(FILE, JSON.stringify({ aggiornato: new Date().toISOString(), notizie }, null, 1) + "\n");
  console.log(`Archivio aggiornato: ${notizie.length} notizie in tutto.`);
}
