import { useState, useEffect, useRef } from 'react'

const CHECK_INTERVAL = 15000 // 15 seconds

export default function UpdateBanner() {
  const [show, setShow] = useState(false)
  const initialEtag = useRef(null)
  const dismissed = useRef(false)

  useEffect(() => {
    // Only run in production (not local dev)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return

    async function getEtag() {
      try {
        const res = await fetch('/', { method: 'HEAD', cache: 'no-store' })
        return res.headers.get('etag') || res.headers.get('last-modified') || null
      } catch {
        return null
      }
    }

    async function init() {
      initialEtag.current = await getEtag()
    }

    async function check() {
      if (dismissed.current) return
      const current = await getEtag()
      if (current && initialEtag.current && current !== initialEtag.current) {
        setShow(true)
      }
    }

    init()
    const interval = setInterval(check, CHECK_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  function handleRefresh() {
    window.location.reload()
  }

  function handleDismiss() {
    dismissed.current = true
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="update-banner">
      <span className="update-banner-dot" />
      <span className="update-banner-text">A new version is available</span>
      <button className="update-banner-refresh" onClick={handleRefresh}>Refresh</button>
      <button className="update-banner-dismiss" onClick={handleDismiss} aria-label="Dismiss">✕</button>
    </div>
  )
}
