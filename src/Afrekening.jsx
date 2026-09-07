import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

const REKENING = 'BE71 2930 2488 1969';
const REKENING_NAAM = 'Jürgen Vael';

const euro = (v) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(v || 0);

/* ── de rekening van één gezin opbouwen ── */
function bouwRekening(ev, inschrijving, regels) {
  const i = inschrijving;
  const bijdrage = !i || i.status === 'vrijgesteld' ? 0
    : i.volw * (ev.prijs_volw || 0) + i.kind * (ev.prijs_kind || 0) + i.klein * (ev.prijs_klein || 0);
  const drank = regels.reduce((s, r) => s + r.aantal * r.prijs, 0);
  const betaald = +(i?.betaald || 0);
  return { bijdrage, drank, totaal: bijdrage + drank, betaald, saldo: bijdrage + drank - betaald };
}

function alsTekst(ev, naam, i, regels, r) {
  const t = [];
  t.push(`Afrekening ${ev.titel} — ${naam}`, '');
  if (i) {
    const d = [];
    if (i.volw) d.push(`${i.volw} volwassene${i.volw > 1 ? 'n' : ''} × ${euro(ev.prijs_volw)}`);
    if (i.kind) d.push(`${i.kind} × 7–13 j. × ${euro(ev.prijs_kind)}`);
    if (i.klein) d.push(`${i.klein} × 6 j. of jonger (gratis)`);
    t.push('INSCHRIJVING');
    d.forEach((x) => t.push(`  ${x}`));
    t.push(`  Subtotaal: ${euro(r.bijdrage)}`, '');
  }
  if (regels.length) {
    t.push('DRANK');
    regels.forEach((x) => t.push(`  ${x.aantal} × ${x.naam} à ${euro(x.prijs)} = ${euro(x.aantal * x.prijs)}`));
    t.push(`  Subtotaal: ${euro(r.drank)}`, '');
  }
  t.push(`TOTAAL: ${euro(r.totaal)}`);
  if (r.betaald) t.push(`Reeds betaald: ${euro(r.betaald)}`);
  t.push(`Te betalen: ${euro(Math.max(r.saldo, 0))}`, '');
  t.push(`Over te schrijven op ${REKENING} (${REKENING_NAAM})`);
  t.push(`Mededeling: BBQ26 ${naam}`);
  return t.join('\n');
}

/* ─────────────  wat een gezin zelf ziet  ───────────── */
export function MijnRekening({ ev, gezin }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const [i, v] = await Promise.all([
        supabase.from('inschrijving').select('*').eq('event_id', ev.id)
          .eq('gezin_id', gezin.id).maybeSingle(),
        supabase.from('verbruik').select('aantal, drank(naam, verkoopprijs, volgorde)')
          .eq('event_id', ev.id).eq('gezin_id', gezin.id),
      ]);
      const regels = (v.data ?? []).map((x) => ({
        naam: x.drank?.naam, prijs: x.drank?.verkoopprijs || 0,
        aantal: x.aantal, volgorde: x.drank?.volgorde || 0,
      })).sort((a, b) => a.volgorde - b.volgorde);
      setData({ i: i.data, regels });
    })();
  }, [ev.id, gezin.id]);

  if (!data) return <p className="stil">Rekening ophalen…</p>;
  const { i, regels } = data;
  const r = bouwRekening(ev, i, regels);

  if (!i && regels.length === 0)
    return (
      <section className="kaart">
        <h2>Onze rekening</h2>
        <p className="stil">Er staat nog niets op jullie naam voor dit event.</p>
      </section>
    );

  return (
    <section className="kaart">
      <h2>Onze rekening</h2>

      {i && (
        <div className="rk-blok">
          <p className="cat-naam">Inschrijving</p>
          {i.volw > 0 && <Regel label={`${i.volw} × volwassene`} sub={euro(ev.prijs_volw)} bedrag={i.volw * ev.prijs_volw} />}
          {i.kind > 0 && <Regel label={`${i.kind} × 7 t.e.m. 13 j.`} sub={euro(ev.prijs_kind)} bedrag={i.kind * ev.prijs_kind} />}
          {i.klein > 0 && <Regel label={`${i.klein} × 6 j. of jonger`} sub="gratis" bedrag={0} />}
          {i.status === 'vrijgesteld' && <p className="stil">Jullie zijn vrijgesteld van de bijdrage.</p>}
        </div>
      )}

      {regels.length > 0 && (
        <div className="rk-blok">
          <p className="cat-naam">Drank</p>
          {regels.map((x) => (
            <Regel key={x.naam} label={`${x.aantal} × ${x.naam}`} sub={euro(x.prijs)} bedrag={x.aantal * x.prijs} />
          ))}
        </div>
      )}

      <div className="rk-totaal">
        <Regel label="Totaal" bedrag={r.totaal} dik />
        {r.betaald > 0 && <Regel label="Reeds betaald" bedrag={-r.betaald} />}
        <Regel label={r.saldo >= 0 ? 'Nog te betalen' : 'Terug te storten'}
               bedrag={Math.abs(r.saldo)} dik kleur={r.saldo > 0 ? 'kriek' : 'blad'} />
      </div>

      {r.saldo > 0 && (
        <div className="rk-betaal">
          <p className="cat-naam">Betalen</p>
          <p><span className="mono-groot">{REKENING}</span><br />
             <span className="stil">op naam van {REKENING_NAAM}</span></p>
          <p>Mededeling: <span className="mono-groot">BBQ26 {gezin.naam}</span></p>
        </div>
      )}
    </section>
  );
}

function Regel({ label, sub, bedrag, dik, kleur }) {
  return (
    <div className="rk-regel">
      <span className={dik ? 'rk-label dik' : 'rk-label'}>
        {label} {sub && <span className="stil">à {sub}</span>}
      </span>
      <span className={`rk-bedrag${dik ? ' dik' : ''}${kleur ? ' ' + kleur : ''}`}>{euro(bedrag)}</span>
    </div>
  );
}

/* ─────────────  wat de organisatie ziet  ───────────── */
export function Afrekeningen({ ev }) {
  const [rijen, setRijen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [open, setOpen] = useState(null);
  const [gekopieerd, setGekopieerd] = useState('');

  const haal = async () => {
    setLaden(true);
    const [g, i, v] = await Promise.all([
      supabase.from('gezin').select('id, naam').order('naam'),
      supabase.from('inschrijving').select('*').eq('event_id', ev.id),
      supabase.from('verbruik').select('gezin_id, aantal, drank(naam, verkoopprijs, volgorde)')
        .eq('event_id', ev.id),
    ]);
    if (i.error) setFout(i.error.message);

    const perGezin = {};
    (v.data ?? []).forEach((x) => {
      (perGezin[x.gezin_id] = perGezin[x.gezin_id] || []).push({
        naam: x.drank?.naam, prijs: x.drank?.verkoopprijs || 0,
        aantal: x.aantal, volgorde: x.drank?.volgorde || 0,
      });
    });

    const lijst = (g.data ?? []).map((gz) => {
      const insch = (i.data ?? []).find((x) => x.gezin_id === gz.id);
      const regels = (perGezin[gz.id] || []).sort((a, b) => a.volgorde - b.volgorde);
      return { gezin: gz, i: insch, regels, ...bouwRekening(ev, insch, regels) };
    }).filter((x) => x.i || x.regels.length > 0);

    setRijen(lijst);
    setLaden(false);
  };

  useEffect(() => { haal(); }, [ev.id]);

  const kopieer = async (rij) => {
    const tekst = alsTekst(ev, rij.gezin.naam, rij.i, rij.regels, rij);
    try { await navigator.clipboard.writeText(tekst); } catch { alert(tekst); }
    setGekopieerd(rij.gezin.id);
    setTimeout(() => setGekopieerd(''), 2500);
  };

  const kopieerAlles = async () => {
    const tekst = rijen.map((r) => alsTekst(ev, r.gezin.naam, r.i, r.regels, r))
      .join('\n\n' + '─'.repeat(40) + '\n\n');
    try { await navigator.clipboard.writeText(tekst); } catch { alert(tekst); }
    setGekopieerd('alles');
    setTimeout(() => setGekopieerd(''), 2500);
  };

  const zetBetaald = async (rij, bedrag) => {
    if (!rij.i) return;
    const { error } = await supabase.from('inschrijving')
      .update({ betaald: bedrag }).eq('id', rij.i.id);
    if (error) setFout(error.message); else haal();
  };

  if (laden) return <p className="stil">Afrekeningen ophalen…</p>;

  const tot = (k) => rijen.reduce((s, r) => s + r[k], 0);
  const open_ = rijen.reduce((s, r) => s + Math.max(r.saldo, 0), 0);

  return (
    <section className="kaart">
      <h2>Afrekening</h2>
      {fout && <p className="fout">{fout}</p>}

      <div className="cijfers">
        {[['Bijdragen', euro(tot('bijdrage'))], ['Drank', euro(tot('drank'))],
          ['Ontvangen', euro(tot('betaald'))], ['Openstaand', euro(open_)]].map(([l, v]) => (
          <div key={l} className="cijfer-kaart">
            <span className="cijfer-label">{l}</span>
            <span className="cijfer-waarde">{v}</span>
          </div>
        ))}
      </div>

      <div className="rij-knoppen" style={{ marginTop: 12 }}>
        <button className="stille-knop" onClick={kopieerAlles}>Alle afrekeningen kopiëren</button>
        <button className="stille-knop" onClick={() => window.print()}>Afdrukken</button>
        {gekopieerd && <span className="ok">✓ gekopieerd</span>}
      </div>

      <div className="af-lijst">
        {rijen.map((r) => (
          <div key={r.gezin.id} className="af-rij">
            <button className="af-kop" onClick={() => setOpen(open === r.gezin.id ? null : r.gezin.id)}>
              <span>{r.gezin.naam}</span>
              <span className="af-cijfers">
                <span className="stil">{euro(r.bijdrage)} + {euro(r.drank)}</span>
                <span className={r.saldo > 0 ? 'af-saldo kriek' : 'af-saldo blad'}>{euro(r.saldo)}</span>
              </span>
            </button>
            {open === r.gezin.id && (
              <div className="af-uit">
                {r.i && (
                  <p className="stil">
                    Inschrijving: {r.i.volw} volw. / {r.i.kind} × 7–13 / {r.i.klein} × ≤6
                    {r.i.status === 'vrijgesteld' && ' — vrijgesteld'}
                  </p>
                )}
                {r.regels.map((x) => (
                  <Regel key={x.naam} label={`${x.aantal} × ${x.naam}`} sub={euro(x.prijs)}
                         bedrag={x.aantal * x.prijs} />
                ))}
                <Regel label="Totaal" bedrag={r.totaal} dik />
                <div className="rij-knoppen" style={{ marginTop: 10 }}>
                  <label style={{ margin: 0 }}>
                    <span>Ontvangen</span>
                    <input type="number" step="0.01" defaultValue={r.betaald}
                           style={{ width: 110, fontFamily: 'var(--mono)', textAlign: 'right' }}
                           onBlur={(e) => zetBetaald(r, +e.target.value || 0)} />
                  </label>
                  <button className="stille-knop" onClick={() => zetBetaald(r, r.totaal)}>
                    Volledig betaald
                  </button>
                  <button className="stille-knop" onClick={() => kopieer(r)}>Kopieer tekst</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {rijen.length === 0 && <p className="stil">Nog geen inschrijvingen of drankverbruik.</p>}
      </div>
    </section>
  );
}

/* ─────────────  printblad: één afrekening per gezin  ───────────── */
export function AfrekeningPrint({ ev }) {
  const [rijen, setRijen] = useState([]);

  useEffect(() => {
    (async () => {
      const [g, i, v] = await Promise.all([
        supabase.from('gezin').select('id, naam').order('naam'),
        supabase.from('inschrijving').select('*').eq('event_id', ev.id),
        supabase.from('verbruik').select('gezin_id, aantal, drank(naam, verkoopprijs, volgorde)')
          .eq('event_id', ev.id),
      ]);
      const perGezin = {};
      (v.data ?? []).forEach((x) => {
        (perGezin[x.gezin_id] = perGezin[x.gezin_id] || []).push({
          naam: x.drank?.naam, prijs: x.drank?.verkoopprijs || 0,
          aantal: x.aantal, volgorde: x.drank?.volgorde || 0,
        });
      });
      setRijen((g.data ?? []).map((gz) => {
        const insch = (i.data ?? []).find((x) => x.gezin_id === gz.id);
        const regels = (perGezin[gz.id] || []).sort((a, b) => a.volgorde - b.volgorde);
        return { gezin: gz, i: insch, regels, ...bouwRekening(ev, insch, regels) };
      }).filter((x) => x.i || x.regels.length > 0));
    })();
  }, [ev.id]);

  if (rijen.length === 0) return null;

  return (
    <div className="afblad">
      {rijen.map((r) => (
        <div key={r.gezin.id} className="af-pagina">
          <div className="tb-kop">
            <div>
              <div className="pb-club">{ev.organisatie || 'ZVC Albertsvrienden'}</div>
              <div className="tb-functie">{r.gezin.naam}</div>
            </div>
            <div className="tb-event">Afrekening<br />{ev.titel}</div>
          </div>

          {r.i && (
            <>
              <div className="tb-sectie"><span>Inschrijving</span></div>
              {r.i.volw > 0 && <PrintRegel a={`${r.i.volw} × volwassene`} p={euro(ev.prijs_volw)} b={r.i.volw * ev.prijs_volw} />}
              {r.i.kind > 0 && <PrintRegel a={`${r.i.kind} × 7 t.e.m. 13 j.`} p={euro(ev.prijs_kind)} b={r.i.kind * ev.prijs_kind} />}
              {r.i.klein > 0 && <PrintRegel a={`${r.i.klein} × 6 j. of jonger`} p="gratis" b={0} />}
            </>
          )}

          {r.regels.length > 0 && (
            <>
              <div className="tb-sectie"><span>Drank</span></div>
              {r.regels.map((x) => (
                <PrintRegel key={x.naam} a={`${x.aantal} × ${x.naam}`} p={euro(x.prijs)} b={x.aantal * x.prijs} />
              ))}
            </>
          )}

          <div className="af-eind">
            <PrintRegel a="Totaal" b={r.totaal} dik />
            {r.betaald > 0 && <PrintRegel a="Reeds betaald" b={-r.betaald} />}
            <PrintRegel a={r.saldo >= 0 ? 'Nog te betalen' : 'Terug te storten'} b={Math.abs(r.saldo)} dik />
          </div>

          {r.saldo > 0 && (
            <p className="af-betaal">
              Over te schrijven op <strong>{REKENING}</strong> op naam van {REKENING_NAAM}.<br />
              Mededeling: <strong>BBQ26 {r.gezin.naam}</strong>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function PrintRegel({ a, p, b, dik }) {
  return (
    <div className={'af-pr' + (dik ? ' dik' : '')}>
      <span className="af-pr-a">{a}</span>
      <span className="af-pr-p">{p || ''}</span>
      <span className="af-pr-b">{euro(b)}</span>
    </div>
  );
}
