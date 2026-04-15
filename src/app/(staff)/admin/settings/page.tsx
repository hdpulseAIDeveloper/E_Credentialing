import { api } from "@/trpc/server";
import { SettingsForm } from "@/components/admin/SettingsForm";

const DEFAULT_SETTINGS = [
  { key: "expirable.warning_days_90", value: "90", description: "Days before expiration to show in 90-day warning band", category: "expirables" },
  { key: "expirable.warning_days_60", value: "60", description: "Days before expiration to show in 60-day warning band", category: "expirables" },
  { key: "expirable.warning_days_30", value: "30", description: "Days before expiration to show in 30-day warning band", category: "expirables" },
  { key: "expirable.warning_days_7", value: "7", description: "Days before expiration to show in critical warning band", category: "expirables" },
  { key: "expirable.auto_outreach_enabled", value: "true", description: "Automatically send renewal outreach emails", category: "expirables" },
  { key: "enrollment.follow_up_cadence_days", value: "14", description: "Default days between enrollment follow-ups", category: "enrollments" },
  { key: "enrollment.overdue_threshold_days", value: "30", description: "Days after which a follow-up is considered overdue", category: "enrollments" },
  { key: "onboarding.invite_expiry_hours", value: "72", description: "Hours before provider invite link expires", category: "onboarding" },
  { key: "onboarding.max_invite_resends", value: "3", description: "Maximum number of invite resends per provider", category: "onboarding" },
  { key: "committee.min_providers_per_session", value: "1", description: "Minimum providers needed to hold a committee session", category: "committee" },
  { key: "committee.auto_agenda_generation", value: "true", description: "Automatically generate agenda PDF before sessions", category: "committee" },
  { key: "bot.max_concurrent_runs", value: "3", description: "Maximum concurrent bot runs (PSV workers)", category: "bots" },
  { key: "bot.retry_attempts", value: "3", description: "Number of retry attempts for failed bot runs", category: "bots" },
  { key: "bot.headed_mode", value: "false", description: "Run bots in headed (visible browser) mode for debugging", category: "bots" },
  { key: "notifications.email_from", value: "cred_onboarding@essenmed.com", description: "Default sender email address for notifications", category: "notifications" },
  { key: "notifications.sms_enabled", value: "false", description: "Enable SMS notifications to providers", category: "notifications" },
  { key: "app.session_timeout_minutes", value: "60", description: "Staff session inactivity timeout in minutes", category: "general" },
  { key: "app.maintenance_mode", value: "false", description: "Put the application in maintenance mode", category: "general" },
];

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  expirables: "Expirables & Renewals",
  enrollments: "Enrollments",
  onboarding: "Provider Onboarding",
  committee: "Committee",
  bots: "Credentialing Bots (PSV)",
  notifications: "Notifications",
};

const CATEGORY_ORDER = ["general", "expirables", "enrollments", "onboarding", "committee", "bots", "notifications"];

/** Row shape from `admin.listSettings` (explicit for stable typing when Prisma client is stale). */
type ListedAppSetting = { id: string; key: string; value: string; description: string | null; category: string };

export default async function AdminSettingsPage() {
  const settings = (await api.admin.listSettings()) as ListedAppSetting[];

  const settingsMap = new Map<string, ListedAppSetting>(settings.map((s) => [s.key, s]));
  const merged = DEFAULT_SETTINGS.map((d) => ({
    ...d,
    value: settingsMap.get(d.key)?.value ?? d.value,
    id: settingsMap.get(d.key)?.id ?? null,
    saved: settingsMap.has(d.key),
  }));

  const grouped = CATEGORY_ORDER.reduce<Record<string, typeof merged>>((acc, cat) => {
    const items = merged.filter((s) => s.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Application Settings</h1>
        <p className="text-gray-500 mt-1">
          Configure system-wide preferences for credentialing workflows
        </p>
      </div>

      <SettingsForm grouped={grouped} categoryLabels={CATEGORY_LABELS} />
    </div>
  );
}
