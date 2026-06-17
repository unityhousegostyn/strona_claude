'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'

interface Props {
  data: { name: string; otwarte: number; zamknięte: number }[]
  title: string
}

export default function StatsChart({ data, title }: Props) {
  if (data.length === 0) return null

  return (
    <div className="bg-[#1e1409] border border-[#33200d] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-[#b45309] mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#33200d" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#b45309' }} />
          <YAxis tick={{ fontSize: 12, fill: '#b45309' }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #33200d', backgroundColor: '#160d05', color: '#fef9ee' }}
            cursor={{ fill: '#33200d' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#b45309' }} />
          <Bar dataKey="otwarte" fill="#059669" radius={[4, 4, 0, 0]} name="Otwarte" />
          <Bar dataKey="zamknięte" fill="#34d399" radius={[4, 4, 0, 0]} name="Zamknięte" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
