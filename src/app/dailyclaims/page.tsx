"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { baseurl } from "@/lib/api/baseurl";
// ^ adjust this import path to wherever baseurl.ts actually lives relative
//   to this page (e.g. "../../lib/api/baseurl").

// ---------------------------------------------------------------------------
// Data shape — matches GET /api/AutoClaim/status
// ---------------------------------------------------------------------------

interface AutoClaimStatus {
  id: number;
  projectName: string;
  nextClaimAt: string | null;
  lastClaimAt: string | null;
  lastStreak: number | null;
  lastReward: number | null;
  lastStatus: "Success" | "Failed" | null;
  lastError: string | null;
}

const POLL_MS = 15_000;

function apiUrl(path: string) {
  const trimmedBase = baseurl?.endsWith("/") ? baseurl.slice(0, -1) : baseurl;
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatTimestamp(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isAlreadyClaimedError(error: string | null) {
  return !!error && error.toLowerCase().includes("already claimed");
}

function isLikelyAuthError(status: string | null, error: string | null) {
  if (status !== "Failed" || !error) return false;
  if (isAlreadyClaimedError(error)) return false;
  return (
    error.includes("401") ||
    error.includes("403") ||
    error.toLowerCase().includes("unauthorized") ||
    error.toLowerCase().includes("cookie")
  );
}

// ---------------------------------------------------------------------------
// Status card
// ---------------------------------------------------------------------------

function UpdateCookieForm({
  accountId,
  onUpdated,
  onCancel,
}: {
  accountId: number;
  onUpdated: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!value.trim() || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(apiUrl("/api/AutoClaim/updateCookie"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: accountId, cookie: value.trim() }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setValue("");
        onUpdated();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save cookie");
      } finally {
        setSubmitting(false);
      }
    },
    [accountId, value, submitting, onUpdated]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-[#262F37] px-6 py-4"
    >
      <label className="mb-2 block text-[13px] text-[#8593A0]">
        Paste the full Cookie header value from DevTools (Network tab →
        request → Headers → Request Headers → Cookie).
      </label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="_ga=...; nifty_discord_access=...; nifty_discord_refresh=..."
        className="w-full resize-none border border-[#262F37] bg-[#10151A] px-3 py-2 text-[13px] text-[#E7ECEF] placeholder:text-[#3A444D] focus:border-[#E3A23D] focus:outline-none"
      />
      {error && (
        <div className="mt-2 text-[13px] text-[#D9695F]">{error}</div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={!value.trim() || submitting}
          className={
            "border px-4 py-2 text-[13px] font-medium transition-colors " +
            (!value.trim() || submitting
              ? "cursor-not-allowed border-[#262F37] text-[#3A444D]"
              : "border-[#E3A23D] text-[#E3A23D] hover:bg-[#E3A23D] hover:text-[#171E24]")
          }
        >
          {submitting ? "Saving…" : "Save cookie"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[13px] text-[#8593A0] hover:text-[#E7ECEF]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function StatusCard({
  account,
  now,
  onUpdated,
}: {
  account: AutoClaimStatus;
  now: number;
  onUpdated: () => void;
}) {
  const nextClaimMs = account.nextClaimAt
    ? new Date(
        account.nextClaimAt.endsWith("Z") ? account.nextClaimAt : account.nextClaimAt + "Z"
      ).getTime()
    : null;

  const remainingMs = nextClaimMs ? nextClaimMs - now : 0;
  const isReady = !nextClaimMs || remainingMs <= 0;
  const needsAttention = isLikelyAuthError(account.lastStatus, account.lastError);
  const [showForm, setShowForm] = useState(needsAttention);

  return (
    <div className="border border-[#262F37] bg-[#171E24]">
      <div className="flex items-center justify-between gap-6 px-6 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={
              "mt-0.5 h-2 w-2 shrink-0 rounded-full " +
              (needsAttention
                ? "bg-[#D9695F]"
                : isReady
                ? "bg-[#E3A23D] animate-pulse"
                : "bg-[#3A444D]")
            }
          />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-medium text-[#E7ECEF]">
              {account.projectName}
            </div>
            <div className="truncate text-[13px] text-[#8593A0]">
              Auto-claim · daily
            </div>
          </div>
        </div>

        <div className="text-right">
          {needsAttention ? (
            <div className="text-[13px] font-medium text-[#D9695F]">
              Needs attention
            </div>
          ) : isReady ? (
            <div className="text-[13px] font-medium tracking-wide text-[#E3A23D]">
              Claiming shortly
            </div>
          ) : (
            <div className="text-[22px] font-medium leading-none text-[#E7ECEF] [font-variant-numeric:tabular-nums]">
              {formatCountdown(remainingMs)}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-6 border-t border-[#262F37] px-6 py-4">
        <div className="text-[13px] text-[#8593A0]">
          {account.lastStreak != null && (
            <span>Streak {account.lastStreak} · </span>
          )}
          {account.lastReward != null && (
            <span>+{account.lastReward} last reward · </span>
          )}
          <span>Last claimed {formatTimestamp(account.lastClaimAt)}</span>
        </div>
      </div>

      {needsAttention && account.lastError && !showForm && (
        <div className="border-t border-[#262F37] px-6 py-3 text-[13px] text-[#D9695F]">
          Session may have expired — refresh the stored cookie for this
          account. ({account.lastError})
        </div>
      )}

      {showForm ? (
        <UpdateCookieForm
          accountId={account.id}
          onUpdated={() => {
            setShowForm(false);
            onUpdated();
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <div className="border-t border-[#262F37] px-6 py-3">
          <button
            onClick={() => setShowForm(true)}
            className="text-[13px] text-[#8593A0] hover:text-[#E7ECEF]"
          >
            Update cookie
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AutoClaimStatusPage() {
  const [accounts, setAccounts] = useState<AutoClaimStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/AutoClaim/status"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AutoClaimStatus[] = await res.json();
      setAccounts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    pollRef.current = window.setInterval(fetchStatus, POLL_MS);
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [fetchStatus]);

  const readyCount = (accounts ?? []).filter((a) => {
    if (!a.nextClaimAt) return true;
    const ms =
      new Date(a.nextClaimAt.endsWith("Z") ? a.nextClaimAt : a.nextClaimAt + "Z").getTime() -
      now;
    return ms <= 0;
  }).length;

  return (
    <main className="min-h-screen bg-[#10151A] px-6 py-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-baseline justify-between">
          <h1 className="text-[20px] font-medium text-[#E7ECEF]">
            Auto-claims
          </h1>
          <div className="text-[13px] text-[#8593A0]">
            {accounts ? `${accounts.length} tracked · ${readyCount} claiming soon` : "—"}
          </div>
        </div>

        {error && (
          <div className="mb-4 border border-[#262F37] bg-[#171E24] px-6 py-4 text-[13px] text-[#D9695F]">
            Couldn't reach the status endpoint. ({error})
          </div>
        )}

        {!accounts && !error && (
          <div className="border border-[#262F37] bg-[#171E24] px-6 py-8 text-center text-[13px] text-[#8593A0]">
            Loading…
          </div>
        )}

        {accounts && accounts.length === 0 && (
          <div className="border border-[#262F37] bg-[#171E24] px-6 py-8 text-center text-[13px] text-[#8593A0]">
            No accounts being tracked yet.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {accounts?.map((a) => (
            <StatusCard key={a.id} account={a} now={now} onUpdated={fetchStatus} />
          ))}
        </div>

        <p className="mt-8 text-[13px] leading-relaxed text-[#8593A0]">
          Claims run automatically on the server on each project's real
          schedule — this page is read-only and just reflects what already
          happened or is coming up next.
        </p>
      </div>
    </main>
  );
}
