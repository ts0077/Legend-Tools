'use client'
import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import { baseurl } from "@/lib/api/baseurl"

interface PendingRaffle {
  id: number
  slug: string
  name: string
  projectId: string
  projectName: string | null
  endDate: number
}

interface ResultRaffle {
  slug: string
  raffleName: string | null
  projectId: string | null
  projectName: string | null
  success: boolean
  enteries: number
  reason: string | null
  error: string | null
  enteredTime: string
}

type Tab = "pending" | "successful" | "failed"

export default function AlphabotDashboard() {
  const [pending, setPending] = useState<PendingRaffle[]>([])
  const [successful, setSuccessful] = useState<ResultRaffle[]>([])
  const [failed, setFailed] = useState<ResultRaffle[]>([])
  const [activeProject, setActiveProject] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<Tab>("pending")
  const [loading, setLoading] = useState(true)
  const [reenteringSlug, setReenteringSlug] = useState<string | null>(null)

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

  const handleReenter = async (slug: string, name: string | null, projectId: string | null, projectName: string | null) => {
    setReenteringSlug(slug)
    try {
      await axios.post(`${baseurl}/api/Raffles/reenter/${slug}`, null, {
        params: { name: name ?? "", projectId: projectId ?? "", projectName: projectName ?? "" },
      })
      await fetchAll()
    } finally {
      setReenteringSlug(null)
    }
  }

  const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 8)}…` : id)

  const projectIds = Array.from(
    new Set([
      ...pending.map((r) => r.projectId),
      ...successful.map((r) => r.projectId ?? "unknown"),
      ...failed.map((r) => r.projectId ?? "unknown"),
    ])
  ).filter(Boolean) as string[]

  const projectLabel = (pid: string): string => {
    if (pid === "unknown") return "unknown"
    const all = [...pending, ...successful, ...failed]
    const match = all.find((r) => r.projectId === pid && r.projectName)
    return match?.projectName || shortId(pid)
  }

  const filterByProject = <T extends { projectId: string | null }>(list: T[]) =>
    activeProject === "all" ? list : list.filter((r) => (r.projectId ?? "unknown") === activeProject)

  const filteredPending = filterByProject(pending).slice().sort((a, b) => a.endDate - b.endDate)
  const filteredSuccessful = filterByProject(successful)
  const filteredFailed = filterByProject(failed)

  const totalEntered = successful.reduce((sum, r) => sum + (r.enteries || 0), 0)

  const timeLeft = (endDate: number) => {
    const diff = endDate - Date.now()
    if (diff <= 0) return "ended"
    const mins = Math.floor(diff / 60000)
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const projectCount = (id: string) =>
    id === "all"
      ? pending.length + successful.length + failed.length
      : pending.filter((r) => r.projectId === id).length +
        successful.filter((r) => (r.projectId ?? "unknown") === id).length +
        failed.filter((r) => (r.projectId ?? "unknown") === id).length

  const statusBar = { pending: "bg-amber-400", successful: "bg-emerald-400", failed: "bg-rose-400" }

  const currentList = activeTab === "pending" ? filteredPending : activeTab === "successful" ? filteredSuccessful : filteredFailed

  return (
    <div className="min-h-screen bg-[#0E0F13] text-[#E7E8ED] font-sans">
      <div className="border-b border-[#242730] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Alphabot Monitor</h1>
          <span className="flex items-center gap-1.5 text-xs text-[#8A8E9C]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            live
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 divide-x divide-[#242730] text-sm">
          <Stat label="pending" value={pending.length} />
          <Stat label="entered" value={successful.length} />
          <Stat label="failed" value={failed.length} />
          <Stat label="total entries" value={totalEntered} />
        </div>
      </div>

      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-[#242730] overflow-x-auto md:overflow-x-visible md:h-[calc(100vh-73px)] md:overflow-y-auto flex md:block">
          <button
            onClick={() => setActiveProject("all")}
            className={`shrink-0 text-left px-4 py-2.5 text-sm border-b-2 md:border-b-0 md:border-l-2 transition-colors whitespace-nowrap ${
              activeProject === "all"
                ? "border-[#7C6CF0] bg-[#15171E] text-[#E7E8ED]"
                : "border-transparent text-[#8A8E9C] hover:text-[#E7E8ED]"
            }`}
          >
            all projects <span className="font-mono text-xs opacity-60 ml-2">{projectCount("all")}</span>
          </button>
          {projectIds.map((pid) => (
            <button
              key={pid}
              onClick={() => setActiveProject(pid)}
              className={`shrink-0 text-left px-4 py-2.5 text-sm border-b-2 md:border-b-0 md:border-l-2 transition-colors whitespace-nowrap ${
                activeProject === pid
                  ? "border-[#7C6CF0] bg-[#15171E] text-[#E7E8ED]"
                  : "border-transparent text-[#8A8E9C] hover:text-[#E7E8ED]"
              }`}
            >
              {projectLabel(pid)}
              <span className="font-mono text-xs opacity-60 ml-2">{projectCount(pid)}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex gap-6 px-6 pt-4 border-b border-[#242730]">
            {(["pending", "successful", "failed"] as Tab[]).map((tab) => (
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
          ) : currentList.length === 0 ? (
            <p className="px-6 py-10 text-sm text-[#8A8E9C]">nothing here right now</p>
          ) : (
            <div className="divide-y divide-[#242730]">
              {activeTab === "pending" &&
                filteredPending.map((r) => (
                  <div key={r.id} className="flex items-stretch">
                    <div className={`w-1 ${statusBar.pending}`} />
                    <div className="flex-1 px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{r.name}</p>
                        <p className="text-xs text-[#8A8E9C] font-mono mt-0.5">
                          {r.projectName || shortId(r.projectId)} · {r.slug}
                        </p>
                      </div>
                      <p className="text-xs font-mono text-amber-400 shrink-0">{timeLeft(r.endDate)} left</p>
                    </div>
                  </div>
                ))}

              {activeTab === "successful" &&
                filteredSuccessful.map((r, i) => (
                  <div key={`${r.slug}-${i}`} className="flex items-stretch">
                    <div className={`w-1 ${statusBar.successful}`} />
                    <div className="flex-1 px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{r.raffleName ?? r.slug}</p>
                        <p className="text-xs text-[#8A8E9C] font-mono mt-0.5">
                          {r.projectName || shortId(r.projectId ?? "")} · {new Date(r.enteredTime).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-xs font-mono text-emerald-400">{r.enteries} entries</span>
                        <button
                          onClick={() => handleReenter(r.slug, r.raffleName, r.projectId, r.projectName)}
                          disabled={reenteringSlug === r.slug}
                          className="text-xs text-[#8A8E9C] hover:text-[#E7E8ED] transition-colors disabled:opacity-40"
                        >
                          {reenteringSlug === r.slug ? "…" : "re-enter"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {activeTab === "failed" &&
                filteredFailed.map((r, i) => (
                  <div key={`${r.slug}-${i}`} className="flex items-stretch">
                    <div className={`w-1 ${statusBar.failed}`} />
                    <div className="flex-1 px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{r.raffleName ?? r.slug}</p>
                        <p className="text-xs text-[#8A8E9C] font-mono mt-0.5">
                          {r.projectName || shortId(r.projectId ?? "")} · {new Date(r.enteredTime).toLocaleString()}
                        </p>
                        {(r.reason || r.error) && (
                          <p className="text-xs text-rose-400 mt-1 whitespace-pre-line">{r.reason || r.error}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleReenter(r.slug, r.raffleName, r.projectId, r.projectName)}
                        disabled={reenteringSlug === r.slug}
                        className="text-xs text-[#8A8E9C] hover:text-[#E7E8ED] transition-colors disabled:opacity-40 shrink-0"
                      >
                        {reenteringSlug === r.slug ? "…" : "re-enter"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
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