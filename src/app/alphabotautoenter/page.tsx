'use client'
import AlphabotRafflesListApi from "@/lib/api/alphabot/getAlphabotRaffles"
import AlphabotRafflesRegisterResultApi, { raffleRegisterResultProps } from "@/lib/api/alphabot/registerAlphabotRaffleResult"
import AlphabotRafflesRegisterApi from "@/lib/api/alphabot/registerforAlphabotRaffle"
import { resolve } from "path"
import { useState, useEffect } from "react"

export default function AlphabotAutoEnter() {
  const [rafflesList, setRafflesList] = useState([])
  const [slugList, setSlugList] = useState([])
  const [loading, setLoading] = useState(true)

  const handleAlphabotRafflesList = async () => {
    setLoading(true)
    try {
      const res = await AlphabotRafflesListApi()
      if (res.data.success === true) {
        setRafflesList(res?.data?.data?.raffles || [])
        console.log(JSON.stringify(res?.data?.data?.raffles?.[0], null, 2))
        setSlugList(res?.data?.data?.raffles.map((r:any)=>r.slug))
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
            const result12:raffleRegisterResultProps =  {
              success: res?.data?.success === true,
      validationSuccess: res?.data?.data?.validation?.success === true,
              enteries:res?.data?.data?.validation?.entries  || 0,
              reason: res?.data?.data?.validation?.reason || "",
              resultMd: res?.data?.data?.resultMd || "",
              error:res?.data?.errors?.[0]?.message  || "",
              slug:slug
            }
      
            
            const res2 = await AlphabotRafflesRegisterResultApi(result12)
            console.log(res2)
    }
    catch(error)
    {
        console.error(error)
    }
  }

  useEffect(()=>{
let cancelled = false

const runSequentially = async()=>{
  for(const slug of slugList)
  {
    if(cancelled) break
    await handleRegisterAlphabotRaffle(slug);
    await new Promise(resolve=>setTimeout(resolve,1000))
  }
}
runSequentially()

return()=>{
  cancelled = true
}
  },[slugList])
  



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
          <div className="border px-4 py-2">
            {
              slugList?.length>0?
              slugList?.map((slug,index)=>(
                <div className="mt-2 flex gap-2">
                    {index} {slug}
              </div>

              ))
                
              :
              <div>
                Failed to load slugs 
              </div>
            }

          </div>
        </div>
      </div>
    </div>
  )
}