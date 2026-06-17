import Link from 'next/link'

export const metadata = {
  title: 'Unity House Gostyń — Panel Zarządzania Wspólnotą',
  description: 'Nowoczesny panel zarządzania wspólnotą mieszkaniową. Ogłoszenia, zgłoszenia, dokumenty i tablica — wszystko w jednym miejscu.',
}

export default function LandingPage() {
  return (
    <>
      <style>{`
        .lp *, .lp *::before, .lp *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .lp {
          --bg:      #18110a;
          --bg2:     #271a0c;
          --card:    #1e1409;
          --border:  #33200d;
          --border2: #3d2008;
          --green:   #18110a;
          --green2:  #0a100d;
          --gold:    #059669;
          --gold2:   #047857;
          --text:    #fef9ee;
          --text2:   #b45309;
          --text3:   #b45309;
          background: var(--bg);
          color: var(--text);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          line-height: 1.6;
          scroll-behavior: smooth;
        }
        .lp a { text-decoration: none; color: inherit; }

        /* NAV */
        .lp-nav {
          position: sticky; top: 0; z-index: 100;
          background: rgba(13,20,16,0.93); backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          padding: 0 24px;
        }
        .lp-nav-inner {
          max-width: 1100px; margin: 0 auto; height: 64px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .lp-logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 17px; color: var(--gold); }
        .lp-logo-icon {
          width: 34px; height: 34px; background: var(--gold2); border-radius: 8px;
          display: flex; align-items: center; justify-content: center; font-size: 18px;
        }
        .lp-nav-links { display: flex; align-items: center; gap: 8px; }
        .lp-nav-links a:not(.lp-btn) {
          font-size: 14px; color: var(--text2); padding: 8px 14px;
          border-radius: 8px; transition: color .2s, background .2s;
        }
        .lp-nav-links a:not(.lp-btn):hover { color: var(--text); background: rgba(5,150,105,.07); }
        .lp-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: #059669; color: #fff; font-size: 14px; font-weight: 600;
          padding: 9px 20px; border-radius: 9px; border: none; cursor: pointer;
          transition: background .2s, transform .15s; text-decoration: none;
        }
        .lp-btn:hover { background: #047857; transform: translateY(-1px); color: #fff; }
        .lp-btn-outline {
          background: transparent; border: 1px solid var(--border2); color: var(--text2);
        }
        .lp-btn-outline:hover { background: rgba(5,150,105,.06); color: var(--text); }
        .lp-btn-lg { font-size: 16px; padding: 13px 28px; border-radius: 11px; }

        /* HERO */
        .lp-hero {
          position: relative; overflow: hidden;
          padding: 100px 24px 80px; text-align: center;
        }
        .lp-hero::before {
          content: ''; position: absolute; top: -100px; left: 50%;
          transform: translateX(-50%); width: 800px; height: 500px;
          background: radial-gradient(ellipse, rgba(5,150,105,.06) 0%, transparent 70%);
          pointer-events: none;
        }
        .lp-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(52,211,153,.12); border: 1px solid rgba(52,211,153,.35);
          color: var(--gold2); font-size: 13px; font-weight: 500;
          padding: 5px 14px; border-radius: 99px; margin-bottom: 28px;
        }
        .lp-hero h1 {
          font-size: clamp(36px, 6vw, 64px); font-weight: 800;
          line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 22px;
          max-width: 800px; margin-left: auto; margin-right: auto;
          color: var(--text);
        }
        .lp-hero h1 span { color: var(--gold); }
        .lp-hero p {
          font-size: clamp(16px, 2.5vw, 20px); color: var(--text2);
          max-width: 560px; margin: 0 auto 40px;
        }
        .lp-hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

        /* MOCKUP */
        .lp-mockup-wrap { max-width: 900px; margin: 64px auto 0; padding: 0 24px; }
        .lp-mockup {
          background: var(--card); border: 1px solid var(--border); border-radius: 16px;
          overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.55), 0 0 0 1px var(--border);
        }
        .lp-mockup-bar {
          background: var(--bg2); border-bottom: 1px solid var(--border);
          padding: 12px 16px; display: flex; align-items: center; gap: 8px;
        }
        .lp-dot { width: 10px; height: 10px; border-radius: 50%; }
        .lp-dot-r { background: #ef4444; } .lp-dot-y { background: #f59e0b; } .lp-dot-g { background: #22c55e; }
        .lp-mockup-url {
          flex: 1; background: rgba(5,150,105,.07); border-radius: 6px;
          height: 24px; margin: 0 12px; display: flex; align-items: center; padding: 0 10px;
        }
        .lp-mockup-url span { font-size: 11px; color: var(--text3); }
        .lp-mockup-body { display: flex; height: 360px; }
        .lp-mock-sidebar {
          width: 180px; background: var(--green); border-right: none;
          padding: 16px 12px; flex-shrink: 0;
        }
        .lp-mock-logo {
          font-size: 13px; font-weight: 700; color: rgba(255,255,255,.9);
          padding: 4px 8px 14px; border-bottom: 1px solid rgba(255,255,255,.15); margin-bottom: 10px;
        }
        .lp-mock-item {
          display: flex; align-items: center; gap: 8px; padding: 7px 8px;
          border-radius: 7px; font-size: 12px; color: rgba(255,255,255,.55); margin-bottom: 2px;
        }
        .lp-mock-item.active { background: rgba(255,255,255,.15); color: #ffffff; }
        .lp-mock-content { flex: 1; padding: 20px; overflow: hidden; background: var(--bg); }
        .lp-mock-title { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 16px; }
        .lp-mock-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 16px; }
        .lp-mock-card {
          background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 12px;
        }
        .lp-mock-card-label { font-size: 10px; color: var(--text3); margin-bottom: 4px; }
        .lp-mock-card-val { font-size: 20px; font-weight: 700; color: var(--gold); }
        .lp-mock-card-icon { font-size: 16px; margin-bottom: 4px; }
        .lp-mock-rows { display: flex; flex-direction: column; gap: 8px; }
        .lp-mock-row {
          background: var(--card); border: 1px solid var(--border); border-radius: 8px;
          padding: 9px 12px; display: flex; justify-content: space-between; align-items: center;
        }
        .lp-mock-row-text { font-size: 11px; color: var(--text2); }
        .lp-mock-badge { font-size: 10px; padding: 2px 7px; border-radius: 99px; background: rgba(52,211,153,.15); color: var(--gold2); }
        .lp-mock-badge.green { background: rgba(5,150,105,.12); color: var(--gold); }

        /* SECTIONS */
        .lp-section { padding: 80px 24px; }
        .lp-container { max-width: 1100px; margin: 0 auto; }
        .lp-section-label {
          display: inline-block; font-size: 12px; font-weight: 600;
          letter-spacing: .08em; text-transform: uppercase; color: var(--gold2); margin-bottom: 12px;
        }
        .lp-section-title {
          font-size: clamp(26px, 4vw, 40px); font-weight: 800;
          letter-spacing: -.02em; line-height: 1.15; margin-bottom: 16px; color: var(--text);
        }
        .lp-section-sub { font-size: 17px; color: var(--text2); max-width: 520px; }
        .lp-center { text-align: center; }
        .lp-center .lp-section-sub { margin: 0 auto; }

        /* STATS */
        .lp-stats { background: var(--green); border-top: none; border-bottom: none; }
        .lp-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); }
        .lp-stat { padding: 40px 32px; border-right: 1px solid rgba(255,255,255,.15); text-align: center; }
        .lp-stat:last-child { border-right: none; }
        .lp-stat-val { font-size: 40px; font-weight: 800; color: var(--gold); line-height: 1; margin-bottom: 8px; }
        .lp-stat-label { font-size: 14px; color: rgba(255,255,255,.88); }

        /* FEATURES */
        .lp-features-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(300px,1fr));
          gap: 16px; margin-top: 52px;
        }
        .lp-feat {
          background: var(--card); border: 1px solid var(--border); border-radius: 16px;
          padding: 28px; transition: border-color .2s, box-shadow .2s, transform .2s;
        }
        .lp-feat:hover { border-color: var(--border2); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.35); }
        .lp-feat-icon {
          width: 48px; height: 48px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; margin-bottom: 18px;
        }
        .fi-green   { background: rgba(5,150,105,.12); }
        .fi-gold    { background: rgba(52,211,153,.12); }
        .fi-sage    { background: rgba(5,150,105,.08); }
        .fi-amber   { background: rgba(52,211,153,.10); }
        .fi-stone   { background: rgba(52,211,153,.10); }
        .fi-warm    { background: rgba(5,150,105,.08); }
        .lp-feat h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; color: var(--text); }
        .lp-feat p  { font-size: 14px; color: var(--text2); line-height: 1.6; }

        /* STEPS */
        .lp-steps { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap: 24px; margin-top: 52px; }
        .lp-step { display: flex; flex-direction: column; align-items: flex-start; }
        .lp-step-num {
          width: 40px; height: 40px; border-radius: 10px; background: var(--gold2); color: #fff;
          font-size: 17px; font-weight: 800; display: flex; align-items: center;
          justify-content: center; margin-bottom: 18px; flex-shrink: 0;
        }
        .lp-step h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; color: var(--text); }
        .lp-step p  { font-size: 14px; color: var(--text2); }

        /* ROLES */
        .lp-roles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px,1fr)); gap: 20px; margin-top: 52px; }
        .lp-role {
          background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 28px;
        }
        .lp-role-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; padding: 4px 12px;
          border-radius: 99px; margin-bottom: 16px;
        }
        .rb-green  { background: rgba(5,150,105,.12);  color: var(--gold2);  border: 1px solid rgba(5,150,105,.22); }
        .rb-gold   { background: rgba(52,211,153,.12); color: var(--gold2);  border: 1px solid rgba(52,211,153,.30); }
        .rb-stone  { background: rgba(52,211,153,.10); color: #4d9678;       border: 1px solid rgba(52,211,153,.25); }
        .lp-role h3 { font-size: 18px; font-weight: 700; margin-bottom: 12px; color: var(--text); }
        .lp-role-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .lp-role-list li { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; color: var(--text2); }
        .lp-role-list li::before { content: '✓'; color: var(--gold); font-weight: 700; flex-shrink: 0; margin-top: 1px; }

        /* DIVIDER */
        .lp-divider { height: 1px; background: linear-gradient(90deg, transparent, var(--border), transparent); max-width: 1100px; margin: 0 auto; }

        /* CTA */
        .lp-cta {
          text-align: center; padding: 100px 24px; position: relative; overflow: hidden;
          background: var(--green);
        }
        .lp-cta h2 { font-size: clamp(28px,5vw,48px); font-weight: 800; margin-bottom: 16px; color: #fff; }
        .lp-cta p { font-size: 18px; color: rgba(255,255,255,.90); margin-bottom: 36px; }
        .lp-cta-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .lp-btn-gold {
          background: var(--gold); color: #fff; border: none;
        }
        .lp-btn-gold:hover { background: var(--gold2); color: #fff; }
        .lp-btn-white {
          background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.3); color: #fff;
        }
        .lp-btn-white:hover { background: rgba(255,255,255,.20); color: #fff; }
        .lp-cta-sub { margin-top: 32px; font-size: 14px; color: rgba(255,255,255,.55); }
        .lp-cta-sub a { color: var(--gold); }

        /* FOOTER */
        .lp-footer { border-top: 1px solid var(--border); padding: 40px 24px; background: var(--bg2); }
        .lp-footer-inner {
          max-width: 1100px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;
        }
        .lp-footer-brand { font-size: 15px; font-weight: 700; color: var(--gold); }
        .lp-footer-tagline { font-size: 13px; color: var(--text3); margin-top: 4px; }
        .lp-footer-links { display: flex; gap: 20px; }
        .lp-footer-links a { font-size: 13px; color: var(--text3); transition: color .2s; }
        .lp-footer-links a:hover { color: var(--text2); }
        .lp-footer-copy { font-size: 12px; color: var(--text3); }

        @media (max-width: 768px) {
          .lp-hide-mobile { display: none !important; }
          .lp-mockup-body { height: auto; flex-direction: column; }
          .lp-mock-sidebar { width: 100%; padding: 10px 12px; display: flex; align-items: center; gap: 12px; height: auto; }
          .lp-mock-logo { border: none; padding: 0; margin: 0; }
          .lp-mock-item { display: none; }
          .lp-mock-item.active { display: flex; }
          .lp-mock-grid { grid-template-columns: repeat(2,1fr); }
          .lp-stats-grid { grid-template-columns: repeat(2,1fr); }
          .lp-stat { border-right: none; border-bottom: 1px solid rgba(255,255,255,.15); }
          .lp-stat:last-child { border-bottom: none; }
          .lp-footer-inner { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="lp">
        {/* NAV */}
        <nav className="lp-nav">
          <div className="lp-nav-inner">
            <Link href="/" className="lp-logo">
              <div className="lp-logo-icon">🏢</div>
              Unity House
            </Link>
            <div className="lp-nav-links">
              <a href="#funkcje" className="lp-hide-mobile">Funkcje</a>
              <a href="#jak-dziala" className="lp-hide-mobile">Jak działa</a>
              <a href="#role" className="lp-hide-mobile">Dla kogo</a>
              <Link href="mailto:unity.housegostyn@gmail.com" className="lp-btn lp-btn-outline lp-hide-mobile">Kontakt</Link>
              <Link href="/login" className="lp-btn">Zaloguj się →</Link>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section className="lp-hero">
          <div className="lp-badge">🏆 Nowoczesne zarządzanie wspólnotą</div>
          <h1>Panel, który <span>łączy zarząd<br />z mieszkańcami</span></h1>
          <p>Ogłoszenia, zgłoszenia usterek, tablica sąsiedzka, dokumenty i kontakty — wszystko w jednym miejscu. Bez zbędnych maili i kartek na klatce.</p>
          <div className="lp-hero-btns">
            <a href="#kontakt" className="lp-btn lp-btn-lg">Skontaktuj się →</a>
            <a href="#funkcje" className="lp-btn lp-btn-lg lp-btn-outline">Zobacz funkcje</a>
          </div>

          {/* MOCKUP */}
          <div className="lp-mockup-wrap">
            <div className="lp-mockup">
              <div className="lp-mockup-bar">
                <div className="lp-dot lp-dot-r" /><div className="lp-dot lp-dot-y" /><div className="lp-dot lp-dot-g" />
                <div className="lp-mockup-url"><span>panel.wspolnota.pl/dashboard</span></div>
              </div>
              <div className="lp-mockup-body">
                <div className="lp-mock-sidebar">
                  <div className="lp-mock-logo">🏢 Wspólnoty</div>
                  <div className="lp-mock-item active">🏠 Dashboard</div>
                  <div className="lp-mock-item">📢 Ogłoszenia</div>
                  <div className="lp-mock-item">🎫 Zgłoszenia</div>
                  <div className="lp-mock-item">💬 Tablica</div>
                  <div className="lp-mock-item">📞 Kontakty</div>
                  <div className="lp-mock-item">📁 Dokumenty</div>
                </div>
                <div className="lp-mock-content">
                  <div className="lp-mock-title">Dzień dobry, Andrzej 👋</div>
                  <div className="lp-mock-grid">
                    <div className="lp-mock-card">
                      <div className="lp-mock-card-icon">🎫</div>
                      <div className="lp-mock-card-label">Otwarte zgłoszenia</div>
                      <div className="lp-mock-card-val">12</div>
                    </div>
                    <div className="lp-mock-card">
                      <div className="lp-mock-card-icon">📢</div>
                      <div className="lp-mock-card-label">Ogłoszenia</div>
                      <div className="lp-mock-card-val">5</div>
                    </div>
                    <div className="lp-mock-card">
                      <div className="lp-mock-card-icon">💬</div>
                      <div className="lp-mock-card-label">Posty na tablicy</div>
                      <div className="lp-mock-card-val">38</div>
                    </div>
                  </div>
                  <div className="lp-mock-rows">
                    <div className="lp-mock-row">
                      <span className="lp-mock-row-text">Awaria windy — blok B</span>
                      <span className="lp-mock-badge">Otwarte</span>
                    </div>
                    <div className="lp-mock-row">
                      <span className="lp-mock-row-text">Nieszczelne okno — kl. 3</span>
                      <span className="lp-mock-badge green">Zamknięte</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <div className="lp-stats">
          <div className="lp-container">
            <div className="lp-stats-grid">
              <div className="lp-stat"><div className="lp-stat-val">100%</div><div className="lp-stat-label">Dostęp z przeglądarki — bez instalacji</div></div>
              <div className="lp-stat"><div className="lp-stat-val">5 min</div><div className="lp-stat-label">Czas wdrożenia dla nowej wspólnoty</div></div>
              <div className="lp-stat"><div className="lp-stat-val">3</div><div className="lp-stat-label">Role: mieszkaniec, admin, super admin</div></div>
              <div className="lp-stat"><div className="lp-stat-val">24/7</div><div className="lp-stat-label">Dostęp dla mieszkańców i zarządu</div></div>
            </div>
          </div>
        </div>

        {/* FEATURES */}
        <section className="lp-section" id="funkcje">
          <div className="lp-container">
            <div className="lp-center">
              <span className="lp-section-label">Funkcje</span>
              <h2 className="lp-section-title">Wszystko czego potrzebuje wspólnota</h2>
              <p className="lp-section-sub">Jeden panel zamiast maili, kartek i telefonów. Zarząd i mieszkańcy w jednym miejscu.</p>
            </div>
            <div className="lp-features-grid">
              {[
                { icon: '📢', cls: 'fi-green',  title: 'Ogłoszenia',          desc: 'Publikuj ogłoszenia dla wybranych wspólnot lub wszystkich mieszkańców. Terminy, archiwum, oznaczanie przeczytanych.' },
                { icon: '🎫', cls: 'fi-gold',   title: 'Zgłoszenia usterek',  desc: 'Mieszkańcy zgłaszają usterki online z opisem i zdjęciem. Zarząd zarządza statusem — aktywne i archiwum w osobnych zakładkach.' },
                { icon: '💬', cls: 'fi-sage',   title: 'Tablica sąsiedzka',   desc: 'Miejsce na ogłoszenia mieszkańców, pytania i dyskusje. Przypinanie ważnych postów, odpowiedzi w wątkach.' },
                { icon: '📞', cls: 'fi-amber',  title: 'Kontakty',            desc: 'Baza kontaktów serwisowych, awaryjnych i zarządcy. Kategorie, numery telefonów i emaile zawsze pod ręką.' },
                { icon: '📁', cls: 'fi-stone',  title: 'Dokumenty',           desc: 'Regulaminy, uchwały, sprawozdania — wszystkie dokumenty wspólnoty w jednym miejscu, dostępne dla uprawnionych.' },
                { icon: '🔒', cls: 'fi-warm',   title: 'Bezpieczeństwo i RODO', desc: 'Szyfrowane połączenie, polityka prywatności, zgodność z RODO. Dane każdej wspólnoty są odseparowane.' },
              ].map(f => (
                <div key={f.title} className="lp-feat">
                  <div className={`lp-feat-icon ${f.cls}`}>{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="lp-divider" />

        {/* HOW IT WORKS */}
        <section className="lp-section" id="jak-dziala">
          <div className="lp-container">
            <div className="lp-center">
              <span className="lp-section-label">Jak to działa</span>
              <h2 className="lp-section-title">Gotowy w 3 krokach</h2>
              <p className="lp-section-sub">Bez skomplikowanej konfiguracji. Od rejestracji do działającego panelu w kilka minut.</p>
            </div>
            <div className="lp-steps">
              {[
                { n: '1', title: 'Zakładamy wspólnotę',       desc: 'Podajesz nazwę wspólnoty, dane zarządu i zapraszasz pierwszych mieszkańców. Zajmuje to dosłownie 5 minut.' },
                { n: '2', title: 'Mieszkańcy się rejestrują', desc: 'Każdy mieszkaniec rejestruje się samodzielnie. Zarząd akceptuje konta jednym kliknięciem — pełna kontrola nad dostępem.' },
                { n: '3', title: 'Zarządzasz z jednego miejsca', desc: 'Ogłoszenia, zgłoszenia, dokumenty i kontakty — dostępne z komputera i telefonu, bez instalowania aplikacji.' },
              ].map(s => (
                <div key={s.n} className="lp-step">
                  <div className="lp-step-num">{s.n}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="lp-divider" />

        {/* ROLES */}
        <section className="lp-section" id="role">
          <div className="lp-container">
            <div className="lp-center">
              <span className="lp-section-label">Dla kogo</span>
              <h2 className="lp-section-title">Każda rola ma swój widok</h2>
              <p className="lp-section-sub">Panel dopasowuje się do tego, kim jesteś. Każdy widzi to, co jest dla niego istotne.</p>
            </div>
            <div className="lp-roles-grid">
              <div className="lp-role">
                <span className="lp-role-badge rb-green">🏢 Zarząd / Administrator</span>
                <h3>Pełna kontrola</h3>
                <ul className="lp-role-list">
                  {['Publikowanie ogłoszeń i dokumentów','Zarządzanie zgłoszeniami usterek','Akceptowanie kont mieszkańców','Dodawanie kontaktów serwisowych','Wgląd w statystyki wspólnoty'].map(i => <li key={i}>{i}</li>)}
                </ul>
              </div>
              <div className="lp-role">
                <span className="lp-role-badge rb-gold">🏠 Mieszkaniec</span>
                <h3>Wszystko pod ręką</h3>
                <ul className="lp-role-list">
                  {['Przeglądanie ogłoszeń zarządu','Zgłaszanie usterek ze zdjęciem','Śledzenie statusu swoich zgłoszeń','Udział w tablicy sąsiedzkiej','Dostęp do dokumentów i kontaktów'].map(i => <li key={i}>{i}</li>)}
                </ul>
              </div>
              <div className="lp-role">
                <span className="lp-role-badge rb-stone">⚡ Super Admin</span>
                <h3>Widok globalny</h3>
                <ul className="lp-role-list">
                  {['Zarządzanie wieloma wspólnotami','Podgląd wszystkich zgłoszeń i postów','Filtrowanie danych per wspólnota','Audit log — pełna historia działań','Zarządzanie kontami administratorów'].map(i => <li key={i}>{i}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="lp-cta" id="kontakt">
          <div className="lp-container">
            <h2>Gotowy na nowoczesną<br />wspólnotę?</h2>
            <p>Skontaktuj się z nami — wdrożymy panel dla Twojej wspólnoty i przeprowadzimy przez każdy krok.</p>
            <div className="lp-cta-btns">
              <a href="mailto:unity.housegostyn@gmail.com" className="lp-btn lp-btn-lg lp-btn-gold">✉️ Napisz do nas</a>
              <a href="tel:536153571" className="lp-btn lp-btn-lg lp-btn-white">📞 536 153 571</a>
            </div>
            <p className="lp-cta-sub">
              Masz pytania? Napisz na <a href="mailto:unity.housegostyn@gmail.com">unity.housegostyn@gmail.com</a>
              {' '}lub odwiedź nas na <a href="https://www.facebook.com/profile.php?id=61576523965878" target="_blank" rel="noopener noreferrer">Facebooku</a>.
            </p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="lp-footer">
          <div className="lp-footer-inner">
            <div>
              <div className="lp-footer-brand">🏢 Unity House Gostyń</div>
              <div className="lp-footer-tagline">Pomagamy Twojej Wspólnocie.</div>
            </div>
            <div className="lp-footer-links">
              <a href="mailto:unity.housegostyn@gmail.com">Email</a>
              <a href="tel:536153571">Telefon</a>
              <a href="https://www.facebook.com/profile.php?id=61576523965878" target="_blank" rel="noopener noreferrer">Facebook</a>
              <Link href="/privacy">Polityka prywatności</Link>
            </div>
            <div className="lp-footer-copy">© 2026 Unity House Gostyń</div>
          </div>
        </footer>
      </div>
    </>
  )
}
