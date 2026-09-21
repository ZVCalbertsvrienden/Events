import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase.js';

const euro = (v) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(v || 0);

const CATEGORIEEN = ['frisdrank', 'water', 'pils', 'speciaal', 'wijn'];

export default function Dranken({ ev, magFinancien }) {
  const [dranken, setDranken] = useState([]);
  const [gezinnen, setGezinnen] = useState([]);
  const [alleGezinnen, setAlleGezinnen] = useState([]);
  const [verbruik, setVerbruik] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [sel, setSel] = useState(null);
  const [toon, setToon] = useState('gezin');
  const [mij, setMij] = useState(null);

  const haal = async () => {
    const [d, g, i, v, u] = await Promise.all([
      supabase.from('drank').select('*').eq('event_id', ev.id).order('volgorde'),
      supabase.from('gezin').select('id, naam').order('naam'),
      supabase.from('inschrijving').select('gezin_id, status').eq('event_id', ev.id),
      supabase.from('verbruik').select('gezin_id, drank_id, aantal').eq('event_id', ev.id),
      supabase.auth.getUser(),
    ]);
    const err = d.error || v.error || g.error;
    if (err) setFout(err.message);
    const ingeschreven = new Set((i.data ?? []).filter((x) => x.status !== 'geannuleerd').map((x) => x.gezin_id));
    const metVerbruik = new Set((v.data ?? []).map((x) => x.gezin_id));
    setDranken(d.data ?? []);
    setAlleGezinnen(g.data ?? []);
    setGezinnen((g.data ?? []).filter((x) => ingeschreven.has(x.id) || metVerbruik.has(x.id)));
    setVerbruik(v.data ?? []);
    setMij(u.data?.user?.id ?? null);
    setLaden(false);
  };

  useEffect(() => { haal(); }, [ev.id]);

  const telling = useMemo(() => {
    const t = {};
    verbruik.forEach((x) => {
      const k = x.gezin_id + '|' + x.drank_id;
      t[k] = (t[k] || 0) + x.aantal;
    });
    return t;
  }, [verbruik]);

  const aantal = (gid, did) => telling[gid + '|' + did] || 0;
  const bedragGezin = (gid) => dranken.reduce((s, d) => s + aantal(gid, d.id) * (+d.verkoopprijs || 0), 0);
  const totaalDrank = (did) => gezinnen.reduce((s, g) => s + aantal(g.id, did), 0);

  /* Het verbruik is een logboek: een wijziging wordt een extra regel met het verschil.
     Zo blijft zichtbaar wat er aangepast is, en overschrijven twee mensen elkaar nooit. */
  const zet = async (gid, did, nieuw) => {
    const n = Math.max(0, Math.round(+nieuw || 0));
    const delta = n - aantal(gid, did);
    if (!delta) return;
    const rij = { event_id: ev.id, gezin_id: gid, drank_id: did, aantal: delta, door: mij };
    setVerbruik((l) => [...l, rij]);
    setFout('');
    const { error } = await supabase.from('verbruik').insert(rij);
    if (error) { setFout(error.message); haal(); }
  };

  if (laden) return <p className="stil">Dranken ophalen…</p>;

  const gekozen = gezinnen.find((g) => g.id === sel);
  const omzet = gezinnen.reduce((s, g) => s + bedragGezin(g.id), 0);

  return (
    <section className="kaart">
      <div className="kop-tussen">
        <h2>Dranken</h2>
        <span className="cijfer">omzet {euro(omzet)}</span>
      </div>
      {fout && <p className="fout">{fout}</p>}

      <div className="uitklap-rij" style={{ marginTop: 4 }}>
        {[['gezin', 'Per gezin'], ['raster', 'Overzicht'], ['kaart', 'Drankenkaart']].map(([id, label]) => (
          <button key={id} className={'pil' + (toon === id ? ' aan' : '')} onClick={() => setToon(id)}>
            {label}
          </button>
        ))}
      </div>

      {toon === 'gezin' && (
        <>
          <p className="stil">Kies een gezin en pas de aantallen aan. Elke wijziging wordt meteen bewaard.</p>
          <div className="dr-gezinnen">
            {gezinnen.map((g) => {
              const b = bedragGezin(g.id);
              return (
                <button key={g.id} className={'pil' + (sel === g.id ? ' aan' : '')} onClick={() => setSel(g.id)}>
                  {g.naam}{b > 0 && <span className="dr-bedrag"> · {euro(b)}</span>}
                </button>
              );
            })}
          </div>

          {gekozen ? (
            <>
              <div className="kop-tussen" style={{ marginTop: 6 }}>
                <span className="functie-naam">{gekozen.naam}</span>
                <span className="mono-groot">{euro(bedragGezin(gekozen.id))}</span>
              </div>
              {dranken.map((d) => (
                <div key={d.id} className="dr-rij">
                  <span>{d.naam}</span>
                  <span className="stil dr-prijs">
                    {euro(d.verkoopprijs)}{d.eenheid === 'fles' ? '/fles' : ''}
                  </span>
                  <Teller waarde={aantal(gekozen.id, d.id)} onZet={(n) => zet(gekozen.id, d.id, n)} />
                  <span className="dr-sub">{euro(aantal(gekozen.id, d.id) * (+d.verkoopprijs || 0))}</span>
                </div>
              ))}
              {dranken.length === 0 && <p className="stil">Er staan nog geen dranken op de kaart.</p>}
            </>
          ) : (
            <p className="stil">Kies hierboven een gezin.</p>
          )}
        </>
      )}

      {toon === 'raster' && (
        <div className="raster-wrap">
          <table className="raster">
            <thead>
              <tr>
                <th className="n">Gezin</th>
                {dranken.map((d) => <th key={d.id} className="v">{d.naam}</th>)}
                <th>€</th>
              </tr>
            </thead>
            <tbody>
              {gezinnen.map((g) => (
                <tr key={g.id} onClick={() => { setSel(g.id); setToon('gezin'); }} className="klikbaar">
                  <td className="n">{g.naam}</td>
                  {dranken.map((d) => <td key={d.id}>{aantal(g.id, d.id) || ''}</td>)}
                  <td className="bedrag">{euro(bedragGezin(g.id))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="n">Totaal</td>
                {dranken.map((d) => <td key={d.id}>{totaalDrank(d.id) || ''}</td>)}
                <td className="bedrag">{euro(omzet)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="stil" style={{ marginTop: 8 }}>Klik op een gezin om de aantallen aan te passen.</p>
        </div>
      )}

      {toon === 'kaart' && (
        <Kaart ev={ev} dranken={dranken} gezinnen={alleGezinnen} verbruik={verbruik}
               magFinancien={magFinancien} haal={haal} setFout={setFout} />
      )}
    </section>
  );
}

function Teller({ waarde, onZet }) {
  const [tekst, setTekst] = useState(String(waarde));
  useEffect(() => { setTekst(String(waarde)); }, [waarde]);
  return (
    <span className="dr-teller">
      <button type="button" className="stille-knop" onClick={() => onZet(waarde - 1)} disabled={waarde <= 0}
              aria-label="één minder">−</button>
      <input type="number" min="0" value={tekst}
             onChange={(e) => setTekst(e.target.value)}
             onBlur={() => onZet(tekst)}
             onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      <button type="button" className="stille-knop" onClick={() => onZet(waarde + 1)}
              aria-label="één meer">+</button>
    </span>
  );
}

/* ── drankenkaart: prijzen, inkoop en wie voorschoot ── */
function Kaart({ ev, dranken, gezinnen, verbruik, magFinancien, haal, setFout }) {
  const leeg = { naam: '', categorie: 'frisdrank', eenheid: 'stuk', verkoopprijs: '', inkoopprijs: '', voorgeschoten_door: '' };
  const [nieuw, setNieuw] = useState(leeg);
  const gebruikt = new Set(verbruik.map((v) => v.drank_id));

  const bewaar = async (id, veld, waarde) => {
    const w = ['verkoopprijs', 'inkoopprijs'].includes(veld) ? (+waarde || 0)
      : waarde === '' ? null : waarde;
    const { error } = await supabase.from('drank').update({ [veld]: w }).eq('id', id);
    if (error) setFout(error.message); else haal();
  };

  const voegToe = async () => {
    if (!nieuw.naam) return;
    const volgorde = dranken.reduce((m, d) => Math.max(m, d.volgorde || 0), 0) + 1;
    const { error } = await supabase.from('drank').insert({
      event_id: ev.id, naam: nieuw.naam, categorie: nieuw.categorie, eenheid: nieuw.eenheid,
      verkoopprijs: +nieuw.verkoopprijs || 0, inkoopprijs: +nieuw.inkoopprijs || 0,
      voorgeschoten_door: nieuw.voorgeschoten_door || null, volgorde,
    });
    if (error) setFout(error.message); else { setNieuw(leeg); haal(); }
  };

  const weg = async (d) => {
    if (gebruikt.has(d.id)) {
      setFout(`${d.naam} is al gedronken en kan niet verwijderd worden. Zet de aantallen eerst op nul.`);
      return;
    }
    const { error } = await supabase.from('drank').delete().eq('id', d.id);
    if (error) setFout(error.message); else haal();
  };

  if (!magFinancien) {
    return (
      <ul className="lijst">
        {dranken.map((d) => (
          <li key={d.id}><span>{d.naam}</span><span className="cijfer">{euro(d.verkoopprijs)}</span></li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <p className="stil">
        De verkoopprijs komt op de afrekening van het gezin. De inkoopprijs bepaalt het voorschot
        van wie de drank kocht.
      </p>
      <div className="dk-kop">
        <span>Drank</span><span>Soort</span><span>Eenheid</span><span>Verkoop</span>
        <span>Inkoop</span><span>Gekocht door</span><span />
      </div>
      {dranken.map((d) => (
        <div key={d.id} className="dk-rij">
          <input defaultValue={d.naam} onBlur={(e) => e.target.value !== d.naam && bewaar(d.id, 'naam', e.target.value)} />
          <select defaultValue={d.categorie || ''} onChange={(e) => bewaar(d.id, 'categorie', e.target.value)}>
            {CATEGORIEEN.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select defaultValue={d.eenheid} onChange={(e) => bewaar(d.id, 'eenheid', e.target.value)}>
            <option value="stuk">stuk</option><option value="fles">fles</option>
          </select>
          <input type="number" step="0.1" className="kp-bedrag" defaultValue={d.verkoopprijs}
                 onBlur={(e) => bewaar(d.id, 'verkoopprijs', e.target.value)} />
          <input type="number" step="0.1" className="kp-bedrag" defaultValue={d.inkoopprijs}
                 onBlur={(e) => bewaar(d.id, 'inkoopprijs', e.target.value)} />
          <select defaultValue={d.voorgeschoten_door || ''} onChange={(e) => bewaar(d.id, 'voorgeschoten_door', e.target.value)}>
            <option value="">de club</option>
            {gezinnen.map((g) => <option key={g.id} value={g.id}>{g.naam}</option>)}
          </select>
          <button className="weg" onClick={() => weg(d)} aria-label={`${d.naam} verwijderen`}>×</button>
        </div>
      ))}

      <div className="dk-rij nieuw">
        <input placeholder="nieuwe drank" value={nieuw.naam} onChange={(e) => setNieuw({ ...nieuw, naam: e.target.value })} />
        <select value={nieuw.categorie} onChange={(e) => setNieuw({ ...nieuw, categorie: e.target.value })}>
          {CATEGORIEEN.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={nieuw.eenheid} onChange={(e) => setNieuw({ ...nieuw, eenheid: e.target.value })}>
          <option value="stuk">stuk</option><option value="fles">fles</option>
        </select>
        <input type="number" step="0.1" className="kp-bedrag" placeholder="verkoop"
               value={nieuw.verkoopprijs} onChange={(e) => setNieuw({ ...nieuw, verkoopprijs: e.target.value })} />
        <input type="number" step="0.1" className="kp-bedrag" placeholder="inkoop"
               value={nieuw.inkoopprijs} onChange={(e) => setNieuw({ ...nieuw, inkoopprijs: e.target.value })} />
        <select value={nieuw.voorgeschoten_door} onChange={(e) => setNieuw({ ...nieuw, voorgeschoten_door: e.target.value })}>
          <option value="">de club</option>
          {gezinnen.map((g) => <option key={g.id} value={g.id}>{g.naam}</option>)}
        </select>
        <button onClick={voegToe} aria-label="drank toevoegen">+</button>
      </div>
    </>
  );
}
