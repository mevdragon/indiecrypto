import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { OtterPadFundraiser__factory } from "../../../typechain-types";
import {
  Card,
  Typography,
  Statistic as AntStatistic,
  Alert,
  Spin,
  Input,
  Button,
  Row,
  Col,
  notification,
  Layout,
  Space,
  theme,
  Statistic,
  Tabs,
  List,
  Tooltip,
  Progress,
  Tag,
  Popover,
} from "antd";
import {
  DollarOutlined,
  WalletOutlined,
  UserOutlined,
  LoadingOutlined,
  ShoppingCartOutlined,
  GiftOutlined,
  PieChartOutlined,
  LineChartOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
} from "@ant-design/icons";
import {
  useAccount,
  useBalance,
  useContractReads,
  useWaitForTransactionReceipt,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { Address, formatEther, parseEther } from "viem";
import { Content } from "antd/es/layout/layout";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import TabPane from "antd/es/tabs/TabPane";
import { getPublicClient, waitForTransaction } from "wagmi/actions";

const { Title, Text } = Typography;

interface TokenInfo {
  symbol: string;
  decimals: number;
}

interface TokenState {
  sale: TokenInfo | null;
  payment: TokenInfo | null;
}

const CONTRACT_ADDRESS = "0x40fb23A4316F255eb7C86FB1c8ea5E9a20A9Ba03" as const;
const CONTRACT_ABI = OtterPadFundraiser__factory.abi;

// Contract function result types
type ContractDataResult = {
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
};
const ERC20_ABI = [
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

const FundraiserViewer = () => {
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenState>({
    sale: null,
    payment: null,
  });
  const [buyAmount, setBuyAmount] = useState("");
  const [api, contextHolder] = notification.useNotification();
  const { token } = theme.useToken();
  const { address: userAddress, isConnected } = useAccount();
  const [estimatedTokens, setEstimatedTokens] = useState<string>("0");

  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [isPendingPurchase, setIsPendingPurchase] = useState(false);

  const [isApproved, setIsApproved] = useState(false);
  const [currentAllowance, setCurrentAllowance] = useState<bigint>(BigInt(0));

  const [avgPricePerToken, setAvgPricePerToken] = useState<string>("0");

  const [transactionState, setTransactionState] = useState({
    isCheckingAllowance: false,
    isApproving: false,
    isWaitingForApproval: false,
    isPurchasing: false,
    isWaitingForPurchase: false,
  });

  // Contract operations
  useEffect(() => {
    if (buyAmount && estimatedTokens && parseFloat(estimatedTokens) > 0) {
      const avgPrice = parseFloat(buyAmount) / parseFloat(estimatedTokens);
      setAvgPricePerToken(avgPrice.toFixed(6));
    } else {
      setAvgPricePerToken("0");
    }
  }, [buyAmount, estimatedTokens]);

  const calculateRemainingAmount = () => {
    if (!contractData) return "0";

    // Get current actual contribution amount (excluding rakes)
    const currentBalance = contractData.paymentTokenBalance;
    const escrowAmount =
      (currentBalance * contractData.escrowRakeBPS) / BigInt(10000);
    const upfrontAmount =
      (currentBalance *
        (contractData.upfrontRakeBPS - contractData.OTTERPAD_FEE_BPS)) /
      BigInt(10000);
    const otterpadFee =
      (currentBalance * contractData.OTTERPAD_FEE_BPS) / BigInt(10000);
    const actualContribution =
      currentBalance - escrowAmount - upfrontAmount - otterpadFee;

    // Calculate how much more we need in actual contributions
    const remainingContribution =
      contractData.targetLiquidity - actualContribution;
    if (remainingContribution <= BigInt(0)) return "0";

    // Calculate gross amount needed (before fees)
    // Formula: grossAmount = netAmount / (1 - totalRakePercentage)
    const netContributionBPS =
      BigInt(10000) - contractData.upfrontRakeBPS - contractData.escrowRakeBPS;
    const grossAmount =
      (remainingContribution * BigInt(10000)) / netContributionBPS;

    return formatEther(grossAmount);
  };

  const formatProgressDisplay = () => {
    if (!contractData) return "";

    const currentBalance = contractData.paymentTokenBalance;
    const escrowAmount =
      (currentBalance * contractData.escrowRakeBPS) / BigInt(10000);
    const upfrontAmount =
      (currentBalance *
        (contractData.upfrontRakeBPS - contractData.OTTERPAD_FEE_BPS)) /
      BigInt(10000);
    const otterpadFee =
      (currentBalance * contractData.OTTERPAD_FEE_BPS) / BigInt(10000);
    const actualContribution =
      currentBalance - escrowAmount - upfrontAmount - otterpadFee;

    return `${formatEther(actualContribution)} / ${formatEther(
      contractData.targetLiquidity
    )} ${tokenInfo.payment?.symbol}`;
  };

  const handleMaxRemainClick = () => {
    const remainingAmount = calculateRemainingAmount();
    setBuyAmount(remainingAmount);
    // Trigger calculations for estimated tokens and avg price
    calculateEstimatedTokens(remainingAmount, contractData, tokenInfo);
  };

  // Helper function to format BPS values to percentage
  const formatBPStoPercentage = (bps: bigint) => {
    return (Number(bps) / 100).toFixed(2);
  };

  // Add tooltip content for max remain explanation
  const getMaxRemainTooltip = () => {
    if (!contractData) return "";

    const remainingAmount = calculateRemainingAmount();
    const netContributionBPS =
      BigInt(10000) - contractData.upfrontRakeBPS - contractData.escrowRakeBPS;

    return (
      <div className="space-y-2">
        <p>This amount accounts for all fees:</p>
        <ul className="list-disc pl-4">
          <li>
            OtterPad Fee: {formatBPStoPercentage(contractData.OTTERPAD_FEE_BPS)}
            %
          </li>
          <li>
            Upfront Rake:{" "}
            {formatBPStoPercentage(
              contractData.upfrontRakeBPS - contractData.OTTERPAD_FEE_BPS
            )}
            %
          </li>
          <li>
            Escrow Rake: {formatBPStoPercentage(contractData.escrowRakeBPS)}%
          </li>
        </ul>
        <p className="mt-2">
          Net contribution rate: {formatBPStoPercentage(netContributionBPS)}%
        </p>
      </div>
    );
  };

  const { writeContract: approveToken, data: approvalHash } =
    useWriteContract();
  const { writeContract: buyTokens, data: buyTxHash } = useWriteContract();
  const { writeContract: redeemTokens, data: redeemTxHash } =
    useWriteContract();

  // Add hooks for tracking transactions
  const { isLoading: isApprovalLoading, isSuccess: isApprovalSuccess } =
    useWaitForTransactionReceipt({
      hash: approvalHash,
    });

  const { isLoading: isPurchaseLoading, isSuccess: isPurchaseSuccess } =
    useWaitForTransactionReceipt({
      hash: buyTxHash,
    });

  // Handle approval transaction status changes
  useEffect(() => {
    if (isApprovalSuccess) {
      setTransactionState((prev) => ({
        ...prev,
        isWaitingForApproval: false,
      }));
      checkAllowance();
      api.success({
        message: "Approval Successful",
        description: "You can now proceed with your purchase",
      });
    }
    if (isPurchaseSuccess) {
      setTransactionState((prev) => ({
        ...prev,
        isWaitingForPurchase: false,
      }));
      api.success({
        message: "Purchase Successful",
        description: "Your token purchase was successful!",
      });
      setBuyAmount("");
    }
  }, [isApprovalSuccess, isPurchaseSuccess]);

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
      userAllocation: successResults[16] as bigint | undefined,
      userOrders: successResults[17] as bigint[] | undefined,
    };
  };

  const contractData = processContractData();

  const calculateEstimatedTokens = (
    paymentAmount: string,
    contractData: ContractDataResult | null,
    tokenInfo: TokenState
  ) => {
    if (!contractData || !paymentAmount || isNaN(Number(paymentAmount))) {
      return { estimatedTokens: "0", avgPricePerToken: "0" };
    }

    try {
      const paymentAmountBigInt = parseEther(paymentAmount);

      if (contractData.targetReached) {
        // If target reached, use current price directly
        const tokens =
          (paymentAmountBigInt *
            BigInt(10 ** (tokenInfo.sale?.decimals || 18))) /
          contractData.currentPrice;
        return {
          estimatedTokens: formatEther(tokens),
          avgPricePerToken: formatEther(contractData.currentPrice),
        };
      }

      // Calculate price progression using net contribution
      const otterpadFee =
        (paymentAmountBigInt * contractData.OTTERPAD_FEE_BPS) / BigInt(10000);
      const upfrontAmount =
        (paymentAmountBigInt * contractData.upfrontRakeBPS) / BigInt(10000) -
        otterpadFee;
      const escrowAmount =
        (paymentAmountBigInt * contractData.escrowRakeBPS) / BigInt(10000);
      const netContribution =
        paymentAmountBigInt - otterpadFee - upfrontAmount - escrowAmount;

      // Get current price and calculate end price after this purchase
      const startPrice = contractData.currentPrice;
      const totalPriceDiff = contractData.endPrice - contractData.startPrice;

      const newProgress =
        contractData.totalActiveContributions + netContribution;
      const priceAtEnd =
        contractData.startPrice +
        (totalPriceDiff * newProgress) / contractData.targetLiquidity;

      // Use average price for this purchase
      const averagePrice = (startPrice + priceAtEnd) / BigInt(2);

      // Calculate tokens using full payment amount
      const saleTokenDecimals =
        BigInt(10) ** BigInt(tokenInfo.sale?.decimals || 18);
      const estimatedTokens =
        (paymentAmountBigInt * saleTokenDecimals) / averagePrice;

      return {
        estimatedTokens: formatEther(estimatedTokens),
        avgPricePerToken: formatEther(averagePrice),
      };
    } catch (error) {
      console.error("Error calculating estimated tokens:", error);
      return { estimatedTokens: "0", avgPricePerToken: "0" };
    }
  };

  useEffect(() => {
    calculateEstimatedTokens(buyAmount, contractData, tokenInfo);
  }, [buyAmount, contractData]);

  // Get user's payment token balance
  const { data: userPaymentTokenBalance } = useBalance({
    address: userAddress,
    token: contractData?.paymentTokenAddress,
    query: {
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  // Transaction status
  const { isLoading: buyLoading, isSuccess: buySuccess } =
    useWaitForTransactionReceipt({
      hash: buyTxHash,
    });

  const { isLoading: redeemLoading, isSuccess: redeemSuccess } =
    useWaitForTransactionReceipt({
      hash: redeemTxHash,
    });

  // Fetch token information
  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!contractData?.saleTokenAddress || !contractData?.paymentTokenAddress)
        return;

      const provider = new ethers.JsonRpcProvider(
        "https://sepolia.infura.io/v3/2d52e9fd20f643629739fc0513d6e0b3"
      );

      const erc20Abi = [
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
      ];

      try {
        const saleTokenContract = new ethers.Contract(
          contractData.saleTokenAddress,
          erc20Abi,
          provider
        );
        const paymentTokenContract = new ethers.Contract(
          contractData.paymentTokenAddress,
          erc20Abi,
          provider
        );

        const [saleSymbol, saleDecimals, paymentSymbol, paymentDecimals] =
          await Promise.all([
            saleTokenContract.symbol(),
            saleTokenContract.decimals(),
            paymentTokenContract.symbol(),
            paymentTokenContract.decimals(),
          ]);

        setTokenInfo({
          sale: { symbol: saleSymbol, decimals: saleDecimals },
          payment: { symbol: paymentSymbol, decimals: paymentDecimals },
        });
        setLoading(false);
      } catch (error) {
        console.error("Error fetching token info:", error);
        setLoading(false);
      }
    };

    fetchTokenInfo();
  }, [contractData?.saleTokenAddress, contractData?.paymentTokenAddress]);

  const publicClient = usePublicClient();

  const checkAllowance = async () => {
    if (!contractData || !userAddress || !publicClient || !buyAmount) return;

    try {
      setTransactionState((prev) => ({ ...prev, isCheckingAllowance: true }));
      const amount = parseEther(buyAmount);
      const allowance = await publicClient.readContract({
        address: contractData.paymentTokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [userAddress, CONTRACT_ADDRESS],
      });

      setCurrentAllowance(allowance);
      setIsApproved(allowance >= amount);
    } catch (error) {
      console.error("Error checking allowance:", error);
      setIsApproved(false);
    } finally {
      setTransactionState((prev) => ({ ...prev, isCheckingAllowance: false }));
    }
  };

  // Check allowance whenever buy amount changes
  useEffect(() => {
    checkAllowance();
  }, [buyAmount, contractData?.paymentTokenAddress, userAddress]);

  useEffect(() => {
    if (buyAmount && contractData && tokenInfo.sale && tokenInfo.payment) {
      console.log("Input state:", {
        buyAmount,
        tokenInfo,
        contractData: {
          currentPrice: formatEther(contractData.currentPrice),
          startPrice: formatEther(contractData.startPrice),
          endPrice: formatEther(contractData.endPrice),
        },
      });

      const result = calculateEstimatedTokens(
        buyAmount,
        contractData,
        tokenInfo
      );
      setEstimatedTokens(result.estimatedTokens);
      setAvgPricePerToken(result.avgPricePerToken);
    }
  }, [buyAmount, contractData, tokenInfo]);

  const handleApprove = async () => {
    if (!buyAmount || !contractData || !userAddress) return;

    try {
      setTransactionState((prev) => ({
        ...prev,
        isApproving: true,
      }));

      const amount = parseEther(buyAmount);

      await approveToken({
        address: contractData.paymentTokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, amount],
      });

      setTransactionState((prev) => ({
        ...prev,
        isApproving: false,
        isWaitingForApproval: true,
      }));

      api.info({
        message: "Approval Pending",
        description: "Please wait while the approval is being processed",
        duration: 5,
      });
    } catch (error) {
      console.error("Approval error:", error);
      api.error({
        message: "Approval Failed",
        description:
          error instanceof Error ? error.message : "Failed to approve tokens",
        duration: 5,
      });
      setTransactionState((prev) => ({
        ...prev,
        isApproving: false,
        isWaitingForApproval: false,
      }));
    }
  };

  // Handle buy action
  const handleBuy = async () => {
    if (!buyAmount || !contractData || !userAddress) return;

    try {
      setTransactionState((prev) => ({
        ...prev,
        isPurchasing: true,
      }));

      await buyTokens({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "buy",
        args: [parseEther(buyAmount)],
      });

      setTransactionState((prev) => ({
        ...prev,
        isPurchasing: false,
        isWaitingForPurchase: true,
      }));

      api.info({
        message: "Purchase Pending",
        description: "Please wait while your purchase is being processed",
        duration: 5,
      });
    } catch (error) {
      console.error("Purchase error:", error);
      api.error({
        message: "Purchase Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to complete purchase",
        duration: 5,
      });
      setTransactionState((prev) => ({
        ...prev,
        isPurchasing: false,
        isWaitingForPurchase: false,
      }));
    }
  };

  // Handle redeem action
  const handleRedeem = (orderIndex: number) => {
    try {
      redeemTokens({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "redeem",
        args: [BigInt(orderIndex)],
      });
    } catch (error) {
      api.error({
        message: "Transaction Failed",
        description: "Failed to execute redeem transaction",
      });
    }
  };

  const getButtonState = () => {
    const {
      isCheckingAllowance,
      isApproving,
      isWaitingForApproval,
      isPurchasing,
      isWaitingForPurchase,
    } = transactionState;

    if (isCheckingAllowance) {
      return {
        text: "Checking Allowance...",
        icon: <LoadingOutlined />,
        disabled: true,
        onClick: () => {},
      };
    }

    if (isApproving || isWaitingForApproval) {
      return {
        text: isApproving ? "Awaiting Approval..." : "Confirming Approval...",
        icon: <LoadingOutlined />,
        disabled: true,
        onClick: () => {},
      };
    }

    if (isPurchasing || isWaitingForPurchase) {
      return {
        text: isPurchasing
          ? "Confirming Purchase..."
          : "Processing Purchase...",
        icon: <LoadingOutlined />,
        disabled: true,
        onClick: () => {},
      };
    }

    if (!isApproved) {
      return {
        text: "Approve",
        icon: <ShoppingCartOutlined />,
        disabled: false,
        onClick: handleApprove,
      };
    }

    return {
      text: "Buy Tokens",
      icon: <ShoppingCartOutlined />,
      disabled: false,
      onClick: handleBuy,
    };
  };

  // Transaction notifications
  useEffect(() => {
    if (buySuccess) {
      api.success({
        message: "Purchase Successful",
        description: "Your token purchase was successful!",
      });
      setBuyAmount("");
    }
  }, [buySuccess]);

  useEffect(() => {
    if (redeemSuccess) {
      api.success({
        message: "Redemption Successful",
        description: "Your tokens have been redeemed!",
      });
    }
  }, [redeemSuccess]);

  if (!isConnected) {
    return (
      <Layout
        style={{ minHeight: "100vh", background: token.colorBgContainer }}
      >
        <Content style={{ padding: "50px 24px" }}>
          <Card style={{ maxWidth: 500, margin: "0 auto" }}>
            <Space
              direction="vertical"
              size="large"
              style={{ width: "100%", textAlign: "center" }}
            >
              <Title level={3}>OtterPad Fundraiser</Title>
              <Text type="secondary">
                Connect your wallet to participate in the fundraiser
              </Text>
              <ConnectButton />
            </Space>
          </Card>
        </Content>
      </Layout>
    );
  }

  if (loading || !tokenInfo.sale || !tokenInfo.payment) {
    return (
      <Card style={{ textAlign: "center", padding: "50px" }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        <div style={{ marginTop: "20px" }}>Loading token information...</div>
      </Card>
    );
  }

  if (isError || !contractData) {
    return (
      <Card>
        <Alert
          message="Error Loading Contract Data"
          description="Failed to fetch contract data. Please try again later."
          type="error"
          showIcon
        />
      </Card>
    );
  }

  const getEscrowInfo = () => {
    if (!contractData || !tokenInfo.payment) return "";

    const escrowAmount = Number(formatEther(contractData.escrowedAmount));
    const escrowPercentage = Number(contractData.escrowRakeBPS) / 100;
    const upfrontPercentage =
      (Number(contractData.upfrontRakeBPS) -
        Number(contractData.OTTERPAD_FEE_BPS)) /
      100;
    const otterpadPercentage = Number(contractData.OTTERPAD_FEE_BPS) / 100;

    return (
      <>
        <label style={{ color: "white" }}>
          The progress bar shows only funds allocated for DEX liquidity.
          Additional amounts:
        </label>
        <ul className="mt-2">
          <li>
            Escrowed: {escrowAmount} {tokenInfo.payment.symbol} (
            {escrowPercentage.toFixed(1)}%)
          </li>
          <li>Upfront to team: {upfrontPercentage.toFixed(1)}%</li>
          <li>OtterPad fee: {otterpadPercentage.toFixed(1)}%</li>
        </ul>
      </>
    );
  };

  const getStatusTag = () => {
    if (!contractData) return null;

    if (contractData.isDeployedToUniswap) {
      return <Tag color="success">Completed</Tag>;
    }
    if (contractData.targetReached) {
      return <Tag color="warning">Target Reached</Tag>;
    }
    return <Tag color="processing">In Progress</Tag>;
  };

  const getLiquidityProgress = () => {
    if (!contractData) return 0;

    // Get current balance excluding escrow and upfront amounts
    const currentBalance = contractData.paymentTokenBalance;
    const escrowAmount =
      (currentBalance * contractData.escrowRakeBPS) / BigInt(10000);
    const upfrontAmount =
      (currentBalance *
        (contractData.upfrontRakeBPS - contractData.OTTERPAD_FEE_BPS)) /
      BigInt(10000);
    const otterpadFee =
      (currentBalance * contractData.OTTERPAD_FEE_BPS) / BigInt(10000);

    // Calculate actual contribution amount (excluding all rakes)
    const actualContribution =
      currentBalance - escrowAmount - upfrontAmount - otterpadFee;

    // Convert BigInt values to numbers for percentage calculation
    const currentNet = Number(actualContribution);
    const targetNet = Number(contractData.targetLiquidity);

    if (targetNet === 0) return 0;

    // Calculate percentage, capped at 100
    const progress = (currentNet / targetNet) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  return (
    <Layout style={{ minHeight: "100vh", background: token.colorBgContainer }}>
      {contextHolder}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "flex-end",
        }}
      >
        <ConnectButton />
      </div>
      <Content style={{ padding: "24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Card>
            {/* Header with Title, Status, and Connect Button */}
            <Row
              justify="space-between"
              align="middle"
              style={{ marginBottom: 24 }}
            >
              <Space size="middle">
                <Title level={2} style={{ margin: 0 }}>
                  OtterPad Fundraiser
                </Title>
                {getStatusTag()}
                <Popover
                  content={`Sale Token Balance: ${formatEther(
                    contractData.saleTokenBalance
                  ).toLocaleString()} ${tokenInfo.sale.symbol}`}
                  trigger="hover"
                >
                  <InfoCircleOutlined />
                </Popover>
              </Space>
            </Row>

            {/* First Row: Price and Progress Bar */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={8}>
                <Card>
                  <div>
                    <Text strong>Current Price</Text>
                    <div className="flex items-baseline gap-2">
                      <Title level={3} className="mb-0">
                        {formatEther(contractData.currentPrice)} PAY
                      </Title>
                      <Text type="secondary">
                        End Price:{" "}
                        {contractData.endPrice
                          ? formatEther(contractData.endPrice)
                          : "0"}{" "}
                        PAY
                      </Text>
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={16}>
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <Text strong>Progress to Liquidity Goal</Text>
                    <Tooltip title={getEscrowInfo()} placement="topRight">
                      <InfoCircleOutlined className="text-gray-400 cursor-help" />
                    </Tooltip>
                  </div>
                  <Progress
                    percent={getLiquidityProgress()}
                    status="active"
                    format={() => formatProgressDisplay()}
                  />
                </Card>
              </Col>
            </Row>

            <Tabs defaultActiveKey="1" type="card">
              <TabPane
                tab={
                  <span>
                    <ShoppingCartOutlined />
                    Buy Tokens
                  </span>
                }
                key="1"
              >
                <Card>
                  <Space
                    direction="vertical"
                    size="large"
                    style={{ width: "100%" }}
                  >
                    {/* Input Section */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Text strong>
                          Amount to Buy ({tokenInfo.payment.symbol})
                        </Text>
                        {!contractData.targetReached && (
                          <Tooltip
                            title={getMaxRemainTooltip()}
                            placement="right"
                          >
                            <Button
                              type="link"
                              size="small"
                              onClick={handleMaxRemainClick}
                              className="text-gray-400 hover:text-blue-500 p-0 h-auto flex items-center gap-1"
                            >
                              max remain
                              <InfoCircleOutlined className="text-xs" />
                            </Button>
                          </Tooltip>
                        )}
                        <Text type="secondary">
                          Min: {formatEther(contractData.minimumPurchase)}{" "}
                          {tokenInfo.payment.symbol} | Balance:{" "}
                          {userPaymentTokenBalance?.formatted ?? "0"}{" "}
                          {tokenInfo.payment.symbol}
                        </Text>
                      </div>

                      <div className="relative">
                        <Input
                          size="large"
                          placeholder="Enter amount"
                          value={buyAmount}
                          onChange={(e) => setBuyAmount(e.target.value)}
                          prefix={<DollarOutlined className="text-gray-400" />}
                          suffix={tokenInfo.payment.symbol}
                          disabled={buyLoading}
                        />

                        {parseFloat(buyAmount) > 0 && (
                          <div className="mt-4 flex justify-between text-gray-500">
                            <div>
                              Total Cost:{" "}
                              <span className="font-medium">
                                {buyAmount} {tokenInfo.payment?.symbol}
                              </span>
                            </div>
                            <div>
                              Estimated Tokens:{" "}
                              <span className="font-medium">
                                {estimatedTokens
                                  ? Number(estimatedTokens).toFixed(6)
                                  : "0"}{" "}
                                {tokenInfo.sale?.symbol}
                              </span>
                            </div>
                            <div className="flex justify-end">
                              <div>
                                Avg Price per Token:{" "}
                                <span className="font-medium">
                                  {avgPricePerToken} {tokenInfo.payment?.symbol}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Warning Messages */}
                    {parseFloat(buyAmount) >
                      parseFloat(userPaymentTokenBalance?.formatted ?? "0") && (
                      <Alert
                        message="Insufficient Balance"
                        description={`You don't have enough ${tokenInfo.payment.symbol} tokens to complete this purchase.`}
                        type="warning"
                        showIcon
                      />
                    )}

                    {parseFloat(buyAmount) > 0 &&
                      parseFloat(buyAmount) <
                        parseFloat(
                          formatEther(contractData.minimumPurchase)
                        ) && (
                        <Alert
                          message="Below Minimum Purchase"
                          description={`The minimum purchase amount is ${formatEther(
                            contractData.minimumPurchase
                          )} ${tokenInfo.payment.symbol}`}
                          type="warning"
                          showIcon
                        />
                      )}

                    {/* Buy Button */}
                    <div>
                      <Button
                        type="primary"
                        size="large"
                        icon={getButtonState().icon}
                        onClick={getButtonState().onClick}
                        disabled={
                          getButtonState().disabled ||
                          !buyAmount ||
                          parseFloat(buyAmount) <
                            parseFloat(
                              formatEther(contractData.minimumPurchase)
                            ) ||
                          parseFloat(buyAmount) >
                            parseFloat(
                              userPaymentTokenBalance?.formatted ?? "0"
                            )
                        }
                        block
                      >
                        {getButtonState().text}
                      </Button>

                      {transactionState.isWaitingForApproval && (
                        <Alert
                          message="Approval In Progress"
                          description="Please wait while your approval transaction is being confirmed..."
                          type="info"
                          showIcon
                          icon={<LoadingOutlined />}
                          style={{ marginTop: "1rem" }}
                        />
                      )}

                      {transactionState.isWaitingForPurchase && (
                        <Alert
                          message="Purchase In Progress"
                          description="Please wait while your purchase transaction is being confirmed..."
                          type="info"
                          showIcon
                          icon={<LoadingOutlined />}
                          style={{ marginTop: "1rem" }}
                        />
                      )}

                      {(isApprovalSuccess || isPurchaseSuccess) && (
                        <Alert
                          message={
                            isApprovalSuccess && !isPurchaseSuccess
                              ? "Approval Successful"
                              : isPurchaseSuccess
                              ? "Purchase Successful"
                              : ""
                          }
                          description={
                            isApprovalSuccess && !isPurchaseSuccess
                              ? "You can now proceed with your purchase"
                              : isPurchaseSuccess
                              ? "Your tokens have been purchased successfully!"
                              : ""
                          }
                          type="success"
                          showIcon
                          icon={<CheckCircleOutlined />}
                          style={{ marginTop: "1rem" }}
                        />
                      )}
                    </div>

                    {/* Disclaimers */}
                    <Text type="secondary" className="text-center block">
                      Make sure you have enough {tokenInfo.payment.symbol}{" "}
                      tokens in your wallet.
                      <br />
                      Transaction will require approval from your wallet.
                    </Text>
                  </Space>
                </Card>
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <UserOutlined />
                    My Orders
                  </span>
                }
                key="2"
              >
                <Card>
                  {/* User-specific stats */}
                  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} sm={12}>
                      <Statistic
                        title="Your Allocation"
                        value={
                          contractData.userAllocation
                            ? formatEther(contractData.userAllocation)
                            : "0"
                        }
                        suffix={tokenInfo.sale.symbol}
                        prefix={<UserOutlined />}
                      />
                    </Col>
                    <Col xs={24} sm={12}>
                      <Statistic
                        title="Your Balance"
                        value={userPaymentTokenBalance?.formatted ?? "0"}
                        suffix={tokenInfo.payment.symbol}
                        prefix={<WalletOutlined />}
                      />
                    </Col>
                  </Row>

                  {contractData.userOrders &&
                  contractData.userOrders.length > 0 ? (
                    <List
                      itemLayout="horizontal"
                      dataSource={contractData.userOrders}
                      renderItem={(orderIndex) => (
                        <List.Item
                          actions={[
                            <Button
                              type="primary"
                              icon={<GiftOutlined />}
                              onClick={() => handleRedeem(Number(orderIndex))}
                              loading={redeemLoading}
                              disabled={!contractData.targetReached}
                              title={
                                !contractData.targetReached
                                  ? "Fundraising goal not reached"
                                  : ""
                              }
                            >
                              Redeem
                            </Button>,
                            <Button
                              type="default"
                              danger
                              icon={<RollbackOutlined />}
                              // onClick={() => handleRefund(Number(orderIndex))}
                              disabled={
                                contractData.targetReached ||
                                contractData.isDeployedToUniswap
                              }
                              title={
                                contractData.targetReached
                                  ? "Fundraising goal reached"
                                  : ""
                              }
                            >
                              Refund
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            avatar={<WalletOutlined style={{ fontSize: 24 }} />}
                            title={`Order #${orderIndex.toString()}`}
                            description={
                              contractData.targetReached
                                ? "Click redeem to claim your tokens"
                                : "You can refund your order until the fundraising goal is reached"
                            }
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Alert
                      message="No Orders Found"
                      description="You haven't made any purchases yet."
                      type="info"
                      showIcon
                    />
                  )}
                </Card>
              </TabPane>
            </Tabs>
          </Card>
        </div>
      </Content>
    </Layout>
  );
};

export default FundraiserViewer;
