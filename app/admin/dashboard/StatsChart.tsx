'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'

interface Props {
  data: { name: string; otwarte: number; zamknięte: number }[]
  title: string
}

export default function StatsChart({ data, title }: Props) {
  if (data.length === 0) return null

  return (
    <div className="bg-[#121c15] border border-[#1e3324] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-[#6b9478] mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3324" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b9478' }} />
          <YAxis tick={{ fontSize: 12, fill: '#6b9478' }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #1e3324', backgroundColor: '#111a13', color: '#ecfdf5' }}
            cursor={{ fill: '#1e3324' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#6b9478' }} />
          <Bar dataKey="otwarte" fill="#059669" radius={[4, 4, 0, 0]} name="Otwarte" />
          <Bar dataKey="zamknięte" fill="#34d399" radius={[4, 4, 0, 0]} name="Zamknięte" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
