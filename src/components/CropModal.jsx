import { useRef, useState, useEffect, useCallback } from 'react'

export default function CropModal({ imageSrc, onSave, onCancel, circular = true }) {
  const canvasRef    = useRef()
  const imageRef     = useRef(new Image())
  const isDragging   = useRef(false)
  const lastPos      = useRef({ x: 0, y: 0 })

  const SIZE = 280 // canvas display size
  const [zoom, setZoom]     = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)

  // Load image
  useEffect(() => {
    const img = imageRef.current
    img.onload = () => {
      // Center image initially
      const scale = Math.max(SIZE / img.width, SIZE / img.height)
      setZoom(scale)
      setOffset({ x: 0, y: 0 })
    }
    img.src = imageSrc
  }, [imageSrc])

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const img = imageRef.current
    if (!img.complete || !img.naturalWidth) return

    ctx.clearRect(0, 0, SIZE, SIZE)

    // Draw image
    const w = img.naturalWidth  * zoom
    const h = img.naturalHeight * zoom
    const x = (SIZE - w) / 2 + offset.x
    const y = (SIZE - h) / 2 + offset.y
    ctx.drawImage(img, x, y, w, h)

    // Dark overlay outside circle
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Circle border
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 8, 0, Math.PI * 2)
    ctx.stroke()

    // Grid lines inside circle
    ctx.save()
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 8, 0, Math.PI * 2)
    ctx.clip()
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 0.5
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(SIZE * i / 3, 8); ctx.lineTo(SIZE * i / 3, SIZE - 8); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(8, SIZE * i / 3); ctx.lineTo(SIZE - 8, SIZE * i / 3); ctx.stroke()
    }
    ctx.restore()
  }, [zoom, offset, imageSrc])

  function handleMouseDown(e) {
    isDragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }

  function handleMouseMove(e) {
    if (!isDragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }))
  }

  function handleMouseUp() { isDragging.current = false }

  function handleTouchStart(e) {
    isDragging.current = true
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  function handleTouchMove(e) {
    if (!isDragging.current) return
    e.preventDefault()
    const dx = e.touches[0].clientX - lastPos.current.x
    const dy = e.touches[0].clientY - lastPos.current.y
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }))
  }

  function handleWheel(e) {
    e.preventDefault()
    setZoom(z => Math.max(0.5, Math.min(4, z - e.deltaY * 0.001)))
  }

  async function handleSave() {
    setSaving(true)
    const canvas = canvasRef.current
    const img    = imageRef.current
    const output = document.createElement('canvas')
    const R      = SIZE / 2 - 8
    const D      = R * 2
    output.width  = D
    output.height = D
    const ctx = output.getContext('2d')

    // Clip to circle
    ctx.beginPath()
    ctx.arc(R, R, R, 0, Math.PI * 2)
    ctx.clip()

    // Draw cropped image
    const w = img.naturalWidth  * zoom
    const h = img.naturalHeight * zoom
    const x = (SIZE - w) / 2 + offset.x - (SIZE / 2 - R)
    const y = (SIZE - h) / 2 + offset.y - (SIZE / 2 - R)
    ctx.drawImage(img, x, y, w, h)

    output.toBlob(blob => {
      onSave(blob)
      setSaving(false)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="crop-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="crop-modal">
        <div className="crop-modal-header">
          <span className="crop-modal-title">Crop your photo</span>
          <button className="crop-modal-close" onClick={onCancel}>✕</button>
        </div>

        <div className="crop-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            style={{ cursor: 'grab', display: 'block', maxWidth: '100%' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            onWheel={handleWheel}
          />
          <div className="crop-canvas-hint">Drag to reposition · Scroll or pinch to zoom</div>
        </div>

        <div className="crop-controls">
          <div className="crop-zoom-row">
            <span className="crop-zoom-label">Zoom</span>
            <input
              type="range" min="0.5" max="4" step="0.05"
              value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span className="crop-zoom-val">{zoom.toFixed(1)}×</span>
          </div>
          <div className="crop-actions">
            <button className="crop-btn-cancel" onClick={onCancel}>Cancel</button>
            <button className="crop-btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save photo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
