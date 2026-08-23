import axios from "axios";
import { baseAlphabotUrl, baseurl } from "../baseurl";

export default async function AlphabotRafflesListApi (){
                const alphabotKey = baseAlphabotUrl
                const url = baseurl + "/api/Raffles/rafflesList" 
    try{
                    const res = await axios.get(url,

                        {   
                            headers:{
                                "Content-Type":"application/json",
                                Accept: "*",
                            },
                            params:{
                                token:alphabotKey,
                                scope:"community",
                                filter:"unregistered"
                            }
                        }
                    ) 
                    return res
    }
    catch(error)
    {
        throw error
    }
}