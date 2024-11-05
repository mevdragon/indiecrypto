import { ContractDataResult } from "../pages/FundPage";

// Utility function to format token amounts with proper decimals
export const formatTokenAmount = (
  amount: bigint | undefined,
  decimals: number,
  displayDecimals: number = 4
): string => {
  if (!amount) return "0";

  // Convert from base units to decimal representation
  const divisor = BigInt(10 ** decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;

  // Convert to string and pad with leading zeros if needed
  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");

  // Combine integer and fractional parts
  const fullNumber = `${integerPart}.${fractionalStr}`;

  // Format to specified number of decimal places
  return Number(fullNumber).toFixed(displayDecimals);
};

// Utility function to calculate estimated tokens with proper decimals
export const calculateEstimatedTokens = (
  paymentAmount: string,
  contractData: ContractDataResult
): { estimatedTokens: string; avgPricePerToken: string } => {
  if (!contractData || !paymentAmount || isNaN(Number(paymentAmount))) {
    return { estimatedTokens: "0", avgPricePerToken: "0" };
  }

  try {
    const paymentAmountBigInt = BigInt(
      Math.floor(
        Number(paymentAmount) * 10 ** contractData.paymentTokenDecimals
      )
    );

    if (contractData.targetReached) {
      // If target reached, use current price directly
      const tokens =
        (paymentAmountBigInt * BigInt(10 ** contractData.saleTokenDecimals)) /
        contractData.currentPrice;
      return {
        estimatedTokens: formatTokenAmount(
          tokens,
          contractData.saleTokenDecimals
        ),
        avgPricePerToken: formatTokenAmount(
          contractData.currentPrice,
          contractData.paymentTokenDecimals
        ),
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
    const startPrice = contractData.startPrice;
    const totalPriceDiff = contractData.endPrice - contractData.startPrice;

    const newProgress = contractData.totalActiveContributions + netContribution;
    const priceAtEnd =
      contractData.startPrice +
      (totalPriceDiff * newProgress) / contractData.targetLiquidity;

    // Use average price for this purchase
    const averagePrice = (startPrice + priceAtEnd) / BigInt(2);

    // Calculate tokens using full payment amount
    const saleTokenDecimals =
      BigInt(10) ** BigInt(contractData.saleTokenDecimals);
    const estimatedTokens =
      (paymentAmountBigInt * saleTokenDecimals) / averagePrice;

    return {
      estimatedTokens: formatTokenAmount(
        estimatedTokens,
        contractData.saleTokenDecimals
      ),
      avgPricePerToken: formatTokenAmount(
        averagePrice,
        contractData.paymentTokenDecimals
      ),
    };
  } catch (error) {
    console.error("Error calculating estimated tokens:", error);
    return { estimatedTokens: "0", avgPricePerToken: "0" };
  }
};

// Utility function to format BPS values to percentage
export const formatBPStoPercentage = (bps: bigint): string => {
  return (Number(bps) / 100).toFixed(2);
};

// Utility function to calculate remaining amount with proper decimals
export const calculateRemainingAmount = (
  contractData: ContractDataResult
): string => {
  if (!contractData) return "0";

  // Get current contribution progress
  const currentContributions = contractData.totalActiveContributions;

  // Calculate how much more we need in net contributions
  const remainingNet = contractData.targetLiquidity - currentContributions;
  if (remainingNet <= BigInt(0)) return "0";

  // Calculate gross amount needed using the same formula as the contract
  const netContributionBPS =
    BigInt(10000) - contractData.upfrontRakeBPS - contractData.escrowRakeBPS;
  const grossAmount = (remainingNet * BigInt(10000)) / netContributionBPS;

  return formatTokenAmount(grossAmount, contractData.paymentTokenDecimals);
};
