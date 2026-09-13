import axios from "axios";
import { baseAlphabotUrl, baseurl } from "../baseurl";

export interface raffleRegisterResultProps {
    success:boolean  
validationSuccess:boolean
enteries:number
slug:string
reason: string
resultMd:string
error:string
}

export default async function AlphabotRafflesRegisterResultApi ( data:raffleRegisterResultProps){
                const alphabotKey = baseAlphabotUrl
                const url = baseurl + "/api/Raffles/AddAlphabotRegisterResult" 
    try{
                    const res = await axios.post(url,
                           data,
                        {   
                            headers:{
                                "Content-Type":"application/json",
                                Accept: "/",
                               
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