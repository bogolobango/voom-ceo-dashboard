/**
 * VOOM Analytics Tracker — Drop into voomparts.com
 * ─────────────────────────────────────────────────
 *
 * HOW TO USE:
 * 1. Copy this file to your voom-ghana-marketplace project
 * 2. Import and call initVoomTracker() once in your app's root component
 * 3. Call trackEvent() from specific components for product_view, search, etc.
 *
 * This tracker sends events to the CEO dashboard's /api/track endpoint.
 * It captures: page views, sessions, traffic source (UTM/referrer),
 * device info, geo (via timezone), and visitor identification.
 *
 * SETUP:
 * Set VOOM_TRACKER_URL to your CEO dashboard URL.
 * In development: http://localhost:5000/api/track
 * In production: https://your-dashboard-domain.com/api/track
 */

// ─── Configuration ───

const TRACKER_URL = typeof window !== 'undefined'
  ? (window as any).__VOOM_TRACKER_URL || 'https://your-ceo-dashboard.replit.app/api/track'
  : '';

const VISITOR_ID_KEY = 'voom_vid';
const SESSION_ID_KEY = 'voom_sid';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// ─── Visitor & Session Management ───

function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let vid = localStorage.getItem(VISITOR_ID_KEY);
  if (!vid) {
    vid = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(VISITOR_ID_KEY, vid);
  }
  return vid;
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  const now = Date.now();
  const stored = sessionStorage.getItem(SESSION_ID_KEY);
  if (stored) {
    const { id, lastActive } = JSON.parse(stored);
    if (now - lastActive < SESSION_TIMEOUT) {
      sessionStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id, lastActive: now }));
      return id;
    }
  }
  // New session
  const id = 's_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  sessionStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id, lastActive: now }));
  return id;
}

function isNewSession(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = sessionStorage.getItem(SESSION_ID_KEY);
  return !stored;
}

// ─── Device & Environment Detection ───

function getDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
}

function getBrowser(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Other';
}

function getOS(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Other';
}

// ─── UTM & Traffic Source ───

function getUTMParams(): { utmSource?: string; utmMedium?: string; utmCampaign?: string } {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  const source = params.get('utm_source');
  const medium = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  if (source) result.utmSource = source;
  if (medium) result.utmMedium = medium;
  if (campaign) result.utmCampaign = campaign;
  return result;
}

function getReferrer(): string {
  if (typeof window === 'undefined') return '';
  const ref = document.referrer;
  if (!ref) return '';
  try {
    const url = new URL(ref);
    // Don't count same-site as referral
    if (url.hostname === window.location.hostname) return '';
    return url.hostname;
  } catch {
    return ref;
  }
}

// ─── Approximate geo from timezone ───

function getApproxGeo(): { country?: string; city?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "Africa/Accra"
    // Map common timezones to countries
    const tzCountryMap: Record<string, { country: string; city: string }> = {
      'Africa/Accra': { country: 'Ghana', city: 'Accra' },
      'Africa/Kumasi': { country: 'Ghana', city: 'Kumasi' },
      'Africa/Lagos': { country: 'Nigeria', city: 'Lagos' },
      'Africa/Nairobi': { country: 'Kenya', city: 'Nairobi' },
      'Africa/Dar_es_Salaam': { country: 'Tanzania', city: 'Dar es Salaam' },
      'Africa/Kampala': { country: 'Uganda', city: 'Kampala' },
      'Africa/Lusaka': { country: 'Zambia', city: 'Lusaka' },
      'Africa/Douala': { country: 'Cameroon', city: 'Douala' },
      'Africa/Abidjan': { country: 'Ivory Coast', city: 'Abidjan' },
      'Africa/Dakar': { country: 'Senegal', city: 'Dakar' },
      'Africa/Kinshasa': { country: 'DRC', city: 'Kinshasa' },
      'Africa/Addis_Ababa': { country: 'Ethiopia', city: 'Addis Ababa' },
      'Africa/Kigali': { country: 'Rwanda', city: 'Kigali' },
      'Africa/Maputo': { country: 'Mozambique', city: 'Maputo' },
      'America/New_York': { country: 'United States', city: 'New York' },
      'America/Chicago': { country: 'United States', city: 'Chicago' },
      'America/Los_Angeles': { country: 'United States', city: 'Los Angeles' },
      'Europe/London': { country: 'United Kingdom', city: 'London' },
      'Europe/Stockholm': { country: 'Sweden', city: 'Stockholm' },
      'Asia/Kolkata': { country: 'India', city: 'Mumbai' },
    };
    return tzCountryMap[tz] || { country: tz.split('/')[0] === 'Africa' ? tz.split('/')[1]?.replace('_', ' ') : undefined };
  } catch {
    return {};
  }
}

// ─── Core Tracking ───

interface TrackEventOptions {
  eventType: string;
  productId?: number;
  vendorId?: number;
  userId?: number;
  metadata?: Record<string, unknown>;
}

let eventQueue: any[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushQueue() {
  if (eventQueue.length === 0) return;
  const batch = [...eventQueue];
  eventQueue = [];

  // Use sendBeacon for reliability (survives page unload)
  const payload = JSON.stringify(batch);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(TRACKER_URL, new Blob([payload], { type: 'application/json' }));
  } else {
    fetch(TRACKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {}); // silent fail
  }
}

/**
 * Track a single event. Events are batched and sent every 2 seconds
 * or immediately on page unload.
 */
export function trackEvent(options: TrackEventOptions): void {
  if (typeof window === 'undefined') return;
  if (!TRACKER_URL) return;

  const visitorId = getOrCreateVisitorId();
  const sessionId = getOrCreateSessionId();
  const utm = getUTMParams();
  const geo = getApproxGeo();

  eventQueue.push({
    eventType: options.eventType,
    productId: options.productId,
    vendorId: options.vendorId,
    userId: options.userId,
    visitorId,
    sessionId,
    referrer: getReferrer(),
    ...utm,
    ...geo,
    deviceType: getDeviceType(),
    browser: getBrowser(),
    os: getOS(),
    screenWidth: window.innerWidth,
    pageUrl: window.location.pathname,
    pageTitle: document.title,
    metadata: options.metadata,
  });

  // Batch: flush every 2 seconds
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushQueue();
      flushTimer = null;
    }, 2000);
  }
}

/**
 * Initialize the VOOM tracker. Call once in your app root.
 * Automatically tracks:
 * - session_start (once per session)
 * - page_view (on every route change)
 */
export function initVoomTracker(options?: { trackerUrl?: string; userId?: number }): void {
  if (typeof window === 'undefined') return;

  // Override tracker URL if provided
  if (options?.trackerUrl) {
    (window as any).__VOOM_TRACKER_URL = options.trackerUrl;
  }

  // Track session start
  const newSession = isNewSession();
  getOrCreateSessionId(); // ensure session exists

  if (newSession) {
    trackEvent({ eventType: 'session_start', userId: options?.userId });
  }

  // Track initial page view
  trackEvent({ eventType: 'page_view', userId: options?.userId });

  // Track page views on History API navigation (SPA)
  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    originalPushState(...args);
    setTimeout(() => trackEvent({ eventType: 'page_view', userId: options?.userId }), 100);
  };

  window.addEventListener('popstate', () => {
    trackEvent({ eventType: 'page_view', userId: options?.userId });
  });

  // Flush on page unload
  window.addEventListener('beforeunload', flushQueue);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushQueue();
  });
}

/*
 * ─── INTEGRATION EXAMPLES ────────────────────────────────────
 *
 * 1. In your app's root component (e.g., App.tsx or _app.tsx):
 *
 *    import { initVoomTracker } from './voom-tracker';
 *
 *    useEffect(() => {
 *      initVoomTracker({
 *        trackerUrl: 'https://your-ceo-dashboard.replit.app/api/track',
 *        userId: currentUser?.id,  // pass if logged in
 *      });
 *    }, []);
 *
 * 2. On product detail pages:
 *
 *    import { trackEvent } from './voom-tracker';
 *
 *    useEffect(() => {
 *      trackEvent({
 *        eventType: 'product_view',
 *        productId: product.id,
 *        vendorId: product.vendorId,
 *      });
 *    }, [product.id]);
 *
 * 3. On WhatsApp tap:
 *
 *    trackEvent({
 *      eventType: 'whatsapp_tap',
 *      productId: product.id,
 *      vendorId: product.vendorId,
 *    });
 *
 * 4. On search:
 *
 *    trackEvent({
 *      eventType: 'search',
 *      metadata: { query: searchQuery, resultCount: results.length },
 *    });
 *
 * 5. On add to cart:
 *
 *    trackEvent({
 *      eventType: 'cart_add',
 *      productId: product.id,
 *    });
 */
