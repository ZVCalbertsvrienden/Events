import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

/* ─────────────────────────  takenlijst  ───────────────────────── */
export function Taken({ ev, functies, mijnFuncties, isOrganisator }) {
  const [taken, setTaken] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);
  const [alles, setAlles] = useState(false);

  const haal = async () => {
    setLaden(true);
    const { data, error } = await supabase
      .from('taak').select('*').eq('event_id', ev.id).order('volgorde');
    if (error) setFout(error.message);
    setTaken(data ?? []);
    setLaden(false);
  };

  useEffect(() => { haal(); }, [ev.id]);

  const overnemen = async () => {
    setBezig(true); setFout('');
    const { error } = await supabase.rpc('neem_taken_over', { ev: ev.id });
    if (error) setFout(error.message); else await haal();
    setBezig(false);
  };

  const vink = async (t) => {
    const nieuw = !t.klaar;
    setTaken((l) => l.map((x) => (x.id === t.id ? { ...x, klaar: nieuw } : x)));
    const { error } = await supabase.from('taak').update({ klaar: nieuw }).eq('id', t.id);
    if (error) { setFout(error.message); haal(); }
  };

  if (laden) return <p className="stil">Taken ophalen…</p>;

  const zichtbaar = alles || isOrganisator
    ? functies
    : functies.filter((f) => mijnFuncties.includes(f.naam));

  const vanFunctie = (naam, fase) =>
    taken.filter((t) => t.functie === naam && t.fase === fase);

  const klaar = taken.filter((t) => t.klaar).length;

  return (
    <section className="kaart geen-print">
      <div className="kop-tussen">
        <h2>Taken</h2>
        {taken.length > 0 && (
          <span className="cijfer">{klaar} van {taken.length} afgevinkt</span>
        )}
      </div>

      {fout && <p className="fout">{fout}</p>}

      {taken.length === 0 ? (
        <>
          <p className="stil">
            Nog geen taken. Neem ze over uit de functieomschrijvingen — daarna kan je ze
            aanpassen, schrappen of aanvullen zonder het sjabloon te raken.
          </p>
          {isOrganisator && (
            <button onClick={overnemen} disabled={bezig}>
              {bezig ? 'Bezig…' : 'Taken overnemen uit de functies'}
            </button>
          )}
        </>
      ) : (
        <>
          {!isOrganisator && mijnFuncties.length > 0 && (
            <label className="schakel">
              <input type="checkbox" checked={alles} onChange={(e) => setAlles(e.target.checked)} />
              <span>Ook de taken van de anderen tonen</span>
            </label>
          )}

          {zichtbaar.map((f) => {
            const voor = vanFunctie(f.naam, 'voor');
            const tijdens = vanFunctie(f.naam, 'tijdens');
            const na = vanFunctie(f.naam, 'na');
            if (voor.length + tijdens.length + na.length === 0) return null;
            const mag = isOrganisator || mijnFuncties.includes(f.naam);
            return (
              <div key={f.naam} className="taakgroep">
                <div className="taakgroep-kop">
                  <span className="functie-naam">{f.naam}</span>
                  {!mag && <span className="stil">alleen lezen</span>}
                </div>
                {[['Vóór de BBQ', voor], ['Tijdens de BBQ', tijdens], ['Na de BBQ', na]].map(([label, lijst]) =>
                  lijst.length === 0 ? null : (
                    <div key={label}>
                      <p className="cat-naam">{label}</p>
                      {lijst.map((t) => (
                        <label key={t.id} className={'taak' + (t.klaar ? ' af' : '')}>
                          <input type="checkbox" checked={t.klaar} disabled={!mag}
                                 onChange={() => vink(t)} />
                          <span>{t.titel}</span>
                        </label>
                      ))}
                    </div>
                  )
                )}
              </div>
            );
          })}

          {zichtbaar.length === 0 && (
            <p className="stil">Je hebt nog geen functie toegewezen gekregen.</p>
          )}

          {isOrganisator && (
            <div className="rij-knoppen">
              <button className="stille-knop" onClick={overnemen} disabled={bezig}>
                Nieuwe taken uit de functies halen
              </button>
              <button className="stille-knop" onClick={() => window.print()}>
                Takenblad afdrukken
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ─────────────────────────  printblad taken  ───────────────────────── */
export function TakenPrint({ ev, functies, taken }) {
  if (taken.length === 0) return null;
  return (
    <div className="takenblad">
      {functies.map((f) => {
        const voor = taken.filter((t) => t.functie === f.naam && t.fase === 'voor');
        const tijdens = taken.filter((t) => t.functie === f.naam && t.fase === 'tijdens');
        const na = taken.filter((t) => t.functie === f.naam && t.fase === 'na');
        if (voor.length + tijdens.length + na.length === 0) return null;
        return (
          <div key={f.naam} className="tb-blad">
            <div className="tb-kop">
              <div>
                <div className="pb-club">{ev.organisatie || 'ZVC Albertsvrienden'}</div>
                <div className="tb-functie">{f.naam}</div>
              </div>
              <div className="tb-event">{ev.titel}</div>
            </div>
            <p className="tb-kern">{f.kerntaak}</p>
            {[['Vóór de BBQ', voor], ['Tijdens de BBQ', tijdens], ['Na de BBQ', na]].map(([label, lijst]) =>
              lijst.length === 0 ? null : (
                <div key={label}>
                  <div className="pb-sectie">{label}</div>
                  {lijst.map((t) => (
                    <div key={t.id} className="tb-taak">
                      <span className="pb-vak" />
                      <span>{t.titel}</span>
                    </div>
                  ))}
                </div>
              )
            )}
            <div className="tb-vrij">
              <div className="pb-sectie">Eigen notities</div>
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="tb-lijn" />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────  rollen toekennen  ───────────────────────── */
export function Rollen({ ev, functies }) {
  const [leden, setLeden] = useState([]);
  const [rollen, setRollen] = useState([]);
  const [helpers, setHelpers] = useState({});
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [open, setOpen] = useState(null);

  const haal = async () => {
    setLaden(true); setFout('');
    const [g, r, i] = await Promise.all([
      supabase.from('gezin').select('id, naam, profiel_id').order('naam'),
      supabase.from('rol').select('*').eq('event_id', ev.id),
      supabase.from('inschrijving').select('gezin_id, helpen').eq('event_id', ev.id),
    ]);
    if (g.error) setFout(g.error.message);
    setLeden((g.data ?? []).filter((x) => x.profiel_id));
    setRollen(r.data ?? []);
    const h = {};
    (i.data ?? []).forEach((row) => { h[row.gezin_id] = row.helpen || []; });
    setHelpers(h);
    setLaden(false);
  };

  useEffect(() => { haal(); }, [ev.id]);

  const rijenVan = (pid) => rollen.filter((r) => r.profiel_id === pid);

  const wisselRol = async (pid, rol) => {
    setFout('');
    const bestaat = rollen.find((r) => r.profiel_id === pid && r.rol === rol && !r.functie);
    if (bestaat) {
      const { error } = await supabase.from('rol').delete()
        .eq('event_id', ev.id).eq('profiel_id', pid).eq('rol', rol).is('functie', null);
      if (error) return setFout(error.message);
    } else {
      const { error } = await supabase.from('rol')
        .insert({ event_id: ev.id, profiel_id: pid, rol });
      if (error) return setFout(vertaal(error));
    }
    haal();
  };

  const wisselFunctie = async (pid, functie) => {
    setFout('');
    const bestaat = rollen.find((r) => r.profiel_id === pid && r.functie === functie);
    if (bestaat) {
      const { error } = await supabase.from('rol').delete()
        .eq('event_id', ev.id).eq('profiel_id', pid).eq('functie', functie);
      if (error) return setFout(error.message);
    } else {
      const { error } = await supabase.from('rol')
        .insert({ event_id: ev.id, profiel_id: pid, rol: 'organisator', functie });
      if (error) return setFout(vertaal(error));
    }
    haal();
  };

  const vertaal = (e) => {
    if (e.message.includes('drie functies')) return 'Deze persoon heeft er al drie.';
    if (e.code === '23505') return 'Deze functie is al aan iemand anders toegekend.';
    return e.message;
  };

  if (laden) return <p className="stil">Leden ophalen…</p>;

  const houderVan = (f) => {
    const r = rollen.find((x) => x.functie === f);
    if (!r) return null;
    return leden.find((l) => l.profiel_id === r.profiel_id)?.naam ?? 'onbekend';
  };

  return (
    <>
    <TakenPrint ev={ev} functies={functies} taken={taken} />
    <section className="kaart geen-print">
      <h2>Rollen en functies toekennen</h2>
      <p className="stil">
        Wat leden bij hun inschrijving aankruisen is een aanbod. Jij beslist. Enkel wie al
        eens is ingelogd verschijnt in deze lijst.
      </p>
      {fout && <p className="fout">{fout}</p>}

      <div className="functie-stand">
        {functies.map((f) => (
          <div key={f.naam} className="fs-rij">
            <span className="functie-naam">{f.naam}</span>
            <span className={houderVan(f.naam) ? 'fs-vast' : 'stil'}>
              {houderVan(f.naam) ?? 'nog niemand'}
            </span>
          </div>
        ))}
      </div>

      <h3>Per lid</h3>
      {leden.map((l) => {
        const mijn = rijenVan(l.profiel_id);
        const rolNamen = [...new Set(mijn.map((r) => r.rol))];
        const funcNamen = mijn.filter((r) => r.functie).map((r) => r.functie);
        const aangeboden = helpers[l.id] || [];
        const uit = open === l.id;
        return (
          <div key={l.id} className="lid">
            <button type="button" className="lid-kop" onClick={() => setOpen(uit ? null : l.id)}>
              <span>{l.naam}</span>
              <span className="stil">
                {funcNamen.length ? funcNamen.join(', ') : rolNamen.join(', ') || 'geen rol'}
              </span>
            </button>
            {uit && (
              <div className="lid-uit">
                {aangeboden.length > 0 && (
                  <p className="stil">Bood zich aan voor: {aangeboden.join(', ')}</p>
                )}
                <p className="cat-naam">Toegang</p>
                <div className="knoppen">
                  {['admin', 'organisator', 'bar'].map((r) => (
                    <button key={r} type="button"
                            className={'pil' + (rolNamen.includes(r) ? ' aan' : '')}
                            onClick={() => wisselRol(l.profiel_id, r)}>{r}</button>
                  ))}
                </div>
                <p className="cat-naam">Functies</p>
                <div className="knoppen">
                  {functies.map((f) => {
                    const van = houderVan(f.naam);
                    const mijnFunctie = funcNamen.includes(f.naam);
                    const bezet = van && !mijnFunctie;
                    return (
                      <button key={f.naam} type="button"
                              className={'pil' + (mijnFunctie ? ' aan' : '') + (bezet ? ' uit' : '')}
                              disabled={bezet && ['CEO Ceremonie', 'Schatbewaarder'].includes(f.naam)}
                              title={bezet ? `Nu bij ${van}` : f.kerntaak}
                              onClick={() => wisselFunctie(l.profiel_id, f.naam)}>
                        {f.naam}
                        {aangeboden.includes(f.naam) && !mijnFunctie && <span className="ster"> ●</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {leden.length === 0 && <p className="stil">Nog niemand is ingelogd.</p>}
      <p className="stil" style={{ marginTop: 12 }}>
        Een stip betekent dat deze persoon zich er zelf voor aanbood. Wie een functie krijgt,
        krijgt automatisch toegang als organisator.
      </p>
    </section>
    </>
  );
}
