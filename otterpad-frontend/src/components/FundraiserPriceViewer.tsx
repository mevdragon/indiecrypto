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
} from "@ant-design/icons";
import {
  useAccount,
  useBalance,
  useContractReads,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Address, formatEther, parseEther } from "viem";
import { Content } from "antd/es/layout/layout";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import TabPane from "antd/es/tabs/TabPane";

const { Title, Text } = Typography;

interface TokenInfo {
  symbol: string;
  decimals: number;
}

interface TokenState {
  sale: TokenInfo | null;
  payment: TokenInfo | null;
}

const CONTRACT_ADDRESS = "0x317E7dadfcA1F92B02A377D6b78A14808d7f2EB4" as const;
const CONTRACT_ABI = OtterPadFundraiser__factory.abi;

// Contract function result types
type ContractDataResult = {
  currentPrice: bigint;
  startPrice: bigint;
  endPrice: bigint;
  minimumPurchase: bigint;
  saleTokenBalance: bigint;
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
      userAllocation: successResults[15] as bigint | undefined,
      userOrders: successResults[16] as bigint[] | undefined,
    };
  };

  const contractData = processContractData();

  const calculateEstimatedTokens = (paymentAmount: string) => {
    if (!contractData || !paymentAmount || isNaN(Number(paymentAmount))) {
      setEstimatedTokens("0");
      return;
    }

    try {
      const paymentAmountBigInt = parseEther(paymentAmount);

      // All calculations using BigInt
      const bps = BigInt(10000);
      const otterpadFee =
        (paymentAmountBigInt * BigInt(contractData.OTTERPAD_FEE_BPS)) / bps;
      const upfrontAmount =
        (paymentAmountBigInt * contractData.upfrontRakeBPS) / bps - otterpadFee;
      const escrowAmount =
        (paymentAmountBigInt * contractData.escrowRakeBPS) / bps;
      const contributionAmount =
        paymentAmountBigInt - otterpadFee - upfrontAmount - escrowAmount;

      const totalActive = contractData.paymentTokenBalance;
      const targetLiquidity = contractData.targetLiquidity;

      let priceAtStart = contractData.currentPrice;
      let priceAtEnd: bigint;

      if (contractData.targetReached) {
        priceAtEnd = priceAtStart;
      } else {
        const startPrice = BigInt(contractData.startPrice);
        const endPrice = BigInt(contractData.endPrice);
        const priceDiff = endPrice - startPrice;
        const newTotal = totalActive + contributionAmount;
        priceAtEnd = startPrice + (priceDiff * newTotal) / targetLiquidity;
      }

      const averagePrice = (priceAtStart + priceAtEnd) / BigInt(2);
      const decimals = BigInt(10) ** BigInt(tokenInfo.sale?.decimals || 18);
      const estimatedAmount = (contributionAmount * decimals) / averagePrice;

      setEstimatedTokens(formatEther(estimatedAmount));
    } catch (error) {
      console.error("Error calculating estimated tokens:", error);
      setEstimatedTokens("0");
    }
  };

  useEffect(() => {
    calculateEstimatedTokens(buyAmount);
  }, [buyAmount, contractData]);

  // Get user's payment token balance
  const { data: userPaymentTokenBalance } = useBalance({
    address: userAddress,
    token: contractData?.paymentTokenAddress,
    query: {
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  // Contract operations
  const { writeContract: buyTokens, data: buyTxHash } = useWriteContract();
  const { writeContract: redeemTokens, data: redeemTxHash } =
    useWriteContract();

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

  // Handle buy action
  const handleBuy = () => {
    console.log("handleBuy > Buy amount:", buyAmount);
    if (!buyAmount) return;
    try {
      buyTokens({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "buy",
        args: [parseEther(buyAmount)],
      });
    } catch (error) {
      api.error({
        message: "Transaction Failed",
        description: "Failed to execute buy transaction",
      });
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

    // Calculate net contribution (excluding escrowed amount)
    const netContributionBPS =
      BigInt(10000) - contractData.upfrontRakeBPS - contractData.escrowRakeBPS;

    // Get current balance excluding escrow
    const currentBalance = contractData.paymentTokenBalance;
    const escrowAmount = contractData.escrowedAmount;
    const netBalance = currentBalance - escrowAmount;

    // Convert BigInt values to numbers for percentage calculation
    const currentNet = Number(netBalance);
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
                    format={(percent) => (
                      <span>
                        {formatEther(contractData.paymentTokenBalance)} /{" "}
                        {formatEther(contractData.targetLiquidity)}{" "}
                        {tokenInfo.payment?.symbol}
                      </span>
                    )}
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
                    <Button
                      type="primary"
                      size="large"
                      icon={
                        buyLoading ? (
                          <LoadingOutlined />
                        ) : (
                          <ShoppingCartOutlined />
                        )
                      }
                      onClick={handleBuy}
                      disabled={
                        !buyAmount ||
                        buyLoading ||
                        parseFloat(buyAmount) <
                          parseFloat(
                            formatEther(contractData.minimumPurchase)
                          ) ||
                        parseFloat(buyAmount) >
                          parseFloat(userPaymentTokenBalance?.formatted ?? "0")
                      }
                      loading={buyLoading}
                      block
                    >
                      {buyLoading ? "Processing..." : "Buy Tokens"}
                    </Button>

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

                  {/* Existing orders list */}
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
                            >
                              Redeem
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            avatar={<WalletOutlined style={{ fontSize: 24 }} />}
                            title={`Order #${orderIndex.toString()}`}
                            description="Click redeem to claim your tokens"
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
