const BASIS = import.meta.env.BASE_URL;

export default function Printblad({ ev, opties, functies }) {
  const perCat = opties.reduce((a, o) => {
    (a[o.categorie] = a[o.categorie] || []).push(o);
    return a;
  }, {});
  const euro = (v) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(v || 0);
  const datum = ev.datum
    ? new Date(ev.datum).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="printblad">
      <div className="pb-kop">
        <img className="pb-logo" src={BASIS + 'clublogo.png'} alt="" />
        <div className="pb-kop-tekst">
          <div className="pb-club">ZVC Albertsvrienden</div>
          <div className="pb-titel">{ev.titel}</div>
          <div className="pb-sub">{datum}{ev.uur ? ` · vanaf ${ev.uur.slice(0, 5)}` : ''}{ev.locatie ? ` · ${ev.locatie}` : ''}</div>
        </div>
        <img className="pb-logo" src={BASIS + 'ranch1000.png'} alt="" />
      </div>

      <div className="pb-blok">
        <div className="pb-veld breed"><span>Gezinsnaam</span><div className="pb-lijn" /></div>
        <div className="pb-veld"><span>E-mail</span><div className="pb-lijn" /></div>
        <div className="pb-veld"><span>Gsm</span><div className="pb-lijn" /></div>
      </div>

      <div className="pb-sectie">Met hoeveel komen jullie?</div>
      <div className="pb-tel-rij">
        <div className="pb-tel">
          <div className="pb-tel-hok" />
          <div className="pb-tel-naam">Volwassenen</div>
          <div className="pb-tel-sub">14 j. en ouder · {euro(ev.prijs_volw)}</div>
        </div>
        <div className="pb-tel">
          <div className="pb-tel-hok" />
          <div className="pb-tel-naam">Kinderen</div>
          <div className="pb-tel-sub">7 t.e.m. 13 j. · {euro(ev.prijs_kind)}</div>
        </div>
        <div className="pb-tel">
          <div className="pb-tel-hok" />
          <div className="pb-tel-naam">Kleine kinderen</div>
          <div className="pb-tel-sub">6 j. of jonger · gratis</div>
        </div>
      </div>

      <div className="pb-sectie">Dieet of allergie</div>
      <div className="pb-vinkjes">
        {['Vegetarisch', 'Glutenvrij', 'Lactosevrij', 'Geen varkensvlees', 'Geen vis'].map((d) => (
          <label key={d} className="pb-vink"><span className="pb-vak" />{d}</label>
        ))}
      </div>
      <div className="pb-veld breed"><span>Toelichting</span><div className="pb-lijn" /></div>

      <div className="pb-sectie">Wat drinken jullie doorgaans? Kruis aan wat past.</div>
      {Object.entries(perCat).map(([cat, lijst]) => (
        <div key={cat} className="pb-drank">
          <div className="pb-cat">{cat}</div>
          <div className="pb-vinkjes">
            {lijst.map((o) => (
              <label key={o.naam} className="pb-vink"><span className="pb-vak" />{o.naam}</label>
            ))}
          </div>
        </div>
      ))}

      <div className="pb-sectie">Wil je meehelpen? Kruis aan wat je aanspreekt.</div>
      <div className="pb-vinkjes">
        {functies.map((f) => (
          <label key={f.naam} className="pb-vink"><span className="pb-vak" />{f.naam}</label>
        ))}
      </div>

      <div className="pb-sectie">In te vullen door het bestuur</div>
      <div className="pb-ontvangst">
        <div className="pb-bedrag">
          <span>Ontvangen bedrag</span>
          <div className="pb-bedrag-vak">€</div>
          <div className="pb-datum-lijn">Datum ____ / ____ / 20____</div>
        </div>
        <div className="pb-handtekening">
          <div className="pb-hand-vak" />
          <span>Handtekening inschrijver</span>
        </div>
        <div className="pb-handtekening">
          <div className="pb-hand-vak" />
          <span>Handtekening bestuurslid</span>
        </div>
      </div>

      <div className="pb-voet">
        Drank wordt niet vooraf betaald: aan de bar houden we per gezin bij wat er gedronken wordt,
        en dat komt op de eindafrekening.
      </div>
    </div>
  );
}
