/**
 * VOOM Ghana — WhatsApp Group Discovery Scraper
 * ─────────────────────────────────────────────
 * Discovers public WhatsApp group invite links from multiple sources:
 *  1. Google Search via SerpApi (finds chat.whatsapp.com links indexed on the web)
 *  2. Apify WhatsApp Group Links Scraper Actor (scrapes Facebook, Instagram, TikTok, etc.)
 *
 * Both providers are optional — the system degrades gracefully if API keys are missing,
 * returning mock data so the dashboard UI can be developed and tested immediately.
 */

export interface DiscoveredGroup {
  inviteLink: string;
  source: string;
  sourceUrl: string;
  name?: string;
  keywords: string[];
}

// ── Utility: extract all chat.whatsapp.com links from a block of text ──────────
export function extractWhatsAppLinks(text: string): string[] {
  const regex = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/g;
  const matches = text.match(regex) || [];
  return [...new Set(matches)]; // deduplicate
}

// ── Source 1: SerpApi Google Search ────────────────────────────────────────────
async function scrapeViaGoogle(
  keywords: string[],
  apiKey: string
): Promise<DiscoveredGroup[]> {
  const results: DiscoveredGroup[] = [];

  for (const keyword of keywords) {
    const query = encodeURIComponent(
      `site:chat.whatsapp.com OR "chat.whatsapp.com" ${keyword} Ghana`
    );
    const url = `https://serpapi.com/search.json?q=${query}&num=20&api_key=${apiKey}`;

    try {
      const res = await fetch(url);
      const data = (await res.json()) as any;
      const organicResults: any[] = data?.organic_results || [];

      for (const item of organicResults) {
        const links = extractWhatsAppLinks(
          `${item.link || ""} ${item.snippet || ""}`
        );
        for (const link of links) {
          results.push({
            inviteLink: link,
            source: "google",
            sourceUrl: item.link || url,
            name: item.title,
            keywords,
          });
        }
      }
    } catch (err) {
      console.error("[Scraper] SerpApi error:", err);
    }
  }

  return results;
}

// ── Source 2: Apify WhatsApp Group Links Scraper ────────────────────────────────
async function scrapeViaApify(
  keywords: string[],
  apiKey: string,
  platforms: string[]
): Promise<DiscoveredGroup[]> {
  const results: DiscoveredGroup[] = [];

  // Apify actor: danny.hub/whatsapp-url
  const ACTOR_ID = "danny.hub~whatsapp-url";
  const runUrl = `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${apiKey}`;

  for (const keyword of keywords) {
    for (const platform of platforms) {
      try {
        // Start the actor run
        const runRes = await fetch(runUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: `${keyword} Ghana`,
            platform,
            country: "GH",
          }),
        });
        const runData = (await runRes.json()) as any;
        const runId = runData?.data?.id;
        if (!runId) continue;

        // Poll for completion (max 60 seconds)
        let datasetId: string | null = null;
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const statusRes = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
          );
          const statusData = (await statusRes.json()) as any;
          const status = statusData?.data?.status;
          if (status === "SUCCEEDED") {
            datasetId = statusData?.data?.defaultDatasetId;
            break;
          }
          if (status === "FAILED" || status === "ABORTED") break;
        }

        if (!datasetId) continue;

        // Fetch dataset items
        const dataRes = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&format=json`
        );
        const items = (await dataRes.json()) as any[];

        for (const item of items) {
          const link = item?.whatsappUrl || item?.url || item?.link;
          if (link && link.includes("chat.whatsapp.com")) {
            results.push({
              inviteLink: link,
              source: platform,
              sourceUrl: item?.sourceUrl || item?.pageUrl || "",
              name: item?.groupName || item?.title,
              keywords,
            });
          }
        }
      } catch (err) {
        console.error(`[Scraper] Apify error (${platform}):`, err);
      }
    }
  }

  return results;
}

// ── Source 3: Direct Web Scraping via known group directories ──────────────────
async function scrapeViaDirectSearch(
  keywords: string[]
): Promise<DiscoveredGroup[]> {
  const results: DiscoveredGroup[] = [];

  // Known sites that aggregate WhatsApp group links
  const targetSites = [
    "groupsor.link",
    "whatsaplinks.com",
    "walink.co",
    "chat.whatsapp.com",
  ];

  for (const keyword of keywords) {
    for (const site of targetSites) {
      const searchUrl = `https://www.google.com/search?q=site:${site}+${encodeURIComponent(keyword + " Ghana car parts")}`;
      try {
        const res = await fetch(searchUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });
        const html = await res.text();
        const links = extractWhatsAppLinks(html);
        for (const link of links) {
          results.push({
            inviteLink: link,
            source: "web_directory",
            sourceUrl: searchUrl,
            keywords,
          });
        }
      } catch (err) {
        // Silently skip — Google blocks direct scraping without a proxy
      }
    }
  }

  return results;
}

// ── Mock data for development / when API keys are not configured ───────────────
function getMockGroups(keywords: string[]): DiscoveredGroup[] {
  return [
    {
      inviteLink: "https://chat.whatsapp.com/DEMO_GhanaAutoPartsAccra001",
      source: "facebook",
      sourceUrl: "https://www.facebook.com/groups/cardealersghana",
      name: "Ghana Auto Parts Accra",
      keywords,
    },
    {
      inviteLink: "https://chat.whatsapp.com/DEMO_AbosseyOkaiSpares002",
      source: "facebook",
      sourceUrl: "https://www.facebook.com/groups/966583207420627",
      name: "Abossey Okai Spare Parts Dealers",
      keywords,
    },
    {
      inviteLink: "https://chat.whatsapp.com/DEMO_GhanaMechanicsHub003",
      source: "google",
      sourceUrl: "https://groupsor.link/group/invite/GhanaMechanics",
      name: "Ghana Mechanics Hub",
      keywords,
    },
    {
      inviteLink: "https://chat.whatsapp.com/DEMO_AccraCarEnthusiasts004",
      source: "instagram",
      sourceUrl: "https://www.instagram.com/p/DUuT3QdiHMr/",
      name: "Accra Car Enthusiasts",
      keywords,
    },
    {
      inviteLink: "https://chat.whatsapp.com/DEMO_GhanaCarDealers005",
      source: "facebook",
      sourceUrl: "https://www.facebook.com/groups/cardealersghana",
      name: "Ghana Car Dealers Network",
      keywords,
    },
    {
      inviteLink: "https://chat.whatsapp.com/DEMO_KumasiAutoSpares006",
      source: "google",
      sourceUrl: "https://groupsor.link/group/invite/KumasiAuto",
      name: "Kumasi Auto Spare Parts",
      keywords,
    },
    {
      inviteLink: "https://chat.whatsapp.com/DEMO_GhanaJapaneseUsedCars007",
      source: "tiktok",
      sourceUrl: "https://www.tiktok.com/@ghanaautodeals",
      name: "Ghana Japanese Used Cars",
      keywords,
    },
    {
      inviteLink: "https://chat.whatsapp.com/DEMO_TakoradeAutoHub008",
      source: "facebook",
      sourceUrl: "https://www.facebook.com/groups/takoradiautomotive",
      name: "Takoradi Auto Hub",
      keywords,
    },
  ];
}

// ── Main Orchestrator ──────────────────────────────────────────────────────────
export interface ScrapeOptions {
  keywords: string[];
  platforms: string[];
  serpApiKey?: string;
  apifyApiKey?: string;
  useMockIfNoKeys?: boolean;
}

export async function discoverWhatsAppGroups(
  options: ScrapeOptions
): Promise<DiscoveredGroup[]> {
  const {
    keywords,
    platforms,
    serpApiKey,
    apifyApiKey,
    useMockIfNoKeys = true,
  } = options;

  const allResults: DiscoveredGroup[] = [];

  // Use real APIs if keys are available
  if (serpApiKey) {
    console.log("[Scraper] Running Google/SerpApi discovery...");
    const googleResults = await scrapeViaGoogle(keywords, serpApiKey);
    allResults.push(...googleResults);
  }

  if (apifyApiKey) {
    console.log("[Scraper] Running Apify multi-platform discovery...");
    const apifyResults = await scrapeViaApify(keywords, apifyApiKey, platforms);
    allResults.push(...apifyResults);
  }

  // Fall back to mock data if no API keys are configured
  if (allResults.length === 0 && useMockIfNoKeys) {
    console.log("[Scraper] No API keys configured — returning mock data for development.");
    return getMockGroups(keywords);
  }

  // Deduplicate by invite link
  const seen = new Set<string>();
  return allResults.filter((g) => {
    if (seen.has(g.inviteLink)) return false;
    seen.add(g.inviteLink);
    return true;
  });
}
