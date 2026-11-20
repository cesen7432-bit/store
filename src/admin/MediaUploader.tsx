import { ImagePlus, Loader2, Play, Star, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import clsx from 'clsx'
import { api } from '../services/api'
import { mediaUrl } from '../config/store'
import type { ProjectMedia } from '../types'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime'

/** Subida de fotos y videos (el primero es la portada) */
export function MediaUploader({ value, onChange }: { value: ProjectMedia[]; onChange: (m: ProjectMedia[]) => void }) {
  const [uploading, setUploading] = useState(0)
  const [drag, setDrag] = useState(false)

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    const list = Array.from(files)
    setUploading(list.length)
    const added: ProjectMedia[] = []
    for (const f of list) {
      try {
        added.push(await api.admin.uploadMedia(f))
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (added.length) onChange([...value, ...added])
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {value.map((m, i) => (
          <div key={m.url + i} className={clsx('group relative aspect-video overflow-hidden rounded-md border bg-black', i === 0 ? 'border-primary' : 'border-white/10')}>
            {m.type === 'video' ? (
              <>
                <video src={mediaUrl(m.url) + '#t=0.5'} muted preload="metadata" className="h-full w-full object-cover" />
                <Play size={16} className="absolute right-1.5 bottom-1.5 fill-white text-white" />
              </>
            ) : (
              <img src={mediaUrl(m.url)} alt="" className="h-full w-full object-cover" />
            )}
            {i === 0 && <span className="absolute top-1 left-1 rounded bg-primary px-1.5 text-[10px] font-bold text-black">PORTADA</span>}
            <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition group-hover:opacity-100">
              {i > 0 && (
                <button type="button" title="Usar como portada" onClick={() => onChange([m, ...value.filter((_, k) => k !== i)])} className="rounded bg-white/10 p-1.5 hover:bg-white/20">
                  <Star size={14} />
                </button>
              )}
              <button type="button" title="Quitar" onClick={() => onChange(value.filter((_, k) => k !== i))} className="rounded bg-white/10 p-1.5 hover:bg-red-500">
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            upload(e.dataTransfer.files)
          }}
          className={clsx(
            'flex aspect-video cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-center text-xs text-muted transition',
            drag ? 'border-primary bg-primary/10' : 'border-white/15 hover:border-primary/60',
          )}
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          {uploading ? `Subiendo ${uploading}…` : 'Fotos o videos'}
          <input type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">Fotos JPG/PNG/WebP o videos MP4/WebM/MOV (máx. 60 MB). El primero es la portada.</p>
    </div>
  )
}
