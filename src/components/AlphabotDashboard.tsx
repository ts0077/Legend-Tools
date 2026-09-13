'use client'
import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import { baseurl } from "@/lib/api/baseurl"

interface PendingRaffle {
  id: number
  slug: string
  name: string
  projectId: string
  endDate: number
}

interface ResultRaffle {
  slug: string
  raffleName: string | null
  projectId: string | null
  success: boolean
  enteries: number
  reason: string | null
  error: string | null
  enteredTime: string
}



export default function AlphabotDashboard() {
  const [pending, setPending] = useState<PendingRaffle[]>([])
  const [successful, setSuccessful] = useState<ResultRaffle[]>([])
  const [failed, setFailed] = useState<ResultRaffle[]>([])
  const [activeProject, setActiveProject] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<"pending" | "successful" | "failed">("pending")
  const [loading, setLoading] = useState(true)
  const [reenteringSlug, setReenteringSlug] = useState<string | null>(null)

 const fetchAll = useCallback(async () => {
  try {
    const [pRes, sRes, fRes] = await Promise.all([
      axios.get(`${baseurl}/api/Raffles/queue/pending`),
      axios.get(`${baseurl}/api/Raffles/results/successful`),
      axios.get(`${baseurl}/api/Raffles/results/failed`),
    ])
    setPending(pRes.data)
    setSuccessful(sRes.data)
    setFailed(fRes.data)
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

  const handleReenter = async (slug: string, name: string | null, projectId: string | null) => {
  setReenteringSlug(slug)
  try {
    await axios.post(`${baseurl}/api/Raffles/reenter/${slug}`, null, {
      params: { name: name ?? "", projectId: projectId ?? "" },
    })
    await fetchAll()
  } catch (err) {
    console.error(err)
  } finally {
    setReenteringSlug(null)
  }
}

  // Build the set of known project IDs across all three lists
  const projectIds = Array.from(
    new Set([
      ...pending.map((r) => r.projectId),
      ...successful.map((r) => r.projectId ?? "unknown"),
      ...failed.map((r) => r.projectId ?? "unknown"),
    ])
  ).filter(Boolean)

  const filterByProject = <T extends { projectId: string | null }>(list: T[]) =>
    activeProject === "all" ? list : list.filter((r) => (r.projectId ?? "unknown") === activeProject)

  const filteredPending = filterByProject(pending)
  const filteredSuccessful = filterByProject(successful)
  const filteredFailed = filterByProject(failed)

  const totalEntered = successful.reduce((sum, r) => sum + (r.enteries || 0), 0)

  const timeLeft = (endDate: number) => {
    const diff = endDate - Date.now()
    if (diff <= 0) return "ended"
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m left`
    return `${Math.floor(mins / 60)}h ${mins % 60}m left`
  }

  return (
    <div className="bg-black/10 min-h-screen px-6 py-5 text-sm">
      <h2 className="text-xl font-bold text-center mb-4">ALPHABOT DASHBOARD</h2>

      {/* Totals */}
      <div className="flex gap-6 justify-center mb-4 text-center">
        <div className="border px-4 py-2">
          <p className="text-xs opacity-70">Pending</p>
          <p className="text-lg font-bold">{pending.length}</p>
        </div>
        <div className="border px-4 py-2">
          <p className="text-xs opacity-70">Successful</p>
          <p className="text-lg font-bold">{successful.length}</p>
        </div>
        <div className="border px-4 py-2">
          <p className="text-xs opacity-70">Failed</p>
          <p className="text-lg font-bold">{failed.length}</p>
        </div>
        <div className="border px-4 py-2">
          <p className="text-xs opacity-70">Total Entries</p>
          <p className="text-lg font-bold">{totalEntered}</p>
        </div>
      </div>

      {/* Project tabs */}
      <div className="flex gap-2 flex-wrap justify-center mb-3">
        <button
          onClick={() => setActiveProject("all")}
          className={`px-2 py-1 border text-xs cursor-pointer ${activeProject === "all" ? "bg-white text-black font-bold" : "bg-white/10"}`}
        >
          All Projects
        </button>
        {projectIds.map((pid) => (
          <button
            key={pid}
            onClick={() => setActiveProject(pid!)}
            className={`px-2 py-1 border text-xs cursor-pointer ${activeProject === pid ? "bg-white text-black font-bold" : "bg-white/10"}`}
          >
            {pid}
          </button>
        ))}
      </div>

      {/* Status sub-tabs */}
      <div className="flex gap-2 justify-center mb-4">
        {(["pending", "successful", "failed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 border text-xs cursor-pointer uppercase ${activeTab === tab ? "bg-white/30 font-bold" : "bg-white/5"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center opacity-60">Loading...</p>
      ) : (
        <div className="max-w-3xl mx-auto space-y-2">
          {activeTab === "pending" &&
            (filteredPending.length === 0 ? (
              <p className="text-center opacity-50">No pending raffles</p>
            ) : (
              filteredPending
                .slice()
                .sort((a, b) => a.endDate - b.endDate)
                .map((r) => (
                  <div key={r.id} className="border px-4 py-2 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-xs opacity-60">{r.slug} · {r.projectId}</p>
                    </div>
                    <p className="text-xs">{timeLeft(r.endDate)}</p>
                  </div>
                ))
            ))}

          {activeTab === "successful" &&
            (filteredSuccessful.length === 0 ? (
              <p className="text-center opacity-50">No successful entries yet</p>
            ) : (
              filteredSuccessful.map((r, i) => (
                <div key={`${r.slug}-${i}`} className="border px-4 py-2 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{r.raffleName ?? r.slug}</p>
                    <p className="text-xs opacity-60">{r.slug} · {r.projectId ?? "unknown"} · {r.enteries} entries</p>
                    <p className="text-xs opacity-40">{new Date(r.enteredTime).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => handleReenter(r.slug, r.raffleName, r.projectId)}
                    disabled={reenteringSlug === r.slug}
                    className="border bg-white/10 px-2 py-1 text-xs cursor-pointer disabled:opacity-40"
                  >
                    {reenteringSlug === r.slug ? "..." : "Re-enter"}
                  </button>
                </div>
              ))
            ))}

          {activeTab === "failed" &&
            (filteredFailed.length === 0 ? (
              <p className="text-center opacity-50">No failed entries</p>
            ) : (
              filteredFailed.map((r, i) => (
                <div key={`${r.slug}-${i}`} className="border px-4 py-2 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{r.raffleName ?? r.slug}</p>
                    <p className="text-xs opacity-60">{r.slug} · {r.projectId ?? "unknown"}</p>
                    <p className="text-xs text-red-400 mt-1 whitespace-pre-line">{r.reason || r.error}</p>
                    <p className="text-xs opacity-40">{new Date(r.enteredTime).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => handleReenter(r.slug, r.raffleName, r.projectId)}
                    disabled={reenteringSlug === r.slug}
                    className="border bg-white/10 px-2 py-1 text-xs cursor-pointer disabled:opacity-40"
                  >
                    {reenteringSlug === r.slug ? "..." : "Re-enter"}
                  </button>
                </div>
              ))
            ))}
        </div>
      )}
    </div>
  )
}