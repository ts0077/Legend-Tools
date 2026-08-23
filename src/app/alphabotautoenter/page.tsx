'use client'
import AlphabotRafflesListApi from "@/lib/api/alphabot/getAlphabotRaffles"
import AlphabotRafflesRegisterApi from "@/lib/api/alphabot/registerforAlphabotRaffle"
import { useState, useEffect } from "react"

export default function AlphabotAutoEnter() {
  const [rafflesList, setRafflesList] = useState([])
  const [loading, setLoading] = useState(true)

  const handleAlphabotRafflesList = async () => {
    setLoading(true)
    try {
      const res = await AlphabotRafflesListApi()
      if (res.data.success === true) {
        setRafflesList(res?.data?.data?.raffles || [])
      } else {
        console.error("failed to load")
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterAlphabotRaffle = async(slug:string)=>{
    try{
            const res = await AlphabotRafflesRegisterApi (slug)
            console.log(res)
    }
    catch(error)
    {
        console.error(error)
    }
  }

//   useEffect(() => {
//     handleAlphabotRafflesList()
//   }, [])

  return (
    <div className="bg-black/10 min-h-screen">
      <div className="px-10 py-5">
        <h2 className="text-xl font-bold text-center">ALPHABOT AUTO ENTER</h2>

        <div className="grid grid-cols-2 pt-5">
          <div className="border">
            <div className="flex justify-between pt-5 px-6 items-center">
            <div className="flex gap-3">

            <h2 className="text-lg ">Recent Raffles</h2>
            <button 
            onClick={handleAlphabotRafflesList}
            className="bg-white/20 border border-white/70 px-1 text-xs cursor-pointer">Refresh</button>
            </div>
            <p>Total Raffles: {rafflesList?.length}</p>
            </div>
            {rafflesList?.length > 0 ? (
              rafflesList.map((r: any) => (
                <div 
                className="border px-4 py-1 mt-3"
                key={r._id ?? r.slug}>
                  <div className="flex justify-between">
                    <h4 className="font-semibold">{r?.name}</h4>
                    <p>{r?.blockchain}</p>
                  </div>
                  <div>
                    <div className="flex justify-between">
                    <p>{r?.slug}</p>
                    <button
                    className="border bg-white/10 px-1 cursor-pointer text-xs"
                    onClick={()=>handleRegisterAlphabotRaffle(r.slug)}>Enter Raffle</button>
                    </div>
                    <div>
                      {r?.startDate ? new Date(r.startDate).toLocaleString() : ""}
                      {" - "}
                      {r?.endDate ? new Date(r.endDate).toLocaleString() : ""}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-50 flex flex-col justify-center">
                <p>{loading ? "Loading raffles..." : "Raffles not loaded"}</p>
                {!loading && (
                  <div>
                    <button
                      onClick={handleAlphabotRafflesList}
                      className="bg-white text-black font-bold rounded px-4 py-1"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div></div>
        </div>
      </div>
    </div>
  )
}