import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'

export default async function RaportyPage() {
  const { profile } = await getAuthProfile()
  if (profile.role === 'user') redirect('/admin/dashboard')

  return (
    <div className="max-w-2xl text-center py-20">
      <div className="text-5xl mb-4">📊</div>
      <h2 className="text-2xl font-bold text-gray-100 mb-3">Raporty finansowe</h2>
      <p className="text-gray-500">Ta sekcja jest w przygotowaniu.<br/>Wkrótce pojawią się tu raporty roczne, zestawienia per lokal i eksport danych.</p>
    </div>
  )
}
