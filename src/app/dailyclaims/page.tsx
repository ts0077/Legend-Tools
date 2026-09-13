"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ANiftyDailyClaimApi from "@/lib/api/Nifty/niftydailyclaim";
// ^ adjust this import path to wherever ANiftyDailyClaimApi actually lives
//   in your project (e.g. "../../api/nifty/ANiftyDailyClaimApi").

// ---------------------------------------------------------------------------
// Config — add one entry per project here when you wire up more claims.
// Each claim only needs a stable id, a display name/description, and the
// async function that performs the claim call.
// ---------------------------------------------------------------------------

type ClaimApiFn = () => Promise<unknown>;

interface ClaimConfig {
  id: string;
  name: string;
  description: string;
  api: ClaimApiFn;
}

const CLAIMS: ClaimConfig[] = [
  {
    id: "nifty-shield-daily",
    name: "NiftyShield",
    description: "Daily claim",
    api: ANiftyDailyClaimApi,
  },
  // {
  //   id: "another-project-daily",
  //   name: "Another Project",
  //   description: "Daily claim",
  //   api: AnotherProjectClaimApi,
  // },
];

// ---------------------------------------------------------------------------
// Timing rules
//
// A claim window is not exactly 24h after the last one — a random amount of
// extra minutes is tacked on each time so the schedule keeps drifting and
// never lands on the same clock time twice in a row.
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MIN_VARIANCE_MINUTES = 5;
const MAX_VARIANCE_MINUTES = 45;

function rollVarianceMinutes(): number {
  return (
    Math.floor(
      Math.random() * (MAX_VARIANCE_MINUTES - MIN_VARIANCE_MINUTES + 1)
    ) + MIN_VARIANCE_MINUTES
  );
}

interface ClaimState {
  lastClaimAt: number | null;
  nextClaimAt: number | null;
  lastVarianceMinutes: number;
  totalVarianceMinutes: number;
  claimCount: number;
}

const EMPTY_STATE: ClaimState = {
  lastClaimAt: null,
  nextClaimAt: null,
  lastVarianceMinutes: 0,
  totalVarianceMinutes: 0,
  claimCount: 0,
};

function storageKey(id: string) {
  return `claim-board:${id}`;
}

function loadState(id: string): ClaimState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...JSON.parse(raw) };
  } catch {
    return EMPTY_STATE;
  }
}

function saveState(id: string, state: ClaimState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(id), JSON.stringify(state));
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

function formatMinutes(totalMinutes: number) {
  if (totalMinutes <= 0) return "0m";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Per-claim card
// ---------------------------------------------------------------------------

function ClaimCard({ config }: { config: ClaimConfig }) {
  const [state, setState] = useState<ClaimState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState(false);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    setState(loadState(config.id));
    setHydrated(true);
  }, [config.id]);

  useEffect(() => {
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  const remainingMs = state.nextClaimAt ? state.nextClaimAt - now : 0;
  const isReady = !state.nextClaimAt || remainingMs <= 0;

  const handleClaim = useCallback(async () => {
    if (!isReady || loading) return;
    setLoading(true);
    setError(null);
    try {
      await config.api();

      const variance = rollVarianceMinutes();
      const claimedAt = Date.now();
      const nextState: ClaimState = {
        lastClaimAt: claimedAt,
        nextClaimAt: claimedAt + ONE_DAY_MS + variance * 60_000,
        lastVarianceMinutes: variance,
        totalVarianceMinutes: state.totalVarianceMinutes + variance,
        claimCount: state.claimCount + 1,
      };
      setState(nextState);
      saveState(config.id, nextState);
      setJustClaimed(true);
      window.setTimeout(() => setJustClaimed(false), 2400);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Claim failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  }, [config, isReady, loading, state.totalVarianceMinutes, state.claimCount]);

  return (
    <div className="border border-[#262F37] bg-[#171E24]">
      <div className="flex items-center justify-between gap-6 px-6 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={
              "mt-0.5 h-2 w-2 shrink-0 rounded-full " +
              (isReady ? "bg-[#E3A23D] animate-pulse" : "bg-[#3A444D]")
            }
          />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-medium text-[#E7ECEF]">
              {config.name}
            </div>
            <div className="truncate text-[13px] text-[#8593A0]">
              {config.description}
            </div>
          </div>
        </div>

        <div className="text-right">
          {!hydrated ? (
            <div className="text-[13px] text-[#8593A0]">—</div>
          ) : isReady ? (
            <div className="text-[13px] font-medium tracking-wide text-[#E3A23D]">
              Ready to claim
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
          {state.claimCount === 0 ? (
            <span>No claims yet</span>
          ) : (
            <span>
              +{state.lastVarianceMinutes}m variance last time · {formatMinutes(state.totalVarianceMinutes)} added across{" "}
              {state.claimCount} {state.claimCount === 1 ? "claim" : "claims"}
            </span>
          )}
        </div>

        <button
          onClick={handleClaim}
          disabled={!hydrated || !isReady || loading}
          className={
            "shrink-0 border px-4 py-2 text-[13px] font-medium transition-colors " +
            (!hydrated || !isReady
              ? "cursor-not-allowed border-[#262F37] text-[#3A444D]"
              : loading
              ? "cursor-wait border-[#E3A23D] text-[#E3A23D]"
              : "border-[#E3A23D] text-[#E3A23D] hover:bg-[#E3A23D] hover:text-[#171E24]")
          }
        >
          {loading ? "Claiming…" : justClaimed ? "Claimed" : "Claim"}
        </button>
      </div>

      {error && (
        <div className="border-t border-[#262F37] px-6 py-3 text-[13px] text-[#D9695F]">
          {error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClaimsPage() {
  const [readyCount, setReadyCount] = useState(0);

  useEffect(() => {
    const compute = () => {
      const count = CLAIMS.reduce((acc, c) => {
        const s = loadState(c.id);
        const ready = !s.nextClaimAt || s.nextClaimAt - Date.now() <= 0;
        return acc + (ready ? 1 : 0);
      }, 0);
      setReadyCount(count);
    };
    compute();
    const id = window.setInterval(compute, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen bg-[#10151A] px-6 py-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-baseline justify-between">
          <h1 className="text-[20px] font-medium text-[#E7ECEF]">Claims</h1>
          <div className="text-[13px] text-[#8593A0]">
            {CLAIMS.length} tracked · {readyCount} ready
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {CLAIMS.map((c) => (
            <ClaimCard key={c.id} config={c} />
          ))}
        </div>

        <p className="mt-8 text-[13px] leading-relaxed text-[#8593A0]">
          Each claim window is 24 hours plus a random {MIN_VARIANCE_MINUTES}–
          {MAX_VARIANCE_MINUTES} minute delay added on every successful
          claim, so the schedule keeps drifting instead of landing on the
          same time each day.
        </p>
      </div>
    </main>
  );
}
