'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const SCREENS = [
  { id: 'dashboard',    label: 'Dashboard',      icon: '🏠' },
  { id: 'finanse',      label: 'Finanse',         icon: '💰' },
  { id: 'budzet',       label: 'Budżet',          icon: '📋' },
  { id: 'glosowania',   label: 'Głosowania',      icon: '🗳' },
  { id: 'rozliczenia',  label: 'Rozliczenia',     icon: '🧾' },
  { id: 'wezwania',     label: 'Wezwania',        icon: '⚠️' },
  { id: 'liczniki',     label: 'Liczniki wody',   icon: '🌊' },
  { id: 'mieszkaniec',  label: 'Moje konto',      icon: '💳' },
  { id: 'dokumenty',    label: 'Dokumenty',       icon: '📁' },
]

const SIDEBAR_ITEMS = [
  { icon: '🏠', label: 'Dashboard',         id: 'dashboard' },
  { icon: '📢', label: 'Ogłoszenia',        id: null },
  { icon: '🎫', label: 'Zgłoszenia',        id: null },
  { icon: '💬', label: 'Tablica',           id: null },
  { icon: '─',  label: 'FINANSE',           id: null, section: true },
  { icon: '💰', label: 'Koszty',            id: 'finanse' },
  { icon: '📈', label: 'Przychody',         id: 'finanse' },
  { icon: '📋', label: 'Budżet',            id: 'budzet' },
  { icon: '🏦', label: 'Lokaty',            id: 'finanse' },
  { icon: '📊', label: 'Raporty',           id: 'finanse' },
  { icon: '🔒', label: 'Zamknięcie roku',   id: null },
  { icon: '─',  label: 'WSPÓLNOTA',         id: null, section: true },
  { icon: '🗳', label: 'Głosowania',        id: 'glosowania' },
  { icon: '🧾', label: 'Rozliczenia',       id: 'rozliczenia' },
  { icon: '⚠️', label: 'Wezwania',          id: 'wezwania' },
  { icon: '🌊', label: 'Liczniki wody',     id: 'liczniki' },
  { icon: '💳', label: 'Moje konto',        id: 'mieszkaniec' },
  { icon: '📁', label: 'Dokumenty',         id: 'dokumenty' },
  { icon: '👥', label: 'Użytkownicy',       id: null },
]

function AnimNumber({ target, prefix = '', suffix = '', duration = 1200 }: { target: number; prefix?: string; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0)
  const ref = useRef<number>(0)
  useEffect(() => {
    ref.current = 0
    const start = Date.now()
    const tick = () => {
      const pct = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - pct, 3)
      ref.current = Math.round(eased * target)
      setVal(ref.current)
      if (pct < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return <>{prefix}{val.toLocaleString('pl-PL')}{suffix}</>
}

function BarChart({ values, active }: { values: number[]; active: boolean }) {
  const [heights, setHeights] = useState(values.map(() => 0))
  useEffect(() => {
    if (!active) { setHeights(values.map(() => 0)); return }
    const timers = values.map((v, i) => setTimeout(() => setHeights(prev => { const n = [...prev]; n[i] = v; return n }), i * 80))
    return () => timers.forEach(clearTimeout)
  }, [active, values.join(',')])
  const max = Math.max(...values)
  const labels = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '0 4px' }}>
      {values.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', background: i === values.length - 1 ? '#0d9488' : i >= values.length - 3 ? 'rgba(13,148,136,.5)' : 'rgba(13,148,136,.18)', borderRadius: '4px 4px 0 0', height: `${(heights[i] / max) * 100}%`, transition: 'height .5s cubic-bezier(.34,1.56,.64,1)' }} />
          <div style={{ fontSize: 9, color: '#4d7c78', whiteSpace: 'nowrap' }}>{labels[i]}</div>
        </div>
      ))}
    </div>
  )
}

function ScreenDashboard({ active }: { active: boolean }) {
  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', height: '100%', background: '#030f0e' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#f0fdfa', marginBottom: 4 }}>Dzień dobry, Andrzej 👋</div>
        <div style={{ fontSize: 13, color: '#4d7c78' }}>Wspólnota Gostyń · czerwiec 2026</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Saldo konta', val: 48240, suf: ' zł', delta: '↑ fundusz ok', c: '#14b8a6' },
          { label: 'Przychody (mies.)', val: 12800, suf: ' zł', delta: '↑ +4.2%', c: '#22c55e' },
          { label: 'Koszty (mies.)', val: 9340, suf: ' zł', delta: '↓ -1.1%', c: '#f59e0b' },
          { label: 'Otwarte zgłoszenia', val: 4, suf: '', delta: '2 nowe dziś', c: '#60a5fa' },
        ].map(c => (
          <div key={c.label} style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#4d7c78', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.c, lineHeight: 1 }}>
              {active ? <AnimNumber target={c.val} suffix={c.suf} /> : '—'}
            </div>
            <div style={{ fontSize: 11, color: '#4d7c78', marginTop: 4 }}>{c.delta}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#99f6e4', marginBottom: 14 }}>Przychody — 2026</div>
          <BarChart values={[9200,9800,10200,11000,10500,12800,0,0,0,0,0,0].slice(0,6)} active={active} />
        </div>
        <div style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#99f6e4', marginBottom: 12 }}>Ostatnie zdarzenia</div>
          {[
            { t: 'Uchwała nr 3/2026 przyjęta',        s: 'Głosowanie', d: '✅', c: '#14b8a6' },
            { t: 'Import wyciągu bankowego — maj',     s: '42 operacje', d: '📥', c: '#60a5fa' },
            { t: 'Odczyt licznika — lokal 7',          s: '3.24 m³', d: '🌊', c: '#5eead4' },
            { t: 'Nowe zgłoszenie: przeciek rury',     s: 'kl. B, piętro 2', d: '🎫', c: '#f59e0b' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < 3 ? '1px solid #0f2d2a' : 'none' }}>
              <div style={{ fontSize: 16 }}>{r.d}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#f0fdfa' }}>{r.t}</div>
                <div style={{ fontSize: 10, color: '#4d7c78' }}>{r.s}</div>
              </div>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.c }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScreenFinanse({ active }: { active: boolean }) {
  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', height: '100%', background: '#030f0e' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f0fdfa' }}>Finanse wspólnoty</div>
          <div style={{ fontSize: 13, color: '#4d7c78' }}>Czerwiec 2026</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ fontSize: 12, padding: '6px 14px', background: '#091918', border: '1px solid #0f2d2a', borderRadius: 8, color: '#99f6e4', cursor: 'pointer' }}>↓ Eksport Excel</div>
          <div style={{ fontSize: 12, padding: '6px 14px', background: '#0d9488', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>+ Dodaj koszt</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Fundusz eksploatacyjny', v: 28450, col: '#14b8a6' },
          { l: 'Fundusz remontowy', v: 19790, col: '#22c55e' },
          { l: 'Łącznie na kontach', v: 48240, col: '#0d9488' },
        ].map(c => (
          <div key={c.l} style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '16px' }}>
            <div style={{ fontSize: 11, color: '#4d7c78', marginBottom: 6 }}>{c.l}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: c.col }}>
              {active ? <AnimNumber target={c.v} suffix=" zł" /> : '—'}
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '16px', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#99f6e4', marginBottom: 14 }}>Ostatnie koszty</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #0f2d2a' }}>
              {['Data','Kategoria','Opis','Kwota','Fundusz'].map(h => <th key={h} style={{ fontSize: 11, color: '#4d7c78', padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              { d: '2026-06-18', k: 'Konserwacja', o: 'Przegląd wind — firma WindSerwis', kw: '2 400,00 zł', f: 'Eksploatacyjny' },
              { d: '2026-06-12', k: 'Sprzątanie', o: 'Usługa sprzątania klatek schodowych', kw: '850,00 zł', f: 'Eksploatacyjny' },
              { d: '2026-06-05', k: 'Fundusz rem.', o: 'Malowanie elewacji — zaliczka', kw: '5 200,00 zł', f: 'Remontowy' },
              { d: '2026-05-28', k: 'Ubezpieczenie', o: 'Polisa OC wspólnoty — rata II', kw: '1 100,00 zł', f: 'Eksploatacyjny' },
            ].map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #0f2d2a', opacity: active ? 1 : 0, transition: `opacity .4s ${i * 0.1}s` }}>
                <td style={{ fontSize: 12, padding: '8px 8px', color: '#4d7c78' }}>{r.d}</td>
                <td style={{ fontSize: 12, padding: '8px 8px' }}><span style={{ background: 'rgba(13,148,136,.12)', color: '#14b8a6', padding: '2px 8px', borderRadius: 99, fontSize: 11 }}>{r.k}</span></td>
                <td style={{ fontSize: 12, padding: '8px 8px', color: '#99f6e4' }}>{r.o}</td>
                <td style={{ fontSize: 12, padding: '8px 8px', color: '#f0fdfa', fontWeight: 600 }}>{r.kw}</td>
                <td style={{ fontSize: 12, padding: '8px 8px', color: '#4d7c78' }}>{r.f}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ScreenGlosowania({ active }: { active: boolean }) {
  const [yes, setYes] = useState(0)
  const [no, setNo] = useState(0)
  const [abstain, setAbstain] = useState(0)
  useEffect(() => {
    if (!active) { setYes(0); setNo(0); setAbstain(0); return }
    const t1 = setTimeout(() => setYes(11), 400)
    const t2 = setTimeout(() => setNo(3), 800)
    const t3 = setTimeout(() => setAbstain(2), 1200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [active])
  const total = 18
  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', height: '100%', background: '#030f0e' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#f0fdfa', marginBottom: 4 }}>Głosowania nad uchwałami</div>
      <div style={{ fontSize: 13, color: '#4d7c78', marginBottom: 20 }}>Elektroniczne głosowanie z PINem · zgodne z UoWL</div>
      <div style={{ background: '#091918', border: '1px solid #0d9488', borderRadius: 14, padding: '20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0fdfa', marginBottom: 4 }}>Uchwała nr 4/2026</div>
            <div style={{ fontSize: 13, color: '#99f6e4' }}>Wyrażenie zgody na wymianę instalacji CO w budynku A</div>
            <div style={{ fontSize: 12, color: '#4d7c78', marginTop: 4 }}>Metoda: udział w nieruchomości · Termin: 30.06.2026</div>
          </div>
          <span style={{ fontSize: 12, padding: '4px 12px', background: 'rgba(13,148,136,.15)', color: '#14b8a6', borderRadius: 99, border: '1px solid rgba(13,148,136,.3)', fontWeight: 600 }}>● Otwarte</span>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#99f6e4' }}>Oddano głosów: {yes + no + abstain} z {total} lokali</span>
            <span style={{ fontSize: 13, color: '#4d7c78' }}>{Math.round(((yes + no + abstain) / total) * 100)}% frekwencja</span>
          </div>
          <div style={{ background: '#0f2d2a', borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#0d9488', borderRadius: 6, width: `${((yes + no + abstain) / total) * 100}%`, transition: 'width .6s ease' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <div style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e' }}>{yes}</div>
            <div style={{ fontSize: 12, color: '#4d7c78', marginTop: 4 }}>Za</div>
          </div>
          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>{no}</div>
            <div style={{ fontSize: 12, color: '#4d7c78', marginTop: 4 }}>Przeciw</div>
          </div>
          <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{abstain}</div>
            <div style={{ fontSize: 12, color: '#4d7c78', marginTop: 4 }}>Wstrzymało się</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { n: 'Uchwała nr 3/2026', t: 'Fundusz remontowy — podwyżka o 0,50 zł/m²', s: 'Przyjęta', sc: '#22c55e', sb: 'rgba(34,197,94,.1)' },
          { n: 'Uchwała nr 2/2026', t: 'Regulamin porządku domowego — aktualizacja', s: 'Przyjęta', sc: '#22c55e', sb: 'rgba(34,197,94,.1)' },
        ].map(u => (
          <div key={u.n} style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: '#4d7c78' }}>{u.n}</div>
              <span style={{ fontSize: 11, padding: '2px 8px', background: u.sb, color: u.sc, borderRadius: 99 }}>{u.s}</span>
            </div>
            <div style={{ fontSize: 13, color: '#99f6e4' }}>{u.t}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScreenRozliczenia({ active }: { active: boolean }) {
  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', height: '100%', background: '#030f0e' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#f0fdfa', marginBottom: 4 }}>Rozliczenia — Lokal 12</div>
      <div style={{ fontSize: 13, color: '#4d7c78', marginBottom: 20 }}>ul. Różana 4 · Kowalski Jan · 58.4 m² · udział 4/100</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { l: 'Opłata miesięczna', v: 485, c: '#14b8a6', s: ' zł' },
          { l: 'Wpłacono (YTD)', v: 2910, c: '#22c55e', s: ' zł' },
          { l: 'Zaległość', v: 0, c: '#4d7c78', s: ' zł' },
          { l: 'Saldo otwarcia', v: 120, c: '#60a5fa', s: ' zł' },
        ].map(c => (
          <div key={c.l} style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '14px' }}>
            <div style={{ fontSize: 10, color: '#4d7c78', marginBottom: 6 }}>{c.l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.c }}>{active ? <AnimNumber target={c.v} suffix={c.s} /> : '—'}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#99f6e4' }}>Historia wpłat — 2026</div>
          <div style={{ fontSize: 12, color: '#0d9488', cursor: 'pointer' }}>↓ Pobierz PDF</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #0f2d2a' }}>
              {['Miesiąc','Naliczono','Wpłacono','Woda','Saldo'].map(h => <th key={h} style={{ fontSize: 11, color: '#4d7c78', padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              ['Styczeń 2026',  '485,00 zł', '485,00 zł', '3.2 m³',  '0,00 zł'],
              ['Luty 2026',     '485,00 zł', '485,00 zł', '2.8 m³',  '0,00 zł'],
              ['Marzec 2026',   '485,00 zł', '485,00 zł', '3.5 m³',  '0,00 zł'],
              ['Kwiecień 2026', '485,00 zł', '485,00 zł', '3.1 m³',  '0,00 zł'],
              ['Maj 2026',      '485,00 zł', '485,00 zł', '3.4 m³',  '0,00 zł'],
              ['Czerwiec 2026', '485,00 zł', '485,00 zł', '3.2 m³',  '0,00 zł'],
            ].map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #0f2d2a', opacity: active ? 1 : 0, transition: `opacity .35s ${i * 0.08}s` }}>
                <td style={{ fontSize: 12, padding: '7px 8px', color: '#99f6e4' }}>{r[0]}</td>
                <td style={{ fontSize: 12, padding: '7px 8px', color: '#f0fdfa' }}>{r[1]}</td>
                <td style={{ fontSize: 12, padding: '7px 8px', color: '#22c55e' }}>{r[2]}</td>
                <td style={{ fontSize: 12, padding: '7px 8px', color: '#5eead4' }}>{r[3]}</td>
                <td style={{ fontSize: 12, padding: '7px 8px' }}><span style={{ color: '#4d7c78' }}>{r[4]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ScreenLiczniki({ active }: { active: boolean }) {
  const readings = [
    { l: 'Lokal 1',  m: '2.8',  s: 'confirmed', d: '2026-06-01' },
    { l: 'Lokal 2',  m: '3.4',  s: 'confirmed', d: '2026-06-02' },
    { l: 'Lokal 3',  m: '2.1',  s: 'confirmed', d: '2026-06-03' },
    { l: 'Lokal 5',  m: '4.2',  s: 'confirmed', d: '2026-06-01' },
    { l: 'Lokal 7',  m: '3.2',  s: 'pending',   d: '2026-06-10' },
    { l: 'Lokal 9',  m: '—',    s: 'missing',   d: '—' },
    { l: 'Lokal 11', m: '2.9',  s: 'confirmed', d: '2026-06-04' },
    { l: 'Lokal 12', m: '3.1',  s: 'confirmed', d: '2026-06-02' },
  ]
  const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
    confirmed: { bg: 'rgba(34,197,94,.1)',  color: '#22c55e', label: 'Zatwierdzony' },
    pending:   { bg: 'rgba(245,158,11,.1)', color: '#f59e0b', label: 'Oczekuje' },
    missing:   { bg: 'rgba(239,68,68,.1)',  color: '#ef4444', label: 'Brak odczytu' },
  }
  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', height: '100%', background: '#030f0e' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f0fdfa' }}>Liczniki wody</div>
          <div style={{ fontSize: 13, color: '#4d7c78' }}>Czerwiec 2026 · 7 z 8 odczytów zgłoszonych</div>
        </div>
        <div style={{ fontSize: 12, padding: '6px 14px', background: '#0d9488', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>Nota kwartalna →</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { l: 'Odczytów zatwierdzonych', v: active ? 6 : 0, c: '#22c55e' },
          { l: 'Oczekuje na zatw.',        v: active ? 1 : 0, c: '#f59e0b' },
          { l: 'Brak odczytu',             v: active ? 1 : 0, c: '#ef4444' },
        ].map(c => (
          <div key={c.l} style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.c, transition: 'color .4s' }}>{c.v}</div>
            <div style={{ fontSize: 11, color: '#4d7c78', marginTop: 4 }}>{c.l}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#99f6e4', marginBottom: 12 }}>Odczyty lokali</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {readings.map((r, i) => {
            const st = statusStyle[r.s]
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#030f0e', borderRadius: 8, border: '1px solid #0f2d2a', opacity: active ? 1 : 0, transition: `opacity .3s ${i * 0.07}s` }}>
                <div>
                  <div style={{ fontSize: 12, color: '#f0fdfa', fontWeight: 600 }}>{r.l}</div>
                  <div style={{ fontSize: 11, color: '#4d7c78' }}>{r.m !== '—' ? `${r.m} m³ · ${r.d}` : r.d}</div>
                </div>
                <span style={{ fontSize: 10, padding: '2px 8px', background: st.bg, color: st.color, borderRadius: 99, whiteSpace: 'nowrap' }}>{st.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ScreenDokumenty({ active }: { active: boolean }) {
  const docs = [
    { n: 'Regulamin porządku domowego 2026', t: 'PDF', d: '2026-03-10', s: 'Wszystkie wspólnoty', sz: '248 KB' },
    { n: 'Uchwała nr 3-2026 — fundusz remontowy', t: 'PDF', d: '2026-05-20', s: 'Gostyń', sz: '85 KB' },
    { n: 'Sprawozdanie finansowe 2025', t: 'PDF', d: '2026-01-15', s: 'Gostyń', sz: '512 KB' },
    { n: 'Protokół zebrania — marzec 2026', t: 'DOCX', d: '2026-03-22', s: 'Gostyń', sz: '74 KB' },
    { n: 'Polisa ubezpieczeniowa OC 2026', t: 'PDF', d: '2026-01-02', s: 'Gostyń', sz: '1.2 MB' },
    { n: 'Regulamin głosowań elektronicznych', t: 'PDF', d: '2025-12-01', s: 'Wszystkie wspólnoty', sz: '190 KB' },
  ]
  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', height: '100%', background: '#030f0e' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f0fdfa' }}>Dokumenty wspólnoty</div>
          <div style={{ fontSize: 13, color: '#4d7c78' }}>Regulaminy, uchwały, sprawozdania</div>
        </div>
        <div style={{ fontSize: 12, padding: '6px 14px', background: '#0d9488', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>+ Dodaj dokument</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['Wszystkie','PDF','DOCX','Uchwały'].map((f, i) => (
          <div key={f} style={{ fontSize: 12, padding: '5px 14px', background: i === 0 ? '#0d9488' : '#091918', color: i === 0 ? '#fff' : '#4d7c78', borderRadius: 99, border: '1px solid #0f2d2a', cursor: 'pointer' }}>{f}</div>
        ))}
      </div>
      <div style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '8px' }}>
        {docs.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: i < docs.length - 1 ? '1px solid #0f2d2a' : 'none', opacity: active ? 1 : 0, transition: `opacity .3s ${i * 0.08}s` }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: d.t === 'PDF' ? 'rgba(239,68,68,.12)' : 'rgba(59,130,246,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: d.t === 'PDF' ? '#ef4444' : '#60a5fa', flexShrink: 0 }}>{d.t}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#f0fdfa', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.n}</div>
              <div style={{ fontSize: 11, color: '#4d7c78' }}>{d.d} · {d.s} · {d.sz}</div>
            </div>
            <div style={{ fontSize: 12, color: '#0d9488', cursor: 'pointer', flexShrink: 0 }}>↓ Pobierz</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScreenBudzet({ active }: { active: boolean }) {
  const categories = [
    { name: 'Konserwacja i naprawy', plan: 18000, exec: 14200 },
    { name: 'Sprzątanie',            plan:  9600, exec:  9600 },
    { name: 'Ubezpieczenie',         plan:  4400, exec:  4400 },
    { name: 'Wynagrodzenie zarządcy',plan: 12000, exec: 11000 },
    { name: 'Media — woda/śmieci',   plan: 22000, exec: 19800 },
    { name: 'Fundusz remontowy',     plan: 36000, exec: 28000 },
  ]
  const totalPlan = categories.reduce((s, c) => s + c.plan, 0)
  const totalExec = categories.reduce((s, c) => s + c.exec, 0)
  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', height: '100%', background: '#030f0e' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f0fdfa' }}>Budżet 2026</div>
          <div style={{ fontSize: 13, color: '#4d7c78' }}>Plan vs. wykonanie · stan na czerwiec</div>
        </div>
        <div style={{ fontSize: 12, padding: '6px 14px', background: '#091918', border: '1px solid #0f2d2a', borderRadius: 8, color: '#99f6e4', cursor: 'pointer' }}>↓ Eksport Excel</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Plan roczny', v: totalPlan, c: '#60a5fa' },
          { l: 'Wykonanie YTD', v: totalExec, c: '#14b8a6' },
          { l: 'Pozostało', v: totalPlan - totalExec, c: '#22c55e' },
        ].map(c => (
          <div key={c.l} style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '14px' }}>
            <div style={{ fontSize: 11, color: '#4d7c78', marginBottom: 6 }}>{c.l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.c }}>
              {active ? <AnimNumber target={c.v} suffix=" zł" /> : '—'}
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#99f6e4', marginBottom: 14 }}>Kategorie — plan vs. wykonanie</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categories.map((cat, i) => {
            const pct = Math.round((cat.exec / cat.plan) * 100)
            const over = cat.exec > cat.plan
            return (
              <div key={i} style={{ opacity: active ? 1 : 0, transition: `opacity .3s ${i * 0.08}s` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#f0fdfa' }}>{cat.name}</span>
                  <span style={{ fontSize: 11, color: over ? '#ef4444' : '#4d7c78' }}>
                    {cat.exec.toLocaleString('pl-PL')} / {cat.plan.toLocaleString('pl-PL')} zł · <span style={{ color: over ? '#ef4444' : '#22c55e' }}>{pct}%</span>
                  </span>
                </div>
                <div style={{ background: '#0f2d2a', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: over ? '#ef4444' : pct > 80 ? '#f59e0b' : '#0d9488', width: `${Math.min(pct, 100)}%`, transition: 'width .6s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ScreenWezwania({ active }: { active: boolean }) {
  const debtors = [
    { l: 'Lokal 4',  n: 'Nowak Katarzyna',  debt: 1240 },
    { l: 'Lokal 9',  n: 'Wiśniewski Tomasz', debt: 890 },
    { l: 'Lokal 13', n: 'Zając Piotr',       debt: 3420 },
    { l: 'Lokal 17', n: 'Kaczmarek Anna',    debt: 560 },
  ]
  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', height: '100%', background: '#030f0e' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f0fdfa' }}>⚠️ Wezwania do zapłaty</div>
          <div style={{ fontSize: 13, color: '#4d7c78' }}>Rok 2026 · min. zadłużenie: 100 zł</div>
        </div>
        <div style={{ fontSize: 12, padding: '6px 14px', background: '#ef4444', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>🖨 Drukuj wszystkie (4)</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Dłużnicy', v: active ? 4 : 0, c: '#ef4444' },
          { l: 'Łączne zadłużenie', v: active ? 6110 : 0, c: '#ef4444', s: ' zł' },
          { l: 'Wszystkich lokali', v: active ? 18 : 0, c: '#f0fdfa' },
        ].map(c => (
          <div key={c.l} style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '14px' }}>
            <div style={{ fontSize: 11, color: '#4d7c78', marginBottom: 6 }}>{c.l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.c }}><AnimNumber target={c.v} suffix={c.s ?? ''} /></div>
          </div>
        ))}
      </div>
      <div style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', marginBottom: 12 }}>🔴 Lokale z niedopłatą</div>
        {debtors.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < debtors.length - 1 ? '1px solid #0f2d2a' : 'none', opacity: active ? 1 : 0, transition: `opacity .3s ${i * 0.1}s` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f0fdfa' }}>{d.l} · {d.n}</div>
              <div style={{ fontSize: 11, color: '#4d7c78', marginTop: 2 }}>Rok 2026</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>{d.debt.toLocaleString('pl-PL')} zł</div>
              <div style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(239,68,68,.1)', color: '#ef4444', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(239,68,68,.2)' }}>🖨 Wezwanie</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScreenMieszkanie({ active }: { active: boolean }) {
  const months = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru']
  const paid =   [485, 485, 485, 485, 485, 485, 0, 0, 0, 0, 0, 0]
  const due =    [485, 485, 485, 485, 485, 485, 0, 0, 0, 0, 0, 0]
  const water =  [3.2, 2.8, 3.5, 3.1, 3.4, 3.2, 0, 0, 0, 0, 0, 0]
  const maxW = 4
  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', height: '100%', background: '#030f0e' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#f0fdfa', marginBottom: 4 }}>💳 Moje konto</div>
      <div style={{ fontSize: 13, color: '#4d7c78', marginBottom: 20 }}>Lokal 12 · Kowalski Jan · Wspólnota Gostyń</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { l: 'Saldo 2026', v: 120, col: '#14b8a6', suf: ' zł', note: '✓ Nadpłata' },
          { l: 'Saldo otwarcia', v: 120, col: '#99f6e4', suf: ' zł', note: 'z 2025' },
          { l: 'Naliczono 2026', v: 2910, col: '#f0fdfa', suf: ' zł', note: 'łącznie' },
          { l: 'Wpłacono 2026', v: 2910, col: '#22c55e', suf: ' zł', note: 'łącznie' },
        ].map(c => (
          <div key={c.l} style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '14px' }}>
            <div style={{ fontSize: 10, color: '#4d7c78', marginBottom: 6 }}>{c.l}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.col }}>{active ? <AnimNumber target={c.v} suffix={c.suf} /> : '—'}</div>
            <div style={{ fontSize: 10, color: '#4d7c78', marginTop: 3 }}>{c.note}</div>
          </div>
        ))}
      </div>
      {/* Water chart */}
      <div style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '16px', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#99f6e4', marginBottom: 12 }}>🚿 Zużycie wody — 2026</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
          {water.map((w, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', background: w > 0 ? 'rgba(96,165,250,.65)' : '#0c1a1a', borderRadius: '4px 4px 0 0', height: w > 0 ? `${(w / maxW) * 54}px` : '2px', transition: 'height .5s .2s ease' }} title={w > 0 ? `${w} m³` : ''} />
              <div style={{ fontSize: 9, color: '#4d7c78' }}>{months[i]}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#4d7c78', marginTop: 10 }}>
          Łącznie: <span style={{ color: '#60a5fa', fontWeight: 600 }}>{water.reduce((s,v)=>s+v,0).toFixed(1)} m³</span> · Noty: Q1 · Q2 · Q3 · Q4
        </div>
      </div>
      {/* Mini table */}
      <div style={{ background: '#091918', border: '1px solid #0f2d2a', borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0 }}>
          {['Miesiąc','Naliczono','Wpłacono','Saldo'].map(h => (
            <div key={h} style={{ fontSize: 10, color: '#4d7c78', padding: '4px 8px', fontWeight: 600 }}>{h}</div>
          ))}
          {['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec'].map((m, i) => [
            <div key={`m${i}`} style={{ fontSize: 11, color: '#99f6e4', padding: '5px 8px', borderTop: '1px solid #0f2d2a', opacity: active ? 1 : 0, transition: `opacity .3s ${i*0.06}s` }}>{m}</div>,
            <div key={`d${i}`} style={{ fontSize: 11, color: '#f0fdfa', padding: '5px 8px', borderTop: '1px solid #0f2d2a', opacity: active ? 1 : 0, transition: `opacity .3s ${i*0.06}s` }}>485,00 zł</div>,
            <div key={`p${i}`} style={{ fontSize: 11, color: '#22c55e', padding: '5px 8px', borderTop: '1px solid #0f2d2a', opacity: active ? 1 : 0, transition: `opacity .3s ${i*0.06}s` }}>485,00 zł</div>,
            <div key={`s${i}`} style={{ fontSize: 11, color: '#14b8a6', padding: '5px 8px', borderTop: '1px solid #0f2d2a', opacity: active ? 1 : 0, transition: `opacity .3s ${i*0.06}s` }}>0,00 zł</div>,
          ])}
        </div>
      </div>
    </div>
  )
}

const SCREEN_COMPONENTS: Record<string, (props: { active: boolean }) => React.ReactElement> = {
  dashboard:   ScreenDashboard,
  finanse:     ScreenFinanse,
  budzet:      ScreenBudzet,
  glosowania:  ScreenGlosowania,
  rozliczenia: ScreenRozliczenia,
  wezwania:    ScreenWezwania,
  liczniki:    ScreenLiczniki,
  mieszkaniec: ScreenMieszkanie,
  dokumenty:   ScreenDokumenty,
}

export default function DemoPage() {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const DURATION = 7000

  useEffect(() => {
    if (paused) return
    const start = Date.now()
    const tick = setInterval(() => {
      const elapsed = (Date.now() - start) % DURATION
      setProgress(elapsed / DURATION)
    }, 50)
    const next = setInterval(() => {
      setCurrent(c => (c + 1) % SCREENS.length)
      setProgress(0)
    }, DURATION)
    return () => { clearInterval(tick); clearInterval(next) }
  }, [paused, current])

  function goTo(i: number) { setCurrent(i); setProgress(0); setPaused(true) }

  const screen = SCREENS[current]
  const Comp = SCREEN_COMPONENTS[screen.id]

  return (
    <>
      <style>{`
        .demo-wrap { min-height: 100vh; background: #030f0e; color: #f0fdfa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
        .demo-top { background: rgba(3,15,14,.95); backdrop-filter: blur(12px); border-bottom: 1px solid #0f2d2a; padding: 0 24px; position: sticky; top: 0; z-index: 100; }
        .demo-top-inner { max-width: 1160px; margin: 0 auto; height: 58px; display: flex; align-items: center; justify-content: space-between; }
        .demo-logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 16px; }
        .demo-logo-icon { width: 32px; height: 32px; background: linear-gradient(135deg, #0f766e, #0d9488); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
        .demo-badge { font-size: 11px; padding: 2px 10px; background: rgba(13,148,136,.12); border: 1px solid rgba(13,148,136,.3); color: #14b8a6; border-radius: 99px; margin-left: 10px; }
        .demo-cta-btn { font-size: 13px; font-weight: 600; padding: 8px 18px; background: #0d9488; color: #fff; border-radius: 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: background .2s; }
        .demo-cta-btn:hover { background: #0f766e; color: #fff; }
        .demo-hero { text-align: center; padding: 48px 24px 32px; }
        .demo-hero h1 { font-size: clamp(28px,5vw,46px); font-weight: 900; letter-spacing: -.03em; line-height: 1.1; margin-bottom: 14px; }
        .demo-hero p { font-size: 16px; color: #4d7c78; max-width: 480px; margin: 0 auto 8px; }
        .demo-note { font-size: 12px; color: #4d7c78; margin-top: 8px; }
        .demo-note span { color: #14b8a6; }
        .panel-wrap { max-width: 1100px; margin: 0 auto; padding: 0 16px 60px; }
        .panel-tabs { display: flex; gap: 4px; margin-bottom: 16px; flex-wrap: wrap; }
        .panel-tab { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 7px 14px; border-radius: 8px; cursor: pointer; border: 1px solid #0f2d2a; background: #091918; color: #4d7c78; transition: all .2s; white-space: nowrap; }
        .panel-tab.active { background: #0d9488; border-color: #0d9488; color: #fff; font-weight: 600; }
        .panel-tab:hover:not(.active) { color: #99f6e4; border-color: #133835; }
        .panel-progress { height: 2px; background: #0f2d2a; border-radius: 1px; margin-bottom: 4px; overflow: hidden; }
        .panel-progress-bar { height: 100%; background: #0d9488; border-radius: 1px; transition: width .05s linear; }
        .panel-hint { font-size: 11px; color: #4d7c78; text-align: right; margin-bottom: 12px; }
        .panel-hint span { color: #0d9488; cursor: pointer; }
        .panel-chrome { background: #091918; border: 1px solid #0f2d2a; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,.7); }
        .panel-chrome-bar { background: #071514; border-bottom: 1px solid #0f2d2a; padding: 10px 16px; display: flex; align-items: center; gap: 8px; }
        .dot { width: 10px; height: 10px; border-radius: 50%; } .dr { background: #ef4444; } .dy { background: #f59e0b; } .dg { background: #22c55e; }
        .chrome-url { flex: 1; background: rgba(13,148,136,.06); border-radius: 6px; border: 1px solid #0f2d2a; height: 24px; margin: 0 12px; display: flex; align-items: center; padding: 0 10px; gap: 6px; }
        .chrome-url-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
        .chrome-url span { font-size: 11px; color: #4d7c78; }
        .panel-body { display: flex; height: 520px; }
        .panel-sidebar { width: 200px; background: #051110; border-right: 1px solid #0f2d2a; padding: 14px 10px; flex-shrink: 0; overflow: hidden; }
        .ps-logo { font-size: 13px; font-weight: 700; color: #f0fdfa; padding: 4px 8px 12px; border-bottom: 1px solid #0f2d2a; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
        .ps-icon { width: 22px; height: 22px; background: #0d9488; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
        .ps-section { font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #1a4a45; padding: 10px 8px 3px; }
        .ps-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 7px; font-size: 12px; color: #4d7c78; margin-bottom: 1px; cursor: pointer; transition: background .15s, color .15s; }
        .ps-item.active { background: rgba(13,148,136,.15); color: #14b8a6; font-weight: 600; }
        .ps-item:hover:not(.active) { background: rgba(13,148,136,.07); color: #99f6e4; }
        .panel-screen { flex: 1; overflow: auto; }
        .demo-bottom { text-align: center; padding: 32px 24px 60px; }
        .demo-bottom h2 { font-size: 28px; font-weight: 800; margin-bottom: 12px; letter-spacing: -.02em; }
        .demo-bottom p { font-size: 16px; color: #4d7c78; margin-bottom: 28px; }
        .demo-bottom-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .btn-main { font-size: 15px; font-weight: 600; padding: 13px 28px; background: #0d9488; color: #fff; border-radius: 10px; text-decoration: none; transition: background .2s; }
        .btn-main:hover { background: #0f766e; color: #fff; }
        .btn-sec { font-size: 15px; font-weight: 600; padding: 13px 28px; background: transparent; color: #99f6e4; border-radius: 10px; text-decoration: none; border: 1px solid #133835; transition: background .2s; }
        .btn-sec:hover { background: rgba(13,148,136,.08); }
        @media (max-width: 700px) {
          .panel-body { flex-direction: column; height: auto; }
          .panel-sidebar { width: 100%; height: auto; display: flex; flex-wrap: wrap; gap: 4px; padding: 10px; }
          .ps-logo { display: none; }
          .ps-section { display: none; }
          .ps-item { padding: 5px 10px; }
          .panel-screen { min-height: 420px; }
        }
      `}</style>

      <div className="demo-wrap">
        {/* TOP BAR */}
        <div className="demo-top">
          <div className="demo-top-inner">
            <div className="demo-logo">
              <div className="demo-logo-icon">🏢</div>
              Unity House
              <span className="demo-badge">DEMO</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Link href="/" style={{ fontSize: 13, color: '#4d7c78', textDecoration: 'none' }}>← Wróć na stronę</Link>
              <Link href="mailto:unity.housegostyn@gmail.com" className="demo-cta-btn">Chcę taki panel →</Link>
            </div>
          </div>
        </div>

        {/* HERO */}
        <div className="demo-hero">
          <h1>Tak wygląda<br /><span style={{ color: '#14b8a6' }}>panel Unity House</span></h1>
          <p>Interaktywna demonstracja wszystkich modułów — finanse, głosowania, rozliczenia, liczniki i więcej.</p>
          <div className="demo-note">
            <span>Auto-prezentacja</span> · kliknij zakładkę żeby zatrzymać i zbadać moduł
          </div>
        </div>

        {/* PANEL */}
        <div className="panel-wrap">
          {/* TABS */}
          <div className="panel-tabs">
            {SCREENS.map((s, i) => (
              <div key={s.id} className={`panel-tab${i === current ? ' active' : ''}`} onClick={() => goTo(i)}>
                <span>{s.icon}</span> {s.label}
              </div>
            ))}
          </div>

          {/* PROGRESS */}
          {!paused && (
            <div className="panel-progress">
              <div className="panel-progress-bar" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
          <div className="panel-hint">
            {paused
              ? <span onClick={() => setPaused(false)} style={{ cursor: 'pointer', color: '#0d9488' }}>▶ Wznów autoprezentację</span>
              : <span>Kliknij zakładkę, żeby zatrzymać</span>
            }
          </div>

          {/* CHROME MOCKUP */}
          <div className="panel-chrome">
            <div className="panel-chrome-bar">
              <div className="dot dr" /><div className="dot dy" /><div className="dot dg" />
              <div className="chrome-url">
                <div className="chrome-url-dot" />
                <span>unity-house.pl/admin/{screen.id}</span>
              </div>
            </div>
            <div className="panel-body">
              {/* SIDEBAR */}
              <div className="panel-sidebar">
                <div className="ps-logo"><div className="ps-icon">🏢</div> Unity House</div>
                {SIDEBAR_ITEMS.map((item, i) => (
                  item.section
                    ? <div key={i} className="ps-section">{item.label}</div>
                    : <div
                        key={i}
                        className={`ps-item${item.id === screen.id ? ' active' : ''}`}
                        onClick={() => { const idx = SCREENS.findIndex(s => s.id === item.id); if (idx >= 0) goTo(idx) }}
                      >
                        <span>{item.icon}</span> {item.label}
                      </div>
                ))}
              </div>
              {/* SCREEN */}
              <div className="panel-screen">
                <Comp active={true} key={screen.id} />
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM CTA */}
        <div className="demo-bottom">
          <h2>Gotowy na swój panel?</h2>
          <p>Wdrożenie w 1 dzień roboczy. Bez instalacji, bez umów na rok.</p>
          <div className="demo-bottom-btns">
            <a href="mailto:unity.housegostyn@gmail.com" className="btn-main">✉ Napisz do nas</a>
            <a href="tel:536153571" className="btn-sec">📞 536 153 571</a>
          </div>
        </div>
      </div>
    </>
  )
}
