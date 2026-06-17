'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'

interface Props {
  data: { name: string; otwarte: number; zamknięte: number }[]
  title: string
}

export default function StatsChart({ data, title }: Props) {
  if (data.length === 0) return null

  return (
    <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-[#0f766e] mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0f2d2a" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#0f766e' }} />
          <YAxis tick={{ fontSize: 12, fill: '#0f766e' }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #0f2d2a', backgroundColor: '#041614', color: '#f0fdfa' }}
            cursor={{ fill: '#0f2d2a' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#0f766e' }} />
          <Bar dataKey="otwarte" fill="#059669" radius={[4, 4, 0, 0]} name="Otwarte" />
          <Bar dataKey="zamknięte" fill="#34d399" radius={[4, 4, 0, 0]} name="Zamknięte" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
