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
  resultMd: string | null
  enteredTime: string
}

interface FullRaffle {
  slug: string
  name: string
  endDate: number
  status: "entered" | "failed" | "queued" | "not_attempted"
  reason: string | null
  entries: number
}

type StatusTab = "all" | "pending" | "successful" | "failed"
type GroupMode = "project" | "server" | "community"

const SEEN_KEY = "alphabot_seen_map_v2"
const ORDER_KEY_PREFIX = "alphabot_order_"

function loadSeenMap(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  const initial = { global: Date.now() }
  localStorage.setItem(SEEN_KEY, JSON.stringify(initial))
  return initial
}

function loadOrder(mode: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(ORDER_KEY_PREFIX + mode)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function formatDuration(ms: number) {
  if (ms <= 0) return "ended"
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatSeconds(sec: number) {
  if (sec < 60) return `~${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `~${m}m ${s}s`
}

export default function AlphabotDashboard() {
  const [pending, setPending] = useState<PendingRaffle[]>([])
  const [successful, setSuccessful] = useState<ResultRaffle[]>([])
  const [failed, setFailed] = useState<ResultRaffle[]>([])
  const [groupMode, setGroupMode] = useState<GroupMode>("project")
  const [activeGroup, setActiveGroup] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<StatusTab>("all")
  const [loading, setLoading] = useState(true)
  const [reenteringSlug, setReenteringSlug] = useState<string | null>(null)
  const [seenMap, setSeenMap] = useState<Record<string, number>>({})
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [sidebarSearch, setSidebarSearch] = useState("")
  const [fullList, setFullList] = useState<FullRaffle[] | null>(null)
  const [fullListLoading, setFullListLoading] = useState(false)
  const [fullListError, setFullListError] = useState<string | null>(null)
  const [queueingSlug, setQueueingSlug] = useState<string | null>(null)
  const [projectOrder, setProjectOrder] = useState<string[]>([])
  const [serverOrder, setServerOrder] = useState<string[]>([])
  const [draggedKey, setDraggedKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  useEffect(() => {
    setSeenMap(loadSeenMap())
    setProjectOrder(loadOrder("project"))
    setServerOrder(loadOrder("server"))
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

  useEffect(() => {
    const fetchEta = async () => {
      try {
        const res = await axios.get(`${baseurl}/api/Raffles/queue/eta`)
        setEtaSeconds(res.data.secondsRemaining)
      } catch {}
    }
    fetchEta()
    const interval = setInterval(fetchEta, 3000)
    return () => clearInterval(interval)
  }, [])

  const fetchFullList = async () => {
    setFullListLoading(true)
    setFullListError(null)
    try {
      const res = await axios.get(`${baseurl}/api/Raffles/queue/full`)
      setFullList(res.data)
    } catch (err: any) {
      console.error(err)
      setFullListError(err?.response?.data?.Message || err?.message || "Failed to fetch")
    } finally {
      setFullListLoading(false)
    }
  }

  const handleReenter = async (r: { slug: string; raffleName?: string | null; name?: string; projectId: string | null; projectName: string | null; teamId?: string | null; serverName?: string | null }) => {
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

  const handleAddToQueue = async (r: FullRaffle) => {
    setQueueingSlug(r.slug)
    try {
      await axios.post(`${baseurl}/api/Raffles/queue/add/${r.slug}`, null, { params: { name: r.name, endDate: r.endDate } })
      await fetchAll()
      await fetchFullList()
    } finally {
      setQueueingSlug(null)
    }
  }

  const persistSeenMap = (map: Record<string, number>) => {
    localStorage.setItem(SEEN_KEY, JSON.stringify(map))
    setSeenMap(map)
  }
  const markGroupRead = (key: string) => persistSeenMap({ ...seenMap, [`${groupMode}:${key}`]: Date.now() })
  const markAllRead = () => persistSeenMap({ global: Date.now() })
  const isNew = (ts: string | number, key: string) => {
    const threshold = seenMap[`${groupMode}:${key}`] ?? seenMap.global ?? 0
    return new Date(ts).getTime() > threshold
  }

  const shortId = (id: string) => (id && id.length > 10 ? `${id.slice(0, 8)}…` : id)
  const groupKey = (r: { projectId: string | null; teamId?: string | null }) =>
    groupMode === "server" ? ((r as any).teamId ?? "unknown") : (r.projectId ?? "unknown")

  const groupLabel = (key: string): string => {
    if (key === "unknown") return "unknown"
    const all = [...pending, ...successful, ...failed]
    if (groupMode === "server") {
      const match = all.find((r) => r.teamId === key && r.serverName)
      return match?.serverName || shortId(key)
    }
    const match = all.find((r) => r.projectId === key && r.projectName)
    return match?.projectName || shortId(key)
  }

  const currentOrder = groupMode === "server" ? serverOrder : projectOrder
  const setCurrentOrder = groupMode === "server" ? setServerOrder : setProjectOrder
  const orderKey = groupMode === "server" ? "server" : "project"

  const persistOrder = (order: string[]) => {
    localStorage.setItem(ORDER_KEY_PREFIX + orderKey, JSON.stringify(order))
    setCurrentOrder(order)
  }

  const groupIds = useMemo(() => {
    const rawIds = Array.from(new Set([...pending, ...successful, ...failed].map(groupKey))).filter(Boolean)
    const ordered = currentOrder.filter((id) => rawIds.includes(id))
    const unordered = rawIds.filter((id) => !currentOrder.includes(id))
    return [...ordered, ...unordered]
  }, [pending, successful, failed, groupMode, currentOrder])

  useEffect(() => {
    const missing = groupIds.filter((id) => !currentOrder.includes(id))
    if (missing.length > 0) {
      persistOrder([...currentOrder, ...missing])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIds.join(",")])

  const moveGroup = (key: string, direction: -1 | 1) => {
    const idx = currentOrder.indexOf(key)
    if (idx === -1) return
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= currentOrder.length) return
    const next = [...currentOrder]
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    persistOrder(next)
  }

  const reorderTo = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    const withoutDragged = currentOrder.filter((id) => id !== draggedId)
    const targetIdx = withoutDragged.indexOf(targetId)
    if (targetIdx === -1) return
    const next = [...withoutDragged.slice(0, targetIdx), draggedId, ...withoutDragged.slice(targetIdx)]
    persistOrder(next)
  }

  const handleDragStart = (key: string) => (e: React.DragEvent) => {
    setDraggedKey(key)
    e.dataTransfer.effectAllowed = "move"
  }
  const handleDragOver = (key: string) => (e: React.DragEvent) => {
    e.preventDefault()
    if (key !== dragOverKey) setDragOverKey(key)
  }
  const handleDrop = (key: string) => (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedKey) reorderTo(draggedKey, key)
    setDraggedKey(null)
    setDragOverKey(null)
  }
  const handleDragEnd = () => {
    setDraggedKey(null)
    setDragOverKey(null)
  }

  const visibleGroupIds = groupIds.filter((key) =>
    !sidebarSearch.trim() || groupLabel(key).toLowerCase().includes(sidebarSearch.toLowerCase())
  )

  const inGroup = <T extends { projectId: string | null; teamId?: string | null }>(list: T[]) =>
    activeGroup === "all" ? list : list.filter((r) => groupKey(r) === activeGroup)

  const matchesSearch = (title: string, slug: string) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return title.toLowerCase().includes(q) || slug.toLowerCase().includes(q)
  }

  const gPending = inGroup(pending).filter((r) => matchesSearch(r.name, r.slug)).slice().sort((a, b) => a.endDate - b.endDate)
  const gSuccessful = inGroup(successful).filter((r) => matchesSearch(r.raffleName ?? r.slug, r.slug))
  const gFailed = inGroup(failed).filter((r) => matchesSearch(r.raffleName ?? r.slug, r.slug))

  const newCountFor = (key: string) => {
    const scoped = key === "all"
      ? { p: pending, s: successful, f: failed }
      : { p: pending.filter(r => groupKey(r) === key), s: successful.filter(r => groupKey(r) === key), f: failed.filter(r => groupKey(r) === key) }
    return scoped.p.filter(r => isNew(r.createdAt, key)).length + scoped.s.filter(r => isNew(r.enteredTime, key)).length + scoped.f.filter(r => isNew(r.enteredTime, key)).length
  }
  const groupCount = (key: string) =>
    key === "all" ? pending.length + successful.length + failed.length
      : pending.filter((r) => groupKey(r) === key).length + successful.filter((r) => groupKey(r) === key).length + failed.filter((r) => groupKey(r) === key).length
  const totalNew = newCountFor("all")

  const tabNewCount = (tab: StatusTab) => {
    const pCount = gPending.filter((r) => isNew(r.createdAt, groupKey(r))).length
    const sCount = gSuccessful.filter((r) => isNew(r.enteredTime, groupKey(r))).length
    const fCount = gFailed.filter((r) => isNew(r.enteredTime, groupKey(r))).length
    if (tab === "pending") return pCount
    if (tab === "successful") return sCount
    if (tab === "failed") return fCount
    return pCount + sCount + fCount
  }

  type MergedRow = { key: string; title: string; slug: string; status: "pending" | "entered" | "failed"; groupLabel: string; groupId: string; timestamp: number; entries?: number; reason?: string | null }

  const mergedAll: MergedRow[] = useMemo(() => {
    const rows: MergedRow[] = []
    gPending.forEach((r) => rows.push({ key: `p-${r.id}`, title: r.name, slug: r.slug, status: "pending", groupId: groupKey(r), groupLabel: groupMode === "server" ? (r.serverName || shortId(r.teamId ?? "")) : (r.projectName || shortId(r.projectId)), timestamp: new Date(r.createdAt).getTime() }))
    gSuccessful.forEach((r, i) => rows.push({ key: `s-${r.slug}-${i}`, title: r.raffleName ?? r.slug, slug: r.slug, status: "entered", groupId: groupKey(r), groupLabel: groupMode === "server" ? (r.serverName || shortId(r.teamId ?? "")) : (r.projectName || shortId(r.projectId ?? "")), timestamp: new Date(r.enteredTime).getTime(), entries: r.enteries }))
    gFailed.forEach((r, i) => rows.push({ key: `f-${r.slug}-${i}`, title: r.raffleName ?? r.slug, slug: r.slug, status: "failed", groupId: groupKey(r), groupLabel: groupMode === "server" ? (r.serverName || shortId(r.teamId ?? "")) : (r.projectName || shortId(r.projectId ?? "")), timestamp: new Date(r.enteredTime).getTime(), reason: r.resultMd || r.reason || r.error }))
    return rows.sort((a, b) => b.timestamp - a.timestamp)
  }, [gPending, gSuccessful, gFailed, groupMode])

  const dayLabel = (ts: number) => new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
  const withDateSeparators = <T extends { timestamp: number }>(rows: T[]) => {
    const out: (T | { separator: string })[] = []
    let lastDay = ""
    rows.forEach((r) => { const day = dayLabel(r.timestamp); if (day !== lastDay) { out.push({ separator: day }); lastDay = day }; out.push(r) })
    return out
  }

  const statusBar = { pending: "bg-amber-400", entered: "bg-emerald-400", failed: "bg-rose-400" }
  const statusText = { pending: "text-amber-400", entered: "text-emerald-400", failed: "text-rose-400" }
  const fullListFiltered = (fullList ?? []).filter((r) => matchesSearch(r.name, r.slug))

  const Badge = ({ n }: { n: number }) =>
    n > 0 ? <span className="text-[10px] bg-[#7C6CF0] text-white px-1.5 py-0.5 rounded-full font-mono">{n}</span> : null

  return (
    <div className="min-h-screen bg-[#0E0F13] text-[#E7E8ED] font-sans">
      <div className="border-b border-[#242730] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Alphabot Monitor</h1>
          <span className="flex items-center gap-1.5 text-xs text-[#8A8E9C]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            live
          </span>
          {totalNew > 0 && <Badge n={totalNew} />}
          {etaSeconds !== null && pending.length > 0 && <span className="text-xs text-[#8A8E9C] font-mono">next entry in {formatSeconds(etaSeconds)}</span>}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-wrap gap-x-4 divide-x divide-[#242730] text-sm">
            <Stat label="pending" value={pending.length} />
            <Stat label="entered" value={successful.length} />
            <Stat label="failed" value={failed.length} />
            <Stat label="total entries" value={successful.reduce((s, r) => s + (r.enteries || 0), 0)} />
          </div>
          <button onClick={markAllRead} className="text-xs border border-[#242730] px-2.5 py-1.5 text-[#8A8E9C] hover:text-[#E7E8ED] hover:border-[#3a3d47] transition-colors shrink-0">mark all as read</button>
        </div>
      </div>

      <div className="flex gap-1 px-6 pt-3 border-b border-[#242730]">
        {([["project", "By project"], ["server", "By alpha server"], ["community", "Community raffles"]] as [GroupMode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => { setGroupMode(m); setActiveGroup("all"); if (m === "community" && !fullList) fetchFullList() }}
            className={`px-3 py-1.5 text-xs rounded-t transition-colors ${groupMode === m ? "bg-[#15171E] text-[#E7E8ED]" : "text-[#8A8E9C] hover:text-[#E7E8ED]"}`}>
            {label}
          </button>
        ))}
      </div>

      {groupMode === "community" ? (
        <div>
          <div className="px-6 pt-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search by name or slug…"
              className="w-full max-w-sm bg-[#15171E] border border-[#242730] text-sm px-3 py-1.5 rounded focus:outline-none focus:border-[#7C6CF0]" />
          </div>
          <div className="px-6 py-3 flex items-center justify-between border-b border-[#242730] mt-3">
            <p className="text-xs text-[#8A8E9C]">Full unregistered raffle list from Alphabot — fetched manually only (rate limited to 30/hour).</p>
            <button onClick={fetchFullList} disabled={fullListLoading} className="text-xs border border-[#242730] px-2.5 py-1.5 text-[#8A8E9C] hover:text-[#E7E8ED] disabled:opacity-40">
              {fullListLoading ? "fetching…" : "refresh list"}
            </button>
          </div>
          {fullListError ? (
            <p className="px-6 py-10 text-sm text-rose-400">Error: {fullListError}</p>
          ) : fullListFiltered.length === 0 ? (
            <p className="px-6 py-10 text-sm text-[#8A8E9C]">{fullList === null ? "click refresh to load" : "nothing matches"}</p>
          ) : (
            <div className="divide-y divide-[#242730]">
              {fullListFiltered.map((r) => (
                <div key={r.slug} className="flex items-stretch">
                  <div className={`w-1 ${r.status === "entered" ? statusBar.entered : r.status === "failed" ? statusBar.failed : r.status === "queued" ? statusBar.pending : "bg-[#3a3d47]"}`} />
                  <div className="flex-1 px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{r.name}</p>
                      <p className="text-xs text-[#8A8E9C] font-mono mt-0.5">{r.slug}</p>
                      {r.reason && <p className="text-xs text-rose-400 mt-1 whitespace-pre-line">{r.reason}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-mono ${r.status === "entered" ? "text-emerald-400" : r.status === "failed" ? "text-rose-400" : r.status === "queued" ? "text-amber-400" : "text-[#8A8E9C]"}`}>
                        {r.status.replace("_", " ")}{r.entries ? ` · ${r.entries} entries` : ""}
                      </span>
                      {r.status === "not_attempted" && (
                        <button onClick={() => handleAddToQueue(r)} disabled={queueingSlug === r.slug} className="text-xs border border-[#242730] px-2 py-1 text-[#8A8E9C] hover:text-[#E7E8ED] disabled:opacity-40">
                          {queueingSlug === r.slug ? "…" : "add to queue"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-[#242730] md:h-[calc(100vh-113px)] flex flex-col">
            <div className="px-3 py-2 border-b border-[#242730]">
              <input value={sidebarSearch} onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder={`search ${groupMode === "server" ? "servers" : "projects"}…`}
                className="w-full bg-[#15171E] border border-[#242730] text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-[#7C6CF0]" />
            </div>
            <div className="overflow-x-auto md:overflow-x-visible md:overflow-y-auto flex md:block flex-1">
              <div className={`shrink-0 flex items-center justify-between px-4 py-2.5 text-sm border-b-2 md:border-b-0 md:border-l-2 whitespace-nowrap ${activeGroup === "all" ? "border-[#7C6CF0] bg-[#15171E] text-[#E7E8ED]" : "border-transparent text-[#8A8E9C]"}`}>
                <button onClick={() => setActiveGroup("all")} className="hover:text-[#E7E8ED]">
                  all {groupMode === "server" ? "servers" : "projects"}<span className="font-mono text-xs opacity-60 ml-2">{groupCount("all")}</span>
                </button>
              </div>
              {visibleGroupIds.map((key, idx) => {
                const n = newCountFor(key)
                const isDragging = draggedKey === key
                const isOver = dragOverKey === key && draggedKey !== key
                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={handleDragStart(key)}
                    onDragOver={handleDragOver(key)}
                    onDrop={handleDrop(key)}
                    onDragEnd={handleDragEnd}
                    className={`shrink-0 flex items-center justify-between px-4 py-2.5 text-sm border-b-2 md:border-b-0 md:border-l-2 whitespace-nowrap gap-2 cursor-grab active:cursor-grabbing transition-colors ${
                      activeGroup === key ? "border-[#7C6CF0] bg-[#15171E] text-[#E7E8ED]" : "border-transparent text-[#8A8E9C]"
                    } ${isDragging ? "opacity-40" : ""} ${isOver ? "bg-[#1c1e27] border-t-2 border-t-[#7C6CF0]" : ""}`}
                  >
                    <button onClick={() => setActiveGroup(key)} className="hover:text-[#E7E8ED] flex items-center gap-2 min-w-0">
                      <span className="text-[#4a4d57] select-none">⋮⋮</span>
                      <span className="truncate">{groupLabel(key)}</span>
                      <span className="font-mono text-xs opacity-60 shrink-0">{groupCount(key)}</span>
                      {n > 0 && <span className="shrink-0"><Badge n={n} /></span>}
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {n > 0 && <button onClick={() => markGroupRead(key)} className="text-[10px] text-[#8A8E9C] hover:text-[#E7E8ED]">read</button>}
                      <button onClick={() => moveGroup(key, -1)} disabled={idx === 0} className="text-[#8A8E9C] hover:text-[#E7E8ED] disabled:opacity-20 disabled:cursor-default px-1">↑</button>
                      <button onClick={() => moveGroup(key, 1)} disabled={idx === visibleGroupIds.length - 1} className="text-[#8A8E9C] hover:text-[#E7E8ED] disabled:opacity-20 disabled:cursor-default px-1">↓</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex gap-6 px-6 pt-4 border-b border-[#242730] overflow-x-auto">
              {(["all", "pending", "successful", "failed"] as StatusTab[]).map((tab) => {
                const n = tabNewCount(tab)
                return (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 text-sm capitalize border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab ? "border-[#7C6CF0] text-[#E7E8ED]" : "border-transparent text-[#8A8E9C] hover:text-[#E7E8ED]"}`}>
                    {tab}
                    {n > 0 && <Badge n={n} />}
                  </button>
                )
              })}
            </div>
            <div className="px-6 pt-3">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search by name or slug…"
                className="w-full max-w-sm bg-[#15171E] border border-[#242730] text-sm px-3 py-1.5 rounded focus:outline-none focus:border-[#7C6CF0]" />
            </div>

            {loading ? (
              <p className="px-6 py-10 text-sm text-[#8A8E9C]">loading…</p>
            ) : activeTab === "all" ? (
              mergedAll.length === 0 ? <p className="px-6 py-10 text-sm text-[#8A8E9C]">nothing here right now</p> : (
                <div className="divide-y divide-[#242730]">
                  {withDateSeparators(mergedAll).map((row, idx) => "separator" in row ? (
                    <div key={`sep-${idx}`} className="px-5 py-2 text-xs text-[#8A8E9C] bg-[#15171E]">{row.separator}</div>
                  ) : (
                    <div key={row.key} className="flex items-stretch">
                      <div className={`w-1 ${statusBar[row.status]}`} />
                      <div className="flex-1 px-5 py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex items-center gap-2">
                          {isNew(row.timestamp, row.groupId) && <span className="w-1.5 h-1.5 rounded-full bg-[#7C6CF0] shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm truncate">{row.title}</p>
                            <p className="text-xs text-[#8A8E9C] font-mono mt-0.5">{row.groupLabel} · {row.slug} · {new Date(row.timestamp).toLocaleTimeString()}</p>
                            {row.reason && <p className="text-xs text-rose-400 mt-1 whitespace-pre-line">{row.reason}</p>}
                          </div>
                        </div>
                        <span className={`text-xs font-mono shrink-0 ${statusText[row.status]}`}>{row.status}{row.entries != null ? ` · ${row.entries} entries` : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : activeTab === "pending" ? (
              gPending.length === 0 ? <p className="px-6 py-10 text-sm text-[#8A8E9C]">no pending raffles</p> : (
                <div className="divide-y divide-[#242730]">
                  {gPending.map((r, idx) => {
                    const myEta = (etaSeconds ?? 0) + idx * 60
                    return (
                      <div key={r.id} className="flex items-stretch">
                        <div className={`w-1 ${statusBar.pending}`} />
                        <div className="flex-1 px-5 py-3 flex items-center justify-between gap-4">
                          <div className="min-w-0 flex items-center gap-3">
                            <span className="text-xs font-mono text-[#8A8E9C] w-6 shrink-0">#{idx + 1}</span>
                            {isNew(r.createdAt, groupKey(r)) && <span className="w-1.5 h-1.5 rounded-full bg-[#7C6CF0] shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm truncate">{r.name}</p>
                              <p className="text-xs text-[#8A8E9C] font-mono mt-0.5">
                                {groupMode === "server" ? (r.serverName || shortId(r.teamId ?? "")) : (r.projectName || shortId(r.projectId))} · {r.slug}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-xs font-mono text-amber-400">{formatDuration(r.endDate - Date.now())} left</p>
                              <p className="text-[10px] text-[#8A8E9C] font-mono">enters {formatSeconds(myEta)}</p>
                            </div>
                            <button onClick={() => handleReenter({ slug: r.slug, name: r.name, projectId: r.projectId, projectName: r.projectName, teamId: r.teamId, serverName: r.serverName })}
                              disabled={reenteringSlug === r.slug} className="text-xs text-[#8A8E9C] hover:text-[#E7E8ED] transition-colors disabled:opacity-40">
                              {reenteringSlug === r.slug ? "…" : "enter now"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : activeTab === "successful" ? (
              gSuccessful.length === 0 ? <p className="px-6 py-10 text-sm text-[#8A8E9C]">no successful entries yet</p> : (
                <div className="divide-y divide-[#242730]">
                  {withDateSeparators(gSuccessful.map((r, i) => ({ ...r, timestamp: new Date(r.enteredTime).getTime(), _i: i }))).map((row, idx) => "separator" in row ? (
                    <div key={`sep-${idx}`} className="px-5 py-2 text-xs text-[#8A8E9C] bg-[#15171E]">{row.separator}</div>
                  ) : (
                    <div key={`${row.slug}-${row._i}`} className="flex items-stretch">
                      <div className={`w-1 ${statusBar.entered}`} />
                      <div className="flex-1 px-5 py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex items-center gap-2">
                          {isNew(row.enteredTime, groupKey(row)) && <span className="w-1.5 h-1.5 rounded-full bg-[#7C6CF0] shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm truncate">{row.raffleName ?? row.slug}</p>
                            <p className="text-xs text-[#8A8E9C] font-mono mt-0.5">{groupMode === "server" ? (row.serverName || shortId(row.teamId ?? "")) : (row.projectName || shortId(row.projectId ?? ""))} · {new Date(row.enteredTime).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-xs font-mono text-emerald-400">{row.enteries} entries</span>
                          <button onClick={() => handleReenter(row)} disabled={reenteringSlug === row.slug} className="text-xs text-[#8A8E9C] hover:text-[#E7E8ED] transition-colors disabled:opacity-40">{reenteringSlug === row.slug ? "…" : "re-enter"}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              gFailed.length === 0 ? <p className="px-6 py-10 text-sm text-[#8A8E9C]">no failed entries</p> : (
                <div className="divide-y divide-[#242730]">
                  {withDateSeparators(gFailed.map((r, i) => ({ ...r, timestamp: new Date(r.enteredTime).getTime(), _i: i }))).map((row, idx) => "separator" in row ? (
                    <div key={`sep-${idx}`} className="px-5 py-2 text-xs text-[#8A8E9C] bg-[#15171E]">{row.separator}</div>
                  ) : (
                    <div key={`${row.slug}-${row._i}`} className="flex items-stretch">
                      <div className={`w-1 ${statusBar.failed}`} />
                      <div className="flex-1 px-5 py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex items-center gap-2">
                          {isNew(row.enteredTime, groupKey(row)) && <span className="w-1.5 h-1.5 rounded-full bg-[#7C6CF0] shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm truncate">{row.raffleName ?? row.slug}</p>
                            <p className="text-xs text-[#8A8E9C] font-mono mt-0.5">{groupMode === "server" ? (row.serverName || shortId(row.teamId ?? "")) : (row.projectName || shortId(row.projectId ?? ""))} · {new Date(row.enteredTime).toLocaleTimeString()}</p>
                            {(row.resultMd || row.reason || row.error) && <p className="text-xs text-rose-400 mt-1 whitespace-pre-line">{row.resultMd || row.reason || row.error}</p>}
                          </div>
                        </div>
                        <button onClick={() => handleReenter(row)} disabled={reenteringSlug === row.slug} className="text-xs text-[#8A8E9C] hover:text-[#E7E8ED] transition-colors disabled:opacity-40 shrink-0">{reenteringSlug === row.slug ? "…" : "retry"}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}
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