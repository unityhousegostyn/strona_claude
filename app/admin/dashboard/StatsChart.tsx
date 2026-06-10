'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'

interface Props {
  data: { name: string; otwarte: number; zamknięte: number }[]
  title: string
}

export default function StatsChart({ data, title }: Props) {
  if (data.length === 0) return null

  return (
    <div className="bg-stone-100 border border-stone-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-stone-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #374151', backgroundColor: '#111827', color: '#f3f4f6' }}
            cursor={{ fill: '#1f2937' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
          <Bar dataKey="otwarte" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Otwarte" />
          <Bar dataKey="zamknięte" fill="#10b981" radius={[4, 4, 0, 0]} name="Zamknięte" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
