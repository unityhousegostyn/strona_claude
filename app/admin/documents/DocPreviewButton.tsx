'use client'

import { useState } from 'react'

interface Props {
  url: string
  name: string
}

const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)
const isPdf = (name: string) => /\.pdf$/i.test(name)

export default function DocPreviewButton({ url, name }: Props) {
  const [open, setOpen] = useState(false)
  const canPreview = isImage(name) || isPdf(name)

  if (!canPreview) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline">
        Pobierz
      </a>
    )
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm text-blue-400 hover:underline">
        Podgląd
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden flex flex-col max-w-4xl w-full max-h-[90vh] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
              <p className="text-sm font-medium text-gray-100 truncate max-w-xs">{name}</p>
              <div className="flex items-center gap-3">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline"
                  download
                >
                  ⬇ Pobierz
                </a>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-100 text-xl leading-none px-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-gray-950">
              {isImage(name) ? (
                <img
                  src={url}
                  alt={name}
                  className="max-w-full max-h-[80vh] object-contain mx-auto block p-4"
                />
              ) : (
                <iframe
                  src={url}
                  title={name}
                  className="w-full h-[75vh] border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
