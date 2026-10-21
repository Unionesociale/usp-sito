/* Cerca su Google News le notizie di cortei, manifestazioni, presidi e occupazioni.
   - toglie tutto ciò che riguarda l'immigrazione, la destra e i partiti (salvo "contro" + destra);
   - se nel titolo trova giorno e città, crea anche un evento per la mappa. */

/* ===== IMPOSTAZIONI ===== */
const PAROLE = ["corteo", "manifestazione", "presidio", "occupazione"];
/* zone in cui cercare: una ricerca per l'Italia intera e una concentrata sul Piemonte */
const ZONA_PIEMONTE = "(Torino OR Pinerolo OR Piemonte OR Cuneo OR Novara OR Alessandria OR Asti OR Biella OR Vercelli)";
const ANNUNCI = '(indetto OR indetta OR convocato OR convocata OR "scendono in piazza" OR "in piazza" OR appuntamento OR annunciato OR mobilitazione OR "si terrà")';
/* si cerca nell'ultimo mese: così si trovano anche articoli di giorni fa che annunciano mobilitazioni future.
   Una ricerca per parola (Google News dà al massimo ~100 risultati per ricerca) + ricerche sugli annunci. */
const RICERCHE = [
  ...PAROLE.map((p) => `${p} when:30d`),
  ...PAROLE.map((p) => `${p} ${ZONA_PIEMONTE} when:30d`),
  `(${PAROLE.join(" OR ")}) ${ANNUNCI} when:30d`,
  `(${PAROLE.join(" OR ")} OR sciopero) ${ANNUNCI} ${ZONA_PIEMONTE} when:30d`,
];
const DEVE_AVERE = /\b(corte[oi]|manifestazion[ei]|presidi[oi]?|occupazion[ei]|occupat[aoie])\b/i;
/* sempre esclusi: immigrazione */
const IMMIGRAZIONE = /\b(immigra\w*|emigra\w*|migrant\w*|clandestin\w*|sbarc\w*|rimpatr\w*|remigrazion\w*|espuls\w*|profugh\w*|rifugiat\w*|richiedent\w* asilo|asilo politico|ius scholae|ius soli|cittadinanza|stranier\w*|extracomunitar\w*|accoglienza|cpr|centr[oi] di permanenza|permesso di soggiorno|flussi migratori|ong)\b/i;
/* esclusi: destra e gruppi di destra */
const DESTRA = /\b(destra|centrodestra|centro-destra|lega|leghist\w*|fratelli d'italia|fratelli d’italia|fdi|forza italia|noi moderati|meloni|salvini|tajani|vannacci|casapound|casa pound|forza nuova|gioventù nazionale|gioventu nazionale|futuro nazionale|blocco studentesco|azione studentesca|riprendiamoci l'italia|riprendiamoci l’italia|patriot\w*|sovranist\w*|pro vita|famiglia tradizionale|remigrazione)\b/i;
/* esclusi: tutti i partiti */
const PARTITI = /\b(partit[oi]|pd|partito democratico|dem|m5s|5 stelle|cinque stelle|movimento 5|avs|alleanza verdi|sinistra italiana|verdi|italia viva|renzi|calenda|azione di calenda|\+europa|più europa|schlein|conte|rifondazione|prc|pci|potere al popolo|europa verde|udc|lega|fratelli d'italia|forza italia)\b/i;
/* ... a meno che non siano "contro" la destra */
const CONTRO_DESTRA = /\bcontro\s+(il\s+|la\s+|lo\s+|l['’]\s*|i\s+|gli\s+|le\s+)?(governo meloni|governo|destra|estrema destra|centrodestra|lega|fratelli d['’]italia|fdi|forza italia|meloni|salvini|vannacci|casapound|forza nuova|gioventù nazionale|futuro nazionale|fascis\w*|neofascis\w*|neonazis\w*)\b/i;
/* esclusi: "manifestazioni" che non sono politiche */
const NON_POLITICO = /\b(presidi[oi] (del territorio|sanitari\w*|ospedalier\w*|medic\w*|di polizia|delle forze|fiss[oi]|di sicurezza|di guardia medica)|presidio territoriale|manifestazion[ei] d['’]interesse|manifestazione fieristica|sagra|fiera|calcio|partita|campionato|tifos\w*|ultras|motori|auto d'epoca|enogastronom\w*|degustazion\w*|sfilata|moda|maratona|gara|sportiv\w*|concorso|mercatino)\b/i;

export function tienilo(testo) {
  if (!DEVE_AVERE.test(testo)) return false;
  if (IMMIGRAZIONE.test(testo) || NON_POLITICO.test(testo)) return false;
  if (CONTRO_DESTRA.test(testo)) return true;
  if (DESTRA.test(testo) || PARTITI.test(testo)) return false;
  return true;
}

/* città riconosciute nei titoli (con la maiuscola): capoluoghi italiani e comuni del Piemonte */
const CITTA = ["Torino","Pinerolo","Ivrea","Chieri","Moncalieri","Collegno","Rivoli","Settimo Torinese","Nichelino","Grugliasco","Carmagnola",
 "Orbassano","Venaria","Avigliana","Susa","Bussoleno","Cuneo","Bra","Saluzzo","Mondovì","Fossano","Savigliano","Alessandria","Casale Monferrato",
 "Tortona","Novi Ligure","Acqui Terme","Valenza","Asti","Biella","Novara","Vercelli","Verbania","Omegna","Domodossola","Borgomanero","Aosta",
 "Milano","Roma","Napoli","Genova","Bologna","Firenze","Venezia","Verona","Padova","Trieste","Trento","Bolzano","Brescia","Bergamo","Monza",
 "Como","Varese","Lecco","Pavia","Cremona","Mantova","Lodi","Sondrio","Piacenza","Parma","Reggio Emilia","Modena","Ferrara","Ravenna","Forlì",
 "Cesena","Rimini","Pisa","Livorno","Lucca","Pistoia","Prato","Siena","Arezzo","Grosseto","Massa","Carrara","La Spezia","Savona","Imperia",
 "Perugia","Terni","Ancona","Pesaro","Macerata","Ascoli Piceno","Pescara","Chieti","L'Aquila","Teramo","Campobasso","Isernia","Latina",
 "Frosinone","Viterbo","Rieti","Caserta","Benevento","Avellino","Salerno","Bari","Taranto","Brindisi","Lecce","Foggia","Barletta","Andria",
 "Potenza","Matera","Cosenza","Catanzaro","Reggio Calabria","Crotone","Vibo Valentia","Palermo","Catania","Messina","Siracusa","Ragusa",
 "Agrigento","Trapani","Caltanissetta","Enna","Cagliari","Sassari","Nuoro","Oristano","Udine","Pordenone","Gorizia","Treviso","Vicenza",
 "Rovigo","Belluno","Val di Susa","Valsusa"];
const RE_CITTA = new RegExp("(?<![\\p{L}])(" + [...CITTA].sort((a, b) => b.length - a.length).map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]")).join("|") + ")(?![\\p{L}])", "u");
const REGIONI = ["Piemonte","Valle d'Aosta","Lombardia","Trentino","Alto Adige","Veneto","Friuli","Liguria","Emilia-Romagna","Emilia Romagna",
 "Toscana","Umbria","Marche","Lazio","Abruzzo","Molise","Campania","Puglia","Basilicata","Calabria","Sicilia","Sardegna"];
const RE_REGIONE = new RegExp("(?<![\\p{L}])(" + REGIONI.map((c) => c.replace(/'/g, "['’]")).join("|") + ")(?![\\p{L}])", "u");
const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
const GIORNI = ["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"];
const due = (n) => String(n).padStart(2, "0");

function dataDalTitolo(t, pub) {
  const base = new Date(pub); if (isNaN(base)) return null;
  const roma = new Date(base.toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  let g = null;
  const m = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${MESI.join("|")})\\b`, "i"));
  if (m) {
    const mese = MESI.indexOf(m[2].toLowerCase());
    g = new Date(roma.getFullYear(), mese, +m[1]);
    if (g < new Date(roma.getFullYear(), roma.getMonth(), roma.getDate() - 60)) g.setFullYear(g.getFullYear() + 1);
  } else if (/\b(oggi|stasera|stamattina|questa sera)\b/i.test(t)) g = new Date(roma.getFullYear(), roma.getMonth(), roma.getDate());
  else if (/\bdomani\b/i.test(t)) g = new Date(roma.getFullYear(), roma.getMonth(), roma.getDate() + 1);
  else {
    const w = t.toLowerCase().match(new RegExp(`\\b(${GIORNI.join("|").replace(/ì/g, "[iì]")})\\b`));
    if (w) {
      const target = GIORNI.findIndex((x) => x.slice(0, 3) === w[1].slice(0, 3));
      const diff = (target - roma.getDay() + 7) % 7;
      g = new Date(roma.getFullYear(), roma.getMonth(), roma.getDate() + diff);
    }
  }
  if (!g) return null;
  const o = t.match(/\b(?:ore|alle|dalle|h\.?)\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\b/i);
  return `${g.getFullYear()}-${due(g.getMonth() + 1)}-${due(g.getDate())}` + (o ? `T${due(+o[1])}:${due(+(o[2] || 0))}` : "");
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const pulisci = (s = "") => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m).replace(/\s+/g, " ").trim();
const tag = (b, n) => { const m = b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i")); return m ? pulisci(m[1]) : ""; };

export async function cercaMobilitazioni(headers) {
  const trovate = [], visti = new Set(), errori = []; let riuscite = 0;
  for (const q of RICERCHE) {
    const url = "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=it&gl=IT&ceid=IT:it";
    let xml;
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      xml = await r.text(); riuscite++;
    } catch (e) { errori.push(e.message); continue; }
    await new Promise((r) => setTimeout(r, 700));
    for (const b of xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []) {
      const fonte = tag(b, "source") || "Giornali";
      const titolo = tag(b, "title").replace(new RegExp("\\s+[-–]\\s+" + fonte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "");
      const link = tag(b, "link"), data = new Date(tag(b, "pubDate") || Date.now()).toISOString();
      const chiave = titolo.toLowerCase().replace(/[^a-z0-9àèéìòù]+/g, " ").trim();
      if (!titolo || !link || visti.has(chiave)) continue; visti.add(chiave);
      if (!tienilo(titolo + " " + tag(b, "description"))) continue;
      trovate.push({ titolo, link, fonte, data, descrizione: tag(b, "description").replace(/\s+[-–]\s+[^-–]+$/, "") });
    }
  }
  if (!riuscite) throw new Error(errori[0] || "nessuna risposta");
  trovate.sort((a, b) => b.data.localeCompare(a.data));
  /* eventi per la mappa: ogni articolo di cui si capisce il luogo (città, altrimenti regione).
     La data è quella scritta nel titolo; se manca, si usa la data dell'articolo e si segna come "data non indicata". */
  const eventi = [];
  for (const n of trovate) {
    const testo = n.titolo + " " + (n.descrizione || "");
    const c = n.titolo.match(RE_CITTA) || testo.match(RE_CITTA);
    const r = c ? null : (n.titolo.match(RE_REGIONE) || testo.match(RE_REGIONE));
    if (!c && !r) continue;
    const luogo = c ? c[1] : r[1];
    const dataTitolo = dataDalTitolo(n.titolo, n.data);
    const pub = new Date(n.data).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
    eventi.push({ id: "gn-" + Buffer.from(n.link).toString("base64").slice(-16).replace(/\W/g, ""), fonte: "Giornali · " + n.fonte,
      titolo: n.titolo, tipo: "Dai giornali", inizio: dataTitolo || pub, dataIncerta: !dataTitolo, pubblicato: n.data,
      luogo: c ? luogo : luogo + ", Italia", citta: c ? luogo : "", regione: r ? luogo.replace(/Emilia Romagna/, "Emilia-Romagna") : "",
      coord: null, link: n.link });
  }
  return { segnalazioni: trovate, eventi };
}
