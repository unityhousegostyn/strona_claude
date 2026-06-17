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
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-400 hover:underline">
        Pobierz
      </a>
    )
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm text-teal-400 hover:underline">
        Podgląd
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#081918] border border-[#0f2d2a] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-w-4xl w-full max-h-[92dvh] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#0f2d2a] flex-shrink-0">
              <p className="text-sm font-medium text-[#f0fdfa] truncate max-w-xs">{name}</p>
              <div className="flex items-center gap-3">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-teal-400 hover:underline"
                  download
                >
                  ⬇ Pobierz
                </a>
                <button
                  onClick={() => setOpen(false)}
                  className="text-[#0f766e] hover:text-[#f0fdfa] text-xl leading-none px-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-[#051210]">
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
