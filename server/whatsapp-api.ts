/**
 * VOOM Ghana — WhatsApp Business API Integration
 * ───────────────────────────────────────────────
 * Handles all interactions with the Meta WhatsApp Cloud API:
 *  - Sending messages (individual DMs and group broadcasts)
 *  - Joining groups via invite links
 *  - Webhook verification and event processing
 *  - Lead qualification conversation state machine
 *
 * Configuration (set in .env):
 *  WA_PHONE_NUMBER_ID   — Your WhatsApp Business phone number ID from Meta
 *  WA_ACCESS_TOKEN      — Your permanent access token from Meta
 *  WA_WEBHOOK_TOKEN     — A secret string you define for webhook verification
 *  WA_BUSINESS_ACCOUNT_ID — Your WhatsApp Business Account ID
 */

const WA_API_BASE = "https://graph.facebook.com/v21.0";

export interface WaConfig {
  phoneNumberId: string;
  accessToken: string;
  webhookToken: string;
  businessAccountId: string;
}

function getConfig(): WaConfig {
  return {
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID || "",
    accessToken: process.env.WA_ACCESS_TOKEN || "",
    webhookToken: process.env.WA_WEBHOOK_TOKEN || "voom_webhook_secret",
    businessAccountId: process.env.WA_BUSINESS_ACCOUNT_ID || "",
  };
}

// ── Send a text message to an individual or group ─────────────────────────────
export async function sendTextMessage(
  to: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    console.log("[WA API] Not configured — message not sent (dev mode):", body);
    return { success: true, messageId: `mock_${Date.now()}` };
  }

  try {
    const res = await fetch(
      `${WA_API_BASE}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { body },
        }),
      }
    );
    const data = (await res.json()) as any;
    if (data?.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return { success: false, error: JSON.stringify(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Send a pre-approved template message ──────────────────────────────────────
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = "en_US",
  components: any[] = []
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    console.log("[WA API] Not configured — template not sent (dev mode):", templateName);
    return { success: true, messageId: `mock_tmpl_${Date.now()}` };
  }

  try {
    const res = await fetch(
      `${WA_API_BASE}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            components,
          },
        }),
      }
    );
    const data = (await res.json()) as any;
    if (data?.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return { success: false, error: JSON.stringify(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Create a WhatsApp Group (requires OBA status) ─────────────────────────────
export async function createGroup(
  subject: string,
  description?: string
): Promise<{ success: boolean; groupId?: string; inviteLink?: string; error?: string }> {
  const config = getConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    console.log("[WA API] Not configured — group creation mocked");
    return { success: true, groupId: `mock_group_${Date.now()}`, inviteLink: "https://chat.whatsapp.com/mock" };
  }

  try {
    const res = await fetch(
      `${WA_API_BASE}/${config.phoneNumberId}/groups`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject, description }),
      }
    );
    const data = (await res.json()) as any;
    if (data?.id) {
      return { success: true, groupId: data.id, inviteLink: data.invite_link };
    }
    return { success: false, error: JSON.stringify(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Send a group invite link to a user (uses approved template) ───────────────
export async function sendGroupInvite(
  to: string,
  groupInviteLink: string,
  groupName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // This uses the "group_invite_link" template from Meta's Template Library
  return sendTemplateMessage(to, "group_invite_upon_request", "en_US", [
    {
      type: "body",
      parameters: [
        { type: "text", text: groupName },
        { type: "text", text: groupInviteLink },
      ],
    },
  ]);
}

// ── Broadcast a message to multiple groups ────────────────────────────────────
export async function broadcastToGroups(
  groupWaIds: string[],
  message: string
): Promise<{ groupId: string; success: boolean; messageId?: string }[]> {
  const results = [];
  for (const groupId of groupWaIds) {
    const result = await sendTextMessage(groupId, message);
    results.push({ groupId, ...result });
    // Rate limiting: wait 500ms between messages to avoid API throttling
    await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}

// ── Verify webhook signature from Meta ────────────────────────────────────────
export function verifyWebhookToken(token: string): boolean {
  const config = getConfig();
  return token === config.webhookToken;
}

// ── Lead Qualification State Machine ─────────────────────────────────────────
// Tracks conversation state for each phone number
const conversationStates: Map<string, ConversationState> = new Map();

interface ConversationState {
  step: "welcome" | "ask_type" | "ask_name" | "ask_interest" | "done";
  type?: "vendor" | "customer";
  name?: string;
  interest?: string;
  startedAt: Date;
}

export function getConversationState(phone: string): ConversationState {
  if (!conversationStates.has(phone)) {
    conversationStates.set(phone, { step: "welcome", startedAt: new Date() });
  }
  return conversationStates.get(phone)!;
}

export function setConversationState(phone: string, state: ConversationState): void {
  conversationStates.set(phone, state);
}

export function clearConversationState(phone: string): void {
  conversationStates.delete(phone);
}

export interface QualificationResult {
  reply: string;
  isComplete: boolean;
  leadData?: {
    name?: string;
    type: "vendor" | "customer" | "unknown";
    interest?: string;
  };
}

export function processLeadMessage(
  phone: string,
  message: string
): QualificationResult {
  const state = getConversationState(phone);
  const msg = message.trim().toLowerCase();

  switch (state.step) {
    case "welcome":
    case "ask_type": {
      setConversationState(phone, { ...state, step: "ask_name" });
      return {
        reply: `👋 Hi! Thanks for reaching out to *VOOM Parts* — Ghana's #1 marketplace for auto spare parts.\n\nAre you:\n1️⃣ A *buyer* looking for car parts?\n2️⃣ A *vendor/mechanic* who sells parts?\n\nReply with *1* or *2*.`,
        isComplete: false,
      };
    }

    case "ask_name": {
      let type: "vendor" | "customer" | "unknown" = "unknown";
      if (msg === "1" || msg.includes("buyer") || msg.includes("buy")) {
        type = "customer";
      } else if (
        msg === "2" ||
        msg.includes("vendor") ||
        msg.includes("sell") ||
        msg.includes("mechanic")
      ) {
        type = "vendor";
      }

      setConversationState(phone, { ...state, step: "ask_interest", type });
      return {
        reply:
          type === "vendor"
            ? `Great! 🛠️ As a vendor, you can list your parts on *voomparts.com* and reach buyers across all 16 regions of Ghana — for free!\n\nWhat's your business name or your name?`
            : `Perfect! 🔍 We can help you find any car part in Ghana fast.\n\nWhat's your name?`,
        isComplete: false,
      };
    }

    case "ask_interest": {
      const name = message.trim();
      setConversationState(phone, { ...state, step: "done", name });

      const type = state.type || "unknown";
      const finalReply =
        type === "vendor"
          ? `Nice to meet you, *${name}*! 🎉\n\nHere's how to get started:\n👉 Visit *voomparts.com* and click "Register as Vendor"\n👉 It's completely *FREE* to list your first 10 parts\n👉 Buyers from across Ghana will find you\n\nNeed help? Reply *HELP* and our team will assist you within 24 hours.`
          : `Nice to meet you, *${name}*! 🔧\n\nFind genuine spare parts from verified vendors at:\n👉 *www.voomparts.com*\n\nYou can also post a *Part Request* and vendors will contact you directly with prices!\n\nReply *HELP* if you need assistance.`;

      return {
        reply: finalReply,
        isComplete: true,
        leadData: {
          name,
          type,
          interest: state.interest,
        },
      };
    }

    default: {
      // Conversation already complete — handle follow-up messages
      if (msg === "help" || msg.includes("help")) {
        return {
          reply: `Our team will contact you shortly! You can also reach us directly:\n📞 Call/WhatsApp: +233 XX XXX XXXX\n🌐 voomparts.com`,
          isComplete: true,
        };
      }
      return {
        reply: `Thanks for your message! Visit *voomparts.com* for Ghana's best auto parts marketplace. Type *HELP* for assistance.`,
        isComplete: true,
      };
    }
  }
}

// ── Parse incoming webhook payload ────────────────────────────────────────────
export interface IncomingMessage {
  from: string;
  messageId: string;
  type: string;
  text?: string;
  timestamp: string;
  groupId?: string;
  senderName?: string;
}

export function parseWebhookPayload(body: any): IncomingMessage[] {
  const messages: IncomingMessage[] = [];

  try {
    const entries = body?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value;
        if (!value?.messages) continue;

        for (const msg of value.messages) {
          messages.push({
            from: msg.from,
            messageId: msg.id,
            type: msg.type,
            text: msg.type === "text" ? msg.text?.body : undefined,
            timestamp: msg.timestamp,
            groupId: value?.metadata?.group_id,
            senderName:
              value?.contacts?.find((c: any) => c.wa_id === msg.from)?.profile
                ?.name,
          });
        }
      }
    }
  } catch (err) {
    console.error("[WA API] Error parsing webhook payload:", err);
  }

  return messages;
}
