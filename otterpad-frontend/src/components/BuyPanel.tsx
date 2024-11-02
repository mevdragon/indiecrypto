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
import { CONTRACT_ABI, ContractDataResult, ERC20_ABI } from "../pages/FundPage";
import { useMediaQuery } from "react-responsive";

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
}

const BuyPanel = ({
  address,
  contractData,
}: {
  address: Address;
  contractData: ContractDataResult | null;
}) => {
  const CONTRACT_ADDRESS = address;
  const isDesktop = useMediaQuery({ minWidth: 1024 });
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenState>({
    sale: null,
    payment: null,
  });
  const [buyAmount, setBuyAmount] = useState("");
  const [api, contextHolder] = notification.useNotification();
  const { address: userAddress, isConnected } = useAccount();
  const [estimatedTokens, setEstimatedTokens] = useState<string>("0");
  const publicClient = usePublicClient();

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

  // Replace single refund state with a map
  const [refundStates, setRefundStates] = useState<Record<number, RefundState>>(
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

  // Helper function to format token amounts
  const formatTokenAmount = (
    amount: bigint | undefined,
    symbol: string | undefined
  ): string => {
    if (!amount || !symbol) return "0";
    return `${Number(formatEther(amount)).toFixed(6)} ${symbol}`;
  };

  // Helper function to calculate average price for a purchase
  const calculateAveragePriceForPurchase = (purchase: Purchase | undefined) => {
    if (!purchase || !tokenInfo.payment || !tokenInfo.sale) return "0";

    const paymentAmount = Number(formatEther(purchase.paymentAmount));
    const tokenAmount = Number(formatEther(purchase.tokenAmount));

    if (tokenAmount === 0) return "0";

    return (paymentAmount / tokenAmount).toFixed(6);
  };

  // Handle refund action with order-specific state
  const handleRefund = async (orderIndex: number) => {
    if (!contractData || !refundOrder) return;

    try {
      // Update state for specific order
      setRefundStates((prev) => ({
        ...prev,
        [orderIndex]: { isRefunding: true },
      }));

      refundOrder(
        {
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "refund",
          args: [BigInt(orderIndex)],
        },
        {
          onSuccess: (txHash) => {
            // Store transaction hash in state
            setRefundStates((prev) => ({
              ...prev,
              [orderIndex]: { isRefunding: true, txHash },
            }));

            api.info({
              message: "Refund Initiated",
              description: "Please wait while your refund is being processed",
              duration: 5,
            });
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

            // Clear refund state for this order
            setRefundStates((prev) => {
              const newState = { ...prev };
              delete newState[orderIndex];
              return newState;
            });
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

      // Clear refund state for this order
      setRefundStates((prev) => {
        const newState = { ...prev };
        delete newState[orderIndex];
        return newState;
      });
    }
  };

  const monitorRefundTransaction = (
    orderIndex: number,
    hash: `0x${string}`
  ) => {
    const { isLoading, isSuccess } = useWaitForTransactionReceipt({
      hash,
    });

    useEffect(() => {
      if (!isLoading && isSuccess) {
        // Clear refund state on success
        setRefundStates((prev) => {
          const newState = { ...prev };
          delete newState[orderIndex];
          return newState;
        });

        api.success({
          message: "Refund Successful",
          description: `Order #${orderIndex} has been refunded successfully!`,
        });
      }
    }, [isLoading, isSuccess, orderIndex]);

    return { isLoading, isSuccess };
  };

  const RefundMonitor = ({
    orderIndex,
    hash,
  }: {
    orderIndex: number;
    hash: `0x${string}`;
  }) => {
    const { isLoading, isSuccess } = monitorRefundTransaction(orderIndex, hash);
    console.log(`isLoading=${isLoading}, isSuccess=${isSuccess}`);
    return null; // This is just for monitoring, no UI needed
  };

  const RefundTransactionMonitors = () => {
    return (
      <>
        {Object.entries(refundStates).map(([orderIndex, state]) =>
          state.txHash ? (
            <RefundMonitor
              key={orderIndex}
              orderIndex={Number(orderIndex)}
              hash={state.txHash}
            />
          ) : null
        )}
      </>
    );
  };

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
      setBuyAmount("");
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

  const debouncedCheckAllowance = useMemo(
    () =>
      debounce(async (amount: string) => {
        if (!contractData || !userAddress || !publicClient || !amount) return;

        try {
          setTransactionState((prev) => ({
            ...prev,
            isCheckingAllowance: true,
          }));
          const amountBigInt = parseEther(amount);
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
      debounce((amount: string) => {
        if (amount && contractData && tokenInfo.sale && tokenInfo.payment) {
          const result = calculateEstimatedTokens(
            amount,
            contractData,
            tokenInfo
          );
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

  // useEffect(() => {
  //   if (buyAmount && contractData && tokenInfo.sale && tokenInfo.payment) {
  //     console.log("Input state:", {
  //       buyAmount,
  //       tokenInfo,
  //       contractData: {
  //         currentPrice: formatEther(contractData.currentPrice),
  //         startPrice: formatEther(contractData.startPrice),
  //         endPrice: formatEther(contractData.endPrice),
  //       },
  //     });

  //     const result = calculateEstimatedTokens(
  //       buyAmount,
  //       contractData,
  //       tokenInfo
  //     );
  //     setEstimatedTokens(result.estimatedTokens);
  //     setAvgPricePerToken(result.avgPricePerToken);
  //   }
  // }, [buyAmount, contractData, tokenInfo]);

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
        args: [CONTRACT_ADDRESS, parseEther(buyAmount)],
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
    }
  }, [prepareApproveError, prepareBuyError]);

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

    const totalPayments = Number(formatEther(contractData.totalPaymentsIn));
    const netActive = Number(
      formatEther(contractData.totalActiveContributions)
    );

    const escrowRate = Number(contractData.escrowRakeBPS) / 10000;
    const upfrontRate = Number(contractData.upfrontRakeBPS) / 10000;
    const activePayment = netActive / (1 - escrowRate - upfrontRate);

    const escrowAmount = activePayment * escrowRate;
    const upfrontAmount = Number(
      formatEther(
        (contractData.totalPaymentsIn * contractData.upfrontRakeBPS) /
          BigInt(10000)
      )
    );
    const refundedAmount = totalPayments - activePayment - upfrontAmount;
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
          <li>
            Towards Liquidity: {towardsLiquidityAmount.toFixed(2)}{" "}
            {tokenInfo.payment.symbol} ({towardsLiquidityPercentage.toFixed(1)}%
            of active)
          </li>
          <li className="mt-2 text-yellow-500">
            Refunded Amount: {refundedAmount.toFixed(2)}{" "}
            {tokenInfo.payment.symbol} ({refundedPercentage.toFixed(1)}% of
            historical)
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
    if (!contractData || !tokenInfo.sale || !tokenInfo.payment) return "";

    return (
      <div className="space-y-2">
        <p>Current token balances in the smart contract:</p>
        <ul className="list-disc pl-4">
          <li>
            {formatEther(contractData.saleTokenBalance)} {tokenInfo.sale.symbol}
          </li>
          <li>
            {formatEther(contractData.paymentTokenBalance)}{" "}
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
    const currentNet = Number(formatEther(liquidityContribution));
    const targetNet = Number(formatEther(contractData.targetLiquidity));

    if (targetNet === 0) return 0;

    // Calculate percentage, capped at 100
    const progress = (currentNet / targetNet) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const formatProgressDisplay = () => {
    if (!contractData || !tokenInfo.payment) return "";

    // totalActiveContributions is already the amount for liquidity
    return `${formatEther(
      contractData.totalActiveContributions
    )} / ${formatEther(contractData.targetLiquidity)} ${
      tokenInfo.payment?.symbol
    }`;
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
                alignItems: "space-between",
                gap: "12px",
                flexWrap: "nowrap",
              }}
            >
              <div style={{ display: "flex", flex: "1" }}>
                <Title level={3} style={{ margin: 0 }}>
                  {contractData.title}
                </Title>
              </div>
              {getStatusTag()}
              <Tooltip title={getContractBalanceInfo()}>
                <InfoCircleOutlined style={{ color: "#1890ff" }} />
              </Tooltip>
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
                      level={3}
                      style={{ margin: 0, whiteSpace: "nowrap" }}
                    >
                      {formatEther(contractData.currentPrice)} PAY
                    </Title>
                    <Text type="secondary" style={{ whiteSpace: "nowrap" }}>
                      End: {formatEther(contractData.endPrice)} PAY
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
                      Progress to Liquidity Goal
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
                    <ShoppingCartOutlined />
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
                        Amount to Buy (PAY)
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
                        Balance: {userPaymentTokenBalance?.formatted ?? "0"} PAY
                      </Text>
                    </div>

                    <div className="flex gap-2 w-full">
                      <Input
                        size="large"
                        placeholder="Enter amount"
                        value={buyAmount}
                        onChange={handleBuyAmountChange}
                        prefix={<DollarOutlined className="text-gray-500" />}
                        suffix="PAY"
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
                              suffix="PAY"
                            />
                          </div>
                        </Col>
                        <Col xs={24} md={8}>
                          <div style={{ width: "100%" }}>
                            <Statistic
                              title="Estimated Tokens"
                              value={Number(estimatedTokens).toFixed(3)}
                              suffix="SALE"
                            />
                          </div>
                        </Col>
                        <Col xs={24} md={8}>
                          <div style={{ width: "100%" }}>
                            <Statistic
                              title="Avg Price per Token"
                              value={Number(avgPricePerToken).toFixed(4)}
                              suffix="PAY"
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
                    disabled={getButtonState().disabled || !isConnected}
                    style={{ width: "100%", height: "48px" }}
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
                    Make sure you have enough PAY tokens in your wallet.
                    Transaction will require approval from your wallet.
                  </Text>
                </div>
              </TabPane>

              {/* My Orders Tab */}
              <TabPane
                tab={
                  <span>
                    <UserOutlined />
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
                            ? formatEther(contractData.userAllocation)
                            : "0"
                        }
                        suffix="SALE"
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
                                {formatTokenAmount(
                                  purchase.tokenAmount,
                                  "SALE"
                                )}
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
                                {formatTokenAmount(
                                  purchase.paymentAmount,
                                  "PAY"
                                )}
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
                                disabled={
                                  !contractData.targetReached ||
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
                                disabled={
                                  contractData.targetReached ||
                                  purchase.isRefunded
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
    </div>
  );
};

export default BuyPanel;
