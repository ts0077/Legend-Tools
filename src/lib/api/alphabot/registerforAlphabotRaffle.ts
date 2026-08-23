import axios from "axios";
import { baseAlphabotUrl, baseurl } from "../baseurl";

export default async function AlphabotRafflesRegisterApi ( slug:string){
                const alphabotKey = baseAlphabotUrl
                const url = baseurl + "/api/Raffles/alphabotRegisterRaffle" 
    try{
                    const res = await axios.post(url,
                            {
                                slug:slug
                            },
                        {   
                            headers:{
                                "Content-Type":"application/json",
                                Accept: "/",
                                Authorization:alphabotKey
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