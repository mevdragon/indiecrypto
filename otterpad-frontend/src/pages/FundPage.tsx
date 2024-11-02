import { Address } from "viem";
import AppLayout from "../AppLayout";
import BuyPanel from "../components/BuyPanel";
import { OtterPadFund__factory } from "../typechain-types";
import Charts from "../components/Charts";
import { Layout } from "antd";
import { useAccount, useContractReads } from "wagmi";
import { useMediaQuery } from "react-responsive";
import { useParams } from "react-router-dom";
import { getFactoryAddress } from "../config";
import React from "react";
import ChainWarning from "../components/ChainWarning";

export const CONTRACT_ABI = OtterPadFund__factory.abi;

// Contract function result types
export type ContractDataResult = {
  currentPrice: bigint;
  startPrice: bigint;
  endPrice: bigint;
  minimumPurchase: bigint;
  saleTokenBalance: bigint;
  totalActiveContributions: bigint;
  paymentTokenBalance: bigint;
  escrowedAmount: bigint;
  targetReached: boolean;
  isDeployedToUniswap: boolean;
  saleTokenAddress: Address;
  paymentTokenAddress: Address;
  userAllocation?: bigint;
  userOrders?: bigint[];
  targetLiquidity: bigint;
  upfrontRakeBPS: bigint;
  escrowRakeBPS: bigint;
  OTTERPAD_FEE_BPS: bigint;
  totalPaymentsIn: bigint;
  title: string;
  richInfoUrl: string;
};
export const ERC20_ABI = [
  {
    inputs: [
      {
        name: "owner",
        type: "address",
      },
      {
        name: "spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        name: "spender",
        type: "address",
      },
      {
        name: "amount",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const FundPage = () => {
  const { chainIdDecimal, contractAddress } = useParams<{
    chainIdDecimal: string;
    contractAddress: string;
  }>();
  const CONTRACT_ADDRESS = contractAddress as Address;
  const { address: userAddress, isConnected } = useAccount();
  const isDesktop = useMediaQuery({ minWidth: 1024 });
  // Batch contract reads with proper configuration
  const { data: contractResults, isError } = useContractReads({
    contracts: [
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getCurrentPrice",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "startPrice",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "endPrice",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getMinimumPurchase",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getSaleTokenBalance",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getPaymentTokenBalance",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getEscrowedAmount",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "targetReached",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "isDeployedToUniswap",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "saleToken",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "paymentToken",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "targetLiquidity",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "upfrontRakeBPS",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "escrowRakeBPS",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "OTTERPAD_FEE_BPS",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "totalActiveContributions",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "totalPaymentsIn",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "title",
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "richInfoUrl",
      },
      ...(userAddress
        ? [
            {
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: "getAllocation",
              args: [userAddress],
            },
            {
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: "getUserOrderIndices",
              args: [userAddress],
            },
          ]
        : []),
    ],
    query: {
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  React.useEffect(() => {
    try {
      getFactoryAddress(chainIdDecimal!);
    } catch (error) {
      console.error(error);
      // Optionally redirect to a 404 or error page
      // navigate('/404');
    }
  }, [chainIdDecimal]);

  // Process contract results into typed data
  const processContractData = (): ContractDataResult | null => {
    if (!contractResults) return null;

    const successResults = contractResults.map((result) =>
      result.status === "success" ? result.result : undefined
    );

    return {
      currentPrice: successResults[0] as bigint,
      startPrice: successResults[1] as bigint,
      endPrice: successResults[2] as bigint,
      minimumPurchase: successResults[3] as bigint,
      saleTokenBalance: successResults[4] as bigint,
      paymentTokenBalance: successResults[5] as bigint,
      escrowedAmount: successResults[6] as bigint,
      targetReached: successResults[7] as boolean,
      isDeployedToUniswap: successResults[8] as boolean,
      saleTokenAddress: successResults[9] as Address,
      paymentTokenAddress: successResults[10] as Address,
      targetLiquidity: successResults[11] as bigint,
      upfrontRakeBPS: successResults[12] as bigint,
      escrowRakeBPS: successResults[13] as bigint,
      OTTERPAD_FEE_BPS: successResults[14] as bigint,
      totalActiveContributions: successResults[15] as bigint,
      totalPaymentsIn: successResults[16] as bigint,
      title: successResults[17] as string,
      richInfoUrl: successResults[18] as string,
      userAllocation: successResults[19] as bigint | undefined,
      userOrders: successResults[20] as bigint[] | undefined,
    };
  };

  const contractData = processContractData();
  return (
    <AppLayout>
      <div style={{ padding: "0px 16px 0px 16px" }}>
        <ChainWarning requiredChainId={chainIdDecimal!} />
      </div>
      <Layout
        style={{
          minHeight: "100%",
          maxHeight: "100%",
          background: "#f5f5f5",
          display: "flex",
          minWidth: "100vw",
          padding: "42px 16px 16px 16px",
          gap: "16px",
          flexDirection: isDesktop ? "row" : "column",
          alignItems: isDesktop ? "flex-start" : "center",
          justifyContent: isDesktop ? "center" : "flex-start",
        }}
      >
        <BuyPanel address={CONTRACT_ADDRESS} contractData={contractData} />
        <Charts address={CONTRACT_ADDRESS} contractData={contractData} />
      </Layout>
    </AppLayout>
  );
};

export default FundPage;
