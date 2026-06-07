'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'

interface Props {
  data: { name: string; otwarte: number; zamknięte: number }[]
  title: string
}

export default function StatsChart({ data, title }: Props) {
  if (data.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            cursor={{ fill: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="otwarte" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Otwarte" />
          <Bar dataKey="zamknięte" fill="#10b981" radius={[4, 4, 0, 0]} name="Zamknięte" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
