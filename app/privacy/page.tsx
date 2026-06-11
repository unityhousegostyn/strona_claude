import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0d1410] py-12 px-4">
      <div className="max-w-2xl mx-auto bg-[#121c15] rounded-xl shadow-lg shadow-black/30 border border-[#1e3324] p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#ecfdf5]">Polityka Prywatności</h1>
          <p className="text-sm text-[#6b9478] mt-1">Panel Zarządzania Wspólnotą Mieszkaniową</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[#d1fae5]">1. Administrator danych</h2>
          <p className="text-sm text-[#6b9478] leading-relaxed">
            Administratorem Twoich danych osobowych jest zarządca wspólnoty mieszkaniowej,
            do której należysz. W sprawach dotyczących danych osobowych możesz kontaktować
            się z administratorem poprzez panel zgłoszeń lub bezpośrednio z zarządem wspólnoty.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[#d1fae5]">2. Cel i podstawa przetwarzania</h2>
          <p className="text-sm text-[#6b9478] leading-relaxed">
            Twoje dane (adres e-mail, imię i nazwisko, dane kontaktowe) przetwarzamy w celu:
          </p>
          <ul className="text-sm text-[#6b9478] space-y-1 pl-4 list-disc">
            <li>obsługi konta w panelu mieszkańca — podstawa: art. 6 ust. 1 lit. b RODO (wykonanie umowy),</li>
            <li>komunikacji dotyczącej spraw wspólnoty — podstawa: art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes),</li>
            <li>wypełnienia obowiązków prawnych zarządcy — podstawa: art. 6 ust. 1 lit. c RODO.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[#d1fae5]">3. Okres przechowywania</h2>
          <p className="text-sm text-[#6b9478] leading-relaxed">
            Dane przechowywane są przez okres korzystania z panelu oraz przez czas wymagany
            przepisami prawa (np. dokumentacja wspólnoty — do 5 lat od zakończenia roku obrachunkowego).
            Po usunięciu konta dane są anonimizowane lub usuwane w ciągu 30 dni.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[#d1fae5]">4. Twoje prawa</h2>
          <p className="text-sm text-[#6b9478] leading-relaxed">
            Na podstawie RODO przysługują Ci następujące prawa:
          </p>
          <ul className="text-sm text-[#6b9478] space-y-1 pl-4 list-disc">
            <li>prawo dostępu do swoich danych,</li>
            <li>prawo do sprostowania (poprawienia) danych,</li>
            <li>prawo do usunięcia danych („prawo do bycia zapomnianym"),</li>
            <li>prawo do ograniczenia przetwarzania,</li>
            <li>prawo do przenoszenia danych,</li>
            <li>prawo do wniesienia sprzeciwu wobec przetwarzania,</li>
            <li>prawo do wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (UODO), ul. Stawki 2, 00-193 Warszawa.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[#d1fae5]">5. Odbiorcy danych</h2>
          <p className="text-sm text-[#6b9478] leading-relaxed">
            Twoje dane mogą być przekazywane podmiotom świadczącym usługi techniczne
            (hosting, poczta elektroniczna) wyłącznie w zakresie niezbędnym do realizacji
            ww. celów. Dane nie są przekazywane poza Europejski Obszar Gospodarczy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[#d1fae5]">6. Pliki cookies</h2>
          <p className="text-sm text-[#6b9478] leading-relaxed">
            Panel używa wyłącznie niezbędnych plików cookies sesji służących do uwierzytelnienia
            zalogowanego użytkownika. Nie stosujemy cookies analitycznych ani marketingowych.
          </p>
        </section>

        <div className="pt-2 border-t border-[#1e3324]">
          <Link href="/login" className="text-sm text-emerald-500 hover:underline">
            ← Wróć do logowania
          </Link>
        </div>
      </div>
    </main>
  )
}
