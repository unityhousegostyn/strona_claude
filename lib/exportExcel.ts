// Client-side Excel export using SheetJS (xlsx)
// Usage: importuj i wywołaj po stronie klienta (client component)

export async function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Dane'
) {
  const XLSX = await import('xlsx')

  const ws = XLSX.utils.json_to_sheet(data)

  // Auto column widths
  const colWidths = Object.keys(data[0] ?? {}).map(key => ({
    wch: Math.max(key.length, ...data.map(row => String(row[key] ?? '').length), 10),
  }))
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export async function exportMultiSheet(
  sheets: { name: string; data: Record<string, unknown>[] }[],
  filename: string
) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  for (const { name, data } of sheets) {
    const ws = XLSX.utils.json_to_sheet(data)
    if (data.length > 0) {
      ws['!cols'] = Object.keys(data[0]).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key] ?? '').length), 10),
      }))
    }
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  XLSX.writeFile(wb, `${filename}.xlsx`)
}
