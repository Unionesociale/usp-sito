/* Legge i feed dei giornali, tiene le notizie su Gaza e la Palestina e le salva in notizie.json.
   Lo fa partire da solo GitHub Actions ogni ora (file .github/workflows/sito.yml). */
import { readFile, writeFile } from "node:fs/promises";

/* ===== IMPOSTAZIONI =====
   FONTI: per aggiungere un giornale basta una riga con il nome e l'indirizzo del suo feed RSS. */
const FONTI = [
  { fonte: "Il Post", url: "https://www.ilpost.it/feed/" },
  // { fonte: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
];
/* PAROLE: una notizia viene presa se titolo, sommario o categorie contengono una di queste parole. */
const PAROLE = /\b(gaza|palestin\w*|cisgiordania|west bank|rafah|khan yunis|flotilla)\b/i;
/* MASSIMO: quante notizie tenere in archivio. */
const MASSIMO = 200;
const FILE = new URL("../notizie.json", import.meta.url);

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
    return { titolo: tag(b, "title"), link: link.trim(), fonte,
      data: (isNaN(d) ? new Date() : d).toISOString(),
      testo: [tag(b, "title"), tag(b, "description"), tag(b, "summary"), ...tutti(b, "category")].join(" ") };
  });
}

let archivio = { aggiornato: null, notizie: [] };
try { archivio = JSON.parse(await readFile(FILE, "utf8")); } catch {}

const nuove = [];
for (const { fonte, url } of FONTI) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (USP notizie)" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const trovate = leggiFeed(await r.text(), fonte)
      .filter((n) => n.titolo && /^https?:\/\//.test(n.link) && PAROLE.test(n.testo))
      .map(({ testo, ...n }) => n);
    console.log(`${fonte}: ${trovate.length} notizie su Gaza/Palestina nel feed`);
    nuove.push(...trovate);
  } catch (e) { console.log(`${fonte}: feed non letto (${e.message})`); }
}

const perLink = new Map();
for (const n of [...(archivio.notizie || []), ...nuove]) if (!perLink.has(n.link)) perLink.set(n.link, n);
const notizie = [...perLink.values()].sort((a, b) => b.data.localeCompare(a.data)).slice(0, MASSIMO);

if (JSON.stringify(notizie) === JSON.stringify(archivio.notizie || [])) {
  console.log("Nessuna notizia nuova.");
} else {
  await writeFile(FILE, JSON.stringify({ aggiornato: new Date().toISOString(), notizie }, null, 1) + "\n");
  console.log(`Archivio aggiornato: ${notizie.length} notizie in tutto.`);
}
