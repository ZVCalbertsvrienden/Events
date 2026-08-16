import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import Inschrijving from './Inschrijving.jsx';

const BASIS = import.meta.env.BASE_URL;

const SPONSORS = [
  { naam: '', logo: '', url: '' },
  { naam: '', logo: '', url: '' },
  { naam: '', logo: '', url: '' },
];

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
      options: { emailRedirectTo: window.location.origin + BASIS },
    });
    if (error) { setFout(error.message); setStand('fout'); }
    else setStand('verstuurd');
  };

  return (
    <div className="scherm smal">
      <img className="clublogo" src={BASIS + 'clublogo.png'} alt="ZVC Albertsvrienden" style={{ width: 72, height: 72 }} />
      <p className="eyebrow" style={{ marginTop: 14 }}>ZVC Albertsvrienden</p>
      <h1>Aanmelden</h1>

      {stand === 'verstuurd' ? (
        <div className="kaart">
          <p>Er is een inlogknop verstuurd naar <strong>{email}</strong>. Open die mail op dit toestel.</p>
          <p className="stil">Niets gekregen? Kijk in de spam.</p>
          <button className="stille-knop" onClick={() => setStand('invullen')}>Ander adres proberen</button>
        </div>
      ) : (
        <form className="kaart" onSubmit={stuur}>
          <label>
            <span>E-mailadres</span>
            <input id="email" name="email" type="email" required value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder="jij@voorbeeld.be" autoComplete="email" />
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
  const [rollen, setRollen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [naam, setNaam] = useState('');

  const haalOp = async () => {
    setLaden(true);
    const [g, e, r] = await Promise.all([
      supabase.from('gezin').select('*').eq('profiel_id', sessie.user.id).maybeSingle(),
      supabase.from('event').select('*').order('jaar', { ascending: false }),
      supabase.from('rol').select('*').eq('profiel_id', sessie.user.id),
    ]);
    if (e.error) console.error('event:', e.error);
    setGezin(g.data ?? null);
    setEvents(e.data ?? []);
    setRollen(r.data ?? []);
    setFout(e.error ? `${e.error.code}: ${e.error.message}` : '');
    setLaden(false);
  };

  useEffect(() => { haalOp(); }, []);

  const maakGezin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('gezin').insert({ naam, profiel_id: sessie.user.id });
    if (error) alert(error.message); else { setNaam(''); haalOp(); }
  };

  const ev = events[0];
  const mijnRollen = ev ? rollen.filter((r) => r.event_id === ev.id) : [];

  return (
    <div className="scherm">
      <header>
        <div className="kop-rij">
          <div>
            <p className="eyebrow">ZVC Albertsvrienden</p>
            <h1>{gezin ? gezin.naam : 'Welkom'}</h1>
          </div>
          <div className="kop-rechts">
            <img className="clublogo" src={BASIS + 'clublogo.png'} alt="ZVC Albertsvrienden" />
            <button className="stille-knop" onClick={() => supabase.auth.signOut()}>Afmelden</button>
          </div>
        </div>
        <p className="stil">Aangemeld als {sessie.user.email}</p>
      </header>

      {laden && <p className="stil">Gegevens ophalen…</p>}
      {fout && <p className="fout">{fout}</p>}

      {!laden && !gezin && (
        <form className="kaart" onSubmit={maakGezin}>
          <h2>Onder welke naam kennen we jullie?</h2>
          <p className="stil">Zoals op de dranklijst, bijvoorbeeld "Vael Jürgen".</p>
          <label>
            <span>Gezinsnaam</span>
            <input id="gezinsnaam" name="gezinsnaam" required value={naam} onChange={(e) => setNaam(e.target.value)} />
          </label>
          <button type="submit">Gezin aanmaken</button>
        </form>
      )}

      {!laden && gezin && !ev && (
        <div className="kaart"><h2>Evenementen</h2><p className="stil">Er staat nog geen event klaar.</p></div>
      )}

      {!laden && gezin && ev && (
        <>
          <EventBlok ev={ev} />
          <Inschrijving ev={ev} gezin={gezin} rollen={mijnRollen} />
        </>
      )}

      <RlsControle />
      <Sponsors />
    </div>
  );
}

function EventBlok({ ev }) {
  const datum = ev.datum
    ? new Date(ev.datum).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'datum nog te bepalen';
  const uur = ev.uur ? ` · vanaf ${ev.uur.slice(0, 5)}` : '';
  return (
    <article className="veld">
      <div className="veld-rij">
        <div className="veld-merk">
          <img src={BASIS + 'ranch1000.png'} alt="" />
        </div>
        <div className="veld-tekst">
          <p className="veld-org">{ev.organisatie || 'ZVC Albertsvrienden'}</p>
          <div className="veld-titel">{ev.titel}</div>
          <p className="veld-wanneer">{datum}{uur}</p>
          {ev.locatie && <p className="veld-adres">{ev.locatie}</p>}
          {ev.leuze && <p className="veld-leuze">{ev.leuze}</p>}
        </div>
      </div>
    </article>
  );
}

function Sponsors() {
  return (
    <section className="sponsors">
      <p className="sponsors-kop">Met steun van</p>
      <div className="sponsor-rij">
        {SPONSORS.map((s, i) =>
          s.logo ? (
            <a key={i} className="sponsor" href={s.url || '#'} target="_blank" rel="noreferrer">
              <img src={s.logo} alt={s.naam} />
            </a>
          ) : (
            <div key={i} className="sponsor leeg">Sponsorplek vrij</div>
          )
        )}
      </div>
    </section>
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
      inschrijvingen: inschrijvingen.error ? `geweigerd (${inschrijvingen.error.code})` : `${inschrijvingen.count} rijen zichtbaar`,
    });
  };

  return (
    <section className="kaart controle">
      <h2>Controle vóór je echte namen invoert</h2>
      <p className="stil">Meld je aan met een testaccount zonder rol. De kostenposten horen dan op nul te staan.</p>
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
