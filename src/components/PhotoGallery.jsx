import { useState, useEffect } from 'react'

export default function PhotoGallery({ photos, startIndex = 0, onClose }) {
  const [current, setCurrent] = useState(startIndex)

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'ArrowLeft')  setCurrent(c => (c - 1 + photos.length) % photos.length)
      if (e.key === 'ArrowRight') setCurrent(c => (c + 1) % photos.length)
      if (e.key === 'Escape')     onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [photos.length])

  function prev() { setCurrent(c => (c - 1 + photos.length) % photos.length) }
  function next() { setCurrent(c => (c + 1) % photos.length) }

  if (!photos || photos.length === 0) return null

  return (
    <div className="gallery-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="gallery-modal">

        {/* Close */}
        <button className="gallery-close-btn" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Main image */}
        <div className="gallery-main">
          <img
            key={current}
            src={photos[current]}
            alt={`Club photo ${current + 1}`}
            className="gallery-main-img"
          />

          {/* Nav arrows */}
          {photos.length > 1 && (
            <>
              <button className="gallery-nav gallery-nav-left" onClick={prev}>‹</button>
              <button className="gallery-nav gallery-nav-right" onClick={next}>›</button>
            </>
          )}

          {/* Counter */}
          <div className="gallery-counter">{current + 1} / {photos.length}</div>
        </div>

        {/* Thumbnails */}
        {photos.length > 1 && (
          <div
            className="gallery-thumbs"
            style={{ '--thumb-count': photos.length }}
          >
            {photos.map((url, i) => (
              <div
                key={i}
                className={`gallery-thumb ${i === current ? 'active' : ''}`}
                onClick={() => setCurrent(i)}
              >
                <img src={url} alt={`Thumb ${i + 1}`} className="gallery-thumb-img" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
