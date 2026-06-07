export async function extractText(buffer: Buffer, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().split('.').pop()

  try {
    if (ext === 'pdf') {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      return data.text ?? ''
    }

    if (ext === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value ?? ''
    }

    if (ext === 'txt') {
      return buffer.toString('utf-8')
    }
  } catch (e) {
    console.error('[docChunker] extractText error:', e)
  }

  return ''
}

export function splitIntoChunks(text: string, chunkSize = 700, overlap = 80): string[] {
  // Podziel na zdania
  const parts = text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0)

  const chunks: string[] = []
  let current = ''

  for (const part of parts) {
    if (current.length + part.length > chunkSize && current.length > 0) {
      chunks.push(current.trim())
      // overlap: ostatnie słowa z poprzedniego chunka
      const words = current.split(' ')
      current = words.slice(-Math.floor(overlap / 6)).join(' ') + ' ' + part
    } else {
      current += (current ? ' ' : '') + part
    }
  }

  if (current.trim().length > 40) chunks.push(current.trim())

  return chunks
}
