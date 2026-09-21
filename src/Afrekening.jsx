import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

const REKENING = 'BE71 2930 2488 1969';
const REKENING_NAAM = 'Jürgen Vael';

const euro = (v) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(v || 0);
const bedragVan = (k) => (k.werkelijk != null ? +k.werkelijk : +k.geraamd || 0);
const rond = (v) => Math.round(v * 100) / 100;

/* ── alles ophalen: de cijfers komen uit de database, de details eromheen ── */
async function laadAfrekening(ev) {
  const [o, v, kw, k] = await Promise.all([
    supabase.rpc('afrekening_overzicht', { ev: ev.id }),
    supabase.from('verbruik').select('gezin_id, aantal, drank(naam, verkoopprijs, volgorde)')
      .eq('event_id', ev.id),
    supabase.from('kwijtschelding').select('gezin_id, soort, bedrag, reden').eq('event_id', ev.id),
    supabase.from('kostenpost').select('gezin_id, post, werkelijk, geraamd')
      .eq('event_id', ev.id).not('gezin_id', 'is', null),
  ]);

  const rijen = (o.data ?? []).map((r) => {
    const perDrank = {};
    (v.data ?? []).filter((x) => x.gezin_id === r.gezin_id).forEach((x) => {
      const n = x.drank?.naam || '?';
      if (!perDrank[n]) perDrank[n] = { naam: n, prijs: +x.drank?.verkoopprijs || 0, aantal: 0, volgorde: x.drank?.volgorde || 0 };
      perDrank[n].aantal += x.aantal;
    });
    const netto = +r.bijdrage + +r.drank - +r.kwijt - +r.voorschot_drank - +r.voorschot_kosten;
    return {
      ...r,
      betaald: +r.betaald || 0,
      saldo: rond(+r.saldo),
      netto: rond(netto),
      drankRegels: Object.values(perDrank).filter((d) => d.aantal !== 0)
        .sort((a, b) => a.volgorde - b.volgorde),
      kwijtRegels: (kw.data ?? []).filter((x) => x.gezin_id === r.gezin_id),
      kostRegels: (k.data ?? []).filter((x) => x.gezin_id === r.gezin_id && bedragVan(x) !== 0),
    };
  });

  return { rijen, fout: o.error?.message || null };
}

/* ── de regels van één rekening, in groepen ── */
function regelsVan(ev, r) {
  const g = { Inschrijving: [], Drank: [], 'In mindering': [] };
  if (r.status === 'vrijgesteld') {
    g.Inschrijving.push({ label: 'Vrijgesteld van bijdrage', b: 0 });
  } else {
    if (r.volw) g.Inschrijving.push({ label: `${r.volw} × volwassene`, sub: euro(ev.prijs_volw), b: r.volw * ev.prijs_volw });
    if (r.kind) g.Inschrijving.push({ label: `${r.kind} × 7 t.e.m. 13 j.`, sub: euro(ev.prijs_kind), b: r.kind * ev.prijs_kind });
    if (r.klein) g.Inschrijving.push({ label: `${r.klein} × 6 j. of jonger`, sub: 'gratis', b: 0 });
  }
  r.drankRegels.forEach((d) =>
    g.Drank.push({ label: `${d.aantal} × ${d.naam}`, sub: euro(d.prijs), b: d.aantal * d.prijs }));
  r.kwijtRegels.forEach((k) =>
    g['In mindering'].push({ label: `Kwijtgescholden (${k.soort})${k.reden ? ' — ' + k.reden : ''}`, b: -k.bedrag }));
  if (+r.voorschot_drank)
    g['In mindering'].push({ label: 'Drank voorgeschoten, aan inkoopprijs', b: -r.voorschot_drank });
  r.kostRegels.forEach((k) =>
    g['In mindering'].push({ label: `Voorgeschoten: ${k.post}`, b: -bedragVan(k) }));
  return Object.entries(g).filter(([, l]) => l.length > 0);
}

function slotVan(r) {
  const s = [{ label: 'Totaal', b: r.netto, dik: true }];
  if (r.betaald > 0) s.push({ label: 'Reeds betaald', b: -r.betaald });
  if (r.betaald < 0) s.push({ label: 'Reeds teruggestort', b: -r.betaald });
  if (r.saldo > 0.004) s.push({ label: 'Nog te betalen', b: r.saldo, dik: true, kleur: 'kriek' });
  else if (r.saldo < -0.004) s.push({ label: 'Wij storten jullie terug', b: -r.saldo, dik: true, kleur: 'blad' });
  else s.push({ label: 'Vereffend', b: 0, dik: true, kleur: 'blad' });
  return s;
}

function alsTekst(ev, r) {
  const t = [`Afrekening ${ev.titel} — ${r.naam}`, ''];
  regelsVan(ev, r).forEach(([groep, lijst]) => {
    t.push(groep.toUpperCase());
    lijst.forEach((x) => t.push(`  ${x.label}${x.sub ? ` à ${x.sub}` : ''}: ${euro(x.b)}`));
    t.push('');
  });
  slotVan(r).forEach((x) => t.push(`${x.label}: ${euro(x.b)}`));
  t.push('');
  if (r.saldo > 0.004) {
    t.push(`Over te schrijven op ${REKENING} (${REKENING_NAAM})`);
    t.push(`Mededeling: BBQ26 ${r.naam}`);
  } else if (r.saldo < -0.004) {
    t.push('Bezorg ons jullie rekeningnummer, dan storten we dit bedrag terug.');
  }
  return t.join('\n');
}

function Regel({ label, sub, b, dik, kleur }) {
  return (
    <div className="rk-regel">
      <span className={dik ? 'rk-label dik' : 'rk-label'}>
        {label} {sub && <span className="stil">à {sub}</span>}
      </span>
      <span className={`rk-bedrag${dik ? ' dik' : ''}${kleur ? ' ' + kleur : ''}`}>{euro(b)}</span>
    </div>
  );
}

function Detail({ ev, r }) {
  return (
    <>
      {regelsVan(ev, r).map(([groep, lijst]) => (
        <div key={groep} className="rk-blok">
          <p className="cat-naam">{groep}</p>
          {lijst.map((x, i) => <Regel key={i} {...x} />)}
        </div>
      ))}
      <div className="rk-totaal">
        {slotVan(r).map((x, i) => <Regel key={i} {...x} />)}
      </div>
    </>
  );
}

/* ─────────────  wat een gezin zelf ziet  ───────────── */
export function MijnRekening({ ev, gezin }) {
  const [r, setR] = useState(undefined);
  const [fout, setFout] = useState('');

  useEffect(() => {
    (async () => {
      const res = await laadAfrekening(ev);
      if (res.fout) setFout(res.fout);
      setR(res.rijen.find((x) => x.gezin_id === gezin.id) || null);
    })();
  }, [ev.id, gezin.id]);

  if (r === undefined) return <p className="stil">Rekening ophalen…</p>;

  return (
    <section className="kaart">
      <h2>Onze rekening</h2>
      {fout && <p className="fout">{fout}</p>}
      {!r ? (
        <p className="stil">Er staat nog niets op jullie naam voor dit event.</p>
      ) : (
        <>
          <Detail ev={ev} r={r} />
          {r.saldo > 0.004 && (
            <div className="rk-betaal">
              <p className="cat-naam">Betalen</p>
              <p><span className="mono-groot">{REKENING}</span><br />
                 <span className="stil">op naam van {REKENING_NAAM}</span></p>
              <p>Mededeling: <span className="mono-groot">BBQ26 {gezin.naam}</span></p>
            </div>
          )}
          {r.saldo < -0.004 && (
            <div className="rk-betaal">
              <p>De club stort jullie <strong>{euro(-r.saldo)}</strong> terug.
                 Bezorg ons jullie rekeningnummer als we dat nog niet hebben.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ─────────────  wat de organisatie ziet  ───────────── */
export function Afrekeningen({ ev }) {
  const [rijen, setRijen] = useState(null);
  const [fout, setFout] = useState('');
  const [open, setOpen] = useState(null);
  const [gekopieerd, setGekopieerd] = useState('');

  const haal = async () => {
    const res = await laadAfrekening(ev);
    if (res.fout) setFout(res.fout);
    setRijen(res.rijen);
  };

  useEffect(() => { haal(); }, [ev.id]);

  const kopieer = async (tekst, id) => {
    try { await navigator.clipboard.writeText(tekst); } catch { alert(tekst); }
    setGekopieerd(id);
    setTimeout(() => setGekopieerd(''), 2500);
  };

  const zetBetaald = async (r, bedrag) => {
    const { error } = await supabase.from('inschrijving')
      .update({ betaald: bedrag }).eq('event_id', ev.id).eq('gezin_id', r.gezin_id);
    if (error) setFout(error.message); else haal();
  };

  if (!rijen) return <p className="stil">Afrekeningen ophalen…</p>;

  const som = (f) => rijen.reduce((s, r) => s + f(r), 0);

  return (
    <section className="kaart">
      <h2>Alle afrekeningen</h2>
      {fout && <p className="fout">{fout}</p>}

      <div className="cijfers">
        {[['Nog te ontvangen', euro(som((r) => Math.max(r.saldo, 0)))],
          ['Terug te storten', euro(som((r) => Math.max(-r.saldo, 0)))],
          ['Kwijtgescholden', euro(som((r) => +r.kwijt))],
          ['Voorschotten', euro(som((r) => +r.voorschot_drank + +r.voorschot_kosten))]]
          .map(([l, v]) => (
          <div key={l} className="cijfer-kaart">
            <span className="cijfer-label">{l}</span>
            <span className="cijfer-waarde">{v}</span>
          </div>
        ))}
      </div>

      <div className="rij-knoppen" style={{ marginTop: 12 }}>
        <button className="stille-knop"
                onClick={() => kopieer(rijen.map((r) => alsTekst(ev, r)).join('\n\n' + '─'.repeat(40) + '\n\n'), 'alles')}>
          Alle afrekeningen kopiëren
        </button>
        <button className="stille-knop" onClick={() => window.print()}>Afdrukken</button>
        {gekopieerd && <span className="ok">✓ gekopieerd</span>}
      </div>

      <div className="af-lijst">
        {rijen.map((r) => (
          <div key={r.gezin_id} className="af-rij">
            <button className="af-kop" onClick={() => setOpen(open === r.gezin_id ? null : r.gezin_id)}>
              <span>{r.naam}</span>
              <span className={'af-saldo ' + (r.saldo > 0.004 ? 'kriek' : 'blad')}>
                {r.saldo < -0.004 ? `terug ${euro(-r.saldo)}` : euro(r.saldo)}
              </span>
            </button>
            {open === r.gezin_id && (
              <div className="af-uit">
                <Detail ev={ev} r={r} />
                <div className="rij-knoppen" style={{ marginTop: 12 }}>
                  <label style={{ margin: 0 }}>
                    <span>Ontvangen (+) of teruggestort (−)</span>
                    <input type="number" step="0.01" defaultValue={r.betaald}
                           style={{ width: 120, fontFamily: 'var(--mono)', textAlign: 'right' }}
                           onBlur={(e) => zetBetaald(r, +e.target.value || 0)} />
                  </label>
                  <button className="stille-knop" onClick={() => zetBetaald(r, r.netto)}>Vereffend</button>
                  <button className="stille-knop" onClick={() => kopieer(alsTekst(ev, r), r.gezin_id)}>
                    Kopieer tekst
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {rijen.length === 0 && <p className="stil">Nog geen inschrijvingen.</p>}
      </div>
    </section>
  );
}

/* ─────────────  printblad: één afrekening per gezin  ───────────── */
export function AfrekeningPrint({ ev }) {
  const [rijen, setRijen] = useState([]);

  useEffect(() => {
    (async () => { setRijen((await laadAfrekening(ev)).rijen); })();
  }, [ev.id]);

  if (rijen.length === 0) return null;

  return (
    <div className="afblad">
      {rijen.map((r) => (
        <div key={r.gezin_id} className="af-pagina">
          <div className="tb-kop">
            <div>
              <div className="pb-club">{ev.organisatie || 'ZVC Albertsvrienden'}</div>
              <div className="tb-functie">{r.naam}</div>
            </div>
            <div className="tb-event">Afrekening<br />{ev.titel}</div>
          </div>

          {regelsVan(ev, r).map(([groep, lijst]) => (
            <div key={groep}>
              <div className="tb-sectie"><span>{groep}</span></div>
              {lijst.map((x, i) => (
                <div key={i} className="af-pr">
                  <span className="af-pr-a">{x.label}</span>
                  <span className="af-pr-p">{x.sub || ''}</span>
                  <span className="af-pr-b">{euro(x.b)}</span>
                </div>
              ))}
            </div>
          ))}

          <div className="af-eind">
            {slotVan(r).map((x, i) => (
              <div key={i} className={'af-pr' + (x.dik ? ' dik' : '')}>
                <span className="af-pr-a">{x.label}</span>
                <span className="af-pr-p" />
                <span className="af-pr-b">{euro(x.b)}</span>
              </div>
            ))}
          </div>

          {r.saldo > 0.004 && (
            <p className="af-betaal">
              Over te schrijven op <strong>{REKENING}</strong> op naam van {REKENING_NAAM}.<br />
              Mededeling: <strong>BBQ26 {r.naam}</strong>
            </p>
          )}
          {r.saldo < -0.004 && (
            <p className="af-betaal">
              De club stort jullie {euro(-r.saldo)} terug. Bezorg ons jullie rekeningnummer.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
