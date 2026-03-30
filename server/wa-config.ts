/**
 * VOOM — WhatsApp API config loader/saver
 * Priority: environment variables → wa-keys.json file → empty strings
 * Writes to server/wa-keys.json so keys survive server restarts.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "wa-keys.json");

export interface WaKeys {
  phoneNumberId: string;
  accessToken: string;
  webhookToken: string;
  businessAccountId: string;
}

function readFile(): Partial<WaKeys> {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

export function loadWaConfig(): WaKeys {
  const file = readFile();
  return {
    phoneNumberId:     process.env.WA_PHONE_NUMBER_ID     || file.phoneNumberId     || "",
    accessToken:       process.env.WA_ACCESS_TOKEN        || file.accessToken       || "",
    webhookToken:      process.env.WA_WEBHOOK_TOKEN       || file.webhookToken      || "voom_webhook_secret",
    businessAccountId: process.env.WA_BUSINESS_ACCOUNT_ID || file.businessAccountId || "",
  };
}

export function saveWaConfig(keys: WaKeys): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(keys, null, 2), "utf-8");
  // Also update process.env so the running server picks them up immediately
  if (keys.phoneNumberId)     process.env.WA_PHONE_NUMBER_ID     = keys.phoneNumberId;
  if (keys.accessToken)       process.env.WA_ACCESS_TOKEN        = keys.accessToken;
  if (keys.webhookToken)      process.env.WA_WEBHOOK_TOKEN       = keys.webhookToken;
  if (keys.businessAccountId) process.env.WA_BUSINESS_ACCOUNT_ID = keys.businessAccountId;
}
