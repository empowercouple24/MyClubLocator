import { useEffect, useRef } from 'react'
import Quill from 'quill'

let cssInjected = false
function ensureCss() {
  if (cssInjected) return
  cssInjected = true
  const link = document.createElement('link')
  link.rel  = 'stylesheet'
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/quill/2.0.3/quill.snow.min.css'
  document.head.appendChild(link)
}

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['clean'],
]

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 140 }) {
  const wrapRef     = useRef(null)
  const quillRef    = useRef(null)
  const skipRef     = useRef(false)
  const cbRef       = useRef(onChange)
  useEffect(() => { cbRef.current = onChange }, [onChange])

  useEffect(() => {
    ensureCss()
    if (!wrapRef.current || quillRef.current) return
    const q = new Quill(wrapRef.current, {
      theme: 'snow',
      placeholder: placeholder || 'Enter message…',
      modules: { toolbar: TOOLBAR },
    })
    quillRef.current = q
    if (value) q.clipboard.dangerouslyPasteHTML(value)
    q.on('text-change', () => {
      skipRef.current = true
      const html = q.root.innerHTML
      cbRef.current(html === '<p><br></p>' ? '' : html)
    })
    return () => { q.off('text-change') }
  }, [])

  useEffect(() => {
    const q = quillRef.current
    if (!q) return
    if (skipRef.current) { skipRef.current = false; return }
    const incoming = value || ''
    if (q.root.innerHTML !== incoming) q.clipboard.dangerouslyPasteHTML(incoming)
  }, [value])

  return (
    <div className="rte-wrap" style={{ '--rte-min': `${minHeight}px` }}>
      <div ref={wrapRef} />
    </div>
  )
}
