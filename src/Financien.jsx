import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

const euro = (v) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(v || 0);

/* Berekent alles wat met geld te maken heeft, in één plek.
   Wordt ook door de afrekening gebruikt, zodat de cijfers nooit uiteenlopen. */
export function berekenFinancien({ ev, inschrijvingen, verbruik, kosten, kwijt }) {
  const bijdrageVan = (i) =>
    !i ? 0 : i.volw * (ev.prijs_volw || 0) + i.kind * (ev.prijs_kind || 0) + i.klein * (ev.prijs_klein || 0);

  const drankVan = (gid) => verbruik.filter((v) => v.gezin_id === gid)
    .reduce((s, v) => s + v.aantal * (v.drank?.verkoopprijs || 0), 0);

  const kwijtVan = (gid) => kwijt.filter((k) => k.gezin_id === gid)
    .reduce((s, k) => s + (+k.bedrag || 0), 0);

  const voorschotVan = (gid) => {
    const drank = verbruik.filter((v) => v.drank?.voorgeschoten_door === gid)
      .reduce((s, v) => s + v.aantal * (v.drank?.inkoopprijs || 0), 0);
    const posten = kosten.filter((k) => k.gezin_id === gid)
      .reduce((s, k) => s + (k.werkelijk != null ? +k.werkelijk : +k.geraamd || 0), 0);
    return { drank, posten, totaal: drank + posten };
  };

  const rijen = inschrijvingen.map((i) => {
    const bijdrage = bijdrageVan(i);
    const drank = drankVan(i.gezin_id);
    const kwijtgescholden = kwijtVan(i.gezin_id);
    const vs = voorschotVan(i.gezin_id);
    const totaal = bijdrage + drank - kwijtgescholden;
    return {
      ...i, bijdrage, drank, kwijtgescholden,
      voorschot: vs, totaal,
      saldo: totaal - vs.totaal - (+i.betaald || 0),
    };
  });

  const drankOmzet = rijen.reduce((s, r) => s + r.drank, 0);
  const drankInkoop = verbruik.reduce((s, v) => s + v.aantal * (v.drank?.inkoopprijs || 0), 0);
  const bijdragen = rijen.reduce((s, r) => s + r.bijdrage, 0);
  const kwijtTotaal = kwijt.reduce((s, k) => s + (+k.bedrag || 0), 0);
  const kostGeraamd = kosten.reduce((s, k) => s + (+k.geraamd || 0), 0);
  const kostWerkelijk = kosten.reduce((s, k) => s + (k.werkelijk != null ? +k.werkelijk : +k.geraamd || 0), 0);
  const kostDrank = kosten.filter((k) => k.is_drank)
    .reduce((s, k) => s + (k.werkelijk != null ? +k.werkelijk : +k.geraamd || 0), 0);
  const kostOverig = kostWerkelijk - kostDrank;

  return {
    rijen, drankOmzet, drankInkoop, bijdragen, kwijtTotaal,
    kostGeraamd, kostWerkelijk, kostDrank, kostOverig,
    drankMarge: drankOmzet - drankInkoop,
    resultaat: bijdragen + drankOmzet - kwijtTotaal - drankInkoop - kostOverig,
    ontvangen: rijen.reduce((s, r) => s + (+r.betaald || 0), 0),
    openstaand: rijen.reduce((s, r) => s + Math.max(r.saldo, 0), 0),
    terugTeBetalen: rijen.reduce((s, r) => s + Math.max(-r.saldo, 0), 0),
  };
}

/* ─────────────────────────  het scherm  ───────────────────────── */
export default function Financien({ ev, magBeheren }) {
  const [d, setD] = useState(null);
  const [fout, setFout] = useState('');
  const [toon, setToon] = useState('kosten');

  const haal = async () => {
    const [i, v, k, kw, g] = await Promise.all([
      supabase.from('inschrijving').select('*, gezin(naam)').eq('event_id', ev.id),
      supabase.from('verbruik').select('gezin_id, aantal, drank(naam, verkoopprijs, inkoopprijs, voorgeschoten_door)').eq('event_id', ev.id),
      supabase.from('kostenpost').select('*, gezin(naam)').eq('event_id', ev.id).order('post'),
      supabase.from('kwijtschelding').select('*, gezin(naam)').eq('event_id', ev.id),
      supabase.from('gezin').select('id, naam').order('naam'),
    ]);
    if (k.error) setFout(k.error.message);
    setD({
      inschrijvingen: (i.data ?? []).filter((x) => x.status !== 'geannuleerd'),
      verbruik: v.data ?? [], kosten: k.data ?? [], kwijt: kw.data ?? [], gezinnen: g.data ?? [],
    });
  };

  useEffect(() => { haal(); }, [ev.id]);
  if (!d) return <p className="stil">Cijfers ophalen…</p>;

  const f = berekenFinancien({ ev, ...d });

  return (
    <>
      <section className="kaart">
        <h2>Resultaat</h2>
        {fout && <p className="fout">{fout}</p>}

        <div className="fin-resultaat">
          <span className="fin-groot" style={{ color: f.resultaat >= 0 ? 'var(--blad)' : 'var(--kriek)' }}>
            {f.resultaat >= 0 ? '+' : '−'} {euro(Math.abs(f.resultaat))}
          </span>
          <span className="stil">{f.resultaat >= 0 ? 'winst voor de clubkas' : 'verlies'}</span>
        </div>

        <div className="fin-tabel">
          <Rij l="Bijdragen inschrijvingen" b={f.bijdragen} />
          <Rij l="Kwijtgescholden" b={-f.kwijtTotaal} stil />
          <Rij l="Drankomzet" b={f.drankOmzet} />
          <Rij l="Drank ingekocht" b={-f.drankInkoop} stil />
          <Rij l="Marge op drank" b={f.drankMarge} dik />
          <Rij l="Overige kosten" b={-f.kostOverig} stil />
          <Rij l="Resultaat" b={f.resultaat} dik streep />
        </div>

        <p className="stil" style={{ marginTop: 10 }}>
          Raming vooraf was {euro(f.kostGeraamd)} aan kosten. Nu staat er {euro(f.kostWerkelijk)}.
        </p>

        <div className="cijfers" style={{ marginTop: 14 }}>
          {[['Ontvangen', euro(f.ontvangen)], ['Nog te ontvangen', euro(f.openstaand)],
            ['Terug te betalen', euro(f.terugTeBetalen)]].map(([l, v]) => (
            <div key={l} className="cijfer-kaart">
              <span className="cijfer-label">{l}</span>
              <span className="cijfer-waarde">{v}</span>
            </div>
          ))}
        </div>
      </section>

      {magBeheren && (
        <section className="kaart">
          <div className="uitklap-rij" style={{ marginTop: 0 }}>
            {[['kosten', 'Kosten'], ['kwijt', 'Kwijtscheldingen'], ['voorschot', 'Voorschotten']]
              .map(([id, label]) => (
              <button key={id} className={'pil' + (toon === id ? ' aan' : '')}
                      onClick={() => setToon(id)}>{label}</button>
            ))}
          </div>

          {toon === 'kosten' && <Kosten ev={ev} d={d} haal={haal} setFout={setFout} />}
          {toon === 'kwijt' && <Kwijt ev={ev} d={d} haal={haal} setFout={setFout} />}
          {toon === 'voorschot' && <Voorschotten f={f} d={d} />}
        </section>
      )}
    </>
  );
}

function Rij({ l, b, dik, stil, streep }) {
  return (
    <div className={'fin-rij' + (streep ? ' streep' : '')}>
      <span className={stil ? 'stil' : ''} style={{ fontWeight: dik ? 600 : 400, fontSize: 13 }}>{l}</span>
      <span className="fin-bedrag" style={{ fontWeight: dik ? 700 : 400, fontSize: dik ? 15 : 13 }}>
        {euro(b)}
      </span>
    </div>
  );
}

/* ── kostenposten ── */
function Kosten({ ev, d, haal, setFout }) {
  const [nieuw, setNieuw] = useState({ post: '', werkelijk: '', gezin_id: '', is_drank: false });

  const bewaar = async (id, veld, waarde) => {
    const { error } = await supabase.from('kostenpost')
      .update({ [veld]: waarde === '' ? null : waarde }).eq('id', id);
    if (error) setFout(error.message); else haal();
  };

  const voegToe = async () => {
    if (!nieuw.post) return;
    const { error } = await supabase.from('kostenpost').insert({
      event_id: ev.id, post: nieuw.post,
      geraamd: 0, werkelijk: +nieuw.werkelijk || 0,
      gezin_id: nieuw.gezin_id || null, is_drank: nieuw.is_drank,
    });
    if (error) setFout(error.message);
    else { setNieuw({ post: '', werkelijk: '', gezin_id: '', is_drank: false }); haal(); }
  };

  const weg = async (id) => {
    const { error } = await supabase.from('kostenpost').delete().eq('id', id);
    if (error) setFout(error.message); else haal();
  };

  return (
    <>
      <h3>Kosten</h3>
      <p className="stil">
        Vul in wat er werkelijk betaald is. Staat er een gezin bij, dan wordt dat bedrag
        van hun afrekening afgetrokken.
      </p>

      <div className="kp-kop">
        <span>Post</span><span>Geraamd</span><span>Werkelijk</span><span>Voorgeschoten door</span><span />
      </div>

      {d.kosten.map((k) => (
        <div key={k.id} className="kp-rij">
          <span className="kp-post">{k.post}</span>
          <span className="kp-geraamd">{euro(k.geraamd)}</span>
          <input type="number" step="0.01" className="kp-bedrag" defaultValue={k.werkelijk ?? ''}
                 placeholder="—" onBlur={(e) => bewaar(k.id, 'werkelijk', e.target.value)} />
          <select defaultValue={k.gezin_id || ''} onChange={(e) => bewaar(k.id, 'gezin_id', e.target.value)}>
            <option value="">niemand</option>
            {d.gezinnen.map((g) => <option key={g.id} value={g.id}>{g.naam}</option>)}
          </select>
          <button className="weg" onClick={() => weg(k.id)} aria-label="verwijderen">×</button>
        </div>
      ))}

      <div className="kp-rij nieuw">
        <input placeholder="nieuwe post" value={nieuw.post}
               onChange={(e) => setNieuw({ ...nieuw, post: e.target.value })} />
        <span />
        <input type="number" step="0.01" className="kp-bedrag" placeholder="bedrag"
               value={nieuw.werkelijk} onChange={(e) => setNieuw({ ...nieuw, werkelijk: e.target.value })} />
        <select value={nieuw.gezin_id} onChange={(e) => setNieuw({ ...nieuw, gezin_id: e.target.value })}>
          <option value="">niemand</option>
          {d.gezinnen.map((g) => <option key={g.id} value={g.id}>{g.naam}</option>)}
        </select>
        <button onClick={voegToe}>+</button>
      </div>
    </>
  );
}

/* ── kwijtscheldingen ── */
function Kwijt({ ev, d, haal, setFout }) {
  const [n, setN] = useState({ gezin_id: '', soort: 'inschrijving', bedrag: '', reden: '' });

  const voegToe = async () => {
    if (!n.gezin_id || !n.bedrag) return;
    const { error } = await supabase.from('kwijtschelding').insert({
      event_id: ev.id, gezin_id: n.gezin_id, soort: n.soort,
      bedrag: +n.bedrag, reden: n.reden,
    });
    if (error) setFout(error.message);
    else { setN({ gezin_id: '', soort: 'inschrijving', bedrag: '', reden: '' }); haal(); }
  };

  const weg = async (id) => {
    const { error } = await supabase.from('kwijtschelding').delete().eq('id', id);
    if (error) setFout(error.message); else haal();
  };

  return (
    <>
      <h3>Kwijtscheldingen</h3>
      <p className="stil">
        Het gezin betaalt dit bedrag niet, maar het blijft zichtbaar in de eindcalculatie.
      </p>

      <ul className="lijst">
        {d.kwijt.map((k) => (
          <li key={k.id}>
            <span>
              {k.gezin?.naam} <span className="stil">— {k.soort}{k.reden ? `, ${k.reden}` : ''}</span>
            </span>
            <span>
              <span className="cijfer">{euro(k.bedrag)}</span>
              <button className="weg" onClick={() => weg(k.id)} aria-label="verwijderen">×</button>
            </span>
          </li>
        ))}
        {d.kwijt.length === 0 && <li><span className="stil">Nog geen kwijtscheldingen.</span></li>}
      </ul>

      <div className="kw-nieuw">
        <select value={n.gezin_id} onChange={(e) => setN({ ...n, gezin_id: e.target.value })}>
          <option value="">kies gezin</option>
          {d.gezinnen.map((g) => <option key={g.id} value={g.id}>{g.naam}</option>)}
        </select>
        <select value={n.soort} onChange={(e) => setN({ ...n, soort: e.target.value })}>
          <option value="inschrijving">inschrijving</option>
          <option value="drank">drank</option>
          <option value="andere">andere</option>
        </select>
        <input type="number" step="0.01" placeholder="bedrag" className="kp-bedrag"
               value={n.bedrag} onChange={(e) => setN({ ...n, bedrag: e.target.value })} />
        <input placeholder="reden" value={n.reden}
               onChange={(e) => setN({ ...n, reden: e.target.value })} />
        <button onClick={voegToe}>+</button>
      </div>
    </>
  );
}

/* ── voorschotten ── */
function Voorschotten({ f, d }) {
  const perGezin = {};
  d.gezinnen.forEach((g) => {
    const drank = d.verbruik.filter((v) => v.drank?.voorgeschoten_door === g.id)
      .reduce((s, v) => s + v.aantal * (v.drank?.inkoopprijs || 0), 0);
    const posten = d.kosten.filter((k) => k.gezin_id === g.id);
    const postSom = posten.reduce((s, k) => s + (k.werkelijk != null ? +k.werkelijk : +k.geraamd || 0), 0);
    if (drank || postSom) perGezin[g.naam] = { drank, posten, postSom, totaal: drank + postSom };
  });

  return (
    <>
      <h3>Voorschotten</h3>
      <p className="stil">
        Drank wordt vergoed aan inkoopprijs maal wat er gedronken is. Wat overblijft, wordt niet vergoed.
      </p>
      {Object.entries(perGezin).map(([naam, v]) => (
        <div key={naam} className="vs-blok">
          <div className="vs-kop">
            <span className="functie-naam">{naam}</span>
            <span className="fin-bedrag dik">{euro(v.totaal)}</span>
          </div>
          {v.drank > 0 && <Rij l="Drank aan inkoopprijs" b={v.drank} />}
          {v.posten.map((k) => (
            <Rij key={k.id} l={k.post} b={k.werkelijk != null ? +k.werkelijk : +k.geraamd || 0} />
          ))}
        </div>
      ))}
      {Object.keys(perGezin).length === 0 && <p className="stil">Nog geen voorschotten.</p>}
    </>
  );
}
