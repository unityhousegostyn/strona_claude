/**
 * Phosphor-style duotone SVG icons — bez zależności npm.
 * Wizualnie identyczne z @phosphor-icons/react (weight="duotone").
 */
import React from 'react'

interface IconProps {
  size?: number
  color?: string
  className?: string
}

type Ph = React.FC<IconProps>

const Svg = ({ size, color, children }: { size: number; color: string; children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

export const PhHouse: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M3 10.5V20a1 1 0 0 0 1 1h5v-5h6v5h5a1 1 0 0 0 1-1V10.5" fill={color} fillOpacity={0.15} stroke="none"/>
    <path d="M3 10.5V20a1 1 0 0 0 1 1h5v-5h6v5h5a1 1 0 0 0 1-1V10.5"/>
    <polyline points="1 11 12 2 23 11"/>
  </Svg>
)

export const PhMegaphone: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M3 11v2a2 2 0 0 0 2 2h2l2 4h1v-4h8l2 2V7l-2 2H3z" fill={color} fillOpacity={0.15} stroke="none"/>
    <path d="M3 11v2a2 2 0 0 0 2 2h2l2 4h1v-4"/>
    <path d="M19 7l2-2v12l-2-2"/>
    <line x1="19" y1="7" x2="8" y2="9"/>
    <line x1="19" y1="17" x2="8" y2="15"/>
    <line x1="8" y1="9" x2="8" y2="15"/>
  </Svg>
)

export const PhChatBubble: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      fill={color} fillOpacity={0.15} stroke="none"/>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <line x1="8" y1="10" x2="13" y2="10"/>
    <line x1="8" y1="14" x2="11" y2="14"/>
  </Svg>
)

export const PhTicket: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <rect x="2" y="7" width="20" height="10" rx="2" fill={color} fillOpacity={0.15} stroke="none"/>
    <rect x="2" y="7" width="20" height="10" rx="2"/>
    <line x1="8" y1="7" x2="8" y2="17" strokeDasharray="2 2"/>
    <line x1="16" y1="7" x2="16" y2="17" strokeDasharray="2 2"/>
    <line x1="11" y1="12" x2="13" y2="12"/>
  </Svg>
)

export const PhClipboard: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <rect x="8" y="2" width="8" height="4" rx="1" fill={color} fillOpacity={0.3} stroke="none"/>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
      fill={color} fillOpacity={0.12} stroke="none"/>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1"/>
    <line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="13" y2="17"/>
  </Svg>
)

export const PhPhone: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.1 5.18 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9.09 10a16 16 0 0 0 6.91 6.91l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 18v2.92z"
      fill={color} fillOpacity={0.15}/>
  </Svg>
)

export const PhFolder: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
      fill={color} fillOpacity={0.15} stroke="none"/>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </Svg>
)

export const PhScales: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <circle cx="6.5" cy="15" r="3" fill={color} fillOpacity={0.2} stroke="none"/>
    <circle cx="17.5" cy="15" r="3" fill={color} fillOpacity={0.2} stroke="none"/>
    <circle cx="6.5" cy="15" r="3"/>
    <circle cx="17.5" cy="15" r="3"/>
    <line x1="12" y1="3" x2="12" y2="21"/>
    <polyline points="3 9 6.5 12 10 9"/>
    <polyline points="14 9 17.5 12 21 9"/>
    <line x1="6" y1="6" x2="18" y2="6"/>
  </Svg>
)

export const PhReceipt: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"
      fill={color} fillOpacity={0.15} stroke="none"/>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/>
    <line x1="9" y1="9" x2="15" y2="9"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
  </Svg>
)

export const PhCreditCard: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <rect x="1" y="4" width="22" height="16" rx="2" fill={color} fillOpacity={0.15} stroke="none"/>
    <rect x="1" y="4" width="22" height="16" rx="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
    <line x1="6" y1="15" x2="9" y2="15"/>
    <line x1="12" y1="15" x2="14" y2="15"/>
  </Svg>
)

export const PhMoney: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <circle cx="12" cy="12" r="9" fill={color} fillOpacity={0.15} stroke="none"/>
    <circle cx="12" cy="12" r="9"/>
    <line x1="12" y1="7" x2="12" y2="17"/>
    <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 2s-2.5.5-2.5 2a2.5 2.5 0 0 0 5 0"/>
  </Svg>
)

export const PhTrendDown: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M4 7l5 6 4-3 7 8" fill={color} fillOpacity={0.1} stroke="none"/>
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
    <polyline points="17 18 23 18 23 12"/>
  </Svg>
)

export const PhChartBar: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <rect x="18" y="3" width="4" height="18" rx="1" fill={color} fillOpacity={0.15} stroke="none"/>
    <rect x="10" y="8" width="4" height="13" rx="1" fill={color} fillOpacity={0.15} stroke="none"/>
    <rect x="2" y="13" width="4" height="8" rx="1" fill={color} fillOpacity={0.15} stroke="none"/>
    <line x1="18" y1="3" x2="18" y2="21"/>
    <line x1="22" y1="3" x2="22" y2="21"/>
    <line x1="10" y1="8" x2="10" y2="21"/>
    <line x1="14" y1="8" x2="14" y2="21"/>
    <line x1="2" y1="13" x2="2" y2="21"/>
    <line x1="6" y1="13" x2="6" y2="21"/>
    <line x1="1" y1="21" x2="23" y2="21"/>
  </Svg>
)

export const PhLock: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <rect x="3" y="11" width="18" height="11" rx="2" fill={color} fillOpacity={0.15} stroke="none"/>
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    <circle cx="12" cy="16" r="1" fill={color}/>
  </Svg>
)

export const PhArchive: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <polyline points="21 8 21 21 3 21 3 8"/>
    <rect x="1" y="3" width="22" height="5" rx="1" fill={color} fillOpacity={0.2} stroke="none"/>
    <rect x="1" y="3" width="22" height="5" rx="1"/>
    <line x1="10" y1="12" x2="14" y2="12"/>
  </Svg>
)

export const PhBuildings: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill={color} fillOpacity={0.15} stroke="none"/>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
    <rect x="10" y="14" width="4" height="4" fill={color} fillOpacity={0.3} stroke="none"/>
  </Svg>
)

export const PhUsers: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill={color} fillOpacity={0.12} stroke="none"/>
    <circle cx="9" cy="7" r="4" fill={color} fillOpacity={0.12} stroke="none"/>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </Svg>
)

export const PhEnvelope: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
      fill={color} fillOpacity={0.15} stroke="none"/>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22 6 12 13 2 6"/>
  </Svg>
)

export const PhSearch: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <circle cx="11" cy="11" r="7" fill={color} fillOpacity={0.12} stroke="none"/>
    <circle cx="11" cy="11" r="7"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </Svg>
)

export const PhDrop: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill={color} fillOpacity={0.15} stroke="none"/>
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
  </Svg>
)

export const PhFileText: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      fill={color} fillOpacity={0.15} stroke="none"/>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="13" y2="17"/>
  </Svg>
)

export const PhWarning: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
      fill={color} fillOpacity={0.15} stroke="none"/>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </Svg>
)

export const PhBank: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <rect x="3" y="19" width="18" height="2" fill={color} fillOpacity={0.2} stroke="none"/>
    <rect x="3" y="9" width="18" height="2" fill={color} fillOpacity={0.2} stroke="none"/>
    <path d="M12 2L2 7h20z" fill={color} fillOpacity={0.2} stroke="none"/>
    <path d="M12 2L2 7h20z"/>
    <line x1="2" y1="9" x2="22" y2="9"/>
    <line x1="2" y1="19" x2="22" y2="19"/>
    <line x1="2" y1="21" x2="22" y2="21"/>
    <line x1="5" y1="9" x2="5" y2="19"/>
    <line x1="10" y1="9" x2="10" y2="19"/>
    <line x1="15" y1="9" x2="15" y2="19"/>
    <line x1="20" y1="9" x2="20" y2="19"/>
  </Svg>
)

export const PhCalendar: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <rect x="3" y="4" width="18" height="18" rx="2" fill={color} fillOpacity={0.12} stroke="none"/>
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <rect x="7" y="14" width="3" height="3" rx="0.5" fill={color} fillOpacity={0.3} stroke="none"/>
  </Svg>
)

export const PhCaretRight: Ph = ({ size = 16, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <polyline points="9 18 15 12 9 6"/>
  </Svg>
)

export const PhUserCircle: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <circle cx="12" cy="12" r="10" fill={color} fillOpacity={0.1} stroke="none"/>
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="10" r="3"/>
    <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>
  </Svg>
)

export const PhSignOut: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" fill={color} fillOpacity={0.12} stroke="none"/>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </Svg>
)

export const PhBell: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
      fill={color} fillOpacity={0.15} stroke="none"/>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </Svg>
)

export const PhSun: Ph = ({ size = 18, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <circle cx="12" cy="12" r="4" fill={color} fillOpacity={0.2}/>
    <circle cx="12" cy="12" r="4"/>
    {[0,45,90,135,180,225,270,315].map(deg => {
      const r = (deg * Math.PI) / 180
      const x1 = Math.round((12 + 6 * Math.sin(r)) * 100) / 100
      const y1 = Math.round((12 - 6 * Math.cos(r)) * 100) / 100
      const x2 = Math.round((12 + 8 * Math.sin(r)) * 100) / 100
      const y2 = Math.round((12 - 8 * Math.cos(r)) * 100) / 100
      return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}/>
    })}
  </Svg>
)

export const PhMoon: Ph = ({ size = 18, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
      fill={color} fillOpacity={0.15}/>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </Svg>
)

export const PhGrid: Ph = ({ size = 20, color = 'currentColor' }) => (
  <Svg size={size} color={color}>
    <rect x="3" y="3" width="7" height="7" rx="1" fill={color} fillOpacity={0.2} stroke="none"/>
    <rect x="14" y="3" width="7" height="7" rx="1" fill={color} fillOpacity={0.2} stroke="none"/>
    <rect x="3" y="14" width="7" height="7" rx="1" fill={color} fillOpacity={0.2} stroke="none"/>
    <rect x="14" y="14" width="7" height="7" rx="1" fill={color} fillOpacity={0.2} stroke="none"/>
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </Svg>
)
