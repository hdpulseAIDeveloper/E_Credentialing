"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

interface Setting {
  key: string;
  value: string;
  description: string;
  category: string;
  id: string | null;
  saved: boolean;
}

interface SettingsFormProps {
  grouped: Record<string, Setting[]>;
  categoryLabels: Record<string, string>;
}

export function SettingsForm({ grouped, categoryLabels }: SettingsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const items of Object.values(grouped)) {
      for (const s of items) init[s.key] = s.value;
    }
    return init;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const upsertSetting = api.admin.upsertSetting.useMutation({
    onSuccess: (_, variables) => {
      setSaving(null);
      setSavedKeys((prev) => new Set(prev).add(variables.key));
      setTimeout(() => setSavedKeys((prev) => { const n = new Set(prev); n.delete(variables.key); return n; }), 2000);
      router.refresh();
    },
    onError: () => setSaving(null),
  });

  const handleSave = (setting: Setting) => {
    setSaving(setting.key);
    upsertSetting.mutate({
      key: setting.key,
      value: values[setting.key] ?? setting.value,
      description: setting.description,
      category: setting.category,
    });
  };

  const isBool = (v: string) => v === "true" || v === "false";

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, settings]) => (
        <div key={category} className="bg-white rounded-lg border overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              {categoryLabels[category] ?? category}
            </h2>
          </div>
          <div className="divide-y">
            {settings.map((setting) => {
              const currentValue = values[setting.key] ?? setting.value;
              const hasChanged = currentValue !== setting.value;
              const justSaved = savedKeys.has(setting.key);

              return (
                <div key={setting.key} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 font-mono">
                      {setting.key}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {setting.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {isBool(setting.value) ? (
                      <button
                        type="button"
                        onClick={() => {
                          const newVal = currentValue === "true" ? "false" : "true";
                          setValues((p) => ({ ...p, [setting.key]: newVal }));
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          currentValue === "true" ? "bg-blue-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            currentValue === "true" ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    ) : (
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => setValues((p) => ({ ...p, [setting.key]: e.target.value }))}
                        className="w-32 border border-gray-300 rounded-md px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    <button
                      onClick={() => handleSave(setting)}
                      disabled={saving === setting.key || (!hasChanged && setting.saved)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        justSaved
                          ? "bg-green-100 text-green-700"
                          : hasChanged
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {saving === setting.key ? "Saving…" : justSaved ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
