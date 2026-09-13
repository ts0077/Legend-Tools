'use client'
import { useState, useEffect, useCallback, useMemo } from "react"
import axios from "axios"
import { baseurl } from "@/lib/api/baseurl"

interface PendingRaffle {
  id: number
  slug: string
  name: string
  projectId: string
  projectName: string | null
  teamId: string | null
  serverName: string | null
  endDate: number
  createdAt: string
}

interface ResultRaffle {
  slug: string
  raffleName: string | null
  projectId: string | null
  projectName: string | null
  teamId: string | null
  serverName: string | null
  success: boolean
  enteries: number
  reason: string | null
  error: string | null
  enteredTime: string
}

type StatusTab = "all" | "pending" | "successful" | "failed"
type GroupMode = "project" | "server"

const LAST_SEEN_KEY = "alphabot_last_seen_at"

export default function AlphabotDashboard() {
  const [pending, setPending] = useState<PendingRaffle[]>([])
  const [successful, setSuccessful] = useState<ResultRaffle[]>([])
  const [failed, setFailed] = useState<ResultRaffle[]>([])
  const [groupMode, setGroupMode] = useState<GroupMode>("project")
  const [activeGroup, setActiveGroup] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<StatusTab>("all")
  const [loading, setLoading] = useState(true)
  const [reenteringSlug, setReenteringSlug] = useState<string | null>(null)
  const [lastSeenAt, setLastSeenAt] = useState<number>(0)

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(LAST_SEEN_KEY) : null
    setLastSeenAt(stored ? parseInt(stored, 10) : Date.now())
  }, [])

  const fetchAll = useCallback(async () => {
    try {
      const [p, s, f] = await Promise.all([
        axios.get(`${baseurl}/api/Raffles/queue/pending`),
        axios.get(`${baseurl}/api/Raffles/results/successful`),
        axios.get(`${baseurl}/api/Raffles/results/failed`),
      ])
      setPending(p.data)
      setSuccessful(s.data)
      setFailed(f.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 12000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const handleReenter = async (r: { slug: string; raffleName?: string | null; name?: string; projectId: string | null; projectName: string | null; teamId: string | null; serverName: string | null }) => {
    setReenteringSlug(r.slug)
    try {
      await axios.post(`${baseurl}/api/Raffles/reenter/${r.slug}`, null, {
        params: {
          name: r.raffleName ?? r.name ?? "",
          projectId: r.projectId ?? "",
          projectName: r.projectName ?? "",
          teamId: r.teamId ?? "",
          serverName: r.serverName ?? "",
        },
      })
      await fetchAll()
    } finally {
      setReenteringSlug(null)
    }
  }

  const markAllRead = () => {
    const now = Date.now()
    localStorage.setItem(LAST_SEEN_KEY, String(now))
    setLastSeenAt(now)
  }

  const shortId = (id: string) => (id && id.length > 10 ? `${id.slice(0, 8)}…` : id)

  const groupKey = (r: { projectId: string | null; teamId?: string | null }) =>
    groupMode === "project" ? (r.projectId ?? "unknown") : ((r as any).teamId ?? "unknown")

  const groupLabel = (key: string): string => {
    if (key === "unknown") return "unknown"
    const all = [...pending, ...successful, ...failed]
    if (groupMode === "project") {
      const match = all.find((r) => r.projectId === key && r.projectName)
      return match?.projectName || shortId(key)
    } else {
      const match = all.find((r) => r.teamId === key && r.serverName)
      return match?.serverName || shortId(key)
    }
  }

  const groupIds = useMemo(() => {
    const keyOf = (r: { projectId: string | null; teamId?: string | null }) => groupKey(r)
    return Array.from(new Set([...pending, ...successful, ...failed].map(keyOf))).filter(Boolean)
  }, [pending, successful, failed, groupMode])

  const inGroup = <T extends { projectId: string | null; teamId?: string | null }>(list: T[]) =>
    activeGroup === "all" ? list : list.filter((r) => groupKey(r) === activeGroup)

  const gPending = inGroup(pending).slice().sort((a, b) => a.endDate - b.endDate)
  const gSuccessful = inGroup(successful)
  const gFailed = inGroup(failed)

  const totalEntered = successful.reduce((sum, r) => sum + (r.enteries || 0), 0)

  const timeLeft = (endDate: number) => {
    const diff = endDate - Date.now()
    if (diff <= 0) return "ended"
    const mins = Math.floor(diff / 60000)
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const isNew = (ts: string | number) => new Date(ts).getTime() > lastSeenAt

  const newCountFor = (key: string) => {
    const scoped = key === "all"
      ? { p: pending, s: successful, f: failed }
      : { p: pending.filter(r => groupKey(r) === key), s: successful.filter(r => groupKey(r) === key), f: failed.filter(r => groupKey(r) === key) }
    return (
      scoped.p.filter(r => isNew(r.createdAt)).length +
      scoped.s.filter(r => isNew(r.enteredTime)).length +
      scoped.f.filter(r => isNew(r.enteredTime)).length
    )
  }

  const groupCount = (key: string) =>
    key === "all"
      ? pending.length + successful.length + failed.length
      : pending.filter((r) => groupKey(r) === key).length +
        successful.filter((r) => groupKey(r) === key).length +
        failed.filter((r) => groupKey(r) === key).length

  const totalNew = newCountFor("all")

  type MergedRow = {
    key: string
    title: string
    slug: string
    status: "pending" | "entered" | "failed"
    groupLabel: string
    timestamp: number
    entries?: number
    reason?: string | null
    raw: any
  }

  const mergedAll: MergedRow[] = useMemo(() => {
    const rows: MergedRow[] = []
    gPending.forEach((r) => rows.push({
      key: `p-${r.id}`, title: r.name, slug: r.slug, status: "pending",
      groupLabel: groupMode === "project" ? (r.projectName || shortId(r.projectId)) : (r.serverName || shortId(r.teamId ?? "")),
      timestamp: new Date(r.createdAt).getTime(), raw: r,
    }))
    gSuccessful.forEach((r, i) => rows.push({
      key: `s-${r.slug}-${i}`, title: r.raffleName ?? r.slug, slug: r.slug, status: "entered",
      groupLabel: groupMode === "project" ? (r.projectName || shortId(r.projectId ?? "")) : (r.serverName || shortId(r.teamId ?? "")),
      timestamp: new Date(r.enteredTime).getTime(), entries: r.enteries, raw: r,
    }))
    gFailed.forEach((r, i) => rows.push({
      key: `f-${r.slug}-${i}`, title: r.raffleName ?? r.slug, slug: r.slug, status: "failed",
      groupLabel: groupMode === "project" ? (r.projectName || shortId(r.projectId ?? "")) : (r.serverName || shortId(r.teamId ?? "")),
      timestamp: new Date(r.enteredTime).getTime(), reason: r.reason || r.error, raw: r,
    }))
    return rows.sort((a, b) => b.timestamp - a.timestamp)
  }, [gPending, gSuccessful, gFailed, groupMode])

  const statusBar = { pending: "bg-amber-400", entered: "bg-emerald-400", failed: "bg-rose-400" }
  const statusText = { pending: "text-amber-400", entered: "text-emerald-400", failed: "text-rose-400" }
  const statusLabel = { pending: "pending", entered: "entered", failed: "failed" }

  return (
    <div className="min-h-screen bg-[#0E0F13] text-[#E7E8ED] font-sans">
      <div className="border-b border-[#242730] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Alphabot Monitor</h1>
          <span className="flex items-center gap-1.5 text-xs text-[#8A8E9C]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            live
          </span>
          {totalNew > 0 && (
            <span className="text-xs bg-[#7C6CF0] text-white px-1.5 py-0.5 rounded-full font-mono">{totalNew} new</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-wrap gap-x-4 divide-x divide-[#242730] text-sm">
            <Stat label="pending" value={pending.length} />
            <Stat label="entered" value={successful.length} />
            <Stat label="failed" value={failed.length} />
            <Stat label="total entries" value={totalEntered} />
          </div>
          <button
            onClick={markAllRead}
            className="text-xs border border-[#242730] px-2.5 py-1.5 text-[#8A8E9C] hover:text-[#E7E8ED] hover:border-[#3a3d47] transition-colors shrink-0"
          >
            mark all as read
          </button>
        </div>
      </div>

      <div className="flex gap-1 px-6 pt-3 border-b border-[#242730]">
        {(["project", "server"] as GroupMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setGroupMode(m); setActiveGroup("all") }}
            className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
              groupMode === m ? "bg-[#15171E] text-[#E7E8ED]" : "text-[#8A8E9C] hover:text-[#E7E8ED]"
            }`}
          >
            {m === "project" ? "By project" : "By alpha server"}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-[#242730] overflow-x-auto md:overflow-x-visible md:h-[calc(100vh-113px)] md:overflow-y-auto flex md:block">
          <button
            onClick={() => setActiveGroup("all")}
            className={`shrink-0 text-left px-4 py-2.5 text-sm border-b-2 md:border-b-0 md:border-l-2 transition-colors whitespace-nowrap ${
              activeGroup === "all" ? "border-[#7C6CF0] bg-[#15171E] text-[#E7E8ED]" : "border-transparent text-[#8A8E9C] hover:text-[#E7E8ED]"
            }`}
          >
            all {groupMode === "project" ? "projects" : "servers"}
            <span className="font-mono text-xs opacity-60 ml-2">{groupCount("all")}</span>
          </button>
          {groupIds.map((key) => {
            const n = newCountFor(key)
            return (
              <button
                key={key}
                onClick={() => setActiveGroup(key)}
                className={`shrink-0 text-left px-4 py-2.5 text-sm border-b-2 md:border-b-0 md:border-l-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                  activeGroup === key ? "border-[#7C6CF0] bg-[#15171E] text-[#E7E8ED]" : "border-transparent text-[#8A8E9C] hover:text-[#E7E8ED]"
                }`}
              >
                {groupLabel(key)}
                <span className="font-mono text-xs opacity-60">{groupCount(key)}</span>
                {n > 0 && <span className="text-[10px] bg-[#7C6CF0] text-white px-1 rounded-full font-mono">{n}</span>}
              </button>
            )
          })}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex gap-6 px-6 pt-4 border-b border-[#242730]">
            {(["all", "pending", "successful", "failed"] as StatusTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm capitalize border-b-2 transition-colors ${
                  activeTab === tab ? "border-[#7C6CF0] text-[#E7E8ED]" : "border-transparent text-[#8A8E9C] hover:text-[#E7E8ED]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="px-6 py-10 text-sm text-[#8A8E9C]">loading…</p>
          ) : activeTab === "all" ? (
            mergedAll.length === 0 ? (
              <p className="px-6 py-10 text-sm text-[#8A8E9C]">nothing here right now</p>
            ) : (
              <div className="divide-y divide-[#242730]">
                {mergedAll.map((row) => (
                  <div key={row.key} className="flex items-stretch">
                    <div className={`w-1 ${statusBar[row.status]}`} />
                    <div className="flex-1 px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex items-center gap-2">
                        {isNew(row.timestamp) && <span className="w-1.5 h-1.5 rounded-full bg-[#7C6CF0] shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm truncate">{row.title}</p>
                          <p className="text-xs text-[#8A8E9C] font-mono mt-0.5">
                            {row.groupLabel} · {row.slug} · {new Date(row.timestamp).toLocaleString()}
                          </p>
                          {row.reason && <p className="text-xs text-rose-400 mt-1 whitespace-pre-line">{row.reason}</p>}
                        </div>
                      </div>
                      <span className={`text-xs font-mono shrink-0 ${statusText[row.status]}`}>
                        {statusLabel[row.status]}{row.entries != null ? ` · ${row.entries} entries` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "pending" ? (
            gPending.length === 0 ? (
              <p className="px-6 py-10 text-sm text-[#8A8E9C]">no pending raffles</p>
            ) : (
              <div className="divide-y divide-[#242730]">
                {gPending.map((r) => (
                  <div key={r.id} className="flex items-stretch">
                    <div className={`w-1 ${statusBar.pending}`} />
                    <div className="flex-1 px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex items-center gap-2">
                        {isNew(r.createdAt) && <span className="w-1.5 h-1.5 rounded-full bg-[#7C6CF0] shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm truncate">{r.name}</p>
                          <p className="text-xs text-[#8A8E9C] font-mono mt-0.5">
                            {groupMode === "project" ? (r.projectName || shortId(r.projectId)) : (r.serverName || shortId(r.teamId ?? ""))} · {r.slug}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-amber-400 shrink-0">{timeLeft(r.endDate)} left</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "successful" ? (
            gSuccessful.length === 0 ? (
              <p className="px-6 py-10 text-sm text-[#8A8E9C]">no successful entries yet</p>
            ) : (
              <div className="divide-y divide-[#242730]">
                {gSuccessful.map((r, i) => (
                  <div key={`${r.slug}-${i}`} className="flex items-stretch">
                    <div className={`w-1 ${statusBar.entered}`} />
                    <div className="flex-1 px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex items-center gap-2">
                        {isNew(r.enteredTime) && <span className="w-1.5 h-1.5 rounded-full bg-[#7C6CF0] shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm truncate">{r.raffleName ?? r.slug}</p>
                          <p className="text-xs text-[#8A8E9C] font-mono mt-0.5">
                            {groupMode === "project" ? (r.projectName || shortId(r.projectId ?? "")) : (r.serverName || shortId(r.teamId ?? ""))} · {new Date(r.enteredTime).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-xs font-mono text-emerald-400">{r.enteries} entries</span>
                        <button
                          onClick={() => handleReenter(r)}
                          disabled={reenteringSlug === r.slug}
                          className="text-xs text-[#8A8E9C] hover:text-[#E7E8ED] transition-colors disabled:opacity-40"
                        >
                          {reenteringSlug === r.slug ? "…" : "re-enter"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            gFailed.length === 0 ? (
              <p className="px-6 py-10 text-sm text-[#8A8E9C]">no failed entries</p>
            ) : (
              <div className="divide-y divide-[#242730]">
                {gFailed.map((r, i) => (
                  <div key={`${r.slug}-${i}`} className="flex items-stretch">
                    <div className={`w-1 ${statusBar.failed}`} />
                    <div className="flex-1 px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex items-center gap-2">
                        {isNew(r.enteredTime) && <span className="w-1.5 h-1.5 rounded-full bg-[#7C6CF0] shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm truncate">{r.raffleName ?? r.slug}</p>
                          <p className="text-xs text-[#8A8E9C] font-mono mt-0.5">
                            {groupMode === "project" ? (r.projectName || shortId(r.projectId ?? "")) : (r.serverName || shortId(r.teamId ?? ""))} · {new Date(r.enteredTime).toLocaleString()}
                          </p>
                          {(r.reason || r.error) && <p className="text-xs text-rose-400 mt-1 whitespace-pre-line">{r.reason || r.error}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleReenter(r)}
                        disabled={reenteringSlug === r.slug}
                        className="text-xs text-[#8A8E9C] hover:text-[#E7E8ED] transition-colors disabled:opacity-40 shrink-0"
                      >
                        {reenteringSlug === r.slug ? "…" : "re-enter"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <p className="text-lg font-semibold leading-none">{value}</p>
      <p className="text-xs text-[#8A8E9C] mt-1">{label}</p>
    </div>
  )
}