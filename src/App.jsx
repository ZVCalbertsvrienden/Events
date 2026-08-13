import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

export default function App() {
  const [sessie, setSessie] = useState(null);
  const [bezig, setBezig] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessie(data.session);
      setBezig(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessie(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (bezig) return <div className="scherm"><p className="stil">Even kijken of je al ingelogd bent…</p></div>;
  return sessie ? <Binnen sessie={sessie} /> : <Aanmelden />;
}

function Aanmelden() {
  const [email, setEmail] = useState('');
  const [stand, setStand] = useState('invullen');
  const [fout, setFout] = useState('');

  const stuur = async (e) => {
    e.preventDefault();
    setStand('versturen');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    if (error) { setFout(error.message); setStand('fout'); }
    else setStand('verstuurd');
  };

  return (
    <div className="scherm smal">
      <p className="eyebrow">Albertvrienden</p>
      <h1>Aanmelden</h1>

      {stand === 'verstuurd' ? (
        <div className="kaart">
          <p>Er is een inlogknop verstuurd naar <strong>{email}</strong>. Open die mail op dit toestel.</p>
          <p className="stil">
            Niets gekregen? Kijk in de spam. Zolang er geen eigen mailserver is ingesteld, komt de mail
            van Supabase en belandt hij daar vaak.
          </p>
          <button className="stille-knop" onClick={() => setStand('invullen')}>Ander adres proberen</button>
        </div>
      ) : (
        <form className="kaart" onSubmit={stuur}>
          <label>
            <span>E-mailadres</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder="jij@voorbeeld.be" autoComplete="email" />
          </label>
          <button type="submit" disabled={stand === 'versturen'}>
            {stand === 'versturen' ? 'Versturen…' : 'Stuur me een inlogknop'}
          </button>
          {stand === 'fout' && <p className="fout">{fout}</p>}
          <p className="stil">Geen wachtwoord nodig. Je krijgt een mail met een knop die je aanmeldt.</p>
        </form>
      )}
    </div>
  );
}

function Binnen({ sessie }) {
  const [gezin, setGezin] = useState(null);
  const [events, setEvents] = useState([]);
  const [laden, setLaden] = useState(true);
  const [naam, setNaam] = useState('');

  const haalOp = async () => {
    setLaden(true);
    const [g, e] = await Promise.all([
      supabase.from('gezin').select('*').eq('profiel_id', sessie.user.id).maybeSingle(),
      supabase.from('event').select('*').order('jaar', { ascending: false }),
    ]);
    setGezin(g.data ?? null);
    setEvents(e.data ?? []);
    setLaden(false);
  };

  useEffect(() => { haalOp(); }, []);

  const maakGezin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('gezin').insert({ naam, profiel_id: sessie.user.id });
    if (error) alert(error.message); else { setNaam(''); haalOp(); }
  };

  return (
    <div className="scherm">
      <header>
        <p className="eyebrow">Albertvrienden</p>
        <div className="kop-rij">
          <h1>{gezin ? gezin.naam : 'Welkom'}</h1>
          <button className="stille-knop" onClick={() => supabase.auth.signOut()}>Afmelden</button>
        </div>
        <p className="stil">Aangemeld als {sessie.user.email}</p>
      </header>

      {laden && <p className="stil">Gegevens ophalen…</p>}

      {!laden && !gezin && (
        <form className="kaart" onSubmit={maakGezin}>
          <h2>Onder welke naam kennen we jullie?</h2>
          <p className="stil">Zoals op de dranklijst, bijvoorbeeld "Vael Jürgen" of "Depuydt Sarah".</p>
          <label>
            <span>Gezinsnaam</span>
            <input required value={naam} onChange={(e) => setNaam(e.target.value)} />
          </label>
          <button type="submit">Gezin aanmaken</button>
        </form>
      )}

      {!laden && gezin && (
        <section className="kaart">
          <h2>Evenementen</h2>
          {events.length === 0 ? (
            <p className="stil">
              Er staat nog geen event klaar. Maak er een aan in Supabase onder Table Editor → event,
              en geef jezelf daarna een rij in <code>rol</code> met rol <code>admin</code>.
            </p>
          ) : (
            <ul className="lijst">
              {events.map((ev) => (
                <li key={ev.id}>
                  <span>{ev.titel}</span>
                  <span className="cijfer">{ev.datum ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <RlsControle />
    </div>
  );
}

function RlsControle() {
  const [uitslag, setUitslag] = useState(null);

  const test = async () => {
    const [kosten, inschrijvingen] = await Promise.all([
      supabase.from('kostenpost').select('id', { count: 'exact', head: true }),
      supabase.from('inschrijving').select('id', { count: 'exact', head: true }),
    ]);
    setUitslag({
      kosten: kosten.error ? `geweigerd (${kosten.error.code})` : `${kosten.count} rijen zichtbaar`,
      inschrijvingen: inschrijvingen.error
        ? `geweigerd (${inschrijvingen.error.code})`
        : `${inschrijvingen.count} rijen zichtbaar`,
    });
  };

  return (
    <section className="kaart controle">
      <h2>Controle vóór je echte namen invoert</h2>
      <p className="stil">
        Meld je aan met een testaccount zonder rol. De kostenposten horen dan op nul te staan.
        Zie je er meer, dan staat RLS niet aan.
      </p>
      <button className="stille-knop" onClick={test}>Toegang testen</button>
      {uitslag && (
        <ul className="lijst">
          <li><span>kostenpost</span><span className="cijfer">{uitslag.kosten}</span></li>
          <li><span>inschrijving</span><span className="cijfer">{uitslag.inschrijvingen}</span></li>
        </ul>
      )}
    </section>
  );
}
