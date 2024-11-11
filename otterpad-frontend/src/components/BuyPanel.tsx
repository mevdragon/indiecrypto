import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { OtterPadFund__factory } from "../../../typechain-types";
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
  message,
  Divider,
} from "antd";
import debounce from "lodash/debounce";
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
  ShareAltOutlined,
  CopyOutlined,
  LinkOutlined,
  ExportOutlined,
  QuestionCircleFilled,
} from "@ant-design/icons";
import {
  useAccount,
  useBalance,
  useContractReads,
  useWaitForTransactionReceipt,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { Address, formatUnits, parseUnits } from "viem";
import { Content } from "antd/es/layout/layout";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import TabPane from "antd/es/tabs/TabPane";
import { getPublicClient, waitForTransaction } from "wagmi/actions";
import { CONTRACT_ABI, ContractDataResult } from "../pages/FundPage";
import { useMediaQuery } from "react-responsive";
import { ERC20_ABI, getChainName, SUPPORTED_CHAINS } from "../config";
import { token } from "../typechain-types/@openzeppelin/contracts";
import HowItWorksModal from "./HowItWorks";

const { Title, Text } = Typography;

interface TokenInfo {
  symbol: string;
  decimals: number;
}

interface TokenState {
  sale: TokenInfo | null;
  payment: TokenInfo | null;
}

interface Purchase {
  paymentAmount: bigint;
  contributionAmount: bigint;
  tokenAmount: bigint;
  purchaser: string;
  isRefunded: boolean;
  isRedeemed: boolean;
  purchaseBlock: bigint;
}

type PurchaseResponse = readonly [
  paymentAmount: bigint,
  contributionAmount: bigint,
  tokenAmount: bigint,
  purchaser: `0x${string}`,
  isRefunded: boolean,
  isRedeemed: boolean,
  purchaseBlock: bigint
];

interface RefundState {
  isRefunding: boolean;
  txHash?: `0x${string}`;
  isLoading?: boolean;
  isSuccess?: boolean;
  error?: Error;
}

const BuyPanel = ({
  address,
  chainIdDecimal,
  contractData,
  refetchContractDetails,
}: {
  address: Address;
  chainIdDecimal: string;
  contractData: ContractDataResult | null;
  refetchContractDetails: () => void;
}) => {
  const CONTRACT_ADDRESS = address;
  const isDesktop = useMediaQuery({ minWidth: 1024 });
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenState>({
    sale: { symbol: "", decimals: 0 },
    payment: { symbol: "", decimals: 0 },
  });
  const [buyAmount, setBuyAmount] = useState("");
  const [api, contextHolder] = notification.useNotification();
  const { address: userAddress, isConnected } = useAccount();
  const [estimatedTokens, setEstimatedTokens] = useState<string>("0");
  const publicClient = usePublicClient();
  const chainName = getChainName(chainIdDecimal);

  const [isApproved, setIsApproved] = useState(false);
  const [currentAllowance, setCurrentAllowance] = useState<bigint>(BigInt(0));

  const [viewedTutorial, setViewedTutorial] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const [avgPricePerToken, setAvgPricePerToken] = useState<string>("0");

  const [transactionState, setTransactionState] = useState({
    isCheckingAllowance: false,
    isApproving: false,
    isWaitingForApproval: false,
    isPurchasing: false,
    isWaitingForPurchase: false,
  });

  const [refundTxs, setRefundTxs] = useState<Record<number, `0x${string}`>>({});
  const [isRefundLocking, setIsRefundLocking] = useState(false);

  // Single waitForTransactionReceipt hook that watches the latest refund tx
  const { isLoading: isRefundLoading, isSuccess: isRefundSuccess } =
    useWaitForTransactionReceipt({
      hash: Object.values(refundTxs)[0],
    });

  useEffect(() => {
    if (isRefundSuccess) {
      const orderIndex = Number(Object.keys(refundTxs)[0]);

      // Clear the completed transaction
      setRefundTxs((prev) => {
        const { [orderIndex]: _, ...rest } = prev;
        return rest;
      });

      // Show success message
      api.success({
        message: "Refund Successful",
        description: `Order #${orderIndex} has been refunded successfully!`,
        duration: 5,
      });
      message.success("Refund Successful");
      // Refresh contract details
      refetchContractDetails();
      setRefreshCounter((prev) => prev + 1);
    }
  }, [isRefundSuccess]);

  // Contract operations
  // useEffect(() => {
  //   if (buyAmount && estimatedTokens && parseFloat(estimatedTokens) > 0) {
  //     const avgPrice = parseFloat(buyAmount) / parseFloat(estimatedTokens);
  //     setAvgPricePerToken(avgPrice.toFixed(6));
  //   } else {
  //     setAvgPricePerToken("0");
  //   }
  // }, [buyAmount, estimatedTokens]);

  const [purchaseData, setPurchaseData] = useState<Record<number, Purchase>>(
    {}
  );

  // Add refund contract write hook
  const { writeContract: refundOrder } = useWriteContract();

  // Helper function to convert contract response to Purchase type
  const convertToPurchase = (result: PurchaseResponse): Purchase => {
    const [
      paymentAmount,
      contributionAmount,
      tokenAmount,
      purchaser,
      isRefunded,
      isRedeemed,
      purchaseBlock,
    ] = result;

    return {
      paymentAmount,
      contributionAmount,
      tokenAmount,
      purchaser,
      isRefunded,
      isRedeemed,
      purchaseBlock,
    };
  };

  const getExplorerUrl = () => {
    const chain = SUPPORTED_CHAINS.find(
      (chain) => chain.chainIdDecimal === chainIdDecimal
    );
    return chain?.explorerUrl || "";
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    message.success("Contract address copied to clipboard");
  };

  const handleExplorerLink = () => {
    const explorerUrl = getExplorerUrl();
    if (explorerUrl) {
      window.open(
        `${explorerUrl}/address/${CONTRACT_ADDRESS}#readContract`,
        "_blank"
      );
    }
  };

  // Simplified handle refund function
  const handleRefund = async (orderIndex: number) => {
    if (!contractData || !refundOrder) return;
    try {
      setIsRefundLocking(true);
      refundOrder(
        {
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "refund",
          args: [BigInt(orderIndex)],
        },
        {
          onSuccess: (txHash) => {
            setRefundTxs((prev) => ({
              ...prev,
              [orderIndex]: txHash,
            }));

            api.info({
              message: "Refund Initiated",
              description: "Please wait while your refund is being processed",
              duration: 5,
            });
            setIsRefundLocking(false);
          },
          onError: (error) => {
            console.error("Refund error:", error);
            api.error({
              message: "Refund Failed",
              description:
                error instanceof Error
                  ? error.message
                  : "Failed to process refund",
              duration: 5,
            });
            setIsRefundLocking(false);
          },
        }
      );
    } catch (error) {
      console.error("Refund error:", error);
      api.error({
        message: "Refund Failed",
        description:
          error instanceof Error ? error.message : "Failed to process refund",
        duration: 5,
      });
    }
  };

  function calculateRemainingAmount() {
    if (!contractData) return "0";

    // Calculate the total required gross amount first
    const netContributionBPS =
      BigInt(100_000_000) -
      BigInt(contractData.upfrontRakeBPS || 0n) -
      BigInt(contractData.escrowRakeBPS || 0n);
    const totalGrossRequired =
      (BigInt(contractData.targetLiquidity || 0n) * BigInt(100_000_000)) /
      netContributionBPS;

    // Then subtract current contributions adjusted for gross amount
    const currentGross =
      (BigInt(contractData.totalActiveContributions || 0n) *
        BigInt(100_000_000)) /
      netContributionBPS;
    const remainingGross = totalGrossRequired - currentGross;

    if (remainingGross <= BigInt(0)) return "0";

    return formatUnits(remainingGross - 1n, contractData.paymentTokenDecimals);
  }

  const handleMaxRemainClick = () => {
    const remainingAmount = calculateRemainingAmount();
    setBuyAmount(remainingAmount);
    // Trigger calculations for estimated tokens and avg price
    calculateEstimatedTokens(remainingAmount, contractData);
  };

  // Helper function to format BPS values to percentage
  const formatBPStoPercentage = (bps: bigint) => {
    return (Number(bps) / 1000000).toFixed(2);
  };

  // Add tooltip content for max remain explanation
  const getMaxRemainTooltip = () => {
    if (!contractData) return "";

    const remainingAmount = calculateRemainingAmount();
    const netContributionBPS =
      BigInt(100_000_000) -
      BigInt(contractData.upfrontRakeBPS || 0n) -
      BigInt(contractData.escrowRakeBPS || 0n);

    return (
      <div className="space-y-2">
        <p>This amount accounts for all fees:</p>
        <ul className="list-disc pl-4">
          <li>
            OtterPad Fee:{" "}
            {formatBPStoPercentage(contractData.OTTERPAD_FEE_BPS || 0n)}%
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

  const {
    writeContract: approveToken,
    data: approvalHash,
    error: prepareApproveError,
  } = useWriteContract();
  const {
    writeContract: buyTokens,
    data: buyTxHash,
    error: prepareBuyError,
  } = useWriteContract();
  const {
    writeContract: redeemTokens,
    data: redeemTxHash,
    isPending: loadingRedeem,
    isSuccess: redeemSuccessful,
  } = useWriteContract();

  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (redeemSuccessful) {
      message.success("Redeem Successful");
      setRefreshCounter((prev) => prev + 1);
    }
  }, [redeemSuccessful]);

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
      // setBuyAmount("");
      api.success({
        message: "Purchase Successful",
        description: "Your token purchase was successful!",
      });
      message.success("Purchase Successful");
      refetchContractDetails();
    }
  }, [isApprovalSuccess, isPurchaseSuccess]);

  useEffect(() => {
    const fetchPurchaseData = async () => {
      if (
        !contractData?.userOrders ||
        contractData.userOrders.length === 0 ||
        !publicClient
      )
        return;

      try {
        const purchases: Record<number, Purchase> = {};

        const results = await Promise.all(
          contractData.userOrders.map(
            (orderIndex) =>
              publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: "purchases",
                args: [BigInt(orderIndex)],
              }) as Promise<PurchaseResponse>
          )
        );

        results.forEach((result, i) => {
          if (result && contractData.userOrders) {
            purchases[Number(contractData.userOrders[i])] =
              convertToPurchase(result);
          }
        });
        console.log("purchases", purchases);
        setPurchaseData(purchases);
      } catch (error) {
        console.error("Error fetching purchase data:", error);
        api.error({
          message: "Failed to fetch purchase data",
          description: "Please try refreshing the page",
        });
      }
    };

    fetchPurchaseData();
  }, [contractData?.userOrders, refreshCounter]);

  const calculateEstimatedTokens = async (
    paymentAmount: string,
    contractData: ContractDataResult | null
  ) => {
    if (
      !publicClient ||
      !contractData ||
      !paymentAmount ||
      isNaN(Number(paymentAmount))
    ) {
      return { estimatedTokens: "0", avgPricePerToken: "0" };
    }

    try {
      // Convert payment amount to BigInt with proper decimals
      const paymentAmountBigInt = parseUnits(
        paymentAmount,
        contractData.paymentTokenDecimals
      );

      // Call contract's calculateTokensReceived function
      const tokensReceived = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "calculateTokensReceived",
        args: [paymentAmountBigInt],
      });

      // Format the received tokens
      const formattedTokens = formatUnits(
        tokensReceived || 0n,
        contractData.saleTokenDecimals
      );

      // Calculate average price per token
      // avgPrice = paymentAmount / tokensReceived
      console.log(`paymentAmountBigInt: ${paymentAmountBigInt}`);
      console.log(`tokensReceived: ${tokensReceived}`);

      const avgPrice =
        tokensReceived > 0n
          ? (paymentAmountBigInt *
              BigInt(10 ** contractData.saleTokenDecimals)) /
            tokensReceived
          : 0n;

      return {
        estimatedTokens: formattedTokens,
        avgPricePerToken: formatUnits(
          avgPrice || 0n,
          contractData.paymentTokenDecimals
        ),
      };
    } catch (error) {
      console.error("Error calculating estimated tokens:", error);
      return { estimatedTokens: "0", avgPricePerToken: "0" };
    }
  };

  const debouncedCheckAllowance = useMemo(
    () =>
      debounce(async (amount: string) => {
        if (!contractData || !userAddress || !publicClient || !amount) return;

        try {
          setTransactionState((prev) => ({
            ...prev,
            isCheckingAllowance: true,
          }));
          const amountBigInt = parseUnits(
            amount,
            contractData.paymentTokenDecimals
          );
          const allowance = await publicClient.readContract({
            address: contractData.paymentTokenAddress,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [userAddress, CONTRACT_ADDRESS],
          });

          setCurrentAllowance(allowance);
          setIsApproved(allowance >= amountBigInt);
        } catch (error) {
          console.error("Error checking allowance:", error);
          setIsApproved(false);
        } finally {
          setTransactionState((prev) => ({
            ...prev,
            isCheckingAllowance: false,
          }));
        }
      }, 1000),
    [contractData?.paymentTokenAddress, userAddress, publicClient]
  );

  const debouncedCalculateEstimatedTokens = useMemo(
    () =>
      debounce(async (amount: string) => {
        if (amount && contractData && tokenInfo.sale && tokenInfo.payment) {
          const result = await calculateEstimatedTokens(amount, contractData);
          setEstimatedTokens(result.estimatedTokens);
          setAvgPricePerToken(result.avgPricePerToken);
        }
      }, 500),
    [contractData, tokenInfo]
  );

  // Update handlers to use debounced functions
  useEffect(() => {
    if (buyAmount) {
      debouncedCheckAllowance(buyAmount);
      debouncedCalculateEstimatedTokens(buyAmount);
    } else {
      setEstimatedTokens("0");
      setAvgPricePerToken("0");
      setIsApproved(false);
    }

    // Cleanup
    return () => {
      debouncedCheckAllowance.cancel();
      debouncedCalculateEstimatedTokens.cancel();
    };
  }, [buyAmount]);

  // Remove the old separate useEffects for checkAllowance and calculateEstimatedTokens
  // since they're now handled in the combined useEffect above

  // Handler for input changes
  const handleBuyAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Optional: Add immediate validation if needed
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setBuyAmount(value);
    }
  };

  // Get user's payment token balance
  const { data: userPaymentTokenBalance } = useBalance({
    address: userAddress,
    token: contractData?.paymentTokenAddress,
    query: {
      refetchInterval: 30000, // Refresh every 30 seconds
      enabled: isConnected,
    },
  });

  const { isLoading: redeemLoading, isSuccess: redeemSuccess } =
    useWaitForTransactionReceipt({
      hash: redeemTxHash,
    });

  const provider = useMemo(() => {
    return new ethers.JsonRpcProvider(
      "https://sepolia.infura.io/v3/2d52e9fd20f643629739fc0513d6e0b3"
    );
  }, []);

  useEffect(() => {
    if (!contractData) return;

    setTokenInfo({
      sale: {
        symbol: contractData.saleTokenSymbol,
        decimals: contractData.saleTokenDecimals,
      },
      payment: {
        symbol: contractData.paymentTokenSymbol,
        decimals: contractData.paymentTokenDecimals,
      },
    });
    setLoading(false);
  }, [contractData]);

  // Fetch token information
  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!contractData?.saleTokenAddress || !contractData?.paymentTokenAddress)
        return;

      const erc20Abi = [
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
      ];

      try {
        // const saleTokenContract = new ethers.Contract(
        //   contractData.saleTokenAddress,
        //   erc20Abi,
        //   provider
        // );
        // const paymentTokenContract = new ethers.Contract(
        //   contractData.paymentTokenAddress,
        //   erc20Abi,
        //   provider
        // );

        // const [
        //   // saleSymbol,
        //   // saleDecimals,
        //   // paymentSymbol,
        //   // paymentDecimals,
        // ] = await Promise.all([
        //   // saleTokenContract.symbol(),
        //   // saleTokenContract.decimals(),
        //   // paymentTokenContract.symbol(),
        //   // paymentTokenContract.decimals(),
        // ]);

        setTokenInfo({
          sale: {
            symbol: contractData.saleTokenSymbol,
            decimals: contractData.saleTokenDecimals,
          },
          payment: {
            symbol: contractData.paymentTokenSymbol,
            decimals: contractData.paymentTokenDecimals,
          },
          // sale: { symbol: saleSymbol, decimals: saleDecimals },
          // payment: { symbol: paymentSymbol, decimals: paymentDecimals },
        });
        setLoading(false);
      } catch (error) {
        console.error("Error fetching token info:", error);
        setLoading(false);
      }
    };

    fetchTokenInfo();
  }, [
    contractData?.saleTokenAddress,
    contractData?.paymentTokenAddress,
    provider,
  ]);

  const checkAllowance = async () => {
    if (!contractData || !userAddress || !publicClient || !buyAmount) return;

    try {
      setTransactionState((prev) => ({ ...prev, isCheckingAllowance: true }));
      const amount = parseUnits(buyAmount, contractData.paymentTokenDecimals);
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

  // Update handle approve function
  const handleApprove = async () => {
    if (!buyAmount || !contractData || !userAddress || !approveToken) return;

    try {
      setTransactionState((prev) => ({
        ...prev,
        isApproving: true,
      }));

      approveToken({
        address: contractData.paymentTokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [
          CONTRACT_ADDRESS,
          parseUnits(buyAmount, contractData.paymentTokenDecimals),
        ],
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

  // Update handle buy function
  const handleBuy = async () => {
    if (!buyAmount || !contractData || !userAddress || !buyTokens) return;

    try {
      setTransactionState((prev) => ({
        ...prev,
        isPurchasing: true,
      }));

      buyTokens({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "buy",
        args: [parseUnits(buyAmount, contractData.paymentTokenDecimals)],
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

  // Fetch purchase data for user orders
  useEffect(() => {
    const fetchPurchaseData = async () => {
      if (
        !contractData?.userOrders ||
        contractData.userOrders.length === 0 ||
        !publicClient
      )
        return;

      try {
        const purchases: Record<number, Purchase> = {};

        const results = await Promise.all(
          contractData.userOrders.map(
            (orderIndex) =>
              publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: "purchases",
                args: [BigInt(orderIndex)],
              }) as Promise<PurchaseResponse>
          )
        );

        results.forEach((result, i) => {
          if (result && contractData.userOrders) {
            purchases[Number(contractData.userOrders[i])] =
              convertToPurchase(result);
          }
        });

        setPurchaseData(purchases);
      } catch (error) {
        console.error("Error fetching purchase data:", error);
        api.error({
          message: "Failed to fetch purchase data",
          description: "Please try refreshing the page",
        });
      }
    };

    fetchPurchaseData();
  }, [contractData?.userOrders]);

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

    if (!viewedTutorial) {
      return {
        text: "Get Started | How It Works",
        icon: null,
        disabled: false,
        onClick: () => setHelpModalOpen(true),
      };
    }

    if (isCheckingAllowance) {
      return {
        text: "Checking Allowance...",
        icon: <LoadingOutlined style={{ marginRight: "5px" }} />,
        disabled: true,
        onClick: () => {},
      };
    }

    if (isApproving || isWaitingForApproval) {
      return {
        text: isApproving ? "Awaiting Approval..." : "Confirming Approval...",
        icon: <LoadingOutlined style={{ marginRight: "5px" }} />,
        disabled: true,
        onClick: () => {},
      };
    }

    if (isPurchasing || isWaitingForPurchase) {
      return {
        text: isPurchasing
          ? "Confirming Purchase..."
          : "Processing Purchase...",
        icon: <LoadingOutlined style={{ marginRight: "5px" }} />,
        disabled: true,
        onClick: () => {},
      };
    }

    if (!isApproved) {
      return {
        text: "Approve",
        icon: <ShoppingCartOutlined style={{ marginRight: "5px" }} />,
        disabled: false,
        onClick: handleApprove,
      };
    }

    return {
      text: "Buy Tokens",
      icon: <ShoppingCartOutlined style={{ marginRight: "5px" }} />,
      disabled: false,
      onClick: handleBuy,
    };
  };

  // Add error handling for prepare hooks
  useEffect(() => {
    if (prepareApproveError) {
      console.error("Prepare approve error:", prepareApproveError);
      api.error({
        message: "Approval Preparation Failed",
        description: prepareApproveError.message,
      });
    }
    if (prepareBuyError) {
      console.error("Prepare buy error:", prepareBuyError);
      api.error({
        message: "Purchase Preparation Failed",
        description: prepareBuyError.message,
      });
      message.error(`Purchase Failed: ${prepareBuyError.message}`);
    }
  }, [prepareApproveError, prepareBuyError]);

  useEffect(() => {
    if (redeemSuccess) {
      api.success({
        message: "Redemption Successful",
        description: "Your tokens have been redeemed!",
      });
    }
  }, [redeemSuccess]);

  if (loading || !tokenInfo.sale || !tokenInfo.payment) {
    return (
      <Card
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          minWidth: "550px",
          maxWidth: "550px",
          padding: "50px",
          height: "80vh",
        }}
      >
        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        <div style={{ marginTop: "20px" }}>
          Loading fundraiser information...
        </div>
      </Card>
    );
  }

  if (!contractData) {
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

    const totalPayments = Number(
      formatUnits(
        contractData.totalPaymentsIn || 0n,
        contractData.paymentTokenDecimals
      )
    );
    const netActive = Number(
      formatUnits(
        contractData.totalActiveContributions || 0n,
        contractData.paymentTokenDecimals
      )
    );

    const escrowRate = Number(contractData.escrowRakeBPS) / 100_000_000;
    const upfrontRate = Number(contractData.upfrontRakeBPS) / 100_000_000;
    const activePayment = netActive / (1 - escrowRate - upfrontRate);

    const escrowAmount = activePayment * escrowRate;
    const upfrontAmount = Number(
      formatUnits(
        (BigInt(contractData.totalPaymentsIn || 0n) *
          BigInt(contractData.upfrontRakeBPS || 0n)) /
          BigInt(100_000_000) || 0n,
        contractData.paymentTokenDecimals
      )
    );
    const refundedAmount =
      totalPayments - netActive - upfrontAmount - escrowAmount;
    const towardsLiquidityAmount = netActive;

    // Calculate percentages
    // Escrow is % of active payment
    const escrowPercentage =
      activePayment > 0 ? (escrowAmount / activePayment) * 100 : 0;

    // Upfront is % of historical total
    const upfrontPercentage =
      totalPayments > 0 ? (upfrontAmount / totalPayments) * 100 : 0;

    // Towards liquidity is % of active payment - use same base as escrow
    const towardsLiquidityPercentage =
      activePayment > 0 ? (towardsLiquidityAmount / activePayment) * 100 : 0;

    // Refunded is % of historical total
    const refundedPercentage =
      totalPayments > 0 ? (refundedAmount / totalPayments) * 100 : 0;

    return (
      <>
        <label style={{ color: "white" }}>
          The progress bar shows funds allocated for DEX liquidity. Breakdown of
          all payments:
        </label>
        <ul className="mt-2">
          <li>
            Team Escrow: {escrowAmount.toFixed(2)} {tokenInfo.payment.symbol} (
            {escrowPercentage.toFixed(1)}% of active)
          </li>
          <li>
            Team Upfront: {upfrontAmount.toFixed(2)} {tokenInfo.payment.symbol}{" "}
            ({upfrontPercentage.toFixed(1)}% of historical)
          </li>
          <li className="mt-2 text-yellow-500">
            Refunded Amount: {refundedAmount.toFixed(2)}{" "}
            {tokenInfo.payment.symbol} ({refundedPercentage.toFixed(1)}% of
            historical)
          </li>
          <li>
            Towards Liquidity: {towardsLiquidityAmount.toFixed(2)}{" "}
            {tokenInfo.payment.symbol} ({towardsLiquidityPercentage.toFixed(1)}%
            of active)
          </li>
          <li>
            Total Historical: {totalPayments.toFixed(2)}{" "}
            {tokenInfo.payment.symbol}
          </li>
        </ul>
      </>
    );
  };

  const getContractBalanceInfo = () => {
    if (!isConnected || !contractData || !tokenInfo.sale || !tokenInfo.payment)
      return "";

    const totalPaymentRequired =
      (contractData.targetLiquidity * BigInt(100_000_000)) /
      (BigInt(100_000_000) -
        contractData.upfrontRakeBPS -
        contractData.escrowRakeBPS);
    const totalPayTokenRequired =
      totalPaymentRequired -
      (totalPaymentRequired * contractData.upfrontRakeBPS) /
        BigInt(100_000_000);

    return (
      <div className="space-y-2">
        <p>Current token balances in the smart contract:</p>
        <ul className="list-disc pl-4">
          <li>
            {parseFloat(
              formatUnits(
                contractData.saleTokenBalance || 0n,
                contractData.saleTokenDecimals
              )
            ).toFixed(2)}
            /
            {parseFloat(
              formatUnits(
                contractData.requiredSaleTokens || 0n,
                contractData.saleTokenDecimals
              )
            ).toFixed(2)}{" "}
            {tokenInfo.sale.symbol}
          </li>
          <li>
            {parseFloat(
              formatUnits(
                contractData.paymentTokenBalance || 0n,
                contractData.paymentTokenDecimals
              )
            ).toFixed(2)}
            /
            {parseFloat(
              formatUnits(
                totalPayTokenRequired || 0n,
                contractData.paymentTokenDecimals
              )
            ).toFixed(2)}{" "}
            {tokenInfo.payment.symbol}
          </li>
        </ul>
        <p className="text-sm text-gray-400 mt-2">
          These are the raw balances of tokens currently held by the smart
          contract. The payment token balance includes both liquidity and
          escrowed amounts.
        </p>
      </div>
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

    // totalActiveContributions is already net of all fees and ready for liquidity
    const liquidityContribution = contractData.totalActiveContributions;

    // Convert BigInt values to numbers for percentage calculation
    const currentNet = Number(
      formatUnits(
        liquidityContribution || 0n,
        contractData.paymentTokenDecimals
      )
    );
    const targetNet = Number(
      formatUnits(
        contractData.targetLiquidity || 0n,
        contractData.paymentTokenDecimals
      )
    );

    if (targetNet === 0) return 0;

    // Calculate percentage, capped at 100
    const progress = (currentNet / targetNet) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const formatProgressDisplay = () => {
    if (!contractData || !tokenInfo.payment) return "";

    // totalActiveContributions is already the amount for liquidity
    return `${parseFloat(
      formatUnits(
        contractData.totalActiveContributions || 0n,
        contractData.paymentTokenDecimals
      )
    ).toFixed(0)} / ${parseFloat(
      formatUnits(
        contractData.targetLiquidity || 0n,
        contractData.paymentTokenDecimals
      )
    ).toFixed(0)} ${tokenInfo.payment?.symbol}`;
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    message.success("URL copied to clipboard!");
  };

  return (
    <div
      style={{
        width: "100%",
        minWidth: isDesktop ? "550px" : "100%",
        maxWidth: isDesktop ? "550px" : "100%",
        position: "relative",
      }}
    >
      <Content
        style={{
          width: "100%",
        }}
      >
        <Card
          style={{
            width: "100%",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            minHeight: "80vh",
          }}
        >
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {/* Header with fixed width */}
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column-reverse",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Tag color="processing">{chainName}</Tag>
                {getStatusTag()}
                <Input
                  value={CONTRACT_ADDRESS}
                  readOnly
                  size="small"
                  style={{ width: "200px", marginRight: "5px" }}
                  suffix={
                    <>
                      <CopyOutlined
                        className="cursor-pointer mx-1"
                        onClick={handleCopy}
                      />
                      <ExportOutlined
                        className="cursor-pointer mx-1"
                        onClick={handleExplorerLink}
                      />
                    </>
                  }
                />
                <Button
                  size="small"
                  icon={<ShareAltOutlined />}
                  onClick={handleShare}
                >
                  Share
                </Button>
              </div>
              <Divider />
              <Title
                level={2}
                style={{
                  margin: "10px 0px 20px 0px",
                }}
              >
                {contractData.title}
                <Tooltip title={getContractBalanceInfo()}>
                  <InfoCircleOutlined
                    style={{
                      color: "#1890ff",
                      fontSize: "1rem",
                      marginLeft: 8,
                    }}
                  />
                </Tooltip>
              </Title>
            </div>

            {/* Price and Progress Cards */}
            <Row gutter={[16, 16]} style={{ width: "100%", margin: 0 }}>
              <Col xs={24} md={8} style={{ width: "100%" }}>
                <Card
                  style={{ height: "100%", width: "100%", textAlign: "left" }}
                >
                  <Text strong>Current Price</Text>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "8px",
                      marginTop: "8px",
                      width: "100%",
                      flexDirection: "column",
                    }}
                  >
                    <Title
                      level={4}
                      style={{ margin: 0, whiteSpace: "nowrap" }}
                    >
                      {parseFloat(
                        formatUnits(
                          contractData.currentPrice || 0n,
                          contractData.paymentTokenDecimals
                        )
                      ).toFixed(4)}{" "}
                      <span style={{ fontSize: "0.9rem" }}>
                        {tokenInfo.payment?.symbol}
                      </span>
                    </Title>
                    <Text type="secondary" style={{ whiteSpace: "nowrap" }}>
                      End:{" "}
                      {formatUnits(
                        contractData.endPrice || 0n,
                        contractData.paymentTokenDecimals
                      )}{" "}
                      {tokenInfo.payment?.symbol}
                    </Text>
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={16} style={{ width: "100%" }}>
                <Card style={{ height: "100%", width: "100%" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "16px",
                      width: "100%",
                      textAlign: "left",
                    }}
                  >
                    <Text strong style={{ flex: "1" }}>
                      {`${getLiquidityProgress().toFixed(
                        2
                      )}% Progress to Liquidity Goal`}
                    </Text>
                    <Tooltip title={getEscrowInfo()}>
                      <InfoCircleOutlined
                        style={{
                          color: "#8c8c8c",
                          cursor: "help",
                          flexShrink: 0,
                        }}
                      />
                    </Tooltip>
                  </div>
                  <Progress
                    percent={getLiquidityProgress()}
                    status="active"
                    format={() => formatProgressDisplay()}
                    style={{ marginBottom: 0 }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Tabs Container */}
            <Tabs
              defaultActiveKey="1"
              style={{
                width: "100%",
                background: "white",
                borderRadius: "8px",
              }}
            >
              {/* Buy Tokens Tab */}
              <TabPane
                tab={
                  <span>
                    <ShoppingCartOutlined style={{ marginRight: "5px" }} />
                    Buy Tokens
                  </span>
                }
                key="1"
              >
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                  }}
                >
                  <div style={{ width: "100%" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                        width: "100%",
                      }}
                    >
                      <Text strong>
                        Amount to Buy ({tokenInfo.payment?.symbol})
                        <Tooltip title={getMaxRemainTooltip()}>
                          <Button
                            type="link"
                            size="small"
                            onClick={handleMaxRemainClick}
                            className="whitespace-nowrap bg-blue-500 hover:bg-blue-600 text-white"
                          >
                            Max Remain
                          </Button>
                        </Tooltip>
                      </Text>
                      <Text type="secondary" style={{ whiteSpace: "nowrap" }}>
                        {isConnected ? (
                          <div>
                            Balance: {userPaymentTokenBalance?.formatted ?? "0"}{" "}
                            {tokenInfo.payment?.symbol}
                          </div>
                        ) : (
                          "Connect Wallet to Buy Tokens"
                        )}
                      </Text>
                    </div>

                    <div className="flex gap-2 w-full">
                      <Input
                        size="large"
                        placeholder="Enter amount"
                        value={buyAmount}
                        onChange={handleBuyAmountChange}
                        prefix={<DollarOutlined className="text-gray-500" />}
                        suffix={tokenInfo.payment?.symbol}
                        className="flex-1"
                      />
                    </div>

                    {parseFloat(buyAmount) > 0 && (
                      <Row
                        gutter={[16, 16]}
                        style={{
                          marginTop: "16px",
                          width: "100%",
                        }}
                      >
                        <Col xs={24} md={8}>
                          <div style={{ width: "100%" }}>
                            <Statistic
                              title="Total Cost"
                              value={buyAmount}
                              suffix={
                                <span style={{ fontSize: "0.9rem" }}>
                                  {tokenInfo.payment?.symbol}
                                </span>
                              }
                            />
                          </div>
                        </Col>
                        <Col xs={24} md={8}>
                          <div style={{ width: "100%" }}>
                            <Statistic
                              title="Estimated Tokens"
                              value={Number(estimatedTokens).toFixed(3)}
                              suffix={
                                <span style={{ fontSize: "0.9rem" }}>
                                  {tokenInfo.sale?.symbol}
                                </span>
                              }
                            />
                          </div>
                        </Col>
                        <Col xs={24} md={8}>
                          <div style={{ width: "100%" }}>
                            <Statistic
                              title="Avg Price per Token"
                              value={Number(avgPricePerToken).toFixed(4)}
                              suffix={
                                <span style={{ fontSize: "0.9rem" }}>
                                  {tokenInfo.payment?.symbol}
                                </span>
                              }
                            />
                          </div>
                        </Col>
                      </Row>
                    )}
                  </div>

                  <Button
                    type="primary"
                    size="large"
                    icon={getButtonState().icon}
                    onClick={getButtonState().onClick}
                    disabled={
                      viewedTutorial &&
                      (getButtonState().disabled || !isConnected)
                    }
                    style={{ width: "100%", height: "48px", cursor: "pointer" }}
                  >
                    <label style={{ marginLeft: 10 }}>
                      {getButtonState().text}
                    </label>
                  </Button>

                  <Text
                    type="secondary"
                    style={{
                      textAlign: "center",
                      width: "100%",
                    }}
                  >
                    Make sure you have enough {tokenInfo.payment?.symbol} tokens
                    in your wallet. Transaction will require approval from your
                    wallet.{" "}
                    <span
                      onClick={() => setHelpModalOpen(true)}
                      style={{ color: "rgb(22, 119, 255)", cursor: "pointer" }}
                    >
                      How It Works
                    </span>
                  </Text>
                </div>
              </TabPane>

              {/* My Orders Tab */}
              <TabPane
                tab={
                  <span>
                    <UserOutlined style={{ marginRight: "5px" }} />
                    My Orders
                  </span>
                }
                key="2"
              >
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                    overflowY: "scroll",
                    height: "40vh",
                  }}
                >
                  <Row gutter={[16, 16]} style={{ width: "100%", margin: 0 }}>
                    <Card style={{ width: "100%" }}>
                      <Statistic
                        title="Your Allocation"
                        value={
                          contractData.userAllocation
                            ? parseFloat(
                                formatUnits(
                                  contractData.userAllocation || 0n,
                                  contractData.saleTokenDecimals
                                )
                              ).toFixed(3)
                            : "0"
                        }
                        suffix={tokenInfo.sale?.symbol}
                        prefix={<UserOutlined />}
                      />
                    </Card>
                  </Row>

                  <List
                    style={{ width: "100%" }}
                    itemLayout="horizontal"
                    dataSource={contractData.userOrders || []}
                    renderItem={(orderIndex) => {
                      const purchase = purchaseData[Number(orderIndex)];
                      if (!purchase) return null;
                      const isRefunding = Number(orderIndex) in refundTxs;
                      return (
                        <Card
                          style={{
                            width: "100%",
                            marginBottom: "16px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              width: "100%",
                              gap: "16px",
                            }}
                          >
                            <div
                              style={{
                                flex: "1",
                                minWidth: 0,
                              }}
                            >
                              <Title
                                level={5}
                                style={{
                                  margin: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Bought{" "}
                                {parseFloat(
                                  formatUnits(
                                    purchase.tokenAmount || 0n,
                                    contractData.saleTokenDecimals
                                  )
                                ).toFixed(2)}{" "}
                                {tokenInfo.sale?.symbol}
                              </Title>
                              <Text
                                type="secondary"
                                style={{
                                  display: "block",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                for{" "}
                                {formatUnits(
                                  purchase.paymentAmount || 0n,
                                  contractData.paymentTokenDecimals
                                )}{" "}
                                {tokenInfo.payment?.symbol}
                              </Text>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexShrink: 0,
                              }}
                            >
                              <Button
                                type="primary"
                                icon={<GiftOutlined />}
                                onClick={() => handleRedeem(Number(orderIndex))}
                                loading={loadingRedeem}
                                disabled={
                                  !contractData.targetReached ||
                                  !contractData.isDeployedToUniswap ||
                                  purchase.isRedeemed
                                }
                              >
                                Redeem
                              </Button>
                              <Button
                                type="default"
                                danger
                                icon={<RollbackOutlined />}
                                onClick={() => handleRefund(Number(orderIndex))}
                                loading={
                                  isRefunding ||
                                  isRefundLoading ||
                                  isRefundLocking
                                }
                                disabled={
                                  contractData.isDeployedToUniswap ||
                                  purchase.isRefunded ||
                                  isRefunding
                                }
                              >
                                Refund
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    }}
                  />
                </div>
              </TabPane>
            </Tabs>
          </div>
        </Card>
      </Content>
      <HowItWorksModal
        isOpen={helpModalOpen}
        toggleModal={(bool: boolean) => {
          setHelpModalOpen(bool);
          setViewedTutorial(true);
        }}
      />
    </div>
  );
};

export default BuyPanel;
