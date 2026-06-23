import Link from 'next/link'

export const metadata = {
  title: 'Unity House Gostyń — Zarządzanie Wspólnotami Mieszkaniowymi',
  description: 'Profesjonalna firma zarządcza i nowoczesny panel cyfrowy. Rozliczenia, finanse, głosowania, liczniki wody — wszystko w jednym miejscu.',
}

export default function LandingPage() {
  return (
    <>
      <style>{`
        .lp *, .lp *::before, .lp *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .lp {
          --bg:      #030f0e;
          --bg2:     #071514;
          --card:    #091918;
          --border:  #0f2d2a;
          --border2: #1a4a45;
          --teal:    #0d9488;
          --teal2:   #0f766e;
          --teal3:   #14b8a6;
          --accent:  #2dd4bf;
          --text:    #f0fdfa;
          --text2:   #99f6e4;
          --text3:   #5eead4;
          --muted:   #4d7c78;
          background: var(--bg);
          color: var(--text);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          line-height: 1.6;
          scroll-behavior: smooth;
        }
        .lp a { text-decoration: none; color: inherit; }

        /* ── NAV ── */
        .lp-nav {
          position: sticky; top: 0; z-index: 100;
          background: rgba(3,15,14,0.94); backdrop-filter: blur(14px);
          border-bottom: 1px solid var(--border);
          padding: 0 24px;
        }
        .lp-nav-inner {
          max-width: 1160px; margin: 0 auto; height: 66px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .lp-logo {
          display: flex; align-items: center; gap: 10px;
          font-weight: 800; font-size: 17px; color: var(--text); letter-spacing: -.02em;
        }
        .lp-logo-icon {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, var(--teal2), var(--teal));
          border-radius: 9px; display: flex; align-items: center;
          justify-content: center; font-size: 18px; flex-shrink: 0;
          box-shadow: 0 0 0 1px rgba(13,148,136,.35);
        }
        .lp-logo-sub { font-size: 11px; font-weight: 500; color: var(--text3); letter-spacing: .03em; display: block; }
        .lp-nav-links { display: flex; align-items: center; gap: 4px; }
        .lp-nav-links a:not(.lp-btn) {
          font-size: 14px; color: var(--muted); padding: 8px 14px;
          border-radius: 8px; transition: color .18s, background .18s;
        }
        .lp-nav-links a:not(.lp-btn):hover { color: var(--text2); background: rgba(13,148,136,.08); }
        .lp-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 14px; font-weight: 600; padding: 9px 20px;
          border-radius: 9px; border: none; cursor: pointer;
          transition: background .18s, transform .15s, box-shadow .18s; text-decoration: none;
          background: var(--teal2); color: #fff;
        }
        .lp-btn:hover { background: var(--teal); transform: translateY(-1px); color: #fff; box-shadow: 0 4px 16px rgba(13,148,136,.35); }
        .lp-btn-outline { background: transparent; border: 1px solid var(--border2); color: var(--text3); }
        .lp-btn-outline:hover { background: rgba(13,148,136,.08); color: var(--text); box-shadow: none; }
        .lp-btn-lg { font-size: 16px; padding: 14px 30px; border-radius: 11px; }
        .lp-btn-white { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.25); color: #fff; }
        .lp-btn-white:hover { background: rgba(255,255,255,.18); color: #fff; box-shadow: none; }

        /* ── HERO ── */
        .lp-hero {
          position: relative; overflow: hidden;
          padding: 90px 24px 70px; text-align: center;
        }
        .lp-hero::before {
          content: ''; position: absolute; top: -60px; left: 50%;
          transform: translateX(-50%); width: 1000px; height: 600px;
          background: radial-gradient(ellipse, rgba(13,148,136,.09) 0%, transparent 65%);
          pointer-events: none;
        }
        .lp-hero::after {
          content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, var(--border), transparent);
        }
        .lp-badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(45,212,191,.1); border: 1px solid rgba(45,212,191,.28);
          color: var(--accent); font-size: 13px; font-weight: 600;
          padding: 5px 15px; border-radius: 99px; margin-bottom: 30px;
          letter-spacing: .01em;
        }
        .lp-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .lp-hero h1 {
          font-size: clamp(38px, 6.5vw, 68px); font-weight: 900;
          line-height: 1.07; letter-spacing: -0.04em; margin-bottom: 24px;
          max-width: 860px; margin-left: auto; margin-right: auto;
          color: var(--text);
        }
        .lp-hero h1 .hl { color: var(--teal3); }
        .lp-hero h1 .hl2 {
          background: linear-gradient(90deg, var(--teal3), var(--accent));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-hero-lead {
          font-size: clamp(16px, 2.2vw, 20px); color: var(--muted);
          max-width: 580px; margin: 0 auto 42px; line-height: 1.65;
        }
        .lp-hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 16px; }
        .lp-hero-trust { font-size: 13px; color: var(--muted); margin-top: 18px; }
        .lp-hero-trust span { color: var(--teal3); font-weight: 600; }

        /* ── MOCKUP ── */
        .lp-mockup-wrap { max-width: 960px; margin: 56px auto 0; padding: 0 24px; }
        .lp-mockup {
          background: var(--card); border: 1px solid var(--border); border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 0 0 1px var(--border), 0 24px 64px rgba(0,0,0,.65), 0 0 80px rgba(13,148,136,.05);
        }
        .lp-mockup-bar {
          background: var(--bg2); border-bottom: 1px solid var(--border);
          padding: 12px 18px; display: flex; align-items: center; gap: 8px;
        }
        .lp-dot { width: 11px; height: 11px; border-radius: 50%; }
        .lp-dot-r { background: #ef4444; } .lp-dot-y { background: #f59e0b; } .lp-dot-g { background: #22c55e; }
        .lp-mockup-url {
          flex: 1; background: rgba(13,148,136,.06); border-radius: 7px; border: 1px solid var(--border);
          height: 26px; margin: 0 14px; display: flex; align-items: center; padding: 0 12px; gap: 6px;
        }
        .lp-url-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
        .lp-mockup-url span { font-size: 11px; color: var(--muted); }
        .lp-mockup-body { display: flex; height: 400px; }
        .lp-mock-sidebar {
          width: 200px; background: #051110; border-right: 1px solid var(--border);
          padding: 16px 12px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px;
        }
        .lp-mock-logo {
          font-size: 13px; font-weight: 700; color: var(--text);
          padding: 4px 8px 14px; border-bottom: 1px solid var(--border); margin-bottom: 10px;
          display: flex; align-items: center; gap: 8px;
        }
        .lp-mock-logo-icon { width: 22px; height: 22px; background: var(--teal2); border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
        .lp-mock-item {
          display: flex; align-items: center; gap: 9px; padding: 7px 10px;
          border-radius: 8px; font-size: 12px; color: var(--muted);
        }
        .lp-mock-item.active { background: rgba(13,148,136,.15); color: var(--text2); font-weight: 600; }
        .lp-mock-section { font-size: 10px; font-weight: 600; letter-spacing: .08em; color: #2a4f4c; padding: 12px 10px 4px; text-transform: uppercase; }
        .lp-mock-content { flex: 1; padding: 22px; overflow: hidden; background: var(--bg); }
        .lp-mock-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .lp-mock-title { font-size: 17px; font-weight: 700; color: var(--text); }
        .lp-mock-subtitle { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .lp-mock-minibadge { font-size: 10px; padding: 3px 9px; border-radius: 99px; background: rgba(13,148,136,.15); color: var(--teal3); border: 1px solid rgba(13,148,136,.25); }
        .lp-mock-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 16px; }
        .lp-mock-card {
          background: var(--card); border: 1px solid var(--border); border-radius: 11px; padding: 12px;
        }
        .lp-mock-card-label { font-size: 10px; color: var(--muted); margin-bottom: 5px; }
        .lp-mock-card-val { font-size: 22px; font-weight: 800; color: var(--teal3); line-height: 1; }
        .lp-mock-card-delta { font-size: 10px; color: #22c55e; margin-top: 3px; }
        .lp-mock-chart {
          background: var(--card); border: 1px solid var(--border); border-radius: 11px;
          padding: 14px; display: flex; align-items: flex-end; gap: 6px; height: 90px;
          margin-bottom: 12px;
        }
        .lp-mock-bar {
          flex: 1; border-radius: 4px 4px 0 0; background: rgba(13,148,136,.25);
          position: relative; min-height: 12px;
        }
        .lp-mock-bar.hi { background: var(--teal2); }
        .lp-mock-rows { display: flex; flex-direction: column; gap: 7px; }
        .lp-mock-row {
          background: var(--card); border: 1px solid var(--border); border-radius: 8px;
          padding: 9px 12px; display: flex; justify-content: space-between; align-items: center;
        }
        .lp-mock-row-text { font-size: 11px; color: var(--text2); }
        .lp-mock-row-sub { font-size: 10px; color: var(--muted); margin-top: 1px; }
        .lp-mock-badge { font-size: 10px; padding: 2px 8px; border-radius: 99px; }
        .mb-green { background: rgba(13,148,136,.15); color: var(--teal3); border: 1px solid rgba(13,148,136,.2); }
        .mb-amber { background: rgba(245,158,11,.12); color: #f59e0b; border: 1px solid rgba(245,158,11,.2); }
        .mb-blue  { background: rgba(59,130,246,.12); color: #60a5fa; border: 1px solid rgba(59,130,246,.2); }

        /* ── LOGOS / TRUST ── */
        .lp-trust {
          padding: 32px 24px;
          border-bottom: 1px solid var(--border);
        }
        .lp-trust-inner { max-width: 1160px; margin: 0 auto; }
        .lp-trust-label { font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; text-align: center; margin-bottom: 20px; }
        .lp-trust-items { display: flex; gap: 40px; justify-content: center; flex-wrap: wrap; align-items: center; }
        .lp-trust-item {
          display: flex; align-items: center; gap: 10px;
          font-size: 14px; font-weight: 600; color: var(--muted);
          opacity: .65; transition: opacity .2s;
        }
        .lp-trust-item:hover { opacity: 1; }
        .lp-trust-icon { font-size: 20px; }

        /* ── STATS ── */
        .lp-stats { background: linear-gradient(180deg, var(--bg2) 0%, var(--bg) 100%); }
        .lp-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); max-width: 1160px; margin: 0 auto; }
        .lp-stat {
          padding: 44px 32px; border-right: 1px solid var(--border);
          text-align: center; position: relative;
        }
        .lp-stat:last-child { border-right: none; }
        .lp-stat-val { font-size: 44px; font-weight: 900; color: var(--teal3); line-height: 1; margin-bottom: 10px; letter-spacing: -.03em; }
        .lp-stat-label { font-size: 14px; color: var(--muted); line-height: 1.4; }

        /* ── SECTIONS ── */
        .lp-section { padding: 88px 24px; }
        .lp-section-alt { background: var(--bg2); }
        .lp-container { max-width: 1160px; margin: 0 auto; }
        .lp-section-label {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
          color: var(--teal3); margin-bottom: 14px;
        }
        .lp-section-label::before { content: ''; width: 18px; height: 2px; background: var(--teal2); border-radius: 2px; }
        .lp-section-title {
          font-size: clamp(28px, 4vw, 44px); font-weight: 900;
          letter-spacing: -.03em; line-height: 1.1; margin-bottom: 18px; color: var(--text);
        }
        .lp-section-sub { font-size: 18px; color: var(--muted); max-width: 540px; line-height: 1.6; }
        .lp-center { text-align: center; }
        .lp-center .lp-section-sub { margin: 0 auto; }

        /* ── DUAL OFFER ── */
        .lp-dual { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 52px; }
        .lp-dual-card {
          background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 36px;
          position: relative; overflow: hidden;
          transition: border-color .2s, box-shadow .2s;
        }
        .lp-dual-card:hover { border-color: var(--border2); box-shadow: 0 8px 32px rgba(0,0,0,.4); }
        .lp-dual-card-glow {
          position: absolute; top: -40px; right: -40px; width: 180px; height: 180px;
          border-radius: 50%; pointer-events: none;
        }
        .glow-a { background: radial-gradient(circle, rgba(13,148,136,.12) 0%, transparent 70%); }
        .glow-b { background: radial-gradient(circle, rgba(45,212,191,.08) 0%, transparent 70%); }
        .lp-dual-tag {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
          padding: 4px 14px; border-radius: 99px; margin-bottom: 20px;
        }
        .tag-a { background: rgba(13,148,136,.12); color: var(--teal3); border: 1px solid rgba(13,148,136,.25); }
        .tag-b { background: rgba(45,212,191,.1); color: var(--accent); border: 1px solid rgba(45,212,191,.22); }
        .lp-dual-card h3 { font-size: 24px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 12px; color: var(--text); }
        .lp-dual-card p { font-size: 15px; color: var(--muted); line-height: 1.65; margin-bottom: 24px; }
        .lp-dual-list { list-style: none; display: flex; flex-direction: column; gap: 9px; margin-bottom: 28px; }
        .lp-dual-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--text2); }
        .lp-dual-list li::before { content: '→'; color: var(--teal2); font-weight: 700; flex-shrink: 0; margin-top: 1px; }

        /* ── FEATURES ── */
        .lp-features-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(320px,1fr));
          gap: 16px; margin-top: 52px;
        }
        .lp-feat {
          background: var(--card); border: 1px solid var(--border); border-radius: 16px;
          padding: 28px 28px 26px;
          transition: border-color .2s, transform .2s, box-shadow .2s;
          position: relative; overflow: hidden;
        }
        .lp-feat:hover { border-color: var(--border2); transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,.4); }
        .lp-feat-icon {
          width: 50px; height: 50px; border-radius: 13px;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; margin-bottom: 18px; flex-shrink: 0;
        }
        .fi-a { background: rgba(13,148,136,.14); }
        .fi-b { background: rgba(45,212,191,.1); }
        .fi-c { background: rgba(20,184,166,.1); }
        .fi-d { background: rgba(13,148,136,.1); }
        .fi-e { background: rgba(45,212,191,.12); }
        .fi-f { background: rgba(20,184,166,.12); }
        .fi-g { background: rgba(13,148,136,.1); }
        .fi-h { background: rgba(45,212,191,.08); }
        .fi-i { background: rgba(20,184,166,.08); }
        .lp-feat h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; color: var(--text); }
        .lp-feat p  { font-size: 14px; color: var(--muted); line-height: 1.6; }
        .lp-feat-new {
          position: absolute; top: 16px; right: 16px;
          font-size: 10px; font-weight: 700; letter-spacing: .05em;
          background: rgba(45,212,191,.14); color: var(--accent); border: 1px solid rgba(45,212,191,.25);
          padding: 2px 8px; border-radius: 99px;
        }

        /* ── TWO-COL ── */
        .lp-twocol { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .lp-twocol-rev { direction: rtl; }
        .lp-twocol-rev > * { direction: ltr; }
        .lp-twocol-visual {
          background: var(--card); border: 1px solid var(--border); border-radius: 18px;
          padding: 28px; min-height: 280px;
          box-shadow: 0 12px 40px rgba(0,0,0,.4);
        }
        .lp-list-check { list-style: none; display: flex; flex-direction: column; gap: 14px; margin: 24px 0 32px; }
        .lp-list-check li { display: flex; align-items: flex-start; gap: 12px; font-size: 15px; color: var(--text2); }
        .lp-check-icon { width: 22px; height: 22px; border-radius: 6px; background: rgba(13,148,136,.18); display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; margin-top: 1px; }

        /* ── TIMELINE / STEPS ── */
        .lp-steps { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px,1fr)); gap: 28px; margin-top: 52px; }
        .lp-step {
          display: flex; flex-direction: column; align-items: flex-start;
          padding: 28px; background: var(--card); border: 1px solid var(--border); border-radius: 16px;
        }
        .lp-step-num {
          width: 42px; height: 42px; border-radius: 11px;
          background: linear-gradient(135deg, var(--teal2), var(--teal));
          color: #fff; font-size: 18px; font-weight: 900;
          display: flex; align-items: center; justify-content: center; margin-bottom: 18px;
        }
        .lp-step h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; color: var(--text); }
        .lp-step p  { font-size: 14px; color: var(--muted); }

        /* ── TESTIMONIAL ── */
        .lp-testimonials { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px,1fr)); gap: 20px; margin-top: 48px; }
        .lp-testi {
          background: var(--card); border: 1px solid var(--border); border-radius: 16px;
          padding: 28px; position: relative;
        }
        .lp-testi-quote { font-size: 32px; color: var(--teal2); line-height: 1; margin-bottom: 14px; font-family: Georgia, serif; }
        .lp-testi p { font-size: 15px; color: var(--text2); line-height: 1.65; margin-bottom: 20px; }
        .lp-testi-author { display: flex; align-items: center; gap: 10px; }
        .lp-testi-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--teal2); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
        .lp-testi-name { font-size: 14px; font-weight: 700; color: var(--text); }
        .lp-testi-role { font-size: 12px; color: var(--muted); }
        .lp-stars { color: #f59e0b; font-size: 13px; letter-spacing: 1px; margin-bottom: 14px; }

        /* ── DIVIDER ── */
        .lp-divider { height: 1px; background: linear-gradient(90deg, transparent, var(--border), transparent); }

        /* ── CTA ── */
        .lp-cta {
          text-align: center; padding: 110px 24px; position: relative; overflow: hidden;
          background: linear-gradient(180deg, var(--bg2) 0%, var(--bg) 100%);
        }
        .lp-cta::before {
          content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
          width: 700px; height: 400px;
          background: radial-gradient(ellipse, rgba(13,148,136,.11) 0%, transparent 68%);
          pointer-events: none;
        }
        .lp-cta h2 { font-size: clamp(30px,5vw,52px); font-weight: 900; margin-bottom: 16px; color: var(--text); letter-spacing: -.03em; }
        .lp-cta h2 span { color: var(--teal3); }
        .lp-cta p { font-size: 18px; color: var(--muted); margin-bottom: 40px; max-width: 500px; margin-left: auto; margin-right: auto; }
        .lp-cta-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .lp-cta-sub { margin-top: 28px; font-size: 14px; color: var(--muted); }
        .lp-cta-sub a { color: var(--teal3); font-weight: 500; }

        /* ── CONTACT BLOCK ── */
        .lp-contact-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px,1fr)); gap: 16px; margin-top: 44px; }
        .lp-contact-card {
          background: var(--card); border: 1px solid var(--border); border-radius: 16px;
          padding: 28px; text-align: center;
          transition: border-color .2s, transform .2s;
        }
        .lp-contact-card:hover { border-color: var(--border2); transform: translateY(-2px); }
        .lp-contact-icon { font-size: 28px; margin-bottom: 12px; }
        .lp-contact-card h4 { font-size: 14px; font-weight: 700; color: var(--text2); margin-bottom: 6px; letter-spacing: .02em; text-transform: uppercase; font-size: 12px; }
        .lp-contact-card a { font-size: 17px; font-weight: 700; color: var(--teal3); display: block; margin-bottom: 8px; }
        .lp-contact-card p { font-size: 13px; color: var(--muted); }

        /* ── FOOTER ── */
        .lp-footer { border-top: 1px solid var(--border); padding: 44px 24px; background: var(--bg2); }
        .lp-footer-inner {
          max-width: 1160px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;
        }
        .lp-footer-brand { display: flex; align-items: center; gap: 9px; }
        .lp-footer-brand-icon { width: 30px; height: 30px; background: var(--teal2); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .lp-footer-brand-name { font-size: 15px; font-weight: 700; color: var(--text); }
        .lp-footer-tagline { font-size: 12px; color: var(--muted); margin-top: 3px; }
        .lp-footer-links { display: flex; gap: 20px; flex-wrap: wrap; }
        .lp-footer-links a { font-size: 13px; color: var(--muted); transition: color .2s; }
        .lp-footer-links a:hover { color: var(--text2); }
        .lp-footer-copy { font-size: 12px; color: var(--muted); }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .lp-dual { grid-template-columns: 1fr; }
          .lp-twocol { grid-template-columns: 1fr; gap: 40px; }
          .lp-twocol-rev { direction: ltr; }
          .lp-stats-grid { grid-template-columns: repeat(2,1fr); }
          .lp-stat { border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
          .lp-stat:nth-child(2n) { border-right: none; }
          .lp-stat:nth-last-child(-n+2) { border-bottom: none; }
        }
        @media (max-width: 768px) {
          .lp-hide-mobile { display: none !important; }
          .lp-mock-grid { grid-template-columns: repeat(2,1fr); }
          .lp-mockup-body { height: auto; flex-direction: column; }
          .lp-mock-sidebar { width: 100%; flex-direction: row; padding: 10px 14px; gap: 10px; }
          .lp-mock-section, .lp-mock-item:not(.active) { display: none; }
          .lp-footer-inner { flex-direction: column; align-items: flex-start; }
        }
        @media (max-width: 480px) {
          .lp-stats-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="lp">

        {/* ── NAV ── */}
        <nav className="lp-nav">
          <div className="lp-nav-inner">
            <Link href="/" className="lp-logo">
              <div className="lp-logo-icon">🏢</div>
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
          <div className="lp-badge">
            <span className="lp-badge-dot" />
            Firma zarządcza & platforma cyfrowa — Gostyń
          </div>
          <h1>
            Twoja wspólnota<br />
            w <span className="hl2">profesjonalnych rękach</span>
          </h1>
          <p className="lp-hero-lead">
            Unity House to zarządca nieruchomości z Gostynia i twórca nowoczesnego panelu cyfrowego.
            Zajmujemy się Twoją wspólnotą kompleksowo — od rozliczeń i finansów po głosowania i dokumenty.
          </p>
          <div className="lp-hero-btns">
            <a href="#kontakt" className="lp-btn lp-btn-lg">📞 Zleć zarządzanie</a>
            <a href="#funkcje" className="lp-btn lp-btn-lg lp-btn-outline">Zobacz panel →</a>
          </div>
          <p className="lp-hero-trust">
            <span>✓</span> Bez zobowiązań &nbsp;&nbsp;
            <span>✓</span> Wdrożenie w 1 dzień &nbsp;&nbsp;
            <span>✓</span> Pełna obsługa
          </p>

          {/* MOCKUP — financial dashboard */}
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
                  <div className="lp-mock-item active">🏠 Dashboard</div>
                  <div className="lp-mock-item">📢 Ogłoszenia</div>
                  <div className="lp-mock-section">Finanse</div>
                  <div className="lp-mock-item">💰 Koszty</div>
                  <div className="lp-mock-item">📈 Przychody</div>
                  <div className="lp-mock-item">🏦 Lokaty</div>
                  <div className="lp-mock-section">Wspólnota</div>
                  <div className="lp-mock-item">🗳 Głosowania</div>
                  <div className="lp-mock-item">🌊 Liczniki</div>
                  <div className="lp-mock-item">📊 Raporty</div>
                </div>
                <div className="lp-mock-content">
                  <div className="lp-mock-header">
                    <div>
                      <div className="lp-mock-title">Stan finansowy wspólnoty</div>
                      <div className="lp-mock-subtitle">Czerwiec 2026 · Wspólnota Gostyń</div>
                    </div>
                    <div className="lp-mock-minibadge">● Live</div>
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
                      <div className="lp-mock-card-delta">↓ -1.1%</div>
                    </div>
                    <div className="lp-mock-card">
                      <div className="lp-mock-card-label">Zaległości</div>
                      <div className="lp-mock-card-val">2 100</div>
                      <div className="lp-mock-card-delta">3 lokale</div>
                    </div>
                  </div>
                  <div className="lp-mock-chart">
                    {[38,55,45,60,48,70,58,80,65,90,72,85].map((h, i) => (
                      <div key={i} className={`lp-mock-bar${i >= 8 ? ' hi' : ''}`} style={{ height: `${h}%` }} />
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
                    <div className="lp-mock-row">
                      <div>
                        <div className="lp-mock-row-text">Import wyciągu bankowego — maj 2026</div>
                        <div className="lp-mock-row-sub">42 operacje · auto-kategoryzacja</div>
                      </div>
                      <span className="lp-mock-badge mb-blue">Zaimportowano</span>
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
        <section className="lp-section" id="oferta">
          <div className="lp-container">
            <div className="lp-center">
              <span className="lp-section-label">Nasza oferta</span>
              <h2 className="lp-section-title">Dwa sposoby współpracy</h2>
              <p className="lp-section-sub">Możesz zlecić nam zarządzanie Twoją wspólnotą lub wdrożyć nasz panel jako narzędzie dla swojego biura.</p>
            </div>
            <div className="lp-dual">
              <div className="lp-dual-card">
                <div className="lp-dual-card-glow glow-a" />
                <span className="lp-dual-tag tag-a">🏢 Dla wspólnot</span>
                <h3>Zleć nam zarządzanie</h3>
                <p>Profesjonalna obsługa Twojej wspólnoty mieszkaniowej — zajmujemy się wszystkim, Ty masz spokój. Rozliczenia, kontakty z wykonawcami, dokumentacja, zebrania.</p>
                <ul className="lp-dual-list">
                  <li>Pełna obsługa administracyjna i finansowa</li>
                  <li>Rozliczenia czynszów i funduszu remontowego</li>
                  <li>Organizacja zebrań i głosowań uchwał</li>
                  <li>Kontakt z wykonawcami i nadzór nad naprawami</li>
                  <li>Panel cyfrowy dla mieszkańców w cenie</li>
                  <li>Raporty i sprawozdania co miesiąc</li>
                </ul>
                <a href="#kontakt" className="lp-btn lp-btn-lg">Zapytaj o ofertę →</a>
              </div>
              <div className="lp-dual-card">
                <div className="lp-dual-card-glow glow-b" />
                <span className="lp-dual-tag tag-b">💻 Dla zarządców</span>
                <h3>Wdróż nasz panel</h3>
                <p>Zarządzasz wieloma wspólnotami i potrzebujesz nowoczesnego narzędzia? Nasz panel działa dla wielu wspólnot jednocześnie — jeden ekran, pełna kontrola.</p>
                <ul className="lp-dual-list">
                  <li>Multi-wspólnota: zarządzaj dziesiątkami naraz</li>
                  <li>Moduł finansowy: koszty, przychody, lokaty, import CSV</li>
                  <li>Elektroniczne głosowania z audytem (UoWL)</li>
                  <li>Rozliczenia per lokal z historią i raportami</li>
                  <li>Liczniki wody, zawiadomienia o opłatach</li>
                  <li>Branding pod Twoje biuro zarządcze</li>
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
                { icon: '💰', cls: 'fi-a', title: 'Finanse i budżet',        new: false, desc: 'Koszty, przychody, fundusz eksploatacyjny i remontowy. Import wyciągów bankowych z auto-kategoryzacją. Raporty miesięczne i roczne.' },
                { icon: '🧾', cls: 'fi-b', title: 'Rozliczenia per lokal',   new: false, desc: 'Naliczanie czynszów, historia wpłat, saldo otwarcia. Zawiadomienia o opłatach do wydruku lub PDF dla każdego lokalu.' },
                { icon: '🗳',  cls: 'fi-c', title: 'Głosowania uchwał',       new: false, desc: 'Elektroniczne głosowania z PINem, udziałem lub jednym głosem per lokal. Protokół zgodny z UoWL, raport do pobrania.' },
                { icon: '🌊', cls: 'fi-d', title: 'Liczniki wody',           new: false, desc: 'Mieszkańcy zgłaszają odczyty online. Automatyczne rozliczenie różnicy — ryczałt vs. rzeczywiste zużycie, nota kwartalna.' },
                { icon: '🏦', cls: 'fi-e', title: 'Lokaty bankowe',          new: true,  desc: 'Ewidencja lokat terminowych. Automatyczne naliczanie odsetek (po podatku Belki) i księgowanie do przychodów po zakończeniu.' },
                { icon: '📢', cls: 'fi-f', title: 'Ogłoszenia i wiadomości', new: false, desc: 'Publikuj ogłoszenia dla całej wspólnoty lub wybranych grup. Mailing bezpośrednio z panelu, historia przeczytanych.' },
                { icon: '🎫', cls: 'fi-g', title: 'Zgłoszenia i wnioski',   new: false, desc: 'Mieszkańcy zgłaszają usterki i wnioski online. Zarząd zarządza statusem, dodaje notatki i odpowiedzi.' },
                { icon: '📁', cls: 'fi-h', title: 'Dokumenty i regulaminy', new: false, desc: 'Regulaminy, uchwały, protokoły — bezpiecznie przechowywane w chmurze. Dostęp per wspólnota, AI asystent nad dokumentami.' },
                { icon: '📊', cls: 'fi-i', title: 'Raporty i sprawozdania', new: false, desc: 'Sprawozdanie finansowe, zestawienie zadłużeń, rozliczenie per lokal. Eksport do PDF i Excel jednym kliknięciem.' },
              ].map(f => (
                <div key={f.title} className="lp-feat">
                  {f.new && <span className="lp-feat-new">NOWE</span>}
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
                { n: '1', title: 'Kontakt i wycena',        desc: 'Dzwonisz lub piszesz — w ciągu 24h oddzwaniamy z wyceną dopasowaną do liczby lokali i zakresu usług.' },
                { n: '2', title: 'Zakładamy wspólnotę',     desc: 'Konfigurujemy panel: dane wspólnoty, lokale, stawki. Jeśli masz stare dane — importujemy je z Excela lub CSV.' },
                { n: '3', title: 'Mieszkańcy się logują',   desc: 'Wysyłamy zaproszenia emailem lub przez link rejestracyjny. Konta aktywujesz jednym kliknięciem.' },
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
              <div className="lp-testi">
                <div className="lp-stars">★★★★★</div>
                <div className="lp-testi-quote">"</div>
                <p>Wreszcie widzę wszystkie ogłoszenia zarządu i status mojego zgłoszenia bez dzwonienia do biura. Wszystko w telefonie.</p>
                <div className="lp-testi-author">
                  <div className="lp-testi-avatar">👩</div>
                  <div>
                    <div className="lp-testi-name">Anna K.</div>
                    <div className="lp-testi-role">Mieszkaniec · ul. Różana, Gostyń</div>
                  </div>
                </div>
              </div>
              <div className="lp-testi">
                <div className="lp-stars">★★★★★</div>
                <div className="lp-testi-quote">"</div>
                <p>Import wyciągu z banku i automatyczna kategoryzacja kosztów to oszczędność 2 godzin miesięcznie. Polecam każdemu zarządcy.</p>
                <div className="lp-testi-author">
                  <div className="lp-testi-avatar">👨</div>
                  <div>
                    <div className="lp-testi-name">Marek W.</div>
                    <div className="lp-testi-role">Administrator · Zarządca nieruchomości</div>
                  </div>
                </div>
              </div>
              <div className="lp-testi">
                <div className="lp-stars">★★★★★</div>
                <div className="lp-testi-quote">"</div>
                <p>Głosowanie elektroniczne przeszło bez żadnych problemów. Protokół wygenerowany automatycznie, podpisany — gotowy na akta.</p>
                <div className="lp-testi-author">
                  <div className="lp-testi-avatar">👩</div>
                  <div>
                    <div className="lp-testi-name">Zofia P.</div>
                    <div className="lp-testi-role">Przewodnicząca zarządu wspólnoty</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="lp-cta" id="kontakt">
          <div className="lp-container" style={{ position: 'relative' }}>
            <h2>Zacznij dziś.<br /><span>Twoja wspólnota zasługuje na więcej.</span></h2>
            <p>Napisz lub zadzwoń — omówimy szczegóły i bezpłatnie wdrożymy panel dla Twojej wspólnoty.</p>
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
            <p className="lp-cta-sub" style={{ marginTop: 40 }}>
              Masz panel i chcesz się zalogować? <Link href="/login" style={{ color: 'var(--teal3)', fontWeight: 600 }}>Przejdź do panelu →</Link>
            </p>
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
