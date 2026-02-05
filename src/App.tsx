import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  Clock,
  HeartHandshake,
  Image as ImageIcon,
  Info,
  Link as LinkIcon,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MapPin,
  Phone,
  Plus,
  Pencil,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Video,
  X,
} from 'lucide-react'

import { api, API_BASE } from './lib/api'
import { prettyError, uploadImage, useAuth } from './lib/auth'
import type {
  ContactRow,
  EventRow,
  FooterLinkRow,
  GalleryRow,
  ProgramRow,
  SiteConfigRow,
  UserRow,
} from './lib/types'

/**
 * Frontend rebuilt from your uploaded masidsite.txt:
 * - Keeps the same locked navy/gold look
 * - Replaces localStorage content with MySQL-backed API calls
 * - Adds super_admin Users management (GET/POST /users)
 */

// -----------------------------------------------------------------------------
// Theme helpers
// -----------------------------------------------------------------------------

const THEME = {
  ink: '#0B1430',
  ink2: '#0E1C3D',
  sand: '#F3F0E6',
  gold: '#D8B15A',
}

function toAbsoluteUrl(url: string): string {
  const u = String(url || '').trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith('/')) {
    const origin = API_BASE.replace(/\/api\/?$/i, '')
    return origin + u
  }
  return u
}




function getGoogleMapsEmbedSrc(address: string): string {
  const a = String(address || '').trim()
  if (!a) return ''
  return `https://www.google.com/maps?q=${encodeURIComponent(a)}&output=embed`
}

function buildFacebookEmbedSrc(rawUrl: string): { src: string; href: string } {
  const raw = String(rawUrl || '').trim()
  if (!raw) return { src: '', href: '' }

  // Facebook blocks framing of web.facebook.com / facebook.com pages directly (X-Frame-Options).
  // Use the official plugin endpoints instead when a normal FB URL is provided.
  const isFb = /https?:\/\/(www\.|web\.)?facebook\.com\//i.test(raw)
  const isPlugin = /facebook\.com\/plugins\//i.test(raw)
  const isShareVideoLink = /\/share\/v\//i.test(raw)
  const isVideoLink = /\/videos\//i.test(raw) || /facebook\.com\/watch\/?/i.test(raw) || isShareVideoLink
  const isLiveLink = /\/live\//i.test(raw) || /live_videos/i.test(raw) || /watch\/live/i.test(raw)

  const href = raw.replace('web.facebook.com', 'www.facebook.com')
  if (isPlugin) return { src: href, href }
  if (!isFb) return { src: href, href }

  const enc = encodeURIComponent(href)
  if (isVideoLink || isLiveLink) {
    return { src: `https://www.facebook.com/plugins/video.php?href=${enc}&show_text=false&width=1280&height=720`, href }
  }
  return {
    src: `https://www.facebook.com/plugins/page.php?href=${enc}&tabs=timeline&width=1280&height=720&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false`,
    href,
  }
}

function cn(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(' ')
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function msToHMS(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

function formatTime12h(hhmm: string) {
  if (!hhmm) return ''
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})/)
  if (!m) return hhmm
  let h = Number(m[1])
  const min = m[2]
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${min} ${ampm}`
}

function parseBroadcastDateTime(date: string, time: string) {
  if (!date || !time) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (!/^\d{2}:\d{2}$/.test(time)) return null
  const dt = new Date(`${date}T${time}:00`)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

// -----------------------------------------------------------------------------
// UI primitives
// -----------------------------------------------------------------------------

function GoldButton({
  children,
  onClick,
  type = 'button',
  className,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-ink hover:opacity-95 disabled:opacity-50',
        className
      )}
    >
      {children}
    </button>
  )
}

function GhostButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-sand/90 hover:bg-white/10',
        className
      )}
    >
      {children}
    </button>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-sand placeholder:text-sand/40 outline-none focus:border-gold/25',
        props.className
      )}
    />
  )
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-sand placeholder:text-sand/40 outline-none focus:border-gold/25',
        props.className
      )}
    />
  )
}

function Panel({
  title,
  icon,
  children,
  right,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <div className="font-display text-base text-sand">{title}</div>
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function Divider({ label }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/10" />
      {label ? <div className="text-xs text-sand/55">{label}</div> : null}
      <div className="h-px flex-1 bg-white/10" />
    </div>
  )
}

function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  // NOTE: The whole app re-renders every second (prayer/broadcast countdown).
  // If we depend on `onClose`, the timeout is constantly reset and the toast never disappears.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!text) return undefined
    const t = window.setTimeout(() => onCloseRef.current(), 2500)
    return () => window.clearTimeout(t)
  }, [text])

  // Mobile Safari (and some embedded webviews) treat `position: fixed` as relative to the nearest
  // transformed ancestor. Because parts of this app animate with transforms, the toast can end up
  // clipped/off-screen on mobile. Rendering via a portal anchors it to the real viewport.
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {text ? (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] left-1/2 z-[60] w-[min(520px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-ink2/90 px-4 py-3 shadow-soft backdrop-blur"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-sand/90">{text}</div>
            <button onClick={onClose} className="rounded-lg p-1 text-sand/70 hover:bg-white/10" type="button">
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}

// -----------------------------------------------------------------------------
// Header / Nav
// -----------------------------------------------------------------------------

function Header({
  brandName,
  subtitle,
  logoUrl,
  active,
  setActive,
  hasAdmin,
}: {
  brandName: string
  subtitle: string
  logoUrl: string
  active: string
  setActive: (v: string) => void
  hasAdmin: boolean
}) {
  const nav = [
    { id: 'home', label: 'Home' },
    { id: 'prayer', label: 'Prayer Times' },
    { id: 'about', label: 'About' },
    { id: 'programs', label: 'Programs' },
    { id: 'events', label: 'Events' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'donations', label: 'Donations' },
    { id: 'contact', label: 'Contact' },
    ...(hasAdmin ? [{ id: 'admin', label: 'Admin' }] : []),
  ]

  const [open, setOpen] = useState(false)

  const go = (id: string) => {
    setActive(id)
    setOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => go('home')} className="flex items-center gap-3 text-left">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="h-10 w-10 rounded-xl border border-white/10 object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/5" />
          )}
          <div>
            <div className="font-display text-lg text-sand">{brandName}</div>
            <div className="text-xs text-sand/55">{subtitle}</div>
          </div>
        </button>

        <nav className="hidden items-center gap-2 md:flex">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => go(n.id)}
              className={cn(
                'rounded-xl px-3 py-2 text-sm text-sand/70 hover:bg-white/5 hover:text-sand',
                active === n.id && 'bg-white/5 text-sand'
              )}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-sand md:hidden"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/10 bg-ink/95 md:hidden"
          >
            <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
              <div className="grid gap-1">
                {nav.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => go(n.id)}
                    className={cn(
                      'rounded-xl px-3 py-3 text-left text-sm text-sand/80 hover:bg-white/5 hover:text-sand',
                      active === n.id && 'bg-white/5 text-sand'
                    )}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}

function Page({
  id,
  active,
  children,
}: {
  id: string
  active: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className={cn(active === id ? 'block' : 'hidden')}>
      {children}
    </section>
  )
}

// -----------------------------------------------------------------------------
// Public pages
// -----------------------------------------------------------------------------

type PrayerTimes = {
  Fajr: string
  Sunrise: string
  Dhuhr: string
  Asr: string
  Maghrib: string
  Isha: string
}

function getNextPrayer(now: Date, t: PrayerTimes | null) {
  if (!t) return null
  const order: Array<keyof PrayerTimes> = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
  const today = now.toISOString().slice(0, 10)
  const times = order
    .map((k) => {
      const hhmm = t[k]
      const dt = new Date(`${today}T${hhmm}:00`)
      return { key: k, time: dt }
    })
    .filter((x) => !Number.isNaN(x.time.getTime()))

  for (const it of times) {
    if (it.time.getTime() > now.getTime()) return it
  }
  // else tomorrow fajr
  const fajr = t.Fajr
  const dt = new Date(`${today}T${fajr}:00`)
  dt.setDate(dt.getDate() + 1)
  return { key: 'Fajr' as const, time: dt }
}

function HomeHero({
  cfg,
  nextPrayer,
  countdown,
  onGo,
  cfgReady,
}: {
  cfg: SiteConfigRow
  nextPrayer: any
  countdown: string | null
  onGo: (id: string) => void
  cfgReady: boolean
}) {
  const primaryHero = toAbsoluteUrl(cfg.hero_image_url)
  const fallbackHero = toAbsoluteUrl(cfg.hero_image_fallback_url)
  const [heroImg, setHeroImg] = useState<string>('')

  useEffect(() => {
    if (!cfgReady) return
    if (!primaryHero) {
      setHeroImg(fallbackHero)
      return
    }
    let alive = true
    // Show the primary hero immediately to avoid a visible "fallback -> primary" flash.
    // If it fails to load, swap to the fallback.
    setHeroImg(primaryHero)
    const img = new Image()
    img.src = primaryHero
    img.onerror = () => {
      if (alive) setHeroImg(fallbackHero)
    }
    return () => {
      alive = false
    }
  }, [primaryHero, fallbackHero, cfgReady])


  const broadcastDt = parseBroadcastDateTime(cfg.broadcast_date, cfg.broadcast_time)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const broadcastCountdown = useMemo(() => {
    if (!broadcastDt) return null
    return msToHMS(broadcastDt.getTime() - now.getTime())
  }, [broadcastDt, now])

  return (
    <div className="pattern">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:px-8 md:grid-cols-2 md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs text-sand/80">
            <ShieldCheck className="h-3.5 w-3.5 text-gold" /> {cfg.brand_est}
          </div>
          <h1 className="mt-4 font-display text-3xl text-sand sm:text-4xl">{cfg.hero_headline}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-sand/75">{cfg.hero_body}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <GoldButton onClick={() => onGo('donations')}>Donate <HeartHandshake className="h-4 w-4" /></GoldButton>
            <GhostButton onClick={() => onGo('programs')}>Programs <BookOpen className="h-4 w-4 text-gold" /></GhostButton>
            <GhostButton onClick={() => onGo('events')}>Events <Calendar className="h-4 w-4 text-gold" /></GhostButton>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-soft">
              <div className="flex items-center gap-2 text-sm text-sand/80">
                <Clock className="h-4 w-4 text-gold" /> Next prayer
              </div>
              <div className="mt-2 font-display text-lg text-sand">
                {nextPrayer?.key ? String(nextPrayer.key) : '—'}
              </div>
              <div className="mt-1 text-sm text-sand/70">
                {nextPrayer?.time ? nextPrayer.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
              <div className="mt-2 text-xs text-sand/55">Countdown: {countdown || '—'}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-soft">
              <div className="flex items-center gap-2 text-sm text-sand/80">
                <Video className="h-4 w-4 text-gold" /> Live broadcast
              </div>
              <div className="mt-2 font-display text-lg text-sand">{cfg.broadcast_name || '—'}</div>
              <div className="mt-1 text-sm text-sand/70">
                {cfg.broadcast_date ? `${cfg.broadcast_date} • ${formatTime12h(cfg.broadcast_time)}` : 'Not scheduled'}
              </div>
              <div className="mt-2 text-xs text-sand/55">Countdown: {broadcastCountdown || '—'}</div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-ink2/60 shadow-soft">
            <div className="aspect-[4/3] w-full bg-white/5">
              {heroImg ? (
                <img src={heroImg} alt="Hero" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sand/50">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="font-display text-base text-sand">{cfg.brand_name}</div>
              <div className="mt-1 text-sm text-sand/65">{cfg.brand_subtitle}</div>
              <div className="mt-4 flex items-start gap-2 text-sm text-sand/70">
                <MapPin className="mt-0.5 h-4 w-4 text-gold" />
                <div>{cfg.brand_address}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand/80 hover:bg-white/10"
                  href={`mailto:${cfg.brand_email}`}
                >
                  <Mail className="h-4 w-4 text-gold" /> {cfg.brand_email}
                </a>
                {cfg.brand_phone ? (
                  <a
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand/80 hover:bg-white/10"
                    href={`tel:${cfg.brand_phone}`}
                  >
                    <Phone className="h-4 w-4 text-gold" /> {cfg.brand_phone}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FacebookLiveSection({ cfg }: { cfg: SiteConfigRow }) {
  const primaryRaw = (cfg.live_video_url || '').trim()
  const fallbackRaw = (cfg.fallback_video_url || '').trim()
  const hasAny = Boolean(primaryRaw || fallbackRaw)
  const [useFallback, setUseFallback] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setUseFallback(false)
    setLoaded(false)
  }, [primaryRaw, fallbackRaw])

  const chosenRaw = useFallback ? (fallbackRaw || primaryRaw) : (primaryRaw || fallbackRaw)

  // IMPORTANT: Hooks must never appear after an early return.
  // On first load, cfg may not be ready yet, so `hasAny/chosenRaw` can be falsy.
  // If we returned early before this effect, React would see a different hook count on the next render.
  // (This is exactly what triggers minified React error #310: "Rendered more hooks than during the previous render".)
  useEffect(() => {
    if (!primaryRaw || !fallbackRaw) return undefined
    if (!hasAny || !chosenRaw) return undefined
    if (useFallback || loaded) return undefined
    const t = window.setTimeout(() => setUseFallback(true), 4500)
    return () => window.clearTimeout(t)
  }, [primaryRaw, fallbackRaw, hasAny, chosenRaw, useFallback, loaded])

  if (!hasAny || !chosenRaw) return null

  const built = buildFacebookEmbedSrc(chosenRaw)
  const href = built.href || chosenRaw
  const src = built.src || chosenRaw
  const isShareLink = /\/share\/v\//i.test(href)

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-gold" />
            <div className="font-display text-base text-sand">Live</div>
          </div>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-sand/80 hover:bg-white/10"
          >
            Open on Facebook <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-ink2">
          {isShareLink ? (
            <div className="flex items-center justify-center p-8 text-center">
              <div className="max-w-md">
                <div className="font-display text-lg text-sand">Video preview unavailable</div>
                <div className="mt-2 text-sm text-sand/65">
                  Facebook “share” links often can’t be embedded on websites. Please tap the button below to watch on
                  Facebook.
                </div>
                <div className="mt-4">
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink hover:opacity-95"
                  >
                    Open on Facebook <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* Fixed-height responsive wrapper (no Tailwind aspect-ratio plugin needed) */
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                key={src}
                title="live"
                src={src}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                // Facebook plugins can show a blank blue placeholder when referrer is stripped.
                // Keep the page's origin available.
                referrerPolicy="origin-when-cross-origin"
                onLoad={() => setLoaded(true)}
              />
              {/* Always-visible fallback overlay so the user can open FB even if the iframe shows a blank blue block */}
              <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-3">
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto inline-flex items-center gap-1 rounded-xl border border-white/10 bg-ink2/80 px-3 py-2 text-xs text-sand/90 backdrop-blur hover:bg-ink2"
                >
                  Video not loading? Open on Facebook <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PrayerPage() {
  const [timings, setTimings] = useState<PrayerTimes | null>(null)
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const url = 'https://api.aladhan.com/v1/timingsByCity?city=Cape%20Town&country=South%20Africa&method=2'
        const res = await fetch(url)
        const json = await res.json()
        const t = json?.data?.timings
        if (!t) throw new Error('No timings')
        const out: PrayerTimes = {
          Fajr: t.Fajr,
          Sunrise: t.Sunrise,
          Dhuhr: t.Dhuhr,
          Asr: t.Asr,
          Maghrib: t.Maghrib,
          Isha: t.Isha,
        }
        if (alive) setTimings(out)
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Failed to load')
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="font-display text-2xl text-sand">Prayer Times</div>
      <div className="mt-2 text-sm text-sand/65">Powered by AlAdhan timingsByCity (Cape Town).</div>
      <Divider />
      {err ? <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-sand/80">{err}</div> : null}
      {timings ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(timings).map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-soft">
              <div className="text-sm text-sand/70">{k}</div>
              <div className="mt-1 font-display text-xl text-sand">{formatTime12h(v)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-sand/60">Loading…</div>
      )}
    </div>
  )
}

function AboutPage({ cfg }: { cfg: SiteConfigRow }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="font-display text-2xl text-sand">About</div>
      <Divider />
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sand/75 shadow-soft">
        <p className="whitespace-pre-wrap leading-relaxed">{cfg.about_text}</p>
      </div>
    </div>
  )
}

function ProgramsPage({ programs }: { programs: ProgramRow[] }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="font-display text-2xl text-sand">Programs</div>
      <Divider />
      <div className="grid gap-4 md:grid-cols-2">
        {programs.map((p) => (
          <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-soft">
            <div className="font-display text-lg text-sand">{p.title}</div>
            <div className="mt-1 text-sm text-sand/65">{p.grades}</div>
            <div className="mt-4 text-sm leading-relaxed text-sand/75">{p.description}</div>
            <div className="mt-4 grid gap-2 text-sm text-sand/70">
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gold" /> {p.days}</div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gold" /> {p.time}</div>
            </div>
            {p.note ? <div className="mt-3 text-xs text-sand/55">{p.note}</div> : null}
          </div>
        ))}
        {programs.length === 0 ? <div className="text-sm text-sand/60">No programs yet.</div> : null}
      </div>
    </div>
  )
}

function EventsPage({ events }: { events: EventRow[] }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="font-display text-2xl text-sand">Events</div>
      <Divider />
      <div className="grid gap-4 md:grid-cols-2">
        {events.map((e) => (
          <div key={e.id} className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-soft">
            <div className="font-display text-lg text-sand">{e.title}</div>
            <div className="mt-3 grid gap-2 text-sm text-sand/70">
              {e.kind === 'oneoff' ? (
                <>
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gold" /> {e.event_date || '—'}</div>
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gold" /> {formatTime12h(e.event_time) || '—'}</div>
                </>
              ) : (
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gold" /> {e.when_text || '—'}</div>
              )}
            </div>
            {e.note ? <div className="mt-4 text-sm text-sand/75">{e.note}</div> : null}
          </div>
        ))}
        {events.length === 0 ? <div className="text-sm text-sand/60">No events yet.</div> : null}
      </div>
    </div>
  )
}

function GalleryPage({ gallery }: { gallery: GalleryRow[] }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="font-display text-2xl text-sand">Gallery</div>
      <Divider />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.map((g) => (
          <div key={g.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-soft">
            <div className="aspect-[4/3] bg-white/5">
              <img src={toAbsoluteUrl(g.image_url)} alt={g.title} className="h-full w-full object-cover" />
            </div>
            <div className="p-4 text-sm text-sand/75">{g.title || '—'}</div>
          </div>
        ))}
        {gallery.length === 0 ? <div className="text-sm text-sand/60">No photos yet.</div> : null}
      </div>
    </div>
  )
}

function DonationsPage({ cfg }: { cfg: SiteConfigRow }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="font-display text-2xl text-sand">{cfg.donations_title || 'Donations'}</div>
      <Divider />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-soft">
          <div className="text-sm text-sand/70">Why donate</div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-sand/75">{cfg.donations_body}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-soft">
          <div className="text-sm text-sand/70">Banking details</div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-sand/75">{cfg.donations_details}</div>
        </div>
      </div>
    </div>
  )
}

function ContactPage({ cfg, contacts }: { cfg: SiteConfigRow; contacts: ContactRow[] }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="font-display text-2xl text-sand">Contact</div>
      <Divider />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-soft">
          <div className="font-display text-base text-sand">{cfg.brand_name}</div>
          <div className="mt-1 text-sm text-sand/65">{cfg.brand_subtitle}</div>
          <div className="mt-4 flex items-start gap-2 text-sm text-sand/70">
            <MapPin className="mt-0.5 h-4 w-4 text-gold" />
            <div>{cfg.brand_address}</div>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-sand/75">
            <a className="inline-flex items-center gap-2" href={`mailto:${cfg.brand_email}`}>
              <Mail className="h-4 w-4 text-gold" /> {cfg.brand_email}
            </a>
            {cfg.brand_phone ? (
              <a className="inline-flex items-center gap-2" href={`tel:${cfg.brand_phone}`}>
                <Phone className="h-4 w-4 text-gold" /> {cfg.brand_phone}
              </a>
            ) : null}
          </div>

          {cfg.brand_address?.trim() ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-ink2">
              {/* Fixed-height responsive wrapper (no Tailwind aspect-ratio plugin needed) */}
              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                <iframe
                  title="map"
                  src={getGoogleMapsEmbedSrc(cfg.brand_address)}
                  className="absolute inset-0 h-full w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-soft">
          <div className="font-display text-base text-sand">Contacts</div>
          <div className="mt-4 grid gap-3">
            {contacts.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-sand">{c.role}</div>
                <div className="mt-1 text-sm text-sand/70">{c.name}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-sand/65">
                  {c.email ? (
                    <a className="inline-flex items-center gap-1 hover:text-sand" href={`mailto:${c.email}`}>
                      <Mail className="h-3.5 w-3.5 text-gold" /> {c.email}
                    </a>
                  ) : null}
                  {c.phone ? (
                    <a className="inline-flex items-center gap-1 hover:text-sand" href={`tel:${c.phone}`}>
                      <Phone className="h-3.5 w-3.5 text-gold" /> {c.phone}
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
            {contacts.length === 0 ? <div className="text-sm text-sand/60">No contacts yet.</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function Footer({ cfg, links, onNavigate }: { cfg: SiteConfigRow; links: FooterLinkRow[]; onNavigate: (id: string) => void }) {
  const year = new Date().getFullYear()
  const go = (url: string) => {
    if (url.startsWith('#')) onNavigate(url.slice(1))
    else window.open(url, '_blank', 'noreferrer')
  }

  return (
    <footer className="border-t border-white/10 bg-ink2">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:px-8 md:grid-cols-3">
        <div>
          <div className="font-display text-base text-sand">{cfg.brand_name}</div>
          <div className="mt-1 text-sm text-sand/65">{cfg.brand_subtitle}</div>
          <div className="mt-3 text-xs text-sand/60">© {year} {cfg.brand_name}.</div>
        </div>

        <div>
          <div className="font-display text-base text-sand">Links</div>
          <div className="mt-3 grid gap-2">
            {links.map((l) => (
              <button
                key={l.id}
                onClick={() => go(l.url)}
                className="text-left text-sm text-sand/75 hover:text-sand"
                type="button"
              >
                {l.label}
              </button>
            ))}
            {links.length === 0 ? <div className="text-sm text-sand/60">No footer links.</div> : null}
          </div>
        </div>

        <div>
          <div className="font-display text-base text-sand">Powered by</div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => window.open('https://www.ubuntucore.co.za', '_blank', 'noreferrer')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand/80 hover:bg-white/10"
            >
              <ArrowUpRight className="h-4 w-4 text-gold" /> www.ubuntucore.co.za
            </button>
          </div>
          <div className="mt-3 text-xs text-sand/55">(Hard-coded as requested.)</div>
        </div>
      </div>
    </footer>
  )
}

// -----------------------------------------------------------------------------
// Admin
// -----------------------------------------------------------------------------

function AdminPage({
  cfg,
  setCfg,
  events,
  setEvents,
  programs,
  setPrograms,
  contacts,
  setContacts,
  gallery,
  setGallery,
  footerLinks,
  setFooterLinks,
  users,
  setUsers,
  reloadAll,
}: {
  cfg: SiteConfigRow
  setCfg: React.Dispatch<React.SetStateAction<SiteConfigRow>>
  events: EventRow[]
  setEvents: React.Dispatch<React.SetStateAction<EventRow[]>>
  programs: ProgramRow[]
  setPrograms: React.Dispatch<React.SetStateAction<ProgramRow[]>>
  contacts: ContactRow[]
  setContacts: React.Dispatch<React.SetStateAction<ContactRow[]>>
  gallery: GalleryRow[]
  setGallery: React.Dispatch<React.SetStateAction<GalleryRow[]>>
  footerLinks: FooterLinkRow[]
  setFooterLinks: React.Dispatch<React.SetStateAction<FooterLinkRow[]>>
  users: UserRow[]
  setUsers: React.Dispatch<React.SetStateAction<UserRow[]>>
  reloadAll: () => Promise<void>
}) {
  const auth = useAuth()
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState<'site' | 'events' | 'programs' | 'contacts' | 'gallery' | 'footer' | 'users'>('site')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await auth.login(email, password)
      setToast('Logged in.')
      await reloadAll()
    } catch (err) {
      setToast(prettyError(err))
    } finally {
      setLoading(false)
    }
  }

  async function saveSitePatch(patch: Partial<SiteConfigRow>) {
    try {
      const allowed: Record<string, string> = {
        brand_name: 'brand_name',
        brand_subtitle: 'brand_subtitle',
        brand_est: 'brand_est',
        brand_address: 'brand_address',
        brand_email: 'brand_email',
        brand_phone: 'brand_phone',
        logo_url: 'logo_url',
        hero_headline: 'hero_headline',
        hero_body: 'hero_body',
        hero_image_url: 'hero_image_url',
        hero_image_fallback_url: 'hero_image_fallback_url',
        live_video_url: 'live_video_url',
        fallback_video_url: 'fallback_video_url',
        broadcast_name: 'broadcast_name',
        broadcast_date: 'broadcast_date',
        broadcast_time: 'broadcast_time',
        about_text: 'about_text',
        donations_title: 'donations_title',
        donations_body: 'donations_body',
        donations_details: 'donations_details',
      }
      const body: any = {}
      for (const k of Object.keys(patch)) {
        if (allowed[k]) body[k] = (patch as any)[k]
      }
      const res = await api.put('/content/site', body)
      if (!res.data?.ok) throw new Error('Save failed')
      setCfg(res.data.data)
      setToast('Saved.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }

  async function addEvent(item: Partial<EventRow>) {
    try {
      const res = await api.post('/events', {
        title: item.title,
        kind: item.kind === 'recurring' ? 'recurring' : 'oneoff',
        event_date: item.event_date || '',
        event_time: item.event_time || '',
        when_text: item.when_text || '',
        note: item.note || '',
      })
      if (!res.data?.ok) throw new Error('Create failed')
      const list = await api.get('/events')
      setEvents(list.data.data || [])
      setToast('Event added.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }

  async function delEvent(id: string) {
    try {
      await api.delete(`/events/${id}`)
      setEvents((x) => x.filter((e) => e.id !== id))
      setToast('Event deleted.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }


  async function updateEvent(id: string, item: Partial<EventRow>) {
    try {
      const res = await api.put(`/events/${id}`, {
        title: item.title,
        kind: item.kind === 'recurring' ? 'recurring' : 'oneoff',
        event_date: item.event_date || '',
        event_time: item.event_time || '',
        when_text: item.when_text || '',
        note: item.note || '',
      })
      if (!res.data?.ok) throw new Error('Update failed')
      const updated = res.data.data as EventRow
      if (updated?.id) setEvents((xs) => xs.map((x) => (x.id === updated.id ? updated : x)))
      setToast('Event updated.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }

  async function addProgram(item: Partial<ProgramRow>) {
    try {
      const res = await api.post('/programs', {
        title: item.title,
        grades: item.grades || '',
        description: item.description || '',
        days: item.days || '',
        time: item.time || '',
        note: item.note || '',
      })
      if (!res.data?.ok) throw new Error('Create failed')
      const list = await api.get('/programs')
      setPrograms(list.data.data || [])
      setToast('Program added.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }

  async function delProgram(id: string) {
    try {
      await api.delete(`/programs/${id}`)
      setPrograms((x) => x.filter((p) => p.id !== id))
      setToast('Program deleted.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }


  async function updateProgram(id: string, item: Partial<ProgramRow>) {
    try {
      const res = await api.put(`/programs/${id}`, {
        title: item.title,
        grades: item.grades || '',
        description: item.description || '',
        days: item.days || '',
        time: item.time || '',
        note: item.note || '',
      })
      if (!res.data?.ok) throw new Error('Update failed')
      const updated = res.data.data as ProgramRow
      if (updated?.id) setPrograms((xs) => xs.map((x) => (x.id === updated.id ? updated : x)))
      setToast('Program updated.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }

  async function addContact(item: Partial<ContactRow>) {
    try {
      const res = await api.post('/contacts', {
        role: item.role,
        name: item.name,
        email: item.email || '',
        phone: item.phone || '',
      })
      if (!res.data?.ok) throw new Error('Create failed')
      const list = await api.get('/contacts')
      setContacts(list.data.data || [])
      setToast('Contact added.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }

  async function delContact(id: string) {
    try {
      await api.delete(`/contacts/${id}`)
      setContacts((x) => x.filter((c) => c.id !== id))
      setToast('Contact deleted.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }


  async function updateContact(id: string, item: Partial<ContactRow>) {
    try {
      const res = await api.put(`/contacts/${id}`, {
        role: item.role,
        name: item.name,
        email: item.email || '',
        phone: item.phone || '',
      })
      if (!res.data?.ok) throw new Error('Update failed')
      const updated = res.data.data as ContactRow
      if (updated?.id) setContacts((xs) => xs.map((x) => (x.id === updated.id ? updated : x)))
      setToast('Contact updated.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }

  async function addGallery(item: Partial<GalleryRow>) {
    try {
      const res = await api.post('/gallery', {
        title: item.title || '',
        image_url: item.image_url,
      })
      if (!res.data?.ok) throw new Error('Create failed')
      const list = await api.get('/gallery')
      setGallery(list.data.data || [])
      setToast('Photo added.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }

  async function delGallery(id: string) {
    try {
      await api.delete(`/gallery/${id}`)
      setGallery((x) => x.filter((g) => g.id !== id))
      setToast('Photo deleted.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }

  async function addFooterLink(item: Partial<FooterLinkRow>) {
    try {
      const res = await api.post('/footer-links', {
        label: item.label,
        url: item.url,
        sort_order: Number(item.sort_order || 0),
      })
      if (!res.data?.ok) throw new Error('Create failed')
      const list = await api.get('/footer-links')
      setFooterLinks(list.data.data || [])
      setToast('Link added.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }

  async function delFooterLink(id: string) {
    try {
      await api.delete(`/footer-links/${id}`)
      setFooterLinks((x) => x.filter((l) => l.id !== id))
      setToast('Link deleted.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }


  async function updateFooterLink(id: string, item: Partial<FooterLinkRow>) {
    try {
      const res = await api.put(`/footer-links/${id}`, {
        label: item.label,
        url: item.url,
        sort_order: Number(item.sort_order || 0),
      })
      if (!res.data?.ok) throw new Error('Update failed')
      const updated = res.data.data as FooterLinkRow
      if (updated?.id) setFooterLinks((xs) => xs.map((x) => (x.id === updated.id ? updated : x)))
      setToast('Link updated.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }

  async function refreshUsers() {
    if (auth.user?.role !== 'super_admin') return
    const r = await api.get('/users')
    setUsers(r.data.data || [])
  }

  async function createUser(payload: { email: string; password: string; full_name: string; role: 'admin' | 'super_admin' }) {
    try {
      const r = await api.post('/users', payload)
      if (!r.data?.ok) throw new Error('Create failed')
      await refreshUsers()
      setToast('User created.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }
  async function updateUser(id: string, patch: Partial<UserRow> & { password?: string }) {
    try {
      const body: any = {}
      if (Object.prototype.hasOwnProperty.call(patch, 'full_name')) body.full_name = String(patch.full_name || '')
      if (Object.prototype.hasOwnProperty.call(patch, 'role')) body.role = patch.role === 'super_admin' ? 'super_admin' : 'admin'
      if (Object.prototype.hasOwnProperty.call(patch, 'is_active')) body.is_active = patch.is_active ? 1 : 0
      if (patch.password) body.password = String(patch.password)
      const r = await api.put(`/users/${id}`, body)
      if (!r.data?.ok) throw new Error('Update failed')
      await refreshUsers()
      setToast('User updated.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }

  async function deleteUser(id: string) {
    try {
      const r = await api.delete(`/users/${id}`)
      if (!r.data?.ok) throw new Error('Delete failed')
      await refreshUsers()
      setToast('User deleted.')
    } catch (err) {
      setToast(prettyError(err))
    }
  }


  // Login screen
  if (!auth.isAuthed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="font-display text-2xl text-sand">Admin Login</div>
        <Divider />
        <form onSubmit={doLogin} className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-soft">
          <div className="grid gap-4">
            <div>
              <div className="text-xs text-sand/60">Email</div>
              <div className="mt-2"><TextInput value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
            </div>
            <div>
              <div className="text-xs text-sand/60">Password</div>
              <div className="mt-2"><TextInput value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" /></div>
            </div>
            <GoldButton type="submit" disabled={loading} className="w-full">
              {loading ? 'Logging in…' : 'Login'} <LogIn className="h-4 w-4" />
            </GoldButton>
          </div>
        </form>
        <Toast text={toast} onClose={() => setToast('')} />
      </div>
    )
  }

  const tabs: Array<{ id: typeof tab; label: string; icon: React.ReactNode; guard?: boolean }> = [
    { id: 'site', label: 'Site', icon: <Settings className="h-4 w-4" /> },
    { id: 'events', label: 'Events', icon: <Calendar className="h-4 w-4" /> },
    { id: 'programs', label: 'Programs', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'contacts', label: 'Contacts', icon: <Phone className="h-4 w-4" /> },
    { id: 'gallery', label: 'Gallery', icon: <ImageIcon className="h-4 w-4" /> },
    { id: 'footer', label: 'Footer', icon: <LinkIcon className="h-4 w-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" />, guard: auth.user?.role === 'super_admin' },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-2xl text-sand">Admin</div>
          <div className="mt-1 text-sm text-sand/65">Signed in as {auth.user?.email} ({auth.user?.role})</div>
        </div>
        <div className="flex gap-2">
          <GhostButton onClick={() => { void reloadAll(); setToast('Reloaded.'); }}>
            Refresh
          </GhostButton>
          <GoldButton onClick={() => auth.logout()}>
            Logout <LogOut className="h-4 w-4" />
          </GoldButton>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.filter((t) => t.guard !== false).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              if (t.id === 'users') void refreshUsers()
            }}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-sand/80 hover:bg-white/10',
              tab === t.id && 'border-gold/25 bg-gold/10'
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <Divider />

      {tab === 'site' ? (
        <AdminSite cfg={cfg} setCfg={setCfg} onSave={saveSitePatch} setToast={setToast} />
      ) : null}

      {tab === 'events' ? (
        <AdminEvents events={events} onAdd={addEvent} onUpdate={updateEvent} onDelete={delEvent} />
      ) : null}

      {tab === 'programs' ? (
        <AdminPrograms programs={programs} onAdd={addProgram} onUpdate={updateProgram} onDelete={delProgram} />
      ) : null}

      {tab === 'contacts' ? (
        <AdminContacts contacts={contacts} onAdd={addContact} onUpdate={updateContact} onDelete={delContact} />
      ) : null}

      {tab === 'gallery' ? (
        <AdminGallery gallery={gallery} onAdd={addGallery} onDelete={delGallery} />
      ) : null}

      {tab === 'footer' ? (
        <AdminFooter links={footerLinks} onAdd={addFooterLink} onUpdate={updateFooterLink} onDelete={delFooterLink} />
      ) : null}

      {tab === 'users' && auth.user?.role === 'super_admin' ? (
        <AdminUsers users={users} onCreate={createUser} onUpdate={updateUser} onDelete={deleteUser} currentUserId={auth.user?.id || ''} />
      ) : null}

      <Toast text={toast} onClose={() => setToast('')} />
    </div>
  )
}

function AdminSite({
  cfg,
  setCfg,
  onSave,
  setToast,
}: {
  cfg: SiteConfigRow
  setCfg: React.Dispatch<React.SetStateAction<SiteConfigRow>>
  onSave: (p: Partial<SiteConfigRow>) => Promise<void>
  setToast: (t: string) => void
}) {
  const fileLogoRef = useRef<HTMLInputElement | null>(null)
  const fileHeroRef = useRef<HTMLInputElement | null>(null)

  async function pickAndUpload(ref: React.RefObject<HTMLInputElement>, field: 'logo_url' | 'hero_image_url') {
    const file = ref.current?.files?.[0]
    if (!file) return
    try {
      const url = await uploadImage(file)
      const patch: any = { [field]: url }
      setCfg((c) => ({ ...c, ...patch }))
      await onSave(patch)
      setToast('Image uploaded + saved.')
    } catch (e) {
      setToast(prettyError(e))
    } finally {
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Panel title="Brand" icon={<ShieldCheck className="h-4 w-4 text-gold" />}>
        <div className="grid gap-4">
          <div>
            <div className="text-xs text-sand/60">Name</div>
            <div className="mt-2">
              <TextInput value={cfg.brand_name} onChange={(e) => setCfg((c) => ({ ...c, brand_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <div className="text-xs text-sand/60">Subtitle</div>
            <div className="mt-2">
              <TextInput value={cfg.brand_subtitle} onChange={(e) => setCfg((c) => ({ ...c, brand_subtitle: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-sand/60">Est.</div>
              <div className="mt-2">
                <TextInput value={cfg.brand_est} onChange={(e) => setCfg((c) => ({ ...c, brand_est: e.target.value }))} />
              </div>
            </div>
            <div>
              <div className="text-xs text-sand/60">Phone</div>
              <div className="mt-2">
                <TextInput value={cfg.brand_phone} onChange={(e) => setCfg((c) => ({ ...c, brand_phone: e.target.value }))} />
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs text-sand/60">Email</div>
            <div className="mt-2">
              <TextInput value={cfg.brand_email} onChange={(e) => setCfg((c) => ({ ...c, brand_email: e.target.value }))} />
            </div>
          </div>
          <div>
            <div className="text-xs text-sand/60">Address</div>
            <div className="mt-2">
              <TextArea rows={3} value={cfg.brand_address} onChange={(e) => setCfg((c) => ({ ...c, brand_address: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-sand/60">Logo image</div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {cfg.logo_url ? (
                <img src={cfg.logo_url} className="h-12 w-12 rounded-xl object-cover" alt="logo" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-ink2 text-sand/40">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <input ref={fileLogoRef} type="file" accept="image/*" className="hidden" onChange={() => void pickAndUpload(fileLogoRef, 'logo_url')} />
              <GoldButton onClick={() => fileLogoRef.current?.click()}>
                <Upload className="h-4 w-4" /> Upload logo
              </GoldButton>
            </div>
            <div className="mt-3">
              <div className="text-xs text-sand/60">Logo URL (optional)</div>
              <div className="mt-2">
                <TextInput value={cfg.logo_url} onChange={(e) => setCfg((c) => ({ ...c, logo_url: e.target.value }))} />
              </div>
            </div>
          </div>

          <GoldButton onClick={() => void onSave(cfg)} className="w-full">
            <Save className="h-4 w-4" /> Save Brand
          </GoldButton>
        </div>
      </Panel>

      <Panel title="Home + About + Donations" icon={<Info className="h-4 w-4 text-gold" />}>
        <div className="grid gap-4">
          <div>
            <div className="text-xs text-sand/60">Hero headline</div>
            <div className="mt-2">
              <TextInput value={cfg.hero_headline} onChange={(e) => setCfg((c) => ({ ...c, hero_headline: e.target.value }))} />
            </div>
          </div>
          <div>
            <div className="text-xs text-sand/60">Hero body</div>
            <div className="mt-2">
              <TextArea rows={4} value={cfg.hero_body} onChange={(e) => setCfg((c) => ({ ...c, hero_body: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-sand/60">Hero image</div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {(cfg.hero_image_url || cfg.hero_image_fallback_url) ? (
                <img src={cfg.hero_image_url || cfg.hero_image_fallback_url} className="h-16 w-24 rounded-xl object-cover" alt="hero" />
              ) : (
                <div className="flex h-16 w-24 items-center justify-center rounded-xl border border-white/10 bg-ink2 text-sand/40">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <input ref={fileHeroRef} type="file" accept="image/*" className="hidden" onChange={() => void pickAndUpload(fileHeroRef, 'hero_image_url')} />
              <GoldButton onClick={() => fileHeroRef.current?.click()}>
                <Upload className="h-4 w-4" /> Upload hero
              </GoldButton>
            </div>
            <div className="mt-3 grid gap-3">
              <div>
                <div className="text-xs text-sand/60">Hero image URL</div>
                <div className="mt-2">
                  <TextInput value={cfg.hero_image_url} onChange={(e) => setCfg((c) => ({ ...c, hero_image_url: e.target.value }))} />
                </div>
              </div>
              <div>
                <div className="text-xs text-sand/60">Fallback image URL</div>
                <div className="mt-2">
                  <TextInput value={cfg.hero_image_fallback_url} onChange={(e) => setCfg((c) => ({ ...c, hero_image_fallback_url: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          <Divider label="Facebook Live" />
          <div>
            <div className="text-xs text-sand/60">Live video URL (iframe src)</div>
            <div className="mt-2">
              <TextInput value={cfg.live_video_url} onChange={(e) => setCfg((c) => ({ ...c, live_video_url: e.target.value }))} />
            </div>
          </div>
          <div>
            <div className="text-xs text-sand/60">Fallback video URL</div>
            <div className="mt-2">
              <TextInput value={cfg.fallback_video_url} onChange={(e) => setCfg((c) => ({ ...c, fallback_video_url: e.target.value }))} />
            </div>
          </div>

          <Divider label="Broadcast countdown" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <div className="text-xs text-sand/60">Broadcast name</div>
              <div className="mt-2"><TextInput value={cfg.broadcast_name} onChange={(e) => setCfg((c) => ({ ...c, broadcast_name: e.target.value }))} /></div>
            </div>
            <div>
              <div className="text-xs text-sand/60">Date</div>
              <div className="mt-2"><TextInput type="date" value={cfg.broadcast_date} onChange={(e) => setCfg((c) => ({ ...c, broadcast_date: e.target.value }))} /></div>
            </div>
            <div>
              <div className="text-xs text-sand/60">Time</div>
              <div className="mt-2"><TextInput type="time" value={cfg.broadcast_time} onChange={(e) => setCfg((c) => ({ ...c, broadcast_time: e.target.value }))} /></div>
            </div>
          </div>

          <Divider label="About" />
          <div>
            <div className="text-xs text-sand/60">About text</div>
            <div className="mt-2"><TextArea rows={6} value={cfg.about_text} onChange={(e) => setCfg((c) => ({ ...c, about_text: e.target.value }))} /></div>
          </div>

          <Divider label="Donations" />
          <div>
            <div className="text-xs text-sand/60">Title</div>
            <div className="mt-2"><TextInput value={cfg.donations_title} onChange={(e) => setCfg((c) => ({ ...c, donations_title: e.target.value }))} /></div>
          </div>
          <div>
            <div className="text-xs text-sand/60">Body</div>
            <div className="mt-2"><TextArea rows={4} value={cfg.donations_body} onChange={(e) => setCfg((c) => ({ ...c, donations_body: e.target.value }))} /></div>
          </div>
          <div>
            <div className="text-xs text-sand/60">Details</div>
            <div className="mt-2"><TextArea rows={6} value={cfg.donations_details} onChange={(e) => setCfg((c) => ({ ...c, donations_details: e.target.value }))} /></div>
          </div>

          <GoldButton onClick={() => void onSave(cfg)} className="w-full">
            <Save className="h-4 w-4" /> Save Site
          </GoldButton>
        </div>
      </Panel>
    </div>
  )
}

function AdminEvents({
  events,
  onAdd,
  onUpdate,
  onDelete,
}: {
  events: EventRow[]
  onAdd: (e: Partial<EventRow>) => Promise<void>
  onUpdate: (id: string, e: Partial<EventRow>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<Partial<EventRow>>({ kind: 'recurring' as any })
  const [editingId, setEditingId] = useState<string | null>(null)

  const reset = () => {
    setDraft({ kind: draft.kind || 'recurring' })
    setEditingId(null)
  }

  return (
    <Panel title="Manage events" icon={<Trash2 className="h-4 w-4 text-gold" />}>
      <div className="grid gap-4">
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, kind: 'recurring', event_date: '', event_time: '' }))}
              className={cn('rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand/80', draft.kind === 'recurring' && 'border-gold/25 bg-gold/10')}
            >
              Recurring
            </button>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, kind: 'oneoff', when_text: '' }))}
              className={cn('rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand/80', draft.kind === 'oneoff' && 'border-gold/25 bg-gold/10')}
            >
              One-off
            </button>
          </div>

          <TextInput placeholder="Title" value={draft.title || ''} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />

          {draft.kind === 'oneoff' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput type="date" value={draft.event_date || ''} onChange={(e) => setDraft((d) => ({ ...d, event_date: e.target.value }))} />
              <TextInput type="time" value={draft.event_time || ''} onChange={(e) => setDraft((d) => ({ ...d, event_time: e.target.value }))} />
            </div>
          ) : (
            <TextInput placeholder="When text" value={draft.when_text || ''} onChange={(e) => setDraft((d) => ({ ...d, when_text: e.target.value }))} />
          )}

          <TextArea rows={3} placeholder="Note" value={draft.note || ''} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />

          {editingId ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <GoldButton
                onClick={() => {
                  void onUpdate(editingId, draft)
                  reset()
                }}
                className="w-full"
              >
                <Save className="h-4 w-4" /> Save changes
              </GoldButton>
              <GhostButton
                onClick={reset}
                className="w-full"
              >
                <X className="h-4 w-4 text-gold" /> Cancel
              </GhostButton>
            </div>
          ) : (
            <GoldButton
              onClick={() => {
                void onAdd(draft)
                reset()
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4" /> Add event
            </GoldButton>
          )}
        </div>

        <div className="grid gap-3">
          {events.map((e) => (
            <div key={e.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="font-display text-base text-sand">{e.title}</div>
                <div className="mt-1 text-sm text-sand/60">
                  {e.kind === 'oneoff'
                    ? `${e.event_date || '—'} • ${formatTime12h(e.event_time) || '—'}`
                    : e.when_text || '—'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <GhostButton
                  onClick={() => {
                    setEditingId(e.id)
                    setDraft({ ...e })
                  }}
                >
                  <Pencil className="h-4 w-4 text-gold" /> Edit
                </GhostButton>
                <GhostButton onClick={() => void onDelete(e.id)}>
                  <Trash2 className="h-4 w-4 text-gold" /> Delete
                </GhostButton>
              </div>
            </div>
          ))}
          {events.length === 0 ? <div className="text-sm text-sand/60">No events.</div> : null}
        </div>
      </div>
    </Panel>
  )
}

function AdminPrograms({
  programs,
  onAdd,
  onUpdate,
  onDelete,
}: {
  programs: ProgramRow[]
  onAdd: (p: Partial<ProgramRow>) => Promise<void>
  onUpdate: (id: string, p: Partial<ProgramRow>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<Partial<ProgramRow>>({})
  const [editingId, setEditingId] = useState<string | null>(null)

  const reset = () => {
    setDraft({})
    setEditingId(null)
  }

  return (
    <Panel title="Manage programs" icon={<BookOpen className="h-4 w-4 text-gold" />}>
      <div className="grid gap-4">
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <TextInput placeholder="Title" value={draft.title || ''} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          <TextInput placeholder="Grades" value={draft.grades || ''} onChange={(e) => setDraft((d) => ({ ...d, grades: e.target.value }))} />
          <TextArea rows={3} placeholder="Description" value={draft.description || ''} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput placeholder="Days" value={draft.days || ''} onChange={(e) => setDraft((d) => ({ ...d, days: e.target.value }))} />
            <TextInput placeholder="Time" value={draft.time || ''} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))} />
          </div>
          <TextInput placeholder="Note" value={draft.note || ''} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />

          {editingId ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <GoldButton
                onClick={() => {
                  void onUpdate(editingId, draft)
                  reset()
                }}
                className="w-full"
              >
                <Save className="h-4 w-4" /> Save changes
              </GoldButton>
              <GhostButton onClick={reset} className="w-full">
                <X className="h-4 w-4 text-gold" /> Cancel
              </GhostButton>
            </div>
          ) : (
            <GoldButton
              onClick={() => {
                void onAdd(draft)
                reset()
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4" /> Add program
            </GoldButton>
          )}
        </div>

        <div className="grid gap-3">
          {programs.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="font-display text-base text-sand">{p.title}</div>
                <div className="mt-1 text-sm text-sand/60">{p.days} • {p.time}</div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <GhostButton
                  onClick={() => {
                    setEditingId(p.id)
                    setDraft({ ...p })
                  }}
                >
                  <Pencil className="h-4 w-4 text-gold" /> Edit
                </GhostButton>
                <GhostButton onClick={() => void onDelete(p.id)}>
                  <Trash2 className="h-4 w-4 text-gold" /> Delete
                </GhostButton>
              </div>
            </div>
          ))}
          {programs.length === 0 ? <div className="text-sm text-sand/60">No programs.</div> : null}
        </div>
      </div>
    </Panel>
  )
}

function AdminContacts({
  contacts,
  onAdd,
  onUpdate,
  onDelete,
}: {
  contacts: ContactRow[]
  onAdd: (c: Partial<ContactRow>) => Promise<void>
  onUpdate: (id: string, c: Partial<ContactRow>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<Partial<ContactRow>>({})
  const [editingId, setEditingId] = useState<string | null>(null)

  const reset = () => {
    setDraft({})
    setEditingId(null)
  }

  return (
    <Panel title="Manage contacts" icon={<Phone className="h-4 w-4 text-gold" />}>
      <div className="grid gap-4">
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <TextInput placeholder="Role" value={draft.role || ''} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))} />
          <TextInput placeholder="Name" value={draft.name || ''} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput placeholder="Email" value={draft.email || ''} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
            <TextInput placeholder="Phone" value={draft.phone || ''} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
          </div>

          {editingId ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <GoldButton
                onClick={() => {
                  void onUpdate(editingId, draft)
                  reset()
                }}
                className="w-full"
              >
                <Save className="h-4 w-4" /> Save changes
              </GoldButton>
              <GhostButton onClick={reset} className="w-full">
                <X className="h-4 w-4 text-gold" /> Cancel
              </GhostButton>
            </div>
          ) : (
            <GoldButton
              onClick={() => {
                void onAdd(draft)
                reset()
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4" /> Add contact
            </GoldButton>
          )}
        </div>

        <div className="grid gap-3">
          {contacts.map((c) => (
            <div key={c.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="font-display text-base text-sand">{c.role}</div>
                <div className="mt-1 text-sm text-sand/60">{c.name}</div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <GhostButton
                  onClick={() => {
                    setEditingId(c.id)
                    setDraft({ ...c })
                  }}
                >
                  <Pencil className="h-4 w-4 text-gold" /> Edit
                </GhostButton>
                <GhostButton onClick={() => void onDelete(c.id)}>
                  <Trash2 className="h-4 w-4 text-gold" /> Delete
                </GhostButton>
              </div>
            </div>
          ))}
          {contacts.length === 0 ? <div className="text-sm text-sand/60">No contacts.</div> : null}
        </div>
      </div>
    </Panel>
  )
}

function AdminGallery({ gallery, onAdd, onDelete }: { gallery: GalleryRow[]; onAdd: (g: Partial<GalleryRow>) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function onPick() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    try {
      const uploaded = await uploadImage(file)
      setUrl(uploaded)
    } catch (e) {
      // handled by caller toast
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Panel title="Manage gallery" icon={<ImageIcon className="h-4 w-4 text-gold" />}>
      <div className="grid gap-4">
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <TextInput placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={() => void onPick()} />
            <GoldButton onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Upload image
            </GoldButton>
          </div>
          <TextInput placeholder="Image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <GoldButton
            onClick={() => {
              if (!url) return
              void onAdd({ title, image_url: url })
              setTitle('')
              setUrl('')
            }}
            className="w-full"
          >
            <Plus className="h-4 w-4" /> Add photo
          </GoldButton>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((g) => (
            <div key={g.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-soft">
              <div className="aspect-[4/3] bg-white/5">
                <img src={toAbsoluteUrl(g.image_url)} alt={g.title} className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="text-sm text-sand/75 truncate">{g.title || '—'}</div>
                <button type="button" onClick={() => void onDelete(g.id)} className="rounded-lg p-2 hover:bg-white/10">
                  <Trash2 className="h-4 w-4 text-gold" />
                </button>
              </div>
            </div>
          ))}
          {gallery.length === 0 ? <div className="text-sm text-sand/60">No photos.</div> : null}
        </div>
      </div>
    </Panel>
  )
}

function AdminFooter({
  links,
  onAdd,
  onUpdate,
  onDelete,
}: {
  links: FooterLinkRow[]
  onAdd: (l: Partial<FooterLinkRow>) => Promise<void>
  onUpdate: (id: string, l: Partial<FooterLinkRow>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<Partial<FooterLinkRow>>({ sort_order: 0 })
  const [editingId, setEditingId] = useState<string | null>(null)

  const reset = () => {
    setDraft({ sort_order: 0 })
    setEditingId(null)
  }

  return (
    <Panel title="Footer links" icon={<LinkIcon className="h-4 w-4 text-gold" />}>
      <div className="grid gap-4">
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <TextInput placeholder="Label" value={draft.label || ''} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
          <TextInput placeholder="URL (e.g. #programs or https://...)" value={draft.url || ''} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} />
          <TextInput placeholder="Sort order" value={String(draft.sort_order ?? 0)} onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value || 0) }))} />

          {editingId ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <GoldButton
                onClick={() => {
                  void onUpdate(editingId, draft)
                  reset()
                }}
                className="w-full"
              >
                <Save className="h-4 w-4" /> Save changes
              </GoldButton>
              <GhostButton onClick={reset} className="w-full">
                <X className="h-4 w-4 text-gold" /> Cancel
              </GhostButton>
            </div>
          ) : (
            <GoldButton
              onClick={() => {
                void onAdd(draft)
                reset()
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4" /> Add link
            </GoldButton>
          )}
        </div>

        <div className="grid gap-3">
          {links
            .slice()
            .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
            .map((l) => (
              <div key={l.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-display text-base text-sand">{l.label}</div>
                  <div className="mt-1 text-sm text-sand/60">{l.url}</div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <GhostButton
                    onClick={() => {
                      setEditingId(l.id)
                      setDraft({ ...l })
                    }}
                  >
                    <Pencil className="h-4 w-4 text-gold" /> Edit
                  </GhostButton>
                  <GhostButton onClick={() => void onDelete(l.id)}>
                    <Trash2 className="h-4 w-4 text-gold" /> Delete
                  </GhostButton>
                </div>
              </div>
            ))}
          {links.length === 0 ? <div className="text-sm text-sand/60">No links.</div> : null}
        </div>
      </div>
    </Panel>
  )
}

function AdminUsers({
  users,
  onCreate,
  onUpdate,
  onDelete,
  currentUserId,
}: {
  users: UserRow[]
  onCreate: (p: { email: string; password: string; full_name: string; role: 'admin' | 'super_admin' }) => Promise<void>
  onUpdate: (id: string, patch: Partial<UserRow> & { password?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  currentUserId: string
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'super_admin'>('admin')
  const [editActive, setEditActive] = useState(true)
  const [editPassword, setEditPassword] = useState('')

  const startEdit = (u: UserRow) => {
    setEditingId(u.id)
    setEditName(u.full_name || '')
    setEditRole(u.role === 'super_admin' ? 'super_admin' : 'admin')
    setEditActive(Boolean(u.is_active))
    setEditPassword('')
  }

  const stopEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditRole('admin')
    setEditActive(true)
    setEditPassword('')
  }

  return (
    <Panel title="Users (super_admin)" icon={<Users className="h-4 w-4 text-gold" />}>
      <div className="grid gap-4">
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-sand/60">Create user</div>
          <TextInput placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextInput placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextInput placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRole('admin')}
              className={cn('rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand/80', role === 'admin' && 'border-gold/25 bg-gold/10')}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => setRole('super_admin')}
              className={cn('rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand/80', role === 'super_admin' && 'border-gold/25 bg-gold/10')}
            >
              Super Admin
            </button>
          </div>
          <GoldButton
            onClick={() => {
              if (!email || !password || !name) return
              void onCreate({ email, password, full_name: name, role })
              setEmail('')
              setPassword('')
              setName('')
              setRole('admin')
            }}
            className="w-full"
          >
            <Plus className="h-4 w-4" /> Create user
          </GoldButton>
        </div>

        {/* Edit box */}
        {editingId ? (
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-sand/60">Edit user</div>
            <TextInput placeholder="Full name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditRole('admin')}
                className={cn('rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand/80', editRole === 'admin' && 'border-gold/25 bg-gold/10')}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setEditRole('super_admin')}
                className={cn('rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand/80', editRole === 'super_admin' && 'border-gold/25 bg-gold/10')}
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => setEditActive((v) => !v)}
                className={cn('rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand/80', editActive && 'border-gold/25 bg-gold/10')}
              >
                {editActive ? 'Active' : 'Disabled'}
              </button>
            </div>
            <TextInput placeholder="New password (optional)" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <GoldButton
                onClick={() => {
                  void onUpdate(editingId, { full_name: editName, role: editRole, is_active: editActive, password: editPassword || undefined })
                  stopEdit()
                }}
                className="w-full"
              >
                <Save className="h-4 w-4" /> Save user
              </GoldButton>
              <GhostButton onClick={stopEdit} className="w-full">
                <X className="h-4 w-4 text-gold" /> Cancel
              </GhostButton>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3">
          {users.map((u) => (
            <div key={u.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm text-sand/80 truncate">{u.email}</div>
                  <div className="mt-1 text-sm text-sand/60 truncate">{u.full_name}</div>
                  <div className="mt-1 text-xs text-sand/55">{u.role} • {u.is_active ? 'active' : 'disabled'}</div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <GhostButton onClick={() => startEdit(u)}>
                    <Pencil className="h-4 w-4 text-gold" /> Edit
                  </GhostButton>
                  <GhostButton
                    onClick={() => {
                      if (u.id === currentUserId) return
                      void onDelete(u.id)
                      if (editingId === u.id) stopEdit()
                    }}
                    className={cn(u.id === currentUserId && 'opacity-50 pointer-events-none')}
                  >
                    <Trash2 className="h-4 w-4 text-gold" /> Delete
                  </GhostButton>
                </div>
              </div>
            </div>
          ))}
          {users.length === 0 ? <div className="text-sm text-sand/60">No users.</div> : null}
        </div>
      </div>
    </Panel>
  )
}

// -----------------------------------------------------------------------------
// App root
// -----------------------------------------------------------------------------

const DEFAULT_SITE: SiteConfigRow = {
  id: 1,
  brand_name: 'Masjid Al Taubah',
  brand_subtitle: 'Islamic Society of Chatsworth',
  brand_est: 'Est. 1995',
  brand_address: '45 Hopefield Rd, Greater Chatsworth, Malmesbury, 7354',
  brand_email: 'imam.chatsworth@gmail.com',
  brand_phone: '',
  logo_url: '',
  hero_headline: 'A welcoming masjid for worship, learning, and community.',
  hero_body: "Masjid Al Taubah serves the community with programs, daily learning, and Jumu'ah on Fridays.",
  hero_image_url: '',
  hero_image_fallback_url:
    'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1600&q=80',
  live_video_url: '',
  fallback_video_url: '',
  broadcast_name: '',
  broadcast_date: '',
  broadcast_time: '',
  about_text:
    'Established in 1995, we aim to serve with sincerity—welcoming worshippers and families in a respectful and peaceful environment.',
  donations_title: 'Donations',
  donations_body:
    'Your contribution helps support the masjid operations, education programs, and community outreach.',
  donations_details:
    'Bank: Example Bank\nAccount Name: Masjid Al Taubah\nAccount No: 123456789\nBranch Code: 0000\nReference: Donation',
}

export default function App() {
  // Theme CSS + fonts (keeps your exact look)
  const themeCss = useMemo(
    () => `
@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cinzel:wght@400;600&family=Inter:wght@400;500;600&display=swap');
:root{--ink:${THEME.ink};--ink2:${THEME.ink2};--sand:${THEME.sand};--gold:${THEME.gold};}
html{scroll-behavior:smooth;overscroll-behavior-x:none;background:var(--ink);}body{margin:0;overflow-x:hidden;overscroll-behavior-x:none;background:var(--ink);touch-action:pan-y;}
#root{overflow-x:hidden;}
.font-display{font-family:Cinzel,ui-serif,Georgia,serif;}
.font-body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}
.font-arabic{font-family:Amiri,ui-serif,Georgia,serif;}
.shadow-soft{box-shadow:0 22px 70px rgba(0,0,0,.22);}
.bg-ink{background-color:var(--ink);} .bg-ink2{background-color:var(--ink2);} .bg-gold{background-color:var(--gold);} .bg-sand{background-color:var(--sand);}
.text-sand{color:var(--sand);} .text-gold{color:var(--gold);} .text-ink{color:var(--ink);} 
.border-gold\\/25{border-color:rgba(216,177,90,.25);} .bg-gold\\/10{background-color:rgba(216,177,90,.10);} .bg-gold\\/15{background-color:rgba(216,177,90,.15);} .bg-gold\\/20{background-color:rgba(216,177,90,.20);} 
.pattern{background-image:radial-gradient(circle at 12% 18%, rgba(216,177,90,.10), transparent 35%),radial-gradient(circle at 88% 72%, rgba(216,177,90,.08), transparent 40%),linear-gradient(180deg, rgba(255,255,255,.05), transparent 24%),url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 80 80"><g fill="none" stroke="%23D8B15A" stroke-opacity="0.12" stroke-width="1"><path d="M40 2l10 18-10 18-10-18z"/><path d="M40 42l10 18-10 18-10-18z"/><path d="M2 40l18-10 18 10-18 10z"/><path d="M42 40l18-10 18 10-18 10z"/></g></svg>');background-size:auto,auto,auto,260px 260px;background-repeat:no-repeat,no-repeat,no-repeat,repeat;}
.arch{border-top-left-radius:999px;border-top-right-radius:999px;}
`,
    []
  )

  const [active, setActive] = useState('home')
  const [cfg, setCfg] = useState<SiteConfigRow>(() => {
    try {
      const raw = window.localStorage.getItem('site_config_cache')
      if (!raw) return DEFAULT_SITE
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_SITE, ...(parsed || {}) }
    } catch {
      return DEFAULT_SITE
    }
  })
  const [cfgReady, setCfgReady] = useState<boolean>(() => {
    try {
      return Boolean(window.localStorage.getItem('site_config_cache'))
    } catch {
      return false
    }
  })
  const [events, setEvents] = useState<EventRow[]>([])
  const [programs, setPrograms] = useState<ProgramRow[]>([])
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [gallery, setGallery] = useState<GalleryRow[]>([])
  const [footerLinks, setFooterLinks] = useState<FooterLinkRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])

  const [timings, setTimings] = useState<PrayerTimes | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let alive = true
    async function loadTimings() {
      try {
        const url = 'https://api.aladhan.com/v1/timingsByCity?city=Cape%20Town&country=South%20Africa&method=2'
        const res = await fetch(url)
        const json = await res.json()
        const t = json?.data?.timings
        if (!t) return
        const out: PrayerTimes = {
          Fajr: t.Fajr,
          Sunrise: t.Sunrise,
          Dhuhr: t.Dhuhr,
          Asr: t.Asr,
          Maghrib: t.Maghrib,
          Isha: t.Isha,
        }
        if (alive) setTimings(out)
      } catch {
        // ignore
      }
    }
    void loadTimings()
    return () => {
      alive = false
    }
  }, [])

  const nextPrayer = useMemo(() => getNextPrayer(now, timings), [now, timings])
  const countdown = useMemo(() => {
    if (!nextPrayer?.time) return null
    return msToHMS(nextPrayer.time.getTime() - now.getTime())
  }, [nextPrayer, now])

  async function reloadAll() {
    const [siteR, evR, prR, coR, gaR, flR] = await Promise.all([
      api.get('/content/site'),
      api.get('/events'),
      api.get('/programs'),
      api.get('/contacts'),
      api.get('/gallery'),
      api.get('/footer-links'),
    ])

    if (siteR.data?.data) {
      setCfg(siteR.data.data)
      setCfgReady(true)
      try { window.localStorage.setItem('site_config_cache', JSON.stringify(siteR.data.data)) } catch { /* ignore */ }
    }
    setEvents(evR.data?.data || [])
    setPrograms(prR.data?.data || [])
    setContacts(coR.data?.data || [])
    setGallery(gaR.data?.data || [])
    setFooterLinks(flR.data?.data || [])
  }

  useEffect(() => {
    void reloadAll()
  }, [])

  return (
    <div className="min-h-screen bg-ink text-sand font-body flex flex-col overflow-x-hidden">
      <style>{themeCss}</style>

      <Header brandName={cfg.brand_name} subtitle={cfg.brand_subtitle} logoUrl={toAbsoluteUrl(cfg.logo_url)} active={active} setActive={setActive} hasAdmin={true} />

      <main className="flex-1">
        <Page active={active} id="home">
          <HomeHero cfg={cfg} nextPrayer={nextPrayer} countdown={countdown} onGo={setActive} cfgReady={cfgReady} />
          <FacebookLiveSection cfg={cfg} />
        </Page>

        <Page active={active} id="prayer">
          <PrayerPage />
        </Page>

        <Page active={active} id="about">
          <AboutPage cfg={cfg} />
        </Page>

        <Page active={active} id="programs">
          <ProgramsPage programs={programs} />
        </Page>

        <Page active={active} id="events">
          <EventsPage events={events} />
        </Page>

        <Page active={active} id="gallery">
          <GalleryPage gallery={gallery} />
        </Page>

        <Page active={active} id="donations">
          <DonationsPage cfg={cfg} />
        </Page>

        <Page active={active} id="contact">
          <ContactPage cfg={cfg} contacts={contacts} />
        </Page>

        <Page active={active} id="admin">
          <AdminPage
            cfg={cfg}
            setCfg={setCfg}
            events={events}
            setEvents={setEvents}
            programs={programs}
            setPrograms={setPrograms}
            contacts={contacts}
            setContacts={setContacts}
            gallery={gallery}
            setGallery={setGallery}
            footerLinks={footerLinks}
            setFooterLinks={setFooterLinks}
            users={users}
            setUsers={setUsers}
            reloadAll={reloadAll}
          />
        </Page>
      </main>

      <Footer cfg={cfg} links={footerLinks} onNavigate={setActive} />
    </div>
  )
}
