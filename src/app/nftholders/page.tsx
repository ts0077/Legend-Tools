"use client";

import GetNFTsHoldersApi, {
    NftsHoldersFetchdataProps
} from "@/lib/api/NFTfetchAlchemeyUrl";

import { useState } from "react";

export default function NftHoldersFetch() {
    const [contractadd, setContractAdd] = useState("");
    const [holders, setHolders] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchNftsHolders = async () => {
        try {
            setLoading(true);
            setHolders([]);

            let pageKey: string | undefined = undefined;
            const allHolders: string[] = [];

            do {
                const params: NftsHoldersFetchdataProps = {
                    contractAddress: contractadd,
                    pageKey: pageKey
                };

                const res = await GetNFTsHoldersApi(params);

                if (res?.owners) {
                    res.owners.forEach((owner: any) => {
                        allHolders.push(owner.ownerAddress);
                    });
                }

                pageKey = res?.pageKey;

            } while (pageKey);

           
            const uniqueHolders = [...new Set(allHolders)];

            setHolders(uniqueHolders);

            console.log("Total holders:", uniqueHolders.length);
            console.log(uniqueHolders);

        } catch (error) {
            console.error("Error fetching NFT holders:", error);
        } finally {
            setLoading(false);
        }
    };

    const copyAllHolders = async () => {
        await navigator.clipboard.writeText(
            holders.join("\n")
        );
    };

    return (
        <div className="bg-black min-h-screen text-white">
            <div className="bg-slate-800 px-12 py-5">

                <div className="flex flex-col gap-3">

                    <label>
                        Enter Contract Address (0xabc....)
                    </label>

                    <div className="flex gap-2">

                        <input
                            type="text"
                            className="bg-black/10 h-8 border rounded-2xl placeholder:px-2 px-4"
                            placeholder="Enter address here"
                            value={contractadd}
                            onChange={(e) =>
                                setContractAdd(e.target.value)
                            }
                        />

                        <button
                            className="bg-black/20 px-3 py-2 rounded"
                            onClick={fetchNftsHolders}
                            disabled={loading}
                        >
                            {loading ? "Loading..." : "Search"}
                        </button>

                    </div>

                    {holders.length > 0 && (
                        <div className="mt-6">

                            <div className="flex justify-between items-center mb-2">

                                <h2>
                                    Holders: {holders.length}
                                </h2>

                                <button
                                    onClick={copyAllHolders}
                                    className="bg-blue-600 px-4 py-2 rounded"
                                >
                                    Copy All
                                </button>

                            </div>

                            <textarea
                                value={holders.join("\n")}
                                readOnly
                                className="w-full h-96 bg-black border rounded p-4 font-mono text-sm"
                            />

                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}