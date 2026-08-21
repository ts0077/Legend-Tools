import axios from "axios";

export interface NftsHoldersFetchdataProps {
    contractAddress?: string;
    withTokenBalances?: boolean;
    block?: string;
    pageKey?: string;
}

export default async function GetNFTsHoldersApi(
    data: NftsHoldersFetchdataProps
) {
    const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}/getOwnersForContract`;

    try {
        const response = await axios.get(url, {
            params: {
                contractAddress: data.contractAddress,
                withTokenBalances: true,
                block: data.block,
                pageKey: data.pageKey
            }
        });

        return response.data;

    } catch (error) {
        console.error("Error fetching NFT holders:", error);
        throw error;
    }
}