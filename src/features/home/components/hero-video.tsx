import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PawPrint } from 'lucide-react'
import { Button } from '@/components/ui'

const HERO_BG = '#fdf8f0'
const DESKTOP_WEBM_SRC = '/hero/upeva-hero-v2.webm'
const DESKTOP_MP4_SRC = '/hero/upeva-hero-v2.mp4'
const DESKTOP_POSTER_SRC = '/hero/upeva-hero-poster-v2.webp'
const MOBILE_WEBM_SRC = '/hero/upeva-hero-mobile-v2.webm'
const MOBILE_MP4_SRC = '/hero/upeva-hero-mobile-v2.mp4'
const MOBILE_POSTER_SRC = '/hero/upeva-hero-mobile-poster-v2.webp'
const MOBILE_MQ = '(max-width: 767px)'
const REDUCED_MOTION_MQ = '(prefers-reduced-motion: reduce)'

type NetworkInformationWithSaveData = {
  saveData?: boolean
  addEventListener?: (type: 'change', listener: () => void) => void
  removeEventListener?: (type: 'change', listener: () => void) => void
}

type HeroVideoVariant = {
  key: 'desktop' | 'mobile'
  poster: string
  sources: Array<{ src: string; type: string }>
}

const DESKTOP_VARIANT: HeroVideoVariant = {
  key: 'desktop',
  poster: DESKTOP_POSTER_SRC,
  sources: [
    { src: DESKTOP_WEBM_SRC, type: 'video/webm' },
    { src: DESKTOP_MP4_SRC, type: 'video/mp4' },
  ],
}

const MOBILE_VARIANT: HeroVideoVariant = {
  key: 'mobile',
  poster: MOBILE_POSTER_SRC,
  sources: [
    { src: MOBILE_WEBM_SRC, type: 'video/webm' },
    { src: MOBILE_MP4_SRC, type: 'video/mp4' },
  ],
}

const LETTERS = [
  { x: 24, char: 'u', fill: '#c2247a', delay: '0s' },
  { x: 111, char: 'p', fill: '#e72c85', delay: '0.14s' },
  { x: 198, char: 'e', fill: '#f05a48', delay: '0.28s' },
  { x: 285, char: 'v', fill: '#00a7a0', delay: '0.42s' },
  { x: 370, char: 'a', fill: '#4fb760', delay: '0.56s' },
] as const

function getIsMobile(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches
}

function getSaveDataEnabled(): boolean {
  if (typeof navigator === 'undefined') return false
  const connection = (
    navigator as Navigator & { connection?: NetworkInformationWithSaveData }
  ).connection
  return connection?.saveData === true
}

function getShouldLoadVideo(): boolean {
  return (
    typeof window !== 'undefined' &&
    !window.matchMedia(REDUCED_MOTION_MQ).matches &&
    !getSaveDataEnabled()
  )
}

export function HeroVideo() {
  // Initialised synchronously from matchMedia so the correct variant is used on
  // the very first render: no flicker, no wrong-video flash.
  const [isMobile, setIsMobile] = useState<boolean>(getIsMobile)
  const [shouldLoadVideo, setShouldLoadVideo] = useState<boolean>(getShouldLoadVideo)

  // Readiness is tracked by active variant. Switching breakpoint naturally
  // resets readiness without needing to clear state in the render path.
  const currentVariant = isMobile ? MOBILE_VARIANT : DESKTOP_VARIANT
  const [readyVariant, setReadyVariant] = useState<HeroVideoVariant['key'] | null>(null)
  const isVideoReady = !shouldLoadVideo || readyVariant === currentVariant.key

  const videoRef = useRef<HTMLVideoElement>(null)
  // Mirrors the last variant/loading mode we acted on. When the key is stable,
  // scroll, theme changes, and React re-renders never trigger a reload.
  const videoLoadKeyRef = useRef(`${currentVariant.key}:${shouldLoadVideo}`)
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

  // Track user/network preferences that should avoid autoplaying video.
  useEffect(() => {
    const motionMq = window.matchMedia(REDUCED_MOTION_MQ)
    const connection = (
      navigator as Navigator & { connection?: NetworkInformationWithSaveData }
    ).connection
    const updateShouldLoadVideo = () => {
      setShouldLoadVideo(!motionMq.matches && !getSaveDataEnabled())
    }

    motionMq.addEventListener('change', updateShouldLoadVideo)
    connection?.addEventListener?.('change', updateShouldLoadVideo)
    return () => {
      motionMq.removeEventListener('change', updateShouldLoadVideo)
      connection?.removeEventListener?.('change', updateShouldLoadVideo)
    }
  }, [])

  // When the breakpoint or loading mode genuinely changes at runtime, reload
  // the active source list and restart playback. If video loading is disabled,
  // load() applies the source removal and leaves only the poster visible.
  useEffect(() => {
    const videoLoadKey = `${currentVariant.key}:${shouldLoadVideo}`
    if (videoLoadKeyRef.current === videoLoadKey) return
    videoLoadKeyRef.current = videoLoadKey
    hasEndedRef.current = false
    const video = videoRef.current
    if (!video) return
    video.load()
    if (!shouldLoadVideo) return
    video.play().catch(() => {
      // Autoplay may be blocked by the browser — acceptable; the poster/first
      // frame remains visible.
    })
  }, [currentVariant.key, shouldLoadVideo])

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

  // canplay fires when the browser has buffered enough to begin playback —
  // earlier than canplaythrough (full buffer) so the fallback doesn't linger.
  // Marking the active variant as ready handles breakpoint changes safely.
  const handleCanPlay = useCallback(() => {
    setReadyVariant(currentVariant.key)
  }, [currentVariant.key])

  return (
    <section
      className="relative overflow-hidden min-h-screen"
      style={{ backgroundColor: HERO_BG }}
    >
      {/* Single video element with only the active breakpoint's sources attached. */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        preload="metadata"
        poster={currentVariant.poster}
        aria-hidden="true"
        onEnded={handleVideoEnded}
        onCanPlay={handleCanPlay}
        className="absolute inset-0 h-full w-full object-cover object-center"
      >
        {shouldLoadVideo &&
          currentVariant.sources.map((source) => (
            <source key={source.type} src={source.src} type={source.type} />
          ))}
      </video>

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

      {/* Loading fallback — covers the Hero visual area while the video buffers.
          Fades out smoothly once canplay fires. Sits above overlays (z-[5]) but
          below text (z-10) so buttons and headings remain accessible at all times. */}
      <div
        aria-hidden="true"
        className="hero-video-fallback absolute inset-0 z-5 flex items-center justify-center pointer-events-none"
        style={{
          backgroundColor: HERO_BG,
          opacity: isVideoReady ? 0 : 1,
        }}
      >
        <svg
          width="260"
          height="75"
          viewBox="0 0 520 150"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <filter
              id="hero-wm-shadow"
              x="-8%"
              y="-8%"
              width="116%"
              height="124%"
              colorInterpolationFilters="sRGB"
            >
              <feDropShadow
                dx="0"
                dy="10"
                stdDeviation="8"
                floodColor="#412d1d"
                floodOpacity="0.22"
              />
            </filter>
          </defs>
          <g
            filter="url(#hero-wm-shadow)"
            fontFamily="Arial Rounded MT Bold, Nunito, Arial, sans-serif"
            fontSize="106"
            fontWeight="900"
            letterSpacing="-6"
          >
            {LETTERS.map(({ x, char, fill, delay }) => (
              <text
                key={char}
                x={x}
                y={108}
                fill={fill}
                stroke="#17110f"
                strokeWidth="14"
                strokeLinejoin="round"
                paintOrder="stroke fill"
                className="hero-wordmark-letter"
                style={{ animationDelay: delay }}
              >
                {char}
              </text>
            ))}
          </g>
        </svg>
      </div>

      {/* Screen-reader live region — announces while loading, clears when ready */}
      <p role="status" className="sr-only">
        {isVideoReady ? '' : 'Carregando animação da Upeva'}
      </p>

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
