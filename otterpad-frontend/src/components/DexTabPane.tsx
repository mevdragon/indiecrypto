import React from "react";
import { Result, Button, message } from "antd";
import {
  useContractRead,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useAccount,
} from "wagmi";
import {
  UserOutlined,
  LinkOutlined,
  RocketOutlined,
  FundFilled,
  FundOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { CONTRACT_ABI, ContractDataResult } from "../pages/FundPage";
import {
  ERC20_ABI,
  getDexScreenerChainSlug,
  getGeckoTerminalChainSlug,
  SUPPORTED_CHAINS,
} from "../config";
import { Address, formatUnits } from "viem";

interface DexTabPaneProps {
  address: Address;
  chainIdDecimal: string;
  contractData: ContractDataResult | null;
  refetchContractDetails: () => void;
}

const DexTabPane: React.FC<DexTabPaneProps> = ({
  address: contractAddress,
  chainIdDecimal,
  contractData,
  refetchContractDetails,
}) => {
  const { address: userAddress, isConnected } = useAccount();

  const [transactionState, setTransactionState] = React.useState({
    isCheckingAllowance: false,
    isApproving: false,
    isWaitingForApproval: false,
    isTransferring: false,
    isWaitingForTransfer: false,
  });
  const [currentAllowance, setCurrentAllowance] = React.useState<bigint>(
    BigInt(0)
  );
  const [isApproved, setIsApproved] = React.useState(false);

  const publicClient = usePublicClient();

  // Contract write hooks
  const { writeContract: deployToUniswap, data: deployTxHash } =
    useWriteContract();
  const { writeContract: approveSaleToken, data: approvalHash } =
    useWriteContract();
  const { writeContract: transferSaleToken, data: transferHash } =
    useWriteContract();

  // Transaction receipts
  const { isLoading: isDeploying, isSuccess: isDeploySuccess } =
    useWaitForTransactionReceipt({
      hash: deployTxHash,
    });

  const { isLoading: isApprovalLoading, isSuccess: isApprovalSuccess } =
    useWaitForTransactionReceipt({
      hash: approvalHash,
    });

  const { isLoading: isTransferLoading, isSuccess: isTransferSuccess } =
    useWaitForTransactionReceipt({
      hash: transferHash,
    });

  // Get hasSufficientSaleTokens state
  const {
    data: hasSufficientSaleTokens,
    refetch: refetchHasSufficientSalesTokens,
  } = useContractRead({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: "hasSufficientSaleTokens",
  });

  // Clear transfer state when transfer is successful
  React.useEffect(() => {
    if (isTransferSuccess) {
      setTransactionState((prev) => ({
        ...prev,
        isTransferring: false,
        isWaitingForTransfer: false,
      }));
      message.success("Token transfer successful");
      refetchContractDetails();
      refetchHasSufficientSalesTokens();
    }
  }, [isTransferSuccess, refetchContractDetails]);

  // Handle deploy success
  React.useEffect(() => {
    if (isDeploySuccess) {
      message.success("Successfully deployed to DEX");
      refetchContractDetails();
    }
  }, [isDeploySuccess, refetchContractDetails]);

  const checkAllowance = React.useCallback(async () => {
    if (
      !contractData?.saleTokenAddress ||
      !publicClient ||
      !userAddress ||
      !contractAddress
    )
      return;

    try {
      setTransactionState((prev) => ({ ...prev, isCheckingAllowance: true }));

      const allowance = (await publicClient.readContract({
        address: contractData.saleTokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [userAddress, contractAddress],
      })) as bigint;

      setCurrentAllowance(allowance);
      setIsApproved(allowance >= contractData.requiredSaleTokens);
    } catch (error) {
      console.error("Error checking allowance:", error);
      setIsApproved(false);
    } finally {
      setTransactionState((prev) => ({ ...prev, isCheckingAllowance: false }));
    }
  }, [
    contractData?.saleTokenAddress,
    contractData?.requiredSaleTokens,
    publicClient,
    userAddress,
    contractAddress,
  ]);

  // Check allowance on mount and when relevant dependencies change
  React.useEffect(() => {
    checkAllowance();
  }, [checkAllowance]);

  // Recheck allowance after successful approval
  React.useEffect(() => {
    if (isApprovalSuccess) {
      checkAllowance();
      setTransactionState((prev) => ({
        ...prev,
        isApproving: false,
        isWaitingForApproval: false,
      }));
      message.success("Token approval successful");
    }
  }, [isApprovalSuccess, checkAllowance]);

  // Handle approval
  const handleApproveSaleToken = async () => {
    if (
      !contractData?.saleTokenAddress ||
      !contractData.requiredSaleTokens ||
      !userAddress
    )
      return;

    try {
      setTransactionState((prev) => ({
        ...prev,
        isApproving: true,
      }));

      approveSaleToken({
        address: contractData.saleTokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contractAddress, contractData.requiredSaleTokens],
      });

      setTransactionState((prev) => ({
        ...prev,
        isApproving: false,
        isWaitingForApproval: true,
      }));

      message.info(
        "Approval Pending. Please wait while the approval is being processed"
      );
    } catch (error) {
      console.error("Error approving sale token:", error);
      message.error("Failed to approve sale tokens");
      setTransactionState((prev) => ({
        ...prev,
        isApproving: false,
        isWaitingForApproval: false,
      }));
    }
  };

  // Handle transfer
  const handleTransferSaleToken = async () => {
    if (
      !contractData?.saleTokenAddress ||
      !contractData.requiredSaleTokens ||
      !userAddress
    )
      return;

    try {
      setTransactionState((prev) => ({
        ...prev,
        isTransferring: true,
      }));

      transferSaleToken({
        address: contractData.saleTokenAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [contractAddress, contractData.requiredSaleTokens],
      });

      setTransactionState((prev) => ({
        ...prev,
        isTransferring: false,
        isWaitingForTransfer: true,
      }));

      message.info(
        "Transfer Pending. Please wait while your transfer is being processed"
      );
    } catch (error) {
      console.error("Error transferring sale token:", error);
      message.error("Failed to transfer sale tokens");
      setTransactionState((prev) => ({
        ...prev,
        isTransferring: false,
        isWaitingForTransfer: false,
      }));
    }
  };

  // Get explorer URL based on chain ID
  const getExplorerUrl = () => {
    const chain = SUPPORTED_CHAINS.find(
      (chain) => chain.chainIdDecimal === chainIdDecimal
    );
    return chain?.explorerUrl || "";
  };

  // Handle deploy to DEX
  const handleDeploy = async () => {
    console.log("Deploying to DEX");
    if (!isConnected) {
      message.error("Please connect your wallet first");
      return;
    }
    try {
      console.log("About to DEX");
      deployToUniswap({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: "deployToUniswap",
      });
      message.info(
        "Deployment to DEX initiated. Please wait for confirmation."
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      message.error("Failed to deploy to DEX: " + errorMessage);
    }
  };

  // Render the appropriate action button based on state
  const renderActionButton = () => {
    if (!contractData) return null;

    const {
      isCheckingAllowance,
      isApproving,
      isWaitingForApproval,
      isTransferring,
      isWaitingForTransfer,
    } = transactionState;

    const requiredAmount = Number(
      formatUnits(
        contractData.requiredSaleTokens,
        contractData.saleTokenDecimals
      )
    ).toFixed(2);

    if (isCheckingAllowance) {
      return (
        <Button type="primary" disabled>
          <LoadingOutlined /> Checking Allowance...
        </Button>
      );
    }

    if (isApproving || isWaitingForApproval) {
      return (
        <Button type="primary" loading>
          {isApproving ? "Approving..." : "Confirming Approval..."}
        </Button>
      );
    }

    if (isTransferring || isWaitingForTransfer || isTransferLoading) {
      return (
        <Button type="primary" loading>
          {isTransferring ? "Transferring..." : "Confirming Transfer..."}
        </Button>
      );
    }

    if (!isApproved) {
      return (
        <Button
          type="primary"
          onClick={handleApproveSaleToken}
          disabled={isTransferring || isTransferLoading}
        >
          {`Approve Deposit ${requiredAmount} ${contractData.saleTokenSymbol}`}
        </Button>
      );
    }

    return (
      <Button
        type="primary"
        onClick={handleTransferSaleToken}
        loading={isTransferring || isTransferLoading}
      >
        {`Deposit ${requiredAmount} ${contractData.saleTokenSymbol}`}
      </Button>
    );
  };

  // Render based on contract state
  const renderContent = () => {
    if (!contractData) {
      return <Result status="warning" title="Loading contract data..." />;
    }
    const totalPaymentRequired =
      (contractData.targetLiquidity * BigInt(10000)) /
      (BigInt(10000) -
        contractData.upfrontRakeBPS -
        contractData.escrowRakeBPS);
    const totalPayTokenRequired =
      totalPaymentRequired -
      (totalPaymentRequired * contractData.upfrontRakeBPS) / BigInt(10000);

    if (
      (!contractData.targetReached || !hasSufficientSaleTokens) &&
      !contractData.isDeployedToUniswap
    ) {
      return (
        <Result
          status="info"
          title="Fundraiser in Progress"
          subTitle={
            <>
              <div>
                Check back when the fundraiser has ended. Tokens will be
                deployed to Uniswap V2.
              </div>
              <div
                style={{
                  marginTop: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <div>
                  <div>
                    Sale Token Balance:{" "}
                    {Number(
                      formatUnits(
                        contractData.saleTokenBalance,
                        contractData.saleTokenDecimals
                      )
                    ).toFixed(2)}
                    /
                    {Number(
                      formatUnits(
                        contractData.requiredSaleTokens,
                        contractData.saleTokenDecimals
                      )
                    ).toFixed(2)}{" "}
                  </div>
                  <div>
                    Payment Token Balance:{" "}
                    {Number(
                      formatUnits(
                        contractData.paymentTokenBalance,
                        contractData.paymentTokenDecimals
                      )
                    ).toFixed(2)}
                    /
                    {Number(
                      formatUnits(
                        totalPayTokenRequired,
                        contractData.paymentTokenDecimals
                      )
                    ).toFixed(2)}{" "}
                  </div>
                </div>
              </div>
              {!hasSufficientSaleTokens && (
                <div style={{ marginTop: "20px" }}>{renderActionButton()}</div>
              )}
            </>
          }
          icon={<FundOutlined />}
        />
      );
    }

    if (!contractData.isDeployedToUniswap) {
      return (
        <Result
          status="success"
          title="Fundraiser Goal Reached!"
          subTitle="Tokens can now be deployed to DEX by anyone."
          extra={[
            <Button
              type="primary"
              key="deploy"
              onClick={handleDeploy}
              loading={isDeploying}
              icon={<RocketOutlined />}
            >
              Deploy to DEX
            </Button>,
          ]}
        />
      );
    }

    const explorerUrl = getExplorerUrl();
    const geckoTerminalChainSlug = getGeckoTerminalChainSlug(chainIdDecimal);
    const dexScreenerSlug = getDexScreenerChainSlug(chainIdDecimal);
    return (
      <>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 20px",
            backgroundColor: "#f6ffed",
            border: "1px solid #b7eb8f",
            borderRadius: "4px",
          }}
        >
          <div>
            <CheckCircleOutlined
              style={{ color: "#52c41a", fontSize: "20px", marginRight: "8px" }}
            />
            <span style={{ fontWeight: "bold", color: "#389e0d" }}>
              Tokens Successfully Deployed!
            </span>
          </div>
          <div>
            <Button
              type="primary"
              ghost
              icon={<LinkOutlined />}
              onClick={() =>
                window.open(
                  `${explorerUrl}/address/${contractData.uniswapPool}`,
                  "_blank"
                )
              }
            >
              View on Explorer
            </Button>
            <Button
              type="primary"
              icon={<SwapOutlined />}
              style={{ marginLeft: "5px" }}
              onClick={() =>
                window.open(
                  `https://app.uniswap.org/swap?inputCurrency=${contractData.paymentTokenAddress}&outputCurrency=${contractData.saleTokenAddress}`,
                  "_blank"
                )
              }
            >
              Trade on Uniswap
            </Button>
          </div>
        </div>
        {/* {geckoTerminalChainSlug && (
          <iframe
            height="600px"
            width="100%"
            id="geckoterminal-embed"
            title="GeckoTerminal Embed"
            src={`https://www.geckoterminal.com/${geckoTerminalChainSlug}/pools/${contractData.uniswapPool}?embed=1&info=0&swaps=0`}
            // @ts-ignore
            frameborder="0"
            allow="clipboard-write"
            allowfullscreen
          ></iframe>
        )} */}
        {dexScreenerSlug && (
          <div id="dexscreener-embed">
            <iframe
              src={`https://dexscreener.com/${dexScreenerSlug}/${contractData.uniswapPool}?embed=1&theme=dark&trades=0&info=0`}
              style={{ width: "100%", height: "600px" }}
            ></iframe>
          </div>
        )}
      </>
    );
  };

  return (
    <div
      className="w-full h-full flex justify-center"
      style={{
        height: "100%",
        minHeight: "50vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {renderContent()}
    </div>
  );
};

export default DexTabPane;
