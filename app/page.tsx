import Link from 'next/link'

export const metadata = {
  title: 'Unity House Gostyń — Zarządzanie Wspólnotami Mieszkaniowymi',
  description: 'Profesjonalna firma zarządcza i nowoczesny panel cyfrowy. Rozliczenia, finanse, głosowania, liczniki wody — wszystko w jednym miejscu.',
}

export default function LandingPage() {
  return (
    <>
      <style>{`
        /* ── RESET & BASE ─────────────────────────────────────────── */
        .lp *, .lp *::before, .lp *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .lp {
          --white:   #ffffff;
          --bg:      #f8fafc;
          --bg2:     #f1f5f9;
          --card:    #ffffff;
          --border:  #e2e8f0;
          --border2: #cbd5e1;
          --teal:    #0d9488;
          --teal2:   #0f766e;
          --teal3:   #14b8a6;
          --teal-lt: #f0fdfa;
          --text:    #0f172a;
          --text2:   #334155;
          --text3:   #64748b;
          --muted:   #94a3b8;
          background: var(--white);
          color: var(--text);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          line-height: 1.6;
          scroll-behavior: smooth;
        }
        .lp a { text-decoration: none; color: inherit; }

        /* ── NAV ─────────────────────────────────────────────────── */
        .lp-nav {
          position: sticky; top: 0; z-index: 100;
          background: rgba(255,255,255,.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
        }
        .lp-nav-inner {
          max-width: 1160px; margin: 0 auto; height: 66px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px;
        }
        .lp-logo {
          display: flex; align-items: center; gap: 10px;
          font-weight: 800; font-size: 17px; color: var(--text); letter-spacing: -.02em;
        }
        .lp-logo-icon {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #0f766e, #0d9488);
          border-radius: 10px; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(13,148,136,.3);
        }
        .lp-logo-sub { font-size: 11px; font-weight: 500; color: var(--text3); letter-spacing: .03em; display: block; }
        .lp-nav-links { display: flex; align-items: center; gap: 2px; }
        .lp-nav-links a:not(.lp-btn) {
          font-size: 14px; color: var(--text3); padding: 8px 14px;
          border-radius: 8px; transition: color .15s, background .15s;
        }
        .lp-nav-links a:not(.lp-btn):hover { color: var(--text); background: var(--bg); }
        .lp-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 14px; font-weight: 600; padding: 9px 20px;
          border-radius: 10px; cursor: pointer;
          transition: background .15s, transform .12s, box-shadow .15s;
          background: var(--teal2); color: #fff; border: none;
        }
        .lp-btn:hover { background: var(--teal); transform: translateY(-1px); color: #fff; box-shadow: 0 4px 14px rgba(13,148,136,.28); }
        .lp-btn-outline {
          background: transparent; border: 1.5px solid var(--border2); color: var(--text2);
          box-shadow: none;
        }
        .lp-btn-outline:hover { background: var(--bg); color: var(--text); box-shadow: none; transform: none; }
        .lp-btn-lg { font-size: 15px; padding: 13px 28px; border-radius: 12px; }
        .lp-btn-outline-lg { background: var(--white); border: 1.5px solid var(--border2); color: var(--text2); }
        .lp-btn-outline-lg:hover { background: var(--bg); box-shadow: none; transform: none; color: var(--text); }

        /* ── HERO ────────────────────────────────────────────────── */
        .lp-hero {
          padding: 96px 24px 72px; text-align: center;
          background: linear-gradient(180deg, #fff 0%, var(--bg) 100%);
          position: relative; overflow: hidden;
        }
        .lp-hero-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image: radial-gradient(circle, #e2e8f0 1px, transparent 1px);
          background-size: 32px 32px; opacity: .5;
        }
        .lp-hero-glow {
          position: absolute; top: -80px; left: 50%; transform: translateX(-50%);
          width: 900px; height: 600px;
          background: radial-gradient(ellipse, rgba(13,148,136,.07) 0%, transparent 65%);
          pointer-events: none;
        }
        .lp-badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: var(--teal-lt); border: 1px solid rgba(13,148,136,.25);
          color: var(--teal2); font-size: 13px; font-weight: 600;
          padding: 5px 14px; border-radius: 99px; margin-bottom: 28px;
        }
        .lp-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--teal); animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        .lp-hero h1 {
          font-size: clamp(36px, 6vw, 64px); font-weight: 900;
          line-height: 1.05; letter-spacing: -.04em;
          margin-bottom: 22px; max-width: 820px; margin-left: auto; margin-right: auto;
          color: var(--text);
        }
        .lp-hero h1 .hl {
          background: linear-gradient(90deg, #0f766e, #0d9488, #14b8a6);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-hero-lead {
          font-size: clamp(16px, 2vw, 19px); color: var(--text3);
          max-width: 560px; margin: 0 auto 40px; line-height: 1.65;
        }
        .lp-hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .lp-hero-trust {
          display: flex; gap: 24px; justify-content: center; flex-wrap: wrap;
          margin-top: 28px; font-size: 13px; color: var(--text3);
        }
        .lp-hero-trust span { color: var(--teal); font-weight: 600; }

        /* ── MOCKUP ──────────────────────────────────────────────── */
        .lp-mockup-wrap { max-width: 1000px; margin: 60px auto 0; padding: 0 24px; }
        .lp-mockup {
          background: var(--white); border: 1px solid var(--border); border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,.04), 0 24px 80px rgba(0,0,0,.10), 0 0 0 1px var(--border);
        }
        .lp-mockup-bar {
          background: var(--bg); border-bottom: 1px solid var(--border);
          padding: 12px 18px; display: flex; align-items: center; gap: 8px;
        }
        .lp-dot { width: 11px; height: 11px; border-radius: 50%; }
        .lp-dot-r { background: #ef4444; } .lp-dot-y { background: #f59e0b; } .lp-dot-g { background: #22c55e; }
        .lp-mockup-url {
          flex: 1; background: var(--white); border-radius: 7px; border: 1px solid var(--border);
          height: 26px; margin: 0 14px; display: flex; align-items: center; padding: 0 12px; gap: 6px;
        }
        .lp-url-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
        .lp-mockup-url span { font-size: 11px; color: var(--muted); }
        .lp-mockup-body { display: flex; height: 380px; }

        /* Sidebar */
        .lp-mock-sidebar {
          width: 192px; background: var(--white); border-right: 1px solid var(--border);
          padding: 14px 10px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px;
        }
        .lp-mock-logo {
          font-size: 12px; font-weight: 700; color: var(--text);
          padding: 4px 6px 12px; border-bottom: 1px solid var(--border); margin-bottom: 10px;
          display: flex; align-items: center; gap: 8px;
        }
        .lp-mock-logo-icon {
          width: 26px; height: 26px; background: linear-gradient(135deg,#0f766e,#0d9488);
          border-radius: 7px; display: flex; align-items: center; justify-content: center;
          font-size: 13px; color: white;
        }
        .lp-mock-item {
          display: flex; align-items: center; gap: 8px; padding: 6px 10px;
          border-radius: 8px; font-size: 11.5px; color: var(--text3);
        }
        .lp-mock-icon {
          width: 24px; height: 24px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;
          background: var(--bg);
        }
        .lp-mock-item.active {
          background: #0d9488; color: white; font-weight: 600;
        }
        .lp-mock-item.active .lp-mock-icon { background: rgba(255,255,255,.2); }
        .lp-mock-section { font-size: 9.5px; font-weight: 600; letter-spacing: .08em; color: var(--muted); padding: 10px 10px 3px; text-transform: uppercase; }

        /* Content */
        .lp-mock-content { flex: 1; padding: 20px; overflow: hidden; background: var(--bg); }
        .lp-mock-topbar {
          background: var(--white); border-radius: 10px; padding: 8px 14px; margin-bottom: 16px;
          display: flex; align-items: center; justify-content: space-between;
          border: 1px solid var(--border);
        }
        .lp-mock-welcome { font-size: 13px; font-weight: 700; color: var(--text); }
        .lp-mock-date { font-size: 10px; color: var(--muted); }
        .lp-mock-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 12px; }
        .lp-mock-card {
          background: var(--white); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px;
        }
        .lp-mock-card-label { font-size: 9.5px; color: var(--muted); margin-bottom: 4px; }
        .lp-mock-card-val { font-size: 20px; font-weight: 800; color: var(--text); line-height: 1; }
        .lp-mock-card-delta { font-size: 9px; color: #0d9488; margin-top: 2px; font-weight: 600; }
        .lp-mock-chart {
          background: var(--white); border: 1px solid var(--border); border-radius: 10px;
          padding: 10px 14px; display: flex; align-items: flex-end; gap: 4px; height: 76px;
          margin-bottom: 10px;
        }
        .lp-mock-bar {
          flex: 1; border-radius: 4px 4px 0 0; background: #e2e8f0;
          position: relative; min-height: 10px;
        }
        .lp-mock-bar.hi { background: #0d9488; }
        .lp-mock-rows { display: flex; flex-direction: column; gap: 6px; }
        .lp-mock-row {
          background: var(--white); border: 1px solid var(--border); border-radius: 8px;
          padding: 7px 10px; display: flex; justify-content: space-between; align-items: center;
        }
        .lp-mock-row-text { font-size: 10px; font-weight: 600; color: var(--text2); }
        .lp-mock-row-sub { font-size: 9px; color: var(--muted); margin-top: 1px; }
        .lp-mock-badge { font-size: 9.5px; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
        .mb-green { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .mb-amber { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
        .mb-blue  { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }

        /* ── TRUST ───────────────────────────────────────────────── */
        .lp-trust { padding: 28px 24px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); background: var(--bg); }
        .lp-trust-inner { max-width: 1160px; margin: 0 auto; }
        .lp-trust-label { font-size: 11.5px; font-weight: 600; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; text-align: center; margin-bottom: 18px; }
        .lp-trust-items { display: flex; gap: 36px; justify-content: center; flex-wrap: wrap; align-items: center; }
        .lp-trust-item {
          display: flex; align-items: center; gap: 8px;
          font-size: 13.5px; font-weight: 600; color: var(--text3);
        }
        .lp-trust-icon { font-size: 18px; }

        /* ── STATS ───────────────────────────────────────────────── */
        .lp-stats { background: var(--white); }
        .lp-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); max-width: 1160px; margin: 0 auto; }
        .lp-stat {
          padding: 44px 32px; border-right: 1px solid var(--border);
          text-align: center;
        }
        .lp-stat:last-child { border-right: none; }
        .lp-stat-val { font-size: 42px; font-weight: 900; color: var(--teal); line-height: 1; margin-bottom: 8px; letter-spacing: -.03em; }
        .lp-stat-label { font-size: 14px; color: var(--text3); line-height: 1.45; }

        /* ── SECTIONS ────────────────────────────────────────────── */
        .lp-section { padding: 88px 24px; }
        .lp-section-alt { background: var(--bg); }
        .lp-container { max-width: 1160px; margin: 0 auto; }
        .lp-section-label {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
          color: var(--teal); margin-bottom: 12px;
        }
        .lp-section-label::before { content: ''; width: 18px; height: 2px; background: var(--teal); border-radius: 2px; }
        .lp-section-title {
          font-size: clamp(26px, 3.5vw, 42px); font-weight: 900;
          letter-spacing: -.03em; line-height: 1.1; margin-bottom: 16px; color: var(--text);
        }
        .lp-section-sub { font-size: 17px; color: var(--text3); max-width: 540px; line-height: 1.65; }
        .lp-center { text-align: center; }
        .lp-center .lp-section-sub { margin: 0 auto; }

        /* ── DUAL OFFER ──────────────────────────────────────────── */
        .lp-dual { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 48px; }
        .lp-dual-card {
          border: 1.5px solid var(--border); border-radius: 20px; padding: 36px;
          position: relative; overflow: hidden; background: var(--white);
          transition: border-color .2s, box-shadow .2s, transform .2s;
        }
        .lp-dual-card:hover { border-color: var(--teal3); box-shadow: 0 8px 32px rgba(13,148,136,.12); transform: translateY(-2px); }
        .lp-dual-card-glow {
          position: absolute; top: -40px; right: -40px; width: 200px; height: 200px;
          border-radius: 50%; pointer-events: none;
        }
        .glow-a { background: radial-gradient(circle, rgba(13,148,136,.07) 0%, transparent 70%); }
        .glow-b { background: radial-gradient(circle, rgba(20,184,166,.05) 0%, transparent 70%); }
        .lp-dual-tag {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
          padding: 4px 12px; border-radius: 99px; margin-bottom: 18px;
        }
        .tag-a { background: var(--teal-lt); color: var(--teal2); border: 1px solid rgba(13,148,136,.2); }
        .tag-b { background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; }
        .lp-dual-card h3 { font-size: 23px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 10px; color: var(--text); }
        .lp-dual-card p { font-size: 15px; color: var(--text3); line-height: 1.65; margin-bottom: 22px; }
        .lp-dual-list { list-style: none; display: flex; flex-direction: column; gap: 8px; margin-bottom: 26px; }
        .lp-dual-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--text2); }
        .lp-dual-li-dot { width: 18px; height: 18px; border-radius: 50%; background: var(--teal-lt); border: 1.5px solid rgba(13,148,136,.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
        .lp-dual-li-dot::after { content: ''; width: 5px; height: 5px; border-radius: 50%; background: var(--teal); }

        /* ── FEATURES ────────────────────────────────────────────── */
        .lp-features-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(300px,1fr));
          gap: 14px; margin-top: 48px;
        }
        .lp-feat {
          background: var(--white); border: 1.5px solid var(--border); border-radius: 16px;
          padding: 26px; position: relative; overflow: hidden;
          transition: border-color .2s, transform .2s, box-shadow .2s;
        }
        .lp-feat:hover { border-color: rgba(13,148,136,.35); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.07); }
        .lp-feat-icon {
          width: 46px; height: 46px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; margin-bottom: 16px;
        }
        .fi-a { background: var(--teal-lt); }
        .fi-b { background: #fff7ed; }
        .fi-c { background: #f5f3ff; }
        .fi-d { background: #eff6ff; }
        .fi-e { background: #f0fdf4; }
        .fi-f { background: #fdf4ff; }
        .fi-g { background: #fff1f2; }
        .fi-h { background: #f0f9ff; }
        .fi-i { background: #fffbeb; }
        .lp-feat h3 { font-size: 16px; font-weight: 700; margin-bottom: 7px; color: var(--text); }
        .lp-feat p  { font-size: 13.5px; color: var(--text3); line-height: 1.6; }
        .lp-feat-new {
          position: absolute; top: 14px; right: 14px;
          font-size: 9.5px; font-weight: 700; letter-spacing: .04em;
          background: #fef3c7; color: #d97706; border: 1px solid #fde68a;
          padding: 2px 7px; border-radius: 99px; text-transform: uppercase;
        }

        /* ── STEPS ───────────────────────────────────────────────── */
        .lp-steps { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px,1fr)); gap: 20px; margin-top: 48px; }
        .lp-step {
          padding: 28px; background: var(--white); border: 1.5px solid var(--border);
          border-radius: 16px; transition: border-color .2s, box-shadow .2s;
        }
        .lp-step:hover { border-color: rgba(13,148,136,.3); box-shadow: 0 4px 16px rgba(0,0,0,.06); }
        .lp-step-num {
          width: 40px; height: 40px; border-radius: 10px;
          background: linear-gradient(135deg, #0f766e, #0d9488);
          color: #fff; font-size: 18px; font-weight: 900;
          display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
          box-shadow: 0 4px 12px rgba(13,148,136,.3);
        }
        .lp-step h3 { font-size: 16px; font-weight: 700; margin-bottom: 7px; color: var(--text); }
        .lp-step p  { font-size: 13.5px; color: var(--text3); line-height: 1.6; }

        /* ── TESTIMONIALS ────────────────────────────────────────── */
        .lp-testimonials { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px,1fr)); gap: 16px; margin-top: 44px; }
        .lp-testi {
          background: var(--white); border: 1.5px solid var(--border); border-radius: 16px;
          padding: 26px; transition: box-shadow .2s;
        }
        .lp-testi:hover { box-shadow: 0 6px 24px rgba(0,0,0,.07); }
        .lp-stars { color: #f59e0b; font-size: 13px; letter-spacing: 2px; margin-bottom: 14px; }
        .lp-testi p { font-size: 14.5px; color: var(--text2); line-height: 1.7; margin-bottom: 18px; }
        .lp-testi-author { display: flex; align-items: center; gap: 10px; }
        .lp-testi-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg,#0f766e,#14b8a6);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }
        .lp-testi-name { font-size: 13px; font-weight: 700; color: var(--text); }
        .lp-testi-role { font-size: 12px; color: var(--muted); }

        /* ── DIVIDER ─────────────────────────────────────────────── */
        .lp-divider { height: 1px; background: var(--border); }

        /* ── CTA ─────────────────────────────────────────────────── */
        .lp-cta {
          text-align: center; padding: 96px 24px;
          background: linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%);
          position: relative; overflow: hidden;
        }
        .lp-cta::before {
          content: ''; position: absolute; top: -80px; left: -80px;
          width: 300px; height: 300px; border-radius: 50%;
          background: rgba(255,255,255,.08); pointer-events: none;
        }
        .lp-cta::after {
          content: ''; position: absolute; bottom: -60px; right: -60px;
          width: 240px; height: 240px; border-radius: 50%;
          background: rgba(255,255,255,.06); pointer-events: none;
        }
        .lp-cta h2 { font-size: clamp(28px,4.5vw,48px); font-weight: 900; margin-bottom: 14px; color: #fff; letter-spacing: -.03em; position: relative; }
        .lp-cta p { font-size: 17px; color: rgba(255,255,255,.8); margin-bottom: 36px; max-width: 480px; margin-left: auto; margin-right: auto; position: relative; }
        .lp-cta-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; position: relative; }
        .lp-btn-white { background: #fff; color: var(--teal2); border: none; font-weight: 700; }
        .lp-btn-white:hover { background: #f0fdf4; color: var(--teal2); box-shadow: 0 4px 16px rgba(0,0,0,.15); }
        .lp-btn-ghost { background: rgba(255,255,255,.15); color: #fff; border: 1.5px solid rgba(255,255,255,.35); }
        .lp-btn-ghost:hover { background: rgba(255,255,255,.22); color: #fff; box-shadow: none; transform: none; }
        .lp-cta-sub { margin-top: 28px; font-size: 13px; color: rgba(255,255,255,.65); position: relative; }
        .lp-cta-sub a { color: rgba(255,255,255,.9); font-weight: 600; text-decoration: underline; }

        /* ── CONTACT ─────────────────────────────────────────────── */
        .lp-contact-section { padding: 80px 24px; background: var(--white); }
        .lp-contact-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px,1fr)); gap: 14px; margin-top: 40px; }
        .lp-contact-card {
          background: var(--bg); border: 1.5px solid var(--border); border-radius: 16px;
          padding: 26px; text-align: center;
          transition: border-color .2s, transform .2s, box-shadow .2s;
        }
        .lp-contact-card:hover { border-color: rgba(13,148,136,.3); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.07); }
        .lp-contact-icon {
          width: 52px; height: 52px; border-radius: 14px;
          background: var(--teal-lt); border: 1px solid rgba(13,148,136,.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; margin: 0 auto 14px;
        }
        .lp-contact-card h4 { font-size: 11.5px; font-weight: 700; color: var(--muted); margin-bottom: 6px; letter-spacing: .06em; text-transform: uppercase; }
        .lp-contact-card a { font-size: 16px; font-weight: 700; color: var(--teal2); display: block; margin-bottom: 6px; transition: color .15s; }
        .lp-contact-card a:hover { color: var(--teal); }
        .lp-contact-card p { font-size: 13px; color: var(--text3); }

        /* ── FOOTER ──────────────────────────────────────────────── */
        .lp-footer { border-top: 1px solid var(--border); padding: 40px 24px; background: var(--bg); }
        .lp-footer-inner {
          max-width: 1160px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;
        }
        .lp-footer-brand { display: flex; align-items: center; gap: 10px; }
        .lp-footer-brand-icon {
          width: 32px; height: 32px; background: linear-gradient(135deg,#0f766e,#0d9488);
          border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px;
        }
        .lp-footer-brand-name { font-size: 15px; font-weight: 700; color: var(--text); }
        .lp-footer-tagline { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .lp-footer-links { display: flex; gap: 20px; flex-wrap: wrap; }
        .lp-footer-links a { font-size: 13px; color: var(--text3); transition: color .15s; }
        .lp-footer-links a:hover { color: var(--teal); }
        .lp-footer-copy { font-size: 12px; color: var(--muted); }

        /* ── RESPONSIVE ──────────────────────────────────────────── */
        @media (max-width: 900px) {
          .lp-dual { grid-template-columns: 1fr; }
          .lp-stats-grid { grid-template-columns: repeat(2,1fr); }
          .lp-stat { border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
          .lp-stat:nth-child(2n) { border-right: none; }
          .lp-stat:nth-last-child(-n+2) { border-bottom: none; }
        }
        @media (max-width: 768px) {
          .lp-hide-mobile { display: none !important; }
          .lp-mockup-body { height: auto; flex-direction: column; }
          .lp-mock-sidebar { width: 100%; flex-direction: row; padding: 10px 14px; }
          .lp-mock-section, .lp-mock-item:not(.active) { display: none; }
          .lp-mock-grid { grid-template-columns: repeat(2,1fr); }
          .lp-footer-inner { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="lp">

        {/* ── NAV ── */}
        <nav className="lp-nav">
          <div className="lp-nav-inner">
            <Link href="/" className="lp-logo">
              <div className="lp-logo-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M3 10h18M3 7l9-4 9 4" fill="white" fillOpacity=".25" stroke="none"/>
                  <path d="M3 21h18M3 10h18"/><polyline points="3 7 12 2 21 7"/>
                  <rect x="4" y="10" width="2" height="11"/><rect x="11" y="10" width="2" height="11"/><rect x="18" y="10" width="2" height="11"/>
                </svg>
              </div>
              <div>
                Unity House
                <span className="lp-logo-sub">Gostyń</span>
              </div>
            </Link>
            <div className="lp-nav-links">
              <a href="#oferta" className="lp-hide-mobile">Oferta</a>
              <a href="#funkcje" className="lp-hide-mobile">Panel</a>
              <a href="#kontakt" className="lp-hide-mobile">Kontakt</a>
              <a href="mailto:unity.housegostyn@gmail.com" className="lp-btn lp-btn-outline lp-hide-mobile">✉ Napisz</a>
              <Link href="/login" className="lp-btn">Zaloguj się →</Link>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className="lp-hero">
          <div className="lp-hero-grid" />
          <div className="lp-hero-glow" />

          <div style={{ position: 'relative' }}>
            <div className="lp-badge">
              <span className="lp-badge-dot" />
              Firma zarządcza &amp; platforma cyfrowa — Gostyń
            </div>
            <h1>
              Twoja wspólnota<br />
              w <span className="hl">profesjonalnych rękach</span>
            </h1>
            <p className="lp-hero-lead">
              Unity House to zarządca nieruchomości z Gostynia i twórca nowoczesnego panelu cyfrowego.
              Rozliczenia, finanse, głosowania i dokumenty — wszystko w jednym miejscu.
            </p>
            <div className="lp-hero-btns">
              <a href="#kontakt" className="lp-btn lp-btn-lg">📞 Zleć zarządzanie</a>
              <Link href="/demo" className="lp-btn lp-btn-outline-lg lp-btn-lg">▶ Zobacz demo →</Link>
            </div>
            <div className="lp-hero-trust">
              <span><span>✓</span> Bez zobowiązań</span>
              <span><span>✓</span> Wdrożenie w 1 dzień</span>
              <span><span>✓</span> Pełna obsługa</span>
              <span><span>✓</span> RODO compliant</span>
            </div>
          </div>

          {/* MOCKUP */}
          <div className="lp-mockup-wrap">
            <div className="lp-mockup">
              <div className="lp-mockup-bar">
                <div className="lp-dot lp-dot-r" /><div className="lp-dot lp-dot-y" /><div className="lp-dot lp-dot-g" />
                <div className="lp-mockup-url">
                  <div className="lp-url-dot" />
                  <span>unity-house.pl/admin/dashboard</span>
                </div>
              </div>
              <div className="lp-mockup-body">
                <div className="lp-mock-sidebar">
                  <div className="lp-mock-logo">
                    <div className="lp-mock-logo-icon">🏢</div>
                    Unity House
                  </div>
                  <div className="lp-mock-item active">
                    <div className="lp-mock-icon">🏠</div> Dashboard
                  </div>
                  <div className="lp-mock-item">
                    <div className="lp-mock-icon">📢</div> Ogłoszenia
                  </div>
                  <div className="lp-mock-section">Finanse</div>
                  <div className="lp-mock-item">
                    <div className="lp-mock-icon">💰</div> Koszty
                  </div>
                  <div className="lp-mock-item">
                    <div className="lp-mock-icon">📈</div> Przychody
                  </div>
                  <div className="lp-mock-item">
                    <div className="lp-mock-icon">🏦</div> Lokaty
                  </div>
                  <div className="lp-mock-section">Wspólnota</div>
                  <div className="lp-mock-item">
                    <div className="lp-mock-icon">🗳</div> Głosowania
                  </div>
                  <div className="lp-mock-item">
                    <div className="lp-mock-icon">🌊</div> Liczniki
                  </div>
                </div>
                <div className="lp-mock-content">
                  <div className="lp-mock-topbar">
                    <div className="lp-mock-welcome">Dzień dobry, Andrzej 👋</div>
                    <div className="lp-mock-date">piątek, 4 lipca 2026</div>
                  </div>
                  <div className="lp-mock-grid">
                    <div className="lp-mock-card">
                      <div className="lp-mock-card-label">Saldo konta</div>
                      <div className="lp-mock-card-val">48 240</div>
                      <div className="lp-mock-card-delta">↑ zł fundusz</div>
                    </div>
                    <div className="lp-mock-card">
                      <div className="lp-mock-card-label">Przychody (mies.)</div>
                      <div className="lp-mock-card-val">12 800</div>
                      <div className="lp-mock-card-delta">↑ +4.2%</div>
                    </div>
                    <div className="lp-mock-card">
                      <div className="lp-mock-card-label">Koszty (mies.)</div>
                      <div className="lp-mock-card-val">9 340</div>
                      <div className="lp-mock-card-delta" style={{color:'#ef4444'}}>↓ -1.1%</div>
                    </div>
                    <div className="lp-mock-card">
                      <div className="lp-mock-card-label">Zaległości</div>
                      <div className="lp-mock-card-val">2 100</div>
                      <div className="lp-mock-card-delta" style={{color:'#f59e0b'}}>3 lokale</div>
                    </div>
                  </div>
                  <div className="lp-mock-chart">
                    {[38,55,45,60,48,70,58,80,65,90,72,88].map((h, i) => (
                      <div key={i} className={`lp-mock-bar${i >= 9 ? ' hi' : ''}`} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="lp-mock-rows">
                    <div className="lp-mock-row">
                      <div>
                        <div className="lp-mock-row-text">Uchwała nr 3/2026 — fundusz remontowy</div>
                        <div className="lp-mock-row-sub">Głosowanie · 14 z 18 lokali</div>
                      </div>
                      <span className="lp-mock-badge mb-green">Przyjęta</span>
                    </div>
                    <div className="lp-mock-row">
                      <div>
                        <div className="lp-mock-row-text">Odczyt licznika — lokal 7, kl. A</div>
                        <div className="lp-mock-row-sub">Licznik wody · 3.24 m³</div>
                      </div>
                      <span className="lp-mock-badge mb-amber">Oczekuje</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TRUST ── */}
        <div className="lp-trust">
          <div className="lp-trust-inner">
            <div className="lp-trust-label">Zaufali nam mieszkańcy i zarządcy</div>
            <div className="lp-trust-items">
              <div className="lp-trust-item"><span className="lp-trust-icon">🔐</span> RODO i bezpieczeństwo</div>
              <div className="lp-trust-item"><span className="lp-trust-icon">⚖️</span> Zgodność z UoWL</div>
              <div className="lp-trust-item"><span className="lp-trust-icon">🇵🇱</span> Polski system</div>
              <div className="lp-trust-item"><span className="lp-trust-icon">📱</span> PWA — działa jak app</div>
              <div className="lp-trust-item"><span className="lp-trust-icon">🏦</span> Import z banku</div>
              <div className="lp-trust-item"><span className="lp-trust-icon">🤖</span> AI asystent</div>
            </div>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="lp-stats">
          <div className="lp-stats-grid">
            <div className="lp-stat"><div className="lp-stat-val">100%</div><div className="lp-stat-label">Z przeglądarki — zero instalacji, działa na telefonie</div></div>
            <div className="lp-stat"><div className="lp-stat-val">1 dzień</div><div className="lp-stat-label">Wdrożenie nowej wspólnoty od podstaw</div></div>
            <div className="lp-stat"><div className="lp-stat-val">25+</div><div className="lp-stat-label">Modułów: finanse, głosowania, liczniki i więcej</div></div>
            <div className="lp-stat"><div className="lp-stat-val">24/7</div><div className="lp-stat-label">Dostęp dla mieszkańców, zarządu i zarządcy</div></div>
          </div>
        </div>

        {/* ── DUAL OFFER ── */}
        <section className="lp-section lp-section-alt" id="oferta">
          <div className="lp-container">
            <div className="lp-center">
              <span className="lp-section-label">Nasza oferta</span>
              <h2 className="lp-section-title">Dwa sposoby współpracy</h2>
              <p className="lp-section-sub">Możesz zlecić nam zarządzanie Twoją wspólnotą lub wdrożyć nasz panel jako narzędzie dla swojego biura zarządczego.</p>
            </div>
            <div className="lp-dual">
              <div className="lp-dual-card">
                <div className="lp-dual-card-glow glow-a" />
                <span className="lp-dual-tag tag-a">🏢 Dla wspólnot</span>
                <h3>Zleć nam zarządzanie</h3>
                <p>Profesjonalna obsługa Twojej wspólnoty mieszkaniowej — zajmujemy się wszystkim, Ty masz spokój. Rozliczenia, kontakty z wykonawcami, dokumentacja, zebrania.</p>
                <ul className="lp-dual-list">
                  {['Pełna obsługa administracyjna i finansowa','Rozliczenia czynszów i funduszu remontowego','Organizacja zebrań i głosowań uchwał','Kontakt z wykonawcami i nadzór nad naprawami','Panel cyfrowy dla mieszkańców w cenie','Raporty i sprawozdania co miesiąc'].map(li => (
                    <li key={li}><span className="lp-dual-li-dot" />{li}</li>
                  ))}
                </ul>
                <a href="#kontakt" className="lp-btn lp-btn-lg">Zapytaj o ofertę →</a>
              </div>
              <div className="lp-dual-card">
                <div className="lp-dual-card-glow glow-b" />
                <span className="lp-dual-tag tag-b">💻 Dla zarządców</span>
                <h3>Wdróż nasz panel</h3>
                <p>Zarządzasz wieloma wspólnotami i potrzebujesz nowoczesnego narzędzia? Nasz panel działa dla wielu wspólnot jednocześnie — jeden ekran, pełna kontrola.</p>
                <ul className="lp-dual-list">
                  {['Multi-wspólnota: zarządzaj dziesiątkami naraz','Moduł finansowy: koszty, przychody, lokaty, import CSV','Elektroniczne głosowania z audytem (UoWL)','Rozliczenia per lokal z historią i raportami','Liczniki wody, zawiadomienia o opłatach','Branding pod Twoje biuro zarządcze'].map(li => (
                    <li key={li}><span className="lp-dual-li-dot" />{li}</li>
                  ))}
                </ul>
                <a href="#kontakt" className="lp-btn lp-btn-lg lp-btn-outline">Porozmawiajmy →</a>
              </div>
            </div>
          </div>
        </section>

        <div className="lp-divider" />

        {/* ── FEATURES ── */}
        <section className="lp-section" id="funkcje">
          <div className="lp-container">
            <div className="lp-center">
              <span className="lp-section-label">Panel cyfrowy</span>
              <h2 className="lp-section-title">Wszystko w jednym miejscu</h2>
              <p className="lp-section-sub">Kompletna platforma dla nowoczesnej wspólnoty. Nie tylko komunikacja — pełne zarządzanie finansami i operacjami.</p>
            </div>
            <div className="lp-features-grid">
              {[
                { icon: '💰', cls: 'fi-a', title: 'Finanse i budżet',        isNew: false, desc: 'Koszty, przychody, fundusz eksploatacyjny i remontowy. Import wyciągów bankowych z auto-kategoryzacją. Raporty miesięczne i roczne.' },
                { icon: '🧾', cls: 'fi-b', title: 'Rozliczenia per lokal',   isNew: false, desc: 'Naliczanie czynszów, historia wpłat, saldo otwarcia. Zawiadomienia o opłatach do wydruku lub PDF dla każdego lokalu.' },
                { icon: '🗳',  cls: 'fi-c', title: 'Głosowania uchwał',       isNew: false, desc: 'Elektroniczne głosowania z PINem, udziałem lub jednym głosem per lokal. Protokół zgodny z UoWL, raport do pobrania.' },
                { icon: '🌊', cls: 'fi-d', title: 'Liczniki wody',           isNew: false, desc: 'Mieszkańcy zgłaszają odczyty online. Automatyczne rozliczenie różnicy — ryczałt vs. rzeczywiste zużycie, nota kwartalna.' },
                { icon: '🏦', cls: 'fi-e', title: 'Lokaty bankowe',          isNew: true,  desc: 'Ewidencja lokat terminowych. Automatyczne naliczanie odsetek (po podatku Belki) i księgowanie do przychodów po zakończeniu.' },
                { icon: '📢', cls: 'fi-f', title: 'Ogłoszenia i wiadomości', isNew: false, desc: 'Publikuj ogłoszenia dla całej wspólnoty lub wybranych grup. Mailing bezpośrednio z panelu, historia przeczytanych.' },
                { icon: '🎫', cls: 'fi-g', title: 'Zgłoszenia i wnioski',   isNew: false, desc: 'Mieszkańcy zgłaszają usterki i wnioski online. Zarząd zarządza statusem, dodaje notatki i odpowiedzi.' },
                { icon: '📁', cls: 'fi-h', title: 'Dokumenty i regulaminy', isNew: false, desc: 'Regulaminy, uchwały, protokoły — bezpiecznie przechowywane w chmurze. Dostęp per wspólnota, AI asystent nad dokumentami.' },
                { icon: '📊', cls: 'fi-i', title: 'Raporty i sprawozdania', isNew: false, desc: 'Sprawozdanie finansowe, zestawienie zadłużeń, rozliczenie per lokal. Eksport do PDF i Excel jednym kliknięciem.' },
              ].map(f => (
                <div key={f.title} className="lp-feat">
                  {f.isNew && <span className="lp-feat-new">NOWE</span>}
                  <div className={`lp-feat-icon ${f.cls}`}>{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="lp-divider" />

        {/* ── HOW IT WORKS ── */}
        <section className="lp-section lp-section-alt">
          <div className="lp-container">
            <div className="lp-center">
              <span className="lp-section-label">Jak to działa</span>
              <h2 className="lp-section-title">Gotowi w 4 krokach</h2>
              <p className="lp-section-sub">Przejście z papierowej komunikacji do cyfrowego panelu w ciągu jednego dnia roboczego.</p>
            </div>
            <div className="lp-steps">
              {[
                { n: '1', title: 'Kontakt i wycena',             desc: 'Dzwonisz lub piszesz — w ciągu 24h oddzwaniamy z wyceną dopasowaną do liczby lokali i zakresu usług.' },
                { n: '2', title: 'Zakładamy wspólnotę',          desc: 'Konfigurujemy panel: dane wspólnoty, lokale, stawki. Jeśli masz stare dane — importujemy je z Excela lub CSV.' },
                { n: '3', title: 'Mieszkańcy się logują',        desc: 'Wysyłamy zaproszenia emailem lub przez link rejestracyjny. Konta aktywujesz jednym kliknięciem.' },
                { n: '4', title: 'Zarządzasz z jednego miejsca', desc: 'Finanse, głosowania, rozliczenia, liczniki — panel robi robotę za Ciebie. Ty masz czas na to, co ważne.' },
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

        {/* ── TESTIMONIALS ── */}
        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-center">
              <span className="lp-section-label">Opinie</span>
              <h2 className="lp-section-title">Co mówią mieszkańcy</h2>
            </div>
            <div className="lp-testimonials">
              {[
                { text: 'Wreszcie widzę wszystkie ogłoszenia zarządu i status mojego zgłoszenia bez dzwonienia do biura. Wszystko w telefonie.', name: 'Anna K.', role: 'Mieszkaniec · ul. Różana, Gostyń', avatar: '👩' },
                { text: 'Import wyciągu z banku i automatyczna kategoryzacja kosztów to oszczędność 2 godzin miesięcznie. Polecam każdemu zarządcy.', name: 'Marek W.', role: 'Administrator · Zarządca nieruchomości', avatar: '👨' },
                { text: 'Głosowanie elektroniczne przeszło bez żadnych problemów. Protokół wygenerowany automatycznie, podpisany — gotowy na akta.', name: 'Zofia P.', role: 'Przewodnicząca zarządu wspólnoty', avatar: '👩' },
              ].map(t => (
                <div key={t.name} className="lp-testi">
                  <div className="lp-stars">★★★★★</div>
                  <p>&ldquo;{t.text}&rdquo;</p>
                  <div className="lp-testi-author">
                    <div className="lp-testi-avatar">{t.avatar}</div>
                    <div>
                      <div className="lp-testi-name">{t.name}</div>
                      <div className="lp-testi-role">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="lp-cta">
          <h2>Zacznij dziś.</h2>
          <p>Napisz lub zadzwoń — omówimy szczegóły i bezpłatnie wdrożymy panel dla Twojej wspólnoty.</p>
          <div className="lp-cta-btns">
            <a href="#kontakt" className="lp-btn lp-btn-lg lp-btn-white">📞 Zadzwoń teraz</a>
            <Link href="/demo" className="lp-btn lp-btn-lg lp-btn-ghost">▶ Zobacz demo</Link>
          </div>
          <p className="lp-cta-sub">
            Masz już konto? <Link href="/login">Zaloguj się do panelu →</Link>
          </p>
        </section>

        {/* ── CONTACT ── */}
        <section className="lp-contact-section" id="kontakt">
          <div className="lp-container">
            <div className="lp-center">
              <span className="lp-section-label">Kontakt</span>
              <h2 className="lp-section-title">Skontaktuj się z nami</h2>
              <p className="lp-section-sub">Odpowiadamy szybko. Bezpłatna konsultacja i wycena bez zobowiązań.</p>
            </div>
            <div className="lp-contact-grid">
              <div className="lp-contact-card">
                <div className="lp-contact-icon">📞</div>
                <h4>Telefon</h4>
                <a href="tel:536153571">536 153 571</a>
                <p>Pon.–Pt. 8:00–17:00</p>
              </div>
              <div className="lp-contact-card">
                <div className="lp-contact-icon">✉️</div>
                <h4>Email</h4>
                <a href="mailto:unity.housegostyn@gmail.com">unity.housegostyn<br />@gmail.com</a>
                <p>Odpowiedź w 24h</p>
              </div>
              <div className="lp-contact-card">
                <div className="lp-contact-icon">📘</div>
                <h4>Facebook</h4>
                <a href="https://www.facebook.com/profile.php?id=61576523965878" target="_blank" rel="noopener noreferrer">Unity House Gostyń</a>
                <p>Aktualności i ogłoszenia</p>
              </div>
              <div className="lp-contact-card">
                <div className="lp-contact-icon">🏢</div>
                <h4>Biuro</h4>
                <a href="https://maps.google.com/?q=Gostyń" target="_blank" rel="noopener noreferrer">Gostyń, wlkp.</a>
                <p>Obsługa wspólnot</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="lp-footer">
          <div className="lp-footer-inner">
            <div className="lp-footer-brand">
              <div className="lp-footer-brand-icon">🏢</div>
              <div>
                <div className="lp-footer-brand-name">Unity House Gostyń</div>
                <div className="lp-footer-tagline">Profesjonalne zarządzanie wspólnotami</div>
              </div>
            </div>
            <div className="lp-footer-links">
              <a href="tel:536153571">📞 536 153 571</a>
              <a href="mailto:unity.housegostyn@gmail.com">✉ Email</a>
              <a href="https://www.facebook.com/profile.php?id=61576523965878" target="_blank" rel="noopener noreferrer">Facebook</a>
              <Link href="/privacy">Polityka prywatności</Link>
              <Link href="/login">Panel →</Link>
            </div>
            <div className="lp-footer-copy">© 2026 Unity House Gostyń</div>
          </div>
        </footer>

      </div>
    </>
  )
}
