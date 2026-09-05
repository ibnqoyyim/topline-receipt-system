import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const MIN_VISIBLE_MS = 160
const FADE_MS = 80

export function usePageLoadingScreen(): { visible: boolean; fading: boolean } {
  const { pathname } = useLocation()
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    setVisible(true)
    setFading(false)

    const fadeTimer = window.setTimeout(() => setFading(true), MIN_VISIBLE_MS)
    const hideTimer = window.setTimeout(() => {
      setVisible(false)
      setFading(false)
    }, MIN_VISIBLE_MS + FADE_MS)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(hideTimer)
    }
  }, [pathname])

  return { visible, fading }
}
