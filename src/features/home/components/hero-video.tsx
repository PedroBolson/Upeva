import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PawPrint } from 'lucide-react'
import { Button } from '@/components/ui'

const HERO_BG = '#fdf8f0'
const DESKTOP_SRC = '/hero/upeva-hero.mp4'
const MOBILE_SRC = '/hero/upeva-hero-mobile.mp4'
const MOBILE_MQ = '(max-width: 767px)'

function getIsMobile(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches
}

export function HeroVideo() {
  // Initialised synchronously from matchMedia so the correct src is used on
  // the very first render — no flicker, no wrong-video flash.
  const [isMobile, setIsMobile] = useState<boolean>(getIsMobile)

  const videoRef = useRef<HTMLVideoElement>(null)
  // Mirrors the last isMobile value we acted on. When isMobile === isMobileRef
  // the breakpoint hasn't actually changed — skip reload. This correctly
  // handles both the initial mount and React Strict Mode's double-invoke.
  const isMobileRef = useRef(isMobile)
  // Prevents the onEnded handler from firing twice (Safari sometimes fires the
  // ended event more than once on the same playback).
  const hasEndedRef = useRef(false)

  // Track real breakpoint crossings only. Scroll, touch, theme changes, and
  // React re-renders never fire this listener.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // When the breakpoint genuinely changes at runtime, reload the new source and
  // restart playback. No-ops on initial mount (same value) and on Strict Mode
  // remount (ref survived cleanup, value still matches).
  useEffect(() => {
    if (isMobileRef.current === isMobile) return
    isMobileRef.current = isMobile
    hasEndedRef.current = false
    const video = videoRef.current
    if (!video) return
    video.load()
    video.play().catch(() => {
      // Autoplay may be blocked by the browser — acceptable; the poster/first
      // frame remains visible.
    })
  }, [isMobile])

  // Safari resets currentTime to 0 after a non-looping video ends, causing a
  // visible first-frame flash. We clamp it to just before the last frame.
  // hasEndedRef guards against the ended event firing more than once.
  const handleVideoEnded = useCallback(() => {
    if (hasEndedRef.current) return
    hasEndedRef.current = true
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.currentTime = Math.max(video.duration - 0.05, 0)
  }, [])

  return (
    <section
      className="relative overflow-hidden min-h-screen"
      style={{ backgroundColor: HERO_BG }}
    >
      {/* Single video element — src is stable within a breakpoint so React never
          touches the DOM attribute on re-renders, theme changes, or scrolls. */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
        onEnded={handleVideoEnded}
        className="absolute inset-0 h-full w-full object-cover object-center"
        src={isMobile ? MOBILE_SRC : DESKTOP_SRC}
      />

      {/* Mobile overlay — uniform cream tint so text stays readable */}
      <div
        aria-hidden="true"
        className="absolute inset-0 md:hidden pointer-events-none"
        style={{ backgroundColor: 'rgba(253,248,240,0.62)' }}
      />

      {/* Desktop/tablet overlay — left-to-right gradient over the 16:9 video */}
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden md:block pointer-events-none"
        style={{
          background:
            'linear-gradient(to right, rgba(253,248,240,0.90) 0%, rgba(253,248,240,0.50) 42%, rgba(253,248,240,0.10) 68%, transparent 100%)',
        }}
      />

      {/* Bottom-edge blend — cream into page background; adapts to light/dark mode
          via the CSS custom property without needing Tailwind dark: variants. */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-20 md:h-28 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--background))' }}
      />

      {/* Text content — z-10 above all overlays.
          pt-20 clears the fixed 64 px header on mobile.
          Viewport-relative padding on larger breakpoints sits in the upper third. */}
      <div
        className="relative z-10 mx-auto max-w-6xl w-full px-4 sm:px-6 lg:px-8
                   pt-20 sm:pt-[10vh] md:pt-[11vh] lg:pt-[12vh] pb-16"
      >
        <div className="max-w-130">

          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight hero-animate-h1"
            style={{ color: '#1c1410' }}
          >
            <span className="lg:whitespace-nowrap">
              Todo animal merece{' '}
              <span className="text-primary">um lar</span>
            </span>
            <br className="hidden lg:block" />
            {' '}com amor
          </h1>

          <p
            className="mt-5 text-lg leading-relaxed hero-animate-body"
            style={{ color: '#5c4030' }}
          >
            A Upeva conecta cães e gatos resgatados com famílias que querem
            dar amor. Adote um companheiro e transforme duas vidas ao mesmo
            tempo.
          </p>

          <div className="mt-3 flex flex-wrap gap-3 hero-animate-ctas">
            <Link to="/animais">
              <Button size="lg" className="gap-2">
                <PawPrint size={20} className="mb-1" />
                Vitrine virtual
              </Button>
            </Link>
            <Link to="/sobre">
              <Button
                variant="outline"
                size="lg"
                style={{
                  borderColor: '#c9a882',
                  color: '#5c3d1e',
                  backgroundColor: 'transparent',
                }}
                className="hover:opacity-80 transition-opacity"
              >
                Conheça a Upeva
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </section>
  )
}
