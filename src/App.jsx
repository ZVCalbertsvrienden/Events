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
  const [modus, setModus] = useState('inloggen'); // inloggen | registreren | link
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [gelukt, setGelukt] = useState('');

  const vertaal = (e) => {
    const m = e.message || '';
    if (m.includes('Invalid login credentials')) return 'E-mailadres of wachtwoord klopt niet.';
    if (m.includes('already registered')) return 'Dit adres bestaat al. Meld je aan met je wachtwoord, of vraag een inloglink.';
    if (m.includes('at least')) return 'Kies een wachtwoord van minstens zes tekens.';
    if (m.includes('rate limit')) return 'Even wachten: er zijn te veel mails verstuurd het afgelopen uur.';
    return m;
  };

  const verstuur = async (e) => {
    e.preventDefault();
    setBezig(true); setFout(''); setGelukt('');

    if (modus === 'link') {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + BASIS },
      });
      if (error) setFout(vertaal(error));
      else setGelukt(`Er is een inlogknop verstuurd naar ${email}. Kijk ook in je spam.`);
    } else if (modus === 'registreren') {
      const { error } = await supabase.auth.signUp({ email, password: wachtwoord });
      if (error) setFout(vertaal(error));
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
      if (error) setFout(vertaal(error));
    }
    setBezig(false);
  };

  return (
    <div className="scherm smal">
      <img className="clublogo" src={BASIS + 'clublogo.png'} alt="ZVC Albertsvrienden"
           style={{ width: 72, height: 72 }} />
      <p className="eyebrow" style={{ marginTop: 14 }}>ZVC Albertsvrienden</p>
      <h1>{modus === 'registreren' ? 'Account aanmaken' : 'Aanmelden'}</h1>

      {gelukt ? (
        <div className="kaart">
          <p>{gelukt}</p>
          <button className="stille-knop" onClick={() => { setGelukt(''); setModus('inloggen'); }}>
            Terug
          </button>
        </div>
      ) : (
        <form className="kaart" onSubmit={verstuur}>
          <label>
            <span>E-mailadres</span>
            <input id="email" name="email" type="email" required value={email}
                   onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>

          {modus !== 'link' && (
            <label>
              <span>Wachtwoord</span>
              <input id="wachtwoord" name="wachtwoord" type="password" required minLength={6}
                     value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)}
                     autoComplete={modus === 'registreren' ? 'new-password' : 'current-password'} />
            </label>
          )}

          <button type="submit" disabled={bezig}>
            {bezig ? 'Bezig…'
              : modus === 'registreren' ? 'Account aanmaken'
              : modus === 'link' ? 'Stuur me een inloglink'
              : 'Aanmelden'}
          </button>

          {fout && <p className="fout">{fout}</p>}

          <div className="wissel">
            {modus !== 'registreren' && (
              <button type="button" className="tekstknop"
                      onClick={() => { setModus('registreren'); setFout(''); }}>
                Nog geen account? Maak er een aan
              </button>
            )}
            {modus !== 'inloggen' && (
              <button type="button" className="tekstknop"
                      onClick={() => { setModus('inloggen'); setFout(''); }}>
                Ik heb al een account
              </button>
            )}
            {modus !== 'link' && (
              <button type="button" className="tekstknop"
                      onClick={() => { setModus('link'); setFout(''); }}>
                Wachtwoord vergeten? Stuur een inloglink
              </button>
            )}
          </div>
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
  const [tab, setTab] = useState(null);

  const haalOp = async () => {
    setLaden(true);
    const [g, e, r] = await Promise.all([
      supabase.from('gezin').select('*').eq('profiel_id', sessie.user.id).maybeSingle(),
      supabase.from('event').select('*').order('jaar', { ascending: false }),
      supabase.from('rol').select('*').eq('profiel_id', sessie.user.id),
    ]);
    if (e.error) console.error('event:', e.error);
        if (g.error) {
      console.error('gezin:', g.error);
      setFout(`Je gegevens konden niet opgehaald worden (${g.error.code}). Ververs de pagina.`);
      setLaden(false);
      return;
    }
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
  const organisator = mijnRollen.length > 0;
  const actief = tab ?? (organisator ? 'overzicht' : 'inschrijving');

  const knoppen = [
    organisator && ['overzicht', 'Overzicht'],
    ['inschrijving', 'Mijn inschrijving'],
    ['taken', 'Rollen en taken'],
    ['formulieren', 'Formulieren'],
  ].filter(Boolean);

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
        <Wachtwoord email={sessie.user.email} />
      </header>

      {laden && <p className="stil">Gegevens ophalen…</p>}
      {fout && <p className="fout">{fout}</p>}

      {!laden && !gezin && (
        <form className="kaart" onSubmit={maakGezin}>
          <h2>Onder welke naam kennen we jullie?</h2>
          <p className="stil">Zoals op de dranklijst, bijvoorbeeld "Vael Jürgen".</p>
          <label>
            <span>Gezinsnaam</span>
            <input id="gezinsnaam" name="gezinsnaam" required value={naam}
                   onChange={(e) => setNaam(e.target.value)} />
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
          <nav className="menu geen-print">
            {knoppen.map(([id, label]) => (
              <button key={id} className={'menu-knop' + (actief === id ? ' aan' : '')}
                      onClick={() => setTab(id)}>{label}</button>
            ))}
          </nav>
          <Inschrijving ev={ev} gezin={gezin} rollen={mijnRollen} tab={actief} />
        </>
      )}

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
function Wachtwoord({ email }) {
  const [open, setOpen] = useState(false);
  const [ww, setWw] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [klaar, setKlaar] = useState(false);

  const bewaar = async (e) => {
    e.preventDefault();
    setBezig(true); setFout('');
    const { error } = await supabase.auth.updateUser({ password: ww });
    if (error) {
      setFout(error.message.includes('at least')
        ? 'Kies een wachtwoord van minstens zes tekens.'
        : error.message);
    } else {
      setKlaar(true); setWw(''); setOpen(false);
      setTimeout(() => setKlaar(false), 4000);
    }
    setBezig(false);
  };

  if (klaar) return <p className="ok">✓ Je wachtwoord is ingesteld. Voortaan kan je met {email} en dit wachtwoord aanmelden.</p>;

  if (!open) return (
    <button className="tekstknop" onClick={() => setOpen(true)}>
      Wachtwoord instellen of wijzigen
    </button>
  );

  return (
    <form className="kaart" onSubmit={bewaar}>
      <h2>Wachtwoord instellen</h2>
      <p className="stil">
        Daarna kan je aanmelden zonder op een mail te wachten.
      </p>
      <label>
        <span>Nieuw wachtwoord</span>
        <input type="password" required minLength={6} value={ww}
               onChange={(e) => setWw(e.target.value)} autoComplete="new-password" />
      </label>
      <div className="rij-knoppen" style={{ marginTop: 0 }}>
        <button type="submit" disabled={bezig}>{bezig ? 'Bezig…' : 'Bewaren'}</button>
        <button type="button" className="stille-knop" onClick={() => { setOpen(false); setFout(''); }}>
          Annuleren
        </button>
      </div>
      {fout && <p className="fout">{fout}</p>}
    </form>
  );
}
