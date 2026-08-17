import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import Printblad from './Printblad.jsx';
import { Taken, Rollen } from './Beheer.jsx';

const DIEET = ['Vegetarisch', 'Glutenvrij', 'Lactosevrij', 'Geen varkensvlees', 'Geen vis'];

const euro = (v) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(v || 0);

export default function Inschrijving({ ev, gezin, rollen }) {
  const [opties, setOpties] = useState([]);
  const [functies, setFuncties] = useState([]);
  const [rij, setRij] = useState(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [bewaard, setBewaard] = useState(false);

  const organisator = rollen.length > 0;

  const leeg = {
    event_id: ev.id, gezin_id: gezin.id,
    volw: 2, kind: 0, klein: 0,
    dieet: [], dieet_nota: '', voorkeur_namen: [], helpen: [],
    opmerking: '', gsm: '', status: 'ingeschreven', betaald: 0,
  };

  useEffect(() => {
    (async () => {
      setLaden(true);
      const [o, f, i] = await Promise.all([
        supabase.from('drankvoorkeur_optie').select('*').order('volgorde'),
        supabase.from('functie_lijst').select('*').order('volgorde'),
        supabase.from('inschrijving').select('*')
          .eq('event_id', ev.id).eq('gezin_id', gezin.id).maybeSingle(),
      ]);
      if (o.error) setFout(o.error.message);
      setOpties(o.data ?? []);
      setFuncties(f.data ?? []);
      setRij(i.data ?? leeg);
      setLaden(false);
    })();
  }, [ev.id, gezin.id]);

  const zet = (k, v) => { setRij((r) => ({ ...r, [k]: v })); setBewaard(false); };
  const wissel = (k, w) => {
    const lijst = rij[k] || [];
    zet(k, lijst.includes(w) ? lijst.filter((x) => x !== w) : [...lijst, w]);
  };

  const bewaar = async () => {
    setFout('');
    const { error } = await supabase.from('inschrijving').upsert(rij, { onConflict: 'event_id,gezin_id' });
    if (error) setFout(error.message);
    else { setBewaard(true); setTimeout(() => setBewaard(false), 3000); }
  };

  if (laden || !rij) return <p className="stil">Inschrijving ophalen…</p>;

  const bedrag = rij.status === 'vrijgesteld' ? 0 :
    rij.volw * (ev.prijs_volw || 0) + rij.kind * (ev.prijs_kind || 0) + rij.klein * (ev.prijs_klein || 0);

  const perCategorie = opties.reduce((acc, o) => {
    (acc[o.categorie] = acc[o.categorie] || []).push(o);
    return acc;
  }, {});

  return (
    <>
      <section className="kaart">
        <h2>Onze inschrijving</h2>

        <div className="drie">
          <label>
            <span>Volwassenen · {euro(ev.prijs_volw)}</span>
            <input type="number" min="0" value={rij.volw}
                   onChange={(e) => zet('volw', Math.max(0, +e.target.value || 0))} />
          </label>
          <label>
            <span>7 t.e.m. 13 j. · {euro(ev.prijs_kind)}</span>
            <input type="number" min="0" value={rij.kind}
                   onChange={(e) => zet('kind', Math.max(0, +e.target.value || 0))} />
          </label>
          <label>
            <span>6 j. of jonger · gratis</span>
            <input type="number" min="0" value={rij.klein}
                   onChange={(e) => zet('klein', Math.max(0, +e.target.value || 0))} />
          </label>
        </div>

        <p className="bedrag">Deelname: <strong>{euro(bedrag)}</strong></p>

        <label>
          <span>Gsm (optioneel)</span>
          <input value={rij.gsm || ''} onChange={(e) => zet('gsm', e.target.value)} placeholder="0470 12 34 56" />
        </label>

        <h3>Dieet en allergieën</h3>
        <div className="knoppen">
          {DIEET.map((d) => (
            <button key={d} type="button"
                    className={'pil' + (rij.dieet.includes(d) ? ' aan' : '')}
                    onClick={() => wissel('dieet', d)}>{d}</button>
          ))}
        </div>
        <label style={{ marginTop: 10 }}>
          <span>Toelichting</span>
          <input value={rij.dieet_nota || ''} onChange={(e) => zet('dieet_nota', e.target.value)}
                 placeholder="bv. noten, ernstig" />
        </label>

        <h3>Wat drinken jullie doorgaans?</h3>
        <p className="stil">Geen bestelling — hiermee weten we wat we moeten inslaan.</p>
        {Object.entries(perCategorie).map(([cat, lijst]) => (
          <div key={cat} className="cat">
            <p className="cat-naam">{cat}</p>
            <div className="knoppen">
              {lijst.map((o) => (
                <button key={o.naam} type="button"
                        className={'pil' + (rij.voorkeur_namen.includes(o.naam) ? ' aan' : '')}
                        onClick={() => wissel('voorkeur_namen', o.naam)}>{o.naam}</button>
              ))}
            </div>
          </div>
        ))}

        <h3>Wil je meehelpen?</h3>
        <p className="stil">Duid aan wat je aanspreekt. De uren verdelen we later.</p>
        <div className="knoppen">
          {functies.map((f) => (
            <button key={f.naam} type="button"
                    className={'pil' + (rij.helpen.includes(f.naam) ? ' aan' : '')}
                    onClick={() => wissel('helpen', f.naam)} title={f.kerntaak}>{f.naam}</button>
          ))}
        </div>

        <label style={{ marginTop: 16 }}>
          <span>Opmerking</span>
          <input value={rij.opmerking || ''} onChange={(e) => zet('opmerking', e.target.value)} />
        </label>

        <div className="rij-knoppen">
          <button onClick={bewaar}>Inschrijving bewaren</button>
          {bewaard && <span className="ok">✓ bewaard</span>}
          {fout && <span className="fout">{fout}</span>}
        </div>
      </section>

<section className="kaart geen-print">
        <h2>Papieren formulier</h2>
        <p className="stil">Voor wie liever op papier inschrijft. Print het en bezorg het ingevuld terug.</p>
        <button className="stille-knop" onClick={() => window.print()}>Formulier afdrukken</button>
      </section>

      <Printblad ev={ev} opties={opties} functies={functies} />

 <Functies functies={functies} />
      <Taken ev={ev} functies={functies}
             mijnFuncties={rollen.filter((r) => r.functie).map((r) => r.functie)}
             isOrganisator={organisator} />
      {organisator && <Organisatoren ev={ev} functies={functies} />}
      {organisator && <Rollen ev={ev} functies={functies} />}
    </>
  );
}

function Functies({ functies }) {
  const [open, setOpen] = useState(null);
  return (
    <section className="kaart">
      <h2>Wie doet wat</h2>
      {functies.map((f) => (
        <div key={f.naam} className="functie">
          <button type="button" className="functie-kop" onClick={() => setOpen(open === f.naam ? null : f.naam)}>
            <span className="functie-naam">{f.naam}</span>
            <span className="stil">{f.kerntaak}</span>
          </button>
          {open === f.naam && (
            <div className="functie-uit">
              <p className="cat-naam">Vóór de BBQ</p>
              <ul className="taken">{(f.voor_bbq || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
              <p className="cat-naam">Tijdens de BBQ</p>
              <ul className="taken">{(f.tijdens || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function Organisatoren({ ev, functies }) {
  const [lijst, setLijst] = useState([]);
  const [rollen, setRollen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');

  const haal = async () => {
    setLaden(true);
    const [i, r] = await Promise.all([
      supabase.from('inschrijving').select('*, gezin(naam, profiel_id)').eq('event_id', ev.id),
      supabase.from('rol').select('*').eq('event_id', ev.id),
    ]);
    if (i.error) setFout(i.error.message);
    setLijst(i.data ?? []);
    setRollen(r.data ?? []);
    setLaden(false);
  };

  useEffect(() => { haal(); }, [ev.id]);

  if (laden) return <p className="stil">Deelnemers ophalen…</p>;

  const actief = lijst.filter((r) => r.status !== 'geannuleerd');
  const som = (k) => actief.reduce((s, r) => s + (r[k] || 0), 0);
  const koppen = som('volw') + som('kind') + som('klein');
  const betalend = actief.filter((r) => r.status !== 'vrijgesteld')
    .reduce((s, r) => s + r.volw + r.kind + r.klein, 0);
  const veg = actief.filter((r) => (r.dieet || []).includes('Vegetarisch'))
    .reduce((s, r) => s + r.volw + r.kind, 0);
  const inkomsten = actief.filter((r) => r.status !== 'vrijgesteld').reduce((s, r) =>
    s + r.volw * (ev.prijs_volw || 0) + r.kind * (ev.prijs_kind || 0) + r.klein * (ev.prijs_klein || 0), 0);

  const helpers = {};
  actief.forEach((r) => (r.helpen || []).forEach((f) => {
    (helpers[f] = helpers[f] || []).push(r.gezin?.naam || '?');
  }));

  const bezet = (f) => rollen.find((r) => r.functie === f);

  return (
    <section className="kaart">
      <h2>Organisatie</h2>
      {fout && <p className="fout">{fout}</p>}

      <div className="cijfers">
        {[['Gezinnen', actief.length], ['Koppen', koppen], ['Betalend', betalend],
          ['Volwassenen', som('volw')], ['Kind 7–13', som('kind')], ['Kind ≤6', som('klein')],
          ['Vegetarisch', veg], ['Bijdragen', euro(inkomsten)]].map(([l, v]) => (
          <div key={l} className="cijfer-kaart">
            <span className="cijfer-label">{l}</span>
            <span className="cijfer-waarde">{v}</span>
          </div>
        ))}
      </div>

      {koppen !== betalend && (
        <p className="let-op">
          {koppen} koppen om eten voor te bestellen, {betalend} betalende koppen voor de inkomsten.
          Het verschil zit bij gezinnen met status <em>vrijgesteld</em>.
        </p>
      )}

      <h3>Deelnemers</h3>
      <ul className="lijst">
        {actief.map((r) => (
          <li key={r.id}>
            <span>
              {r.gezin?.naam || '?'}
              {r.status === 'vrijgesteld' && <span className="merk">vrijgesteld</span>}
              {(r.dieet || []).length > 0 && <span className="dieet"> {r.dieet.join(', ')}</span>}
            </span>
            <span className="cijfer">{r.volw}/{r.kind}/{r.klein}</span>
          </li>
        ))}
        {actief.length === 0 && <li><span className="stil">Nog geen inschrijvingen.</span></li>}
      </ul>

      <h3>Wie wil helpen</h3>
      {functies.map((f) => {
        const houder = bezet(f.naam);
        return (
          <div key={f.naam} className="helper-rij">
            <span className="functie-naam">{f.naam}</span>
            <span className="stil">
              {houder ? 'toegekend' : (helpers[f.naam]?.join(', ') || 'niemand aangemeld')}
            </span>
          </div>
        );
      })}
      <p className="stil" style={{ marginTop: 12 }}>
        Rollen en functies ken je toe in Supabase, tabel <code>rol</code>. Eén CEO Ceremonie en
        één Schatbewaarder per event; hoogstens drie functies per persoon.
      </p>
    </section>
  );
}
