import { Address } from "viem";
import AppLayout from "../AppLayout";
import BuyPanel from "../components/BuyPanel";
import { OtterPadFund__factory } from "../typechain-types";
import Charts from "../components/Charts";
import { Layout } from "antd";
import { useAccount, useContractReads, useSwitchChain } from "wagmi";
import { useMediaQuery } from "react-responsive";
import { useParams } from "react-router-dom";
import { getFactoryAddress } from "../config";
import React, { useEffect, useState } from "react";
import ChainWarning from "../components/ChainWarning";
import { OtterpadInfo } from "./TrendingPage";
import AlternativePayment from "../components/AlternativePayment";
import mixpanel from "mixpanel-browser";

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
  requiredSaleTokens: bigint;
  uniswapPool?: Address;
  saleTokenDecimals: number;
  paymentTokenDecimals: number;
  paymentTokenSymbol: string;
  saleTokenSymbol: string;
};

const FundPage = () => {
  const { chainIdDecimal, contractAddress } = useParams<{
    chainIdDecimal: string;
    contractAddress: string;
  }>();
  const { switchChain } = useSwitchChain();
  const [finishedChainSetup, setFinishedChainSetup] = React.useState(false);
  useEffect(() => {
    if (chainIdDecimal && switchChain) {
      switchChain({ chainId: Number(chainIdDecimal) });
      setFinishedChainSetup(true);
    }
  }, [chainIdDecimal, switchChain]);
  const [otterpadInfo, setOtterpadInfo] = useState<OtterpadInfo | null>(null);

  const CONTRACT_ADDRESS = contractAddress as Address;
  const { address: userAddress, isConnected } = useAccount();
  const isDesktop = useMediaQuery({ minWidth: 1024 });

  useEffect(() => {
    mixpanel.track("View Item", {
      Fundraiser: contractAddress,
      Chain: chainIdDecimal,
    });
  }, [contractAddress]);

  // Batch contract reads with proper configuration
  const {
    data: contractResults,
    isError,
    refetch: refetchContractDetails,
    // @ts-ignore
  } = useContractReads({
    contracts: [
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getCurrentPrice",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "startPrice",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "endPrice",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getMinimumPurchase",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getSaleTokenBalance",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getPaymentTokenBalance",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getEscrowedAmount",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "targetReached",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "isDeployedToUniswap",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "saleToken",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "paymentToken",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "targetLiquidity",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "upfrontRakeBPS",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "escrowRakeBPS",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "OTTERPAD_FEE_BPS",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "totalActiveContributions",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "totalPaymentsIn",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "title",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "richInfoUrl",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "checkSaleTokensRequired",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "uniswapPool",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "saleTokenDecimals",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "paymentTokenDecimals",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "saleTokenSymbol",
        chainId: Number(chainIdDecimal),
      },
      {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "paymentTokenSymbol",
        chainId: Number(chainIdDecimal),
      },
      ...(userAddress
        ? [
            {
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: "getAllocation",
              chainId: Number(chainIdDecimal),
              args: [userAddress],
            },
            {
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: "getUserOrderIndices",
              chainId: Number(chainIdDecimal),
              args: [userAddress],
            },
          ]
        : []),
    ],
    query: {
      refetchInterval: 60000, // Refresh every 60 seconds
      // Add refetchTrigger to the query dependencies
      refetchOnReconnect: true,
      refetchOnMount: true,
      enabled: true,
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

    console.log(`successResults`, successResults);

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
      // @ts-ignore
      requiredSaleTokens: successResults[19][0] as bigint,
      uniswapPool: successResults[20] as Address | undefined,
      saleTokenDecimals: Number(successResults[21]),
      paymentTokenDecimals: Number(successResults[22]),
      saleTokenSymbol: successResults[23] as string,
      paymentTokenSymbol: successResults[24] as string,
      userAllocation: successResults[25] as bigint | undefined,
      userOrders: successResults[26] as bigint[] | undefined,
    };
  };

  const contractData = processContractData();
  console.log(contractData);

  useEffect(() => {
    fetchOtterpadInfo();
  }, [contractData?.richInfoUrl]);

  async function fetchOtterpadInfo(): Promise<OtterpadInfo | undefined> {
    const url = contractData?.richInfoUrl;
    // const url = `https://api.legions.bot/api/w/officex/capture_u/f/officex/otterpad_rest_api?fund=${"a837fc4a-fdf2-4646-b682-68439ea59e0d"}"`;
    console.log(url);
    if (!url) return;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as OtterpadInfo;
      console.log("metadata", data);
      setOtterpadInfo(data);
      return data;
    } catch (error) {
      throw new Error(
        `Failed to fetch Otterpad info: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  if (!finishedChainSetup) {
    return null;
  }
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
        <BuyPanel
          address={CONTRACT_ADDRESS}
          otterpadInfo={otterpadInfo}
          chainIdDecimal={chainIdDecimal || ""}
          contractData={contractData}
          refetchContractDetails={refetchContractDetails}
        />
        <Charts
          address={CONTRACT_ADDRESS}
          otterpadInfo={otterpadInfo}
          chainIdDecimal={chainIdDecimal || ""}
          contractData={contractData}
          refetchContractDetails={refetchContractDetails}
        />
        <AlternativePayment
          contractData={contractData}
          otterpadInfo={otterpadInfo}
          chainIdDecimal={chainIdDecimal || ""}
        />
      </Layout>
    </AppLayout>
  );
};

export default FundPage;
