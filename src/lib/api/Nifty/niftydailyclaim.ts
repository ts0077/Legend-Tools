import axios from "axios";
import { baseAlphabotUrl, baseurl } from "../baseurl";



export default async function ANiftyDailyClaimApi (){
                const alphabotKey = baseAlphabotUrl
                const url = baseurl + "https://niftyshield.org/api/daily/claim" 
    try{
                    const res = await axios.post(url,
                           {},
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