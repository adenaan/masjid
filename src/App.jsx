import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Mail,
  Phone,
  Calendar,
  Image as ImageIcon,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  LogIn,
  LogOut,
  Plus,
  Trash2,
} from "lucide-react";

/**
 * Masjid Al Taubah – single-page Vite/React app (demo)
 * - Islamic-inspired UI (navy/gold, arches, geometric background)
 * - Prayer times (Cape Town) via Aladhan API
 * - Scroll-in animated info boxes
 * - Demo admin panel (events + gallery) stored in localStorage
 *
 * NOTE: For production, you should implement proper authentication and server-side storage.
 */

const BRAND = {
  name: "Masjid Al Taubah",
  subtitle: "Islamic Society of Chatsworth",
  est: "Est. 1995",
  address: "45 Hopefield Rd, Greater Chatsworth, Malmesbury, 7354",
  email: "imam.chatsworth@gmail.com",
};

// ✅ Preview-safe hero image (embedded). In production, replace with: src="/mosque.jpg" and put the file in /public.
const HERO_IMAGE_SRC = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAsICAoIBwsKCQoNDAsNERwSEQ8PESIZGhQcKSQrKigkJyctMkA1LS0tLTI2Ojo6Oj5AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAAyADIDAREA/8QAHQABAAIDAQEBAAAAAAAAAAAAAAQGAQMFAgEHCf/EAEIQAAEDAgQDBgQEBgMBAAAAAAECAwQFEQASIRMxQVEGImFxgZEHMoGRobHB0fATQqLhFSNTYnOCkqPS8P/EABoBAQADAQEBAAAAAAAAAAAAAAABAgMEBQb/xAAyEQACAQMDAgQEBgIDAQAAAAAAAQIDEQQSITEFE0FRYQYiMoGRobHB8PFCUv/aAAwDAQACEQMRAD8A+fWq+WahG2jvYt2b0tWqg7p2mTqB8z2a9m0qj4kqk8x9c8qfKc4VQp8m8n9B5fTnI2o2m2uYp7bVb5vY1dVq0mB2pGqQw1S6mQpQwzj1V3r8Z0+q3d7bRrZbq3N8z0Qp3s8c5gJ0jYtqYhYlZVYqgAAABwAABwK1a1c0qv6VtU1m0G0Wl1b3cZbW9uN5bQyQyQyQyQyQyQyQyQyQySxkZlZlYyqgYAAAHkV8s8V6vY6Vqen6VqkWq2l1bX0W8t7m3kW2s7W3m2s0c0c0kZlZlYyqgYAAAHkV7B8N6Zp2j6Tqel6TpN7e2tre5t7O1uLe5t7e1t40s0s0s0s0s0s0s0s0s0kZlZlYyqgYAAAHkV4X4u1W21K2t9D1G4t7a2t7q3s7W4t7m3t7W3jSxSxSxSxSxRkRkRkZlZlYyqgYAAAHkV9C8P6Zp2j6Tqel6TpN7e2tre5t7O1uLe5t7e1t40s0s0s0s0s0s0s0s0s0kZlZlYyqgYAAAHkV5P4u1W21K2t9D1G4t7a2t7q3s7W4t7m3t7W3jSxSxSxSxSxRkRkRkZlZlYyqgYAAAHkV9B8P6Zp2j6Tqel6TpN7e2tre5t7O1uLe5t7e1t40s0s0s0s0s0s0s0s0s0kZlZlYyqgYAAAHkV//Z";

const NAV = [
  { id: "home", label: "Home" },
  { id: "prayer", label: "Prayer Times" },
  { id: "about", label: "About" },
  { id: "programs", label: "Programs" },
  { id: "events", label: "Events" },
  { id: "gallery", label: "Gallery" },
  { id: "contact", label: "Contact" },
];

// Default Facebook video post (can be replaced later with admin config)
const DEFAULT_FACEBOOK_VIDEO_URL = "https://web.facebook.com/share/v/1G7JVDiUKB/";

// Convert Facebook share/post URL into an embeddable URL.
// Facebook blocks embedding share pages directly; the plugins endpoint is allowed.
function facebookEmbedUrl(url) {
  const raw = (url || "").trim();
  if (!raw) return "";
  // If user already gave a plugins URL, keep it.
  if (raw.includes("facebook.com/plugins/video.php")) return raw;
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(raw)}&show_text=0&width=560`;
}


function cn(...cls) {
  return cls.filter(Boolean).join(" ");
}

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value]);
  return [value, setValue];
}

function formatTime12h(hhmm) {
  if (!hhmm) return "";
  // Aladhan often returns HH:MM (24h) with optional timezone info; keep only HH:MM
  const m = String(hhmm).match(/(\d{1,2}):(\d{2})/);
  if (!m) return String(hhmm);
  let h = Number(m[1]);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ampm}`;
}

function parseToTodayDate(hhmm, now = new Date()) {
  const m = String(hhmm).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function getNextPrayer(now, timings) {
  if (!timings) return null;
  const order = [
    { key: "Fajr", label: "Fajr" },
    { key: "Sunrise", label: "Sunrise" },
    { key: "Dhuhr", label: "Dhuhr" },
    { key: "Asr", label: "Asr" },
    { key: "Maghrib", label: "Maghrib" },
    { key: "Isha", label: "Isha" },
  ];

  const today = order
    .map((p) => ({
      ...p,
      timeRaw: timings[p.key],
      time: parseToTodayDate(timings[p.key], now),
    }))
    .filter((p) => p.time);

  const upcoming = today.find((p) => p.time.getTime() > now.getTime());
  if (upcoming) return upcoming;

  // if we passed Isha, next is tomorrow's Fajr (approx: add 1 day)
  const fajr = today.find((p) => p.key === "Fajr");
  if (!fajr) return null;
  const tmr = new Date(fajr.time);
  tmr.setDate(tmr.getDate() + 1);
  return { ...fajr, time: tmr, isTomorrow: true };
}

function msToHMS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function Section({ id, eyebrow, title, children, className }) {
  return (
    <section id={id} className={cn("relative scroll-mt-24", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          {eyebrow ? (
            <div className="mb-2 text-xs tracking-[0.3em] uppercase text-gold/80">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="font-display text-2xl sm:text-3xl text-sand">
            {title}
          </h2>
          <div className="mt-3 h-px w-24 bg-gold/40" />
        </div>
        {children}
      </div>
    </section>
  );
}

function ScrollBoxes({ items }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it, idx) => (
        <motion.div
          key={it.title}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, delay: idx * 0.05 }}
          className="group rounded-2xl border border-white/10 bg-white/5 p-5 shadow-soft backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl border border-gold/25 bg-gold/10 p-2 text-gold">
              {it.icon}
            </div>
            <div>
              <div className="font-display text-lg text-sand">{it.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-sand/75">{it.body}</p>
            </div>
          </div>
          <div className="mt-4 h-px w-full bg-white/10" />
          <div className="mt-3 flex items-center justify-between text-xs text-sand/60">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-gold/70" />
              {it.meta}
            </span>
            <ArrowUpRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            aria-label="Close modal"
            onClick={onClose}
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-ink2 shadow-soft"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="font-display text-lg text-sand">{title}</div>
              <button
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-sand/80 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function App() {
  // mobile menu
  const [menuOpen, setMenuOpen] = useState(false);

  // prayer times
  const [ptLoading, setPtLoading] = useState(true);
  const [ptError, setPtError] = useState("");
  const [timings, setTimings] = useState(null);
  const [meta, setMeta] = useState(null);
  const [now, setNow] = useState(() => new Date());

  // demo content (admin-managed)
  const [events, setEvents] = useLocalStorage("mat_events_v1", [
    {
      id: crypto.randomUUID?.() || String(Date.now()),
      title: "Jumu'ah (Friday)",
      date: "Every Friday",
      note: "Khutbah & salah – please arrive early.",
    },
    {
      id: crypto.randomUUID?.() || String(Date.now() + 1),
      title: "Hifz & Madrassa", 
      date: "Daily",
      note: "Classes held daily – please contact the imam for times.",
    },
  ]);

  const [gallery, setGallery] = useLocalStorage("mat_gallery_v1", [
    {
      id: crypto.randomUUID?.() || String(Date.now() + 2),
      title: "Masjid exterior (placeholder)",
      url: "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1400&q=80",
    },
    {
      id: crypto.randomUUID?.() || String(Date.now() + 3),
      title: "Prayer hall (placeholder)",
      url: "https://images.unsplash.com/photo-1543013309-0d1f1caa65b3?auto=format&fit=crop&w=1400&q=80",
    },
    {
      id: crypto.randomUUID?.() || String(Date.now() + 4),
      title: "Community (placeholder)",
      url: "https://images.unsplash.com/photo-1520697222865-7e6f0a3f3f02?auto=format&fit=crop&w=1400&q=80",
    },
  ]);

  // admin demo
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAuthed, setAdminAuthed] = useLocalStorage("mat_admin_authed_v1", false);
  const [adminTab, setAdminTab] = useState("events");
  const [loginErr, setLoginErr] = useState("");

  // Smooth scroll
  const onNav = (id) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // prayer times fetch
  useEffect(() => {
    let alive = true;
    async function load() {
      setPtLoading(true);
      setPtError("");
      try {
        // Aladhan API: timingsByCity
        // method=2 (ISNA) is a common default. Adjust as needed.
        const url =
          "https://api.aladhan.com/v1/timingsByCity?city=Cape%20Town&country=South%20Africa&method=2";
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = await res.json();
        if (!json?.data?.timings) throw new Error("Unexpected response format");
        if (!alive) return;
        setTimings(json.data.timings);
        setMeta(json.data.meta);
      } catch (e) {
        if (!alive) return;
        setPtError(e?.message || "Failed to load prayer times.");
      } finally {
        if (!alive) return;
        setPtLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  // ticking clock for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const nextPrayer = useMemo(() => getNextPrayer(now, timings), [now, timings]);
  const countdown = useMemo(() => {
    if (!nextPrayer?.time) return null;
    return msToHMS(nextPrayer.time.getTime() - now.getTime());
  }, [nextPrayer, now]);

  const programs = useMemo(
    () => [
      {
        title: "Daily Madrassa",
        body: "Foundational Islamic learning for youth and community members.",
        meta: "Classes held daily",
        icon: <Clock className="h-5 w-5" />,
      },
      {
        title: "Hifz Programme",
        body: "Qur'an memorisation guidance with structured support.",
        meta: "Contact imam for details",
        icon: <ShieldCheck className="h-5 w-5" />,
      },
      {
        title: "Jumu'ah (Fridays)",
        body: "Weekly khutbah and congregational salah with a welcoming community.",
        meta: "Arrive early",
        icon: <Calendar className="h-5 w-5" />,
      },
      {
        title: "Community Support",
        body: "A masjid is a home for the community—spiritual, social, and charitable.",
        meta: "All are welcome",
        icon: <MapPin className="h-5 w-5" />,
      },
      {
        title: "Learning & Circles",
        body: "Periodic lessons and reminders (demo copy—update in admin).",
        meta: "Announcements in events",
        icon: <Clock className="h-5 w-5" />,
      },
      {
        title: "Family-Friendly",
        body: "A calm, respectful environment for families to worship and learn.",
        meta: "Responsive facilities",
        icon: <ShieldCheck className="h-5 w-5" />,
      },
    ],
    []
  );

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-ink text-sand">
      {/* Fonts + small CSS helpers */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cinzel:wght@400;600&family=Inter:wght@400;500;600&display=swap');
        :root {
          --ink: #0B1430;
          --ink2: #0E1C3D;
          --sand: #F3F0E6;
          --gold: #D8B15A;
        }
        html { scroll-behavior: smooth; }
        .font-display { font-family: Cinzel, ui-serif, Georgia, serif; }
        .font-body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
        .font-arabic { font-family: Amiri, ui-serif, Georgia, serif; }
        .shadow-soft { box-shadow: 0 22px 70px rgba(0,0,0,.22); }
        /* Fallback utility classes (so the navy theme works even without Tailwind color config) */
        .bg-ink { background-color: var(--ink); }
        .bg-ink2 { background-color: var(--ink2); }
        .bg-gold { background-color: var(--gold); }
        .bg-sand { background-color: var(--sand); }
        .text-sand { color: var(--sand); }
        .text-gold { color: var(--gold); }
        .text-ink { color: var(--ink); }
        .pattern {
          background-image:
            radial-gradient(circle at 12% 18%, rgba(216,177,90,.10), transparent 35%),
            radial-gradient(circle at 88% 72%, rgba(216,177,90,.08), transparent 40%),
            linear-gradient(180deg, rgba(255,255,255,.05), transparent 24%),
            url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 80 80"><g fill="none" stroke="%23D8B15A" stroke-opacity="0.12" stroke-width="1"><path d="M40 2l10 18-10 18-10-18z"/><path d="M40 42l10 18-10 18-10-18z"/><path d="M2 40l18-10 18 10-18 10z"/><path d="M42 40l18-10 18 10-18 10z"/></g></svg>');
          background-size: auto, auto, auto, 260px 260px;
          background-repeat: no-repeat, no-repeat, no-repeat, repeat;
        }
        .arch {
          border-top-left-radius: 999px;
          border-top-right-radius: 999px;
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button
            onClick={() => onNav("home")}
            className="flex items-center gap-3 text-left"
            aria-label="Go to home"
          >
            <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
              {/* Put your logo at /public/maslogo.jpg in Vite */}
              <img
                src="maslogo.jpg"
                alt="Masjid Al Taubah logo"
                className="h-full w-full object-cover"
                onError={(e) => {
                  // graceful fallback if logo missing in preview
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <div className="leading-tight">
              <div className="font-display text-sm sm:text-base text-sand">{BRAND.name}</div>
              <div className="text-xs tracking-wide text-sand/60">{BRAND.subtitle}</div>
            </div>
          </button>

          <nav className="hidden items-center gap-5 md:flex">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => onNav(n.id)}
                className="text-sm text-sand/75 hover:text-sand"
              >
                {n.label}
              </button>
            ))}
            <button
              onClick={() => setAdminOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gold/25 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
            >
              <ShieldCheck className="h-4 w-4" />
              Admin
            </button>
          </nav>

          <button
            className="md:hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand/80"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            Menu
          </button>
        </div>

        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/10 bg-ink/90 md:hidden"
            >
              <div className="mx-auto max-w-6xl px-4 py-3">
                <div className="grid gap-2">
                  {NAV.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onNav(n.id)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm text-sand/80"
                    >
                      {n.label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setAdminOpen(true);
                    }}
                    className="inline-flex items-center justify-between rounded-xl border border-gold/25 bg-gold/10 px-4 py-2 text-left text-sm text-gold"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Admin
                    </span>
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      {/* Hero */}
      <section id="home" className="relative overflow-hidden pattern">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="font-body">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs text-gold">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                {BRAND.est}
              </div>
              <h1 className="mt-5 font-display text-3xl leading-tight text-sand sm:text-5xl">
                A welcoming masjid for worship, learning, and community.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-sand/75">
                {BRAND.name} serves the Chatsworth community in the Malmesbury area with daily madrassa,
                a Hifz programme, and Jumu'ah on Fridays.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => onNav("prayer")}
                  className="rounded-2xl bg-gold px-5 py-3 text-sm font-semibold text-ink hover:opacity-95"
                >
                  View Prayer Times
                </button>
                <button
                  onClick={() => onNav("contact")}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-sand hover:bg-white/10"
                >
                  Get Directions
                </button>
              </div>

              <div className="mt-9 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-xs tracking-[0.25em] uppercase text-sand/60">Next prayer</div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="font-display text-xl text-sand">
                      {nextPrayer ? nextPrayer.label : "—"}
                    </div>
                    <div className="text-sm text-gold">{countdown || ""}</div>
                  </div>
                  <div className="mt-2 text-sm text-sand/70">
                    {nextPrayer?.timeRaw ? formatTime12h(nextPrayer.timeRaw) : ""}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-xs tracking-[0.25em] uppercase text-sand/60">Location</div>
                  <div className="mt-2 font-display text-xl text-sand">Chatsworth</div>
                  <div className="mt-2 text-sm text-sand/70">Malmesbury • Western Cape</div>
                </div>
              </div>
            </div>

            {/* Arch card with mosque imagery */}
            <div className="relative">
              <div className="arch overflow-hidden rounded-b-3xl border border-white/10 bg-ink2/70 shadow-soft">
                <div className="relative h-[420px] w-full">
                  {/* Mosque imagery: replace with your own /public image for production */}
                  <img
                    src={HERO_IMAGE_SRC}
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1600&q=80";
                    }}
                    alt="Mosque imagery"
                    className="absolute inset-0 h-full w-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />

                  {/* Simple mosque line art overlay */}
                  <svg
                    className="absolute inset-x-0 bottom-0 mx-auto mb-6 h-32 w-64 opacity-85"
                    viewBox="0 0 320 140"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M60 120V70c0-8 6-14 14-14h10c0-18 14-32 32-32s32 14 32 32h24c0-18 14-32 32-32s32 14 32 32h10c8 0 14 6 14 14v50"
                      stroke="rgba(216,177,90,.95)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M48 120h224"
                      stroke="rgba(243,240,230,.75)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M260 120V40m0 0l-10 10m10-10l10 10"
                      stroke="rgba(216,177,90,.95)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M260 28c3 0 6 3 6 6s-3 6-6 6-6-3-6-6 3-6 6-6Z"
                      fill="rgba(216,177,90,.95)"
                    />
                  </svg>

                  <div className="absolute left-6 top-6 rounded-2xl border border-white/10 bg-ink/60 p-4 backdrop-blur">
                    <div className="font-arabic text-lg text-sand">بِسْمِ ٱللَّٰهِ</div>
                    <div className="mt-1 text-xs tracking-[0.25em] uppercase text-sand/60">
                      Peace • Prayer • Community
                    </div>
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/15 blur-3xl" />
              <div className="pointer-events-none absolute -left-10 -bottom-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            </div>

          {/* Video */}
          <div className="mt-10">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="font-display text-xl text-sand">Video</div>
                <a
                  className="text-sm text-sand/70 underline decoration-white/20 hover:text-sand"
                  href={DEFAULT_FACEBOOK_VIDEO_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open on Facebook
                </a>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-ink2">
                <div className="relative w-full pb-[56.25%]">
                  <iframe
                    title="Facebook Video"
                    className="absolute inset-0 h-full w-full"
                    src={facebookEmbedUrl(DEFAULT_FACEBOOK_VIDEO_URL)}
                    style={{ border: "none", overflow: "hidden" }}
                    scrolling="no"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>

              <div className="mt-3 text-xs text-sand/60">
                If the video doesn’t play here on your phone, tap “Open on Facebook”.
              </div>
            </div>
          </div>

          </div>
        </div>
      </section>

      {/* Prayer Times */}
      <div className="bg-ink2">
        <div className="py-14 sm:py-18">
          <Section id="prayer" eyebrow="Cape Town" title="Prayer Times (Aladhan API)">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur lg:col-span-1">
                <div className="flex items-center gap-2 text-gold">
                  <Clock className="h-5 w-5" />
                  <div className="font-display text-lg text-sand">Today</div>
                </div>
                <div className="mt-3 text-sm text-sand/75">
                  {meta?.timezone ? (
                    <div>
                      Timezone: <span className="text-sand">{meta.timezone}</span>
                    </div>
                  ) : null}
                  <div className="mt-1">
                    Updated: <span className="text-sand">{now.toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/10 p-4">
                  <div className="text-xs tracking-[0.25em] uppercase text-gold/90">
                    Next
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <div className="font-display text-2xl text-sand">
                      {nextPrayer ? nextPrayer.label : "—"}
                    </div>
                    <div className="text-sm font-semibold text-gold">{countdown || ""}</div>
                  </div>
                  <div className="mt-2 text-sm text-sand/80">
                    {nextPrayer?.timeRaw ? formatTime12h(nextPrayer.timeRaw) : ""}
                    {nextPrayer?.isTomorrow ? (
                      <span className="ml-2 text-xs text-sand/60">(tomorrow)</span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 text-xs text-sand/60">
                  Tip: If your masjid uses a different calculation method, change the <span className="text-sand">method</span>
                  parameter in the API URL.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="font-display text-lg text-sand">Daily Timings</div>
                  <div className="text-xs text-sand/60">Cape Town, South Africa</div>
                </div>

                {ptLoading ? (
                  <div className="mt-6 animate-pulse space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-10 w-full rounded-xl bg-white/10" />
                    ))}
                  </div>
                ) : ptError ? (
                  <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-sand/80">
                    <div className="font-semibold text-sand">Could not load prayer times.</div>
                    <div className="mt-1 text-sand/70">{ptError}</div>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[
                      { k: "Fajr", label: "Fajr" },
                      { k: "Sunrise", label: "Sunrise" },
                      { k: "Dhuhr", label: "Dhuhr" },
                      { k: "Asr", label: "Asr" },
                      { k: "Maghrib", label: "Maghrib" },
                      { k: "Isha", label: "Isha" },
                    ].map((p) => {
                      const isNext = nextPrayer?.key === p.k;
                      return (
                        <div
                          key={p.k}
                          className={cn(
                            "flex items-center justify-between rounded-2xl border p-4",
                            isNext
                              ? "border-gold/35 bg-gold/10"
                              : "border-white/10 bg-white/5"
                          )}
                        >
                          <div className="text-sm text-sand/80">{p.label}</div>
                          <div className={cn("font-display text-lg", isNext ? "text-gold" : "text-sand")}>
                            {formatTime12h(timings?.[p.k])}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* About */}
      <div className="bg-ink">
        <div className="py-14 sm:py-18">
          <Section id="about" eyebrow="Our Masjid" title="About Masjid Al Taubah">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="font-display text-xl text-sand">Who we are</div>
                <p className="mt-3 text-sm leading-relaxed text-sand/75">
                  Established in 1995, Masjid Al Taubah (Islamic Society of Chatsworth) is a place of salah,
                  Qur'an learning, and community connection. We aim to serve with sincerity, welcoming
                  worshippers and families in a respectful and peaceful environment.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-ink2/60 p-4">
                    <div className="text-xs tracking-[0.25em] uppercase text-sand/60">Established</div>
                    <div className="mt-2 font-display text-2xl text-sand">1995</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-ink2/60 p-4">
                    <div className="text-xs tracking-[0.25em] uppercase text-sand/60">Weekly</div>
                    <div className="mt-2 font-display text-2xl text-sand">Jumu'ah</div>
                    <div className="mt-1 text-sm text-sand/70">Fridays</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="font-display text-xl text-sand">What to expect</div>
                <ul className="mt-4 space-y-3 text-sm text-sand/75">
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-gold" />
                    Congregational salah in a calm, welcoming space.
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-gold" />
                    Daily madrassa and Qur'an memorisation support (Hifz).
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-gold" />
                    Announcements and events updated by the admin panel (demo).
                  </li>
                </ul>
                <div className="mt-6 rounded-2xl border border-gold/25 bg-gold/10 p-4">
                  <div className="text-xs tracking-[0.25em] uppercase text-gold/90">Contact</div>
                  <div className="mt-2 text-sm text-sand/80">{BRAND.email}</div>
                  <div className="mt-1 text-sm text-sand/70">{BRAND.address}</div>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* Programs (scroll animated boxes) */}
      <div className="bg-ink2">
        <div className="py-14 sm:py-18">
          <Section id="programs" eyebrow="Learn & Grow" title="Programs">
            <ScrollBoxes items={programs} />
          </Section>
        </div>
      </div>

      {/* Events */}
      <div className="bg-ink">
        <div className="py-14 sm:py-18">
          <Section id="events" eyebrow="Announcements" title="Events">
            <div className="grid gap-4">
              {events.map((e) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.45 }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-display text-lg text-sand">{e.title}</div>
                      <div className="mt-1 text-xs tracking-[0.25em] uppercase text-sand/60">
                        {e.date}
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs text-gold">
                      <Calendar className="h-4 w-4" />
                      Updated via admin
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-sand/75">{e.note}</p>
                </motion.div>
              ))}

              {events.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-sand/75">
                  No events yet. Add one in the Admin panel.
                </div>
              ) : null}
            </div>
          </Section>
        </div>
      </div>

      {/* Gallery */}
      <div className="bg-ink2">
        <div className="py-14 sm:py-18">
          <Section id="gallery" eyebrow="Photos" title="Gallery">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((g, idx) => (
                <motion.figure
                  key={g.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.55, delay: idx * 0.04 }}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
                >
                  <div className="relative h-44 w-full">
                    <img
                      src={g.url}
                      alt={g.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
                  </div>
                  <figcaption className="p-4">
                    <div className="font-display text-base text-sand">{g.title}</div>
                    <div className="mt-1 text-xs text-sand/60">Managed in admin (demo)</div>
                  </figcaption>
                </motion.figure>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-ink">
        <div className="py-14 sm:py-18">
          <Section id="contact" eyebrow="Visit Us" title="Contact & Location">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="font-display text-xl text-sand">Get in touch</div>
                <div className="mt-5 space-y-3 text-sm text-sand/75">
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 text-gold" />
                    <div>
                      <div className="text-sand">Address</div>
                      <div className="text-sand/70">{BRAND.address}</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Mail className="mt-0.5 h-5 w-5 text-gold" />
                    <div>
                      <div className="text-sand">Email</div>
                      <a
                        className="text-sand/70 underline decoration-white/20 hover:text-sand"
                        href={`mailto:${BRAND.email}`}
                      >
                        {BRAND.email}
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Phone className="mt-0.5 h-5 w-5 text-gold" />
                    <div>
                      <div className="text-sand">Phone</div>
                      <div className="text-sand/70">(Add number in admin / settings)</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-gold/25 bg-gold/10 p-4">
                  <div className="text-xs tracking-[0.25em] uppercase text-gold/90">Jumu'ah</div>
                  <div className="mt-2 text-sm text-sand/80">Fridays</div>
                  <div className="mt-1 text-xs text-sand/60">Please arrive early</div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    className="inline-flex items-center gap-2 rounded-2xl bg-gold px-5 py-3 text-sm font-semibold text-ink hover:opacity-95"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      BRAND.address
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => setAdminOpen(true)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-sand hover:bg-white/10"
                  >
                    Admin panel
                    <ShieldCheck className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {/* Google Map embed */}
                <iframe
                  title="Masjid Al Taubah Map"
                  className="h-[420px] w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    BRAND.address
                  )}&output=embed`}
                />
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-ink2">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-display text-lg text-sand">{BRAND.name}</div>
              <div className="mt-1 text-sm text-sand/65">{BRAND.subtitle} • {BRAND.est}</div>
            </div>
            <div className="flex flex-wrap gap-3">
              {NAV.slice(0, 4).map((n) => (
                <button
                  key={n.id}
                  onClick={() => onNav(n.id)}
                  className="text-sm text-sand/70 hover:text-sand"
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-8 text-xs text-sand/55">
            © {year} {BRAND.name}. Built with Vite + React. Prayer times powered by Aladhan API.
          </div>
        </div>
      </footer>

      {/* Admin modal */}
      <Modal
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        title="Admin Panel (Demo)"
      >
        <div className="text-sm text-sand/70">
          This is a <span className="text-sand">demo</span> admin panel that saves changes in your browser only.
          For a real secure admin panel on shared hosting, we can add a backend (e.g., PHP/Laravel)
          or a small Node API with proper authentication.
        </div>

        {!adminAuthed ? (
          <AdminLogin
            onLogin={() => {
              setAdminAuthed(true);
              setLoginErr("");
            }}
            loginErr={loginErr}
            setLoginErr={setLoginErr}
          />
        ) : (
          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
                <button
                  onClick={() => setAdminTab("events")}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm",
                    adminTab === "events" ? "bg-white/10 text-sand" : "text-sand/70"
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Events
                  </span>
                </button>
                <button
                  onClick={() => setAdminTab("gallery")}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm",
                    adminTab === "gallery" ? "bg-white/10 text-sand" : "text-sand/70"
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" /> Gallery
                  </span>
                </button>
              </div>

              <button
                onClick={() => setAdminAuthed(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand/80 hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>

            <div className="mt-5">
              {adminTab === "events" ? (
                <AdminEvents events={events} setEvents={setEvents} />
              ) : (
                <AdminGallery gallery={gallery} setGallery={setGallery} />
              )}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-sand/60">
          <div className="font-semibold text-sand">Demo credentials</div>
          <div className="mt-1">
            Email: <span className="text-sand">admin@mataubah.local</span> • Password: <span className="text-sand">Taubah1995</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AdminLogin({ onLogin, loginErr, setLoginErr }) {
  const [email, setEmail] = useState("admin@mataubah.local");
  const [password, setPassword] = useState("Taubah1995");

  const submit = (e) => {
    e.preventDefault();
    // DEMO ONLY: replace with real auth
    if (email.trim() === "admin@mataubah.local" && password === "Taubah1995") {
      onLogin();
      return;
    }
    setLoginErr("Invalid credentials (demo). Use the demo email/password shown below.");
  };

  return (
    <form onSubmit={submit} className="mt-5">
      <div className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-sand/60">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-sand outline-none focus:border-gold/40"
            type="email"
            autoComplete="username"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-sand/60">Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-sand outline-none focus:border-gold/40"
            type="password"
            autoComplete="current-password"
          />
        </label>

        {loginErr ? (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-sand/80">
            {loginErr}
          </div>
        ) : null}

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:opacity-95"
        >
          <LogIn className="h-4 w-4" /> Sign in
        </button>
      </div>
    </form>
  );
}

function AdminEvents({ events, setEvents }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  const add = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const newEvent = {
      id: crypto.randomUUID?.() || String(Date.now()),
      title: title.trim(),
      date: date.trim() || "TBA",
      note: note.trim() || "",
    };
    setEvents([newEvent, ...events]);
    setTitle("");
    setDate("");
    setNote("");
  };

  const del = (id) => setEvents(events.filter((e) => e.id !== id));

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="font-display text-base text-sand">Add event</div>
        <form onSubmit={add} className="mt-3 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title (e.g., Jumu'ah)"
              className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-sand outline-none focus:border-gold/40"
            />
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="Date / frequency (e.g., Every Friday)"
              className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-sand outline-none focus:border-gold/40"
            />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Short note"
            rows={3}
            className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-sand outline-none focus:border-gold/40"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="font-display text-base text-sand">Manage events</div>
        <div className="mt-3 grid gap-2">
          {events.map((e) => (
            <div
              key={e.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-ink px-3 py-3"
            >
              <div>
                <div className="text-sm text-sand">{e.title}</div>
                <div className="mt-1 text-xs text-sand/60">{e.date}</div>
                {e.note ? <div className="mt-2 text-xs text-sand/70">{e.note}</div> : null}
              </div>
              <button
                onClick={() => del(e.id)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-sand/75 hover:bg-white/10"
                aria-label="Delete event"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {events.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-ink px-3 py-3 text-sm text-sand/70">
              No events.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AdminGallery({ gallery, setGallery }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const add = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    const item = {
      id: crypto.randomUUID?.() || String(Date.now()),
      title: title.trim() || "Gallery image",
      url: url.trim(),
    };
    setGallery([item, ...gallery]);
    setTitle("");
    setUrl("");
  };

  const del = (id) => setGallery(gallery.filter((g) => g.id !== id));

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="font-display text-base text-sand">Add gallery image</div>
        <form onSubmit={add} className="mt-3 grid gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-sand outline-none focus:border-gold/40"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Image URL (https://...)"
            className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-sand outline-none focus:border-gold/40"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="font-display text-base text-sand">Manage gallery</div>
        <div className="mt-3 grid gap-2">
          {gallery.map((g) => (
            <div
              key={g.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-ink px-3 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-sand">{g.title}</div>
                <div className="mt-1 truncate text-xs text-sand/60">{g.url}</div>
              </div>
              <button
                onClick={() => del(g.id)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-sand/75 hover:bg-white/10"
                aria-label="Delete image"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {gallery.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-ink px-3 py-3 text-sm text-sand/70">
              No images.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
