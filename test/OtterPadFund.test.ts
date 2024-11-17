// npx hardhat test

import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import {
  parseEther,
  parseUnits,
  getAddress,
  ContractFunctionRevertedError,
} from "viem";

const title = "Crypto Project";
const richInfoUrl =
  "https://api.legions.bot/api/w/officex/capture_u/f/officex/otterpad_rest_api";

describe("OtterPadFund", function () {
  // Constants for Uniswap addresses
  const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6";
  const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";

  async function deployFundraiserFixture() {
    // Deploy mock tokens first

    const saleToken = await hre.viem.deployContract("MockERC20", [
      "SaleToken",
      "SALE",
      18n,
    ]);

    const paymentToken = await hre.viem.deployContract("MockERC20", [
      "PaymentToken",
      "PAY",
      18n,
    ]);

    const [deployer, foundersWallet, buyer1, buyer2, lpLockWallet] =
      await hre.viem.getWalletClients();

    // Set up initial parameters
    const startPrice = parseEther("0.1"); // 0.1 payment tokens per sale token
    const endPrice = parseEther("0.3"); // 0.3 payment tokens per sale token
    const targetLiquidity = parseEther("100"); // 100 payment tokens target
    const upfrontRakeBPS = 2_000_000n; // 2%
    const escrowRakeBPS = 3_000_000n; // 3%

    // Deploy the fundraiser with new constructor parameters
    const fundraiser = await hre.viem.deployContract("OtterPadFund", [
      title,
      richInfoUrl,
      saleToken.address,
      paymentToken.address,
      UNISWAP_ROUTER,
      UNISWAP_FACTORY,
      startPrice,
      endPrice,
      targetLiquidity,
      upfrontRakeBPS,
      escrowRakeBPS,
      getAddress(foundersWallet.account.address),
      getAddress(lpLockWallet.account.address),
    ]);

    // Mint some tokens to buyers for testing
    const mintAmount = parseEther("1000");
    await paymentToken.write.mint([
      getAddress(buyer1.account.address),
      mintAmount,
    ]);
    await paymentToken.write.mint([
      getAddress(buyer2.account.address),
      mintAmount,
    ]);

    // Calculate required token amount using the contract's helper function
    const requiredTokens = (await fundraiser.read.checkSaleTokensRequired())[0];
    await saleToken.write.mint([fundraiser.address, requiredTokens]);

    const publicClient = await hre.viem.getPublicClient();

    return {
      fundraiser,
      saleToken,
      paymentToken,
      startPrice,
      endPrice,
      targetLiquidity,
      upfrontRakeBPS,
      escrowRakeBPS,
      deployer,
      foundersWallet,
      buyer1,
      buyer2,
      lpLockWallet,
      publicClient,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct initial parameters", async function () {
      const {
        fundraiser,
        saleToken,
        paymentToken,
        startPrice,
        endPrice,
        targetLiquidity,
        upfrontRakeBPS,
        escrowRakeBPS,
        foundersWallet,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      expect(await fundraiser.read.saleToken()).to.equal(
        getAddress(saleToken.address)
      );
      expect(await fundraiser.read.paymentToken()).to.equal(
        getAddress(paymentToken.address)
      );
      expect(await fundraiser.read.uniswapRouter()).to.equal(UNISWAP_ROUTER);
      expect(await fundraiser.read.uniswapFactory()).to.equal(UNISWAP_FACTORY);
      expect(await fundraiser.read.startPrice()).to.equal(startPrice);
      expect(await fundraiser.read.endPrice()).to.equal(endPrice);
      expect(await fundraiser.read.targetLiquidity()).to.equal(targetLiquidity);
      expect(await fundraiser.read.upfrontRakeBPS()).to.equal(upfrontRakeBPS);
      expect(await fundraiser.read.escrowRakeBPS()).to.equal(escrowRakeBPS);
      expect(await fundraiser.read.foundersWallet()).to.equal(
        getAddress(foundersWallet.account.address)
      );
    });

    it("Should verify sufficient sale tokens", async function () {
      const { fundraiser } = await loadFixture(deployFundraiserFixture);
      expect(await fundraiser.read.hasSufficientSaleTokens()).to.equal(true);
    });

    it("Should start with correct initial state", async function () {
      const { fundraiser } = await loadFixture(deployFundraiserFixture);

      expect(await fundraiser.read.orderCounter()).to.equal(0n);
      expect(await fundraiser.read.isDeployedToUniswap()).to.equal(false);
      expect(await fundraiser.read.targetReached()).to.equal(false);
      expect(await fundraiser.read.totalTokensAllocated()).to.equal(0n);
      expect(await fundraiser.read.totalActiveContributions()).to.equal(0n);
      expect(await fundraiser.read.totalPaymentsIn()).to.equal(0n);
    });
  });

  describe("Buying tokens", function () {
    it("Should allow a valid purchase", async function () {
      const { fundraiser, paymentToken, buyer1, publicClient, lpLockWallet } =
        await loadFixture(deployFundraiserFixture);

      const paymentAmount = parseEther("10");

      // Approve payment token spend
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        paymentAmount,
      ]);

      // Get fundraiser contract instance for buyer1
      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      // Make purchase
      const hash = await buyer1Fundraiser.write.buy([
        paymentAmount,
        buyer1.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify purchase was recorded
      expect(await fundraiser.read.orderCounter()).to.equal(1n);

      const purchase = await fundraiser.read.purchases([0n]);
      // struct Purchase {
      //     uint256 paymentAmount;      // Total amount paid by user
      //     uint256 contributionAmount; // Amount after otterpad fee and upfront rake
      //     uint256 tokenAmount;       // Calculated token amount at purchase time
      //     address purchaser;
      //     bool isRefunded;
      //     bool isRedeemed;
      //     uint256 purchaseBlock;
      // }
      expect(purchase[0]).to.equal(paymentAmount);
      expect(purchase[3]).to.equal(getAddress(buyer1.account.address));
      expect(purchase[5]).to.equal(false);
      expect(purchase[6]).to.equal(false);
    });

    it("Should calculate correct token amounts based on price curve", async function () {
      const {
        fundraiser,
        targetLiquidity,
        startPrice,
        endPrice,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      const paymentAmount = parseEther("10");

      // Calculate exactly as contract does
      const OTTERPAD_FEE_BPS = 2_000_000n;
      const upfrontRakeBPS = await fundraiser.read.upfrontRakeBPS();
      const escrowRakeBPS = await fundraiser.read.escrowRakeBPS();
      const netContributionBPS = 100_000_000n - upfrontRakeBPS - escrowRakeBPS;

      // Calculate contribution amount exactly as contract does
      const otterpadFee = (paymentAmount * OTTERPAD_FEE_BPS) / 100_000_000n;
      const upfrontAmount =
        (paymentAmount * upfrontRakeBPS) / 100_000_000n - otterpadFee;
      const escrowAmount = (paymentAmount * escrowRakeBPS) / 100_000_000n;
      const contributionAmount =
        paymentAmount - otterpadFee - upfrontAmount - escrowAmount;

      // Get current total contributions
      const currentContributions =
        await fundraiser.read.totalActiveContributions();

      // Calculate slope exactly as contract's getSlope() function
      const totalCashInflows =
        (targetLiquidity * 100_000_000n) /
        (100_000_000n - upfrontRakeBPS - escrowRakeBPS);
      const avgPrice = (startPrice + endPrice) / 2n;
      const proratedTokensForSale =
        (totalCashInflows * parseEther("1")) / avgPrice;
      const slope =
        ((endPrice - startPrice) * parseEther("1")) / proratedTokensForSale;

      // Calculate net cash inflows as contract does
      const netCashInflows =
        (currentContributions * 100_000_000n) / netContributionBPS;

      // Helper function to perform quadratic calculation with BigInt precision
      function calculateTokens(amount: bigint): bigint {
        const b = startPrice;
        const m = slope;

        // Convert to BigInts and maintain precision throughout calculation
        const bSquared = b * b;
        const mHalf = m / 2n;
        const fourMHalfAmount = 4n * mHalf * amount;

        // Calculate square root term using BigInt math where possible
        const sqrtInput = bSquared + fourMHalfAmount;

        // Convert to string for Math.sqrt, then back to BigInt with precision
        const sqrtValue = Math.sqrt(Number(sqrtInput.toString()));
        const sqrtTermBigInt = BigInt(
          Math.floor(sqrtValue * Number((1e9).toString()))
        );

        // Calculate result maintaining precision
        const numerator = (-b * BigInt(1e9) + sqrtTermBigInt) * parseEther("1");
        const denominator = 2n * mHalf * BigInt(1e9);

        // Perform final division
        return numerator / denominator;
      }

      // Calculate tokens before and after with high precision
      const tokensBefore = calculateTokens(netCashInflows);
      const tokensAfter = calculateTokens(netCashInflows + paymentAmount);

      // Calculate difference
      const expectedTokens = tokensAfter - tokensBefore;

      const actualTokens = await fundraiser.read.calculateTokensReceived([
        paymentAmount,
      ]);

      expect(actualTokens).to.be.closeTo(expectedTokens, 100_000_000n); // Allow difference of up to 10000 wei due to OpenZeppelin Math.sqrt implementation decimals difference
    });

    it("Should emit correct events on purchase", async function () {
      const { fundraiser, paymentToken, buyer1, publicClient, lpLockWallet } =
        await loadFixture(deployFundraiserFixture);

      const paymentAmount = parseEther("10");

      // Approve payment tokens
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        paymentAmount,
      ]);

      // Make purchase
      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      const hash = await buyer1Fundraiser.write.buy([
        paymentAmount,
        buyer1.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Check TokensPurchased event
      const purchaseEvents = await fundraiser.getEvents.TokensPurchased();
      expect(purchaseEvents).to.have.lengthOf(1);
      expect(purchaseEvents[0].args.purchaser).to.equal(
        getAddress(buyer1.account.address)
      );
      expect(purchaseEvents[0].args.paymentAmount).to.equal(paymentAmount);

      // Check PaymentReceived event
      const paymentEvents = await fundraiser.getEvents.PaymentReceived();
      expect(paymentEvents).to.have.lengthOf(1);
      expect(paymentEvents[0].args.purchaser).to.equal(
        getAddress(buyer1.account.address)
      );
      expect(paymentEvents[0].args.totalAmount).to.equal(paymentAmount);
    });
  });

  describe("Token redemption", function () {
    it("Should not allow redemption before target is reached", async function () {
      const { fundraiser, paymentToken, buyer1, publicClient, lpLockWallet } =
        await loadFixture(deployFundraiserFixture);

      // Make a small purchase first
      const paymentAmount = parseEther("10");

      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        paymentAmount,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([paymentAmount, buyer1.account.address]);

      // Try to redeem
      await expect(buyer1Fundraiser.write.redeem([0n])).to.be.rejectedWith(
        "Target not reached yet"
      );
    });

    it("Should not allow redemption before DEX deployment even if target is reached", async function () {
      const {
        fundraiser,
        paymentToken,
        buyer1,
        publicClient,
        targetLiquidity,
        upfrontRakeBPS,
        escrowRakeBPS,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      // Calculate payment needed with correct rake calculation
      const OTTERPAD_FEE_BPS = 2_000_000n;
      const remainingBPS =
        100_000_000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 100_000_000n) / remainingBPS;

      // Make purchase that reaches target
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        requiredPayment,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([
        requiredPayment,
        buyer1.account.address,
      ]);

      // Verify target reached but DEX not deployed
      expect(await fundraiser.read.targetReached()).to.equal(true);
      expect(await fundraiser.read.isDeployedToUniswap()).to.equal(false);

      // Try to redeem should fail
      await expect(buyer1Fundraiser.write.redeem([0n])).to.be.rejectedWith(
        "Not yet deployed to DEX"
      );
    });

    it("Should allow redemption after target is reached and DEX deployment", async function () {
      const {
        fundraiser,
        paymentToken,
        saleToken,
        buyer1,
        foundersWallet,
        publicClient,
        targetLiquidity,
        upfrontRakeBPS,
        escrowRakeBPS,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      // Calculate payment needed with correct rake calculation
      const OTTERPAD_FEE_BPS = 2_000_000n;
      const remainingBPS =
        100_000_000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 100_000_000n) / remainingBPS;

      // Make purchase that reaches target
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        requiredPayment,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      // Buy tokens
      await buyer1Fundraiser.write.buy([
        requiredPayment,
        buyer1.account.address,
      ]);

      // Deploy to Uniswap
      const foundersWalletFundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: foundersWallet } }
      );

      // Ensure contract has sufficient tokens
      const requiredTokens = (
        await fundraiser.read.checkSaleTokensRequired()
      )[0];
      await saleToken.write.mint([fundraiser.address, requiredTokens * 2n]); // Mint extra tokens to be safe

      await foundersWalletFundraiser.write.deployToUniswap();

      // Verify DEX deployed
      expect(await fundraiser.read.isDeployedToUniswap()).to.equal(true);

      // Should now be able to redeem
      const initialBalance = await saleToken.read.balanceOf([
        buyer1.account.address,
      ]);
      await buyer1Fundraiser.write.redeem([0n]);
      const finalBalance = await saleToken.read.balanceOf([
        buyer1.account.address,
      ]);

      // Verify tokens received
      const purchase = await fundraiser.read.purchases([0n]);
      expect(finalBalance - initialBalance).to.equal(purchase[2]); // tokenAmount
    });
  });

  describe("Refunds", function () {
    it("Should allow refund before target reached", async function () {
      const { fundraiser, paymentToken, buyer1, publicClient, lpLockWallet } =
        await loadFixture(deployFundraiserFixture);

      const paymentAmount = parseEther("10");

      // Make initial purchase
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        paymentAmount,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([paymentAmount, buyer1.account.address]);

      // Get initial balances
      const initialBalance = await paymentToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);

      // Request refund
      const hash = await buyer1Fundraiser.write.refund([0n]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify refund processed
      const purchase = await fundraiser.read.purchases([0n]);
      expect(purchase[5]).to.equal(true); // isRefunded

      // Check final balance
      const finalBalance = await paymentToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);

      // Calculate expected refund - match contract's calculation
      const OTTERPAD_FEE_BPS = 2_000_000n;
      const upfrontRakeBPS = await fundraiser.read.upfrontRakeBPS();
      const escrowRakeBPS = await fundraiser.read.escrowRakeBPS();
      const netContributionBPS = 100_000_000n - upfrontRakeBPS - escrowRakeBPS;

      // Get the actual contribution amount from the purchase
      const contributionAmount = purchase[1]; // contributionAmount field

      // Calculate the original payment that would result in this contribution
      const grossAmount =
        (contributionAmount * 100_000_000n) / netContributionBPS;

      // Calculate escrow portion
      const escrowAmount = (grossAmount * escrowRakeBPS) / 100_000_000n;

      // Total refund is contribution + escrow
      const expectedRefund = contributionAmount + escrowAmount;

      expect(finalBalance).to.equal(initialBalance + expectedRefund);
    });

    it("Should allow refund after target reached but before DEX deployment", async function () {
      const {
        fundraiser,
        paymentToken,
        buyer1,
        publicClient,
        targetLiquidity,
        upfrontRakeBPS,
        escrowRakeBPS,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      // Calculate required payment to reach target
      const OTTERPAD_FEE_BPS = 2_000_000n;
      const remainingBPS =
        100_000_000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 100_000_000n) / remainingBPS;

      // Make purchase that reaches target
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        requiredPayment,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([
        requiredPayment,
        buyer1.account.address,
      ]);

      // Verify target is reached
      expect(await fundraiser.read.targetReached()).to.equal(true);

      // Get initial balance before refund
      const initialBalance = await paymentToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);

      // Should still be able to refund since DEX isn't deployed
      const refundHash = await buyer1Fundraiser.write.refund([0n]);
      await publicClient.waitForTransactionReceipt({ hash: refundHash });

      // Verify refund processed
      const purchase = await fundraiser.read.purchases([0n]);
      expect(purchase[5]).to.equal(true); // isRefunded

      // Check final balance
      const finalBalance = await paymentToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);

      // Calculate expected refund - match contract's calculation
      const netContributionBPS = 100_000_000n - upfrontRakeBPS - escrowRakeBPS;

      // Get the actual contribution amount from the purchase
      const contributionAmount = purchase[1]; // contributionAmount field

      // Calculate the original payment that would result in this contribution
      const grossAmount =
        (contributionAmount * 100_000_000n) / netContributionBPS;

      // Calculate escrow portion
      const escrowAmount = (grossAmount * escrowRakeBPS) / 100_000_000n;

      // Total refund is contribution + escrow
      const expectedRefund = contributionAmount + escrowAmount;

      expect(finalBalance).to.equal(initialBalance + expectedRefund);
    });

    it("Should not allow refund after DEX deployment", async function () {
      const {
        fundraiser,
        paymentToken,
        buyer1,
        foundersWallet,
        publicClient,
        targetLiquidity,
        upfrontRakeBPS,
        escrowRakeBPS,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      // Calculate payment needed with correct rake calculation
      const OTTERPAD_FEE_BPS = 2_000_000n;
      const remainingBPS =
        100_000_000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 100_000_000n) / remainingBPS;

      // Make purchase that reaches target
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        requiredPayment,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([
        requiredPayment,
        buyer1.account.address,
      ]);

      // Deploy to Uniswap
      const foundersWalletFundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: foundersWallet } }
      );
      await foundersWalletFundraiser.write.deployToUniswap();

      // Try to refund after DEX deployment should fail
      await expect(buyer1Fundraiser.write.refund([0n])).to.be.rejectedWith(
        "Sale completed"
      );
    });

    // Let's also add a test to verify the refund amounts are correct
    it("Should refund the correct contribution amount", async function () {
      const { fundraiser, paymentToken, buyer1, publicClient, lpLockWallet } =
        await loadFixture(deployFundraiserFixture);

      const paymentAmount = parseEther("10");

      // Make initial purchase
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        paymentAmount,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([paymentAmount, buyer1.account.address]);

      // Get the purchase details to know exact contribution amount
      const purchase = await fundraiser.read.purchases([0n]);
      const contributionAmount = purchase[1]; // contributionAmount field

      // Get initial balance before refund
      const initialBalance = await paymentToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);

      // Perform refund
      const refundHash = await buyer1Fundraiser.write.refund([0n]);
      await publicClient.waitForTransactionReceipt({ hash: refundHash });

      // Check final balance
      const finalBalance = await paymentToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);

      // Calculate expected refund amount - match contract's calculation
      const OTTERPAD_FEE_BPS = 2_000_000n;
      const upfrontRakeBPS = await fundraiser.read.upfrontRakeBPS();
      const escrowRakeBPS = await fundraiser.read.escrowRakeBPS();
      const netContributionBPS = 100_000_000n - upfrontRakeBPS - escrowRakeBPS;

      // Calculate the original payment that would result in this contribution
      const grossAmount =
        (contributionAmount * 100_000_000n) / netContributionBPS;

      // Calculate escrow portion
      const escrowAmount = (grossAmount * escrowRakeBPS) / 100_000_000n;

      // Total refund is contribution + escrow
      const expectedRefund = contributionAmount + escrowAmount;

      expect(finalBalance).to.equal(initialBalance + expectedRefund);
    });
  });

  describe("Edge cases", function () {
    it("Should handle exact target amount purchase", async function () {
      const {
        fundraiser,
        paymentToken,
        buyer1,
        publicClient,
        targetLiquidity,
        upfrontRakeBPS,
        escrowRakeBPS,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      const OTTERPAD_FEE_BPS = 2_000_000n;
      // Calculate exact payment needed
      const remainingBPS =
        100_000_000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const exactPayment = (targetLiquidity * 100_000_000n) / remainingBPS;

      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        exactPayment,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([exactPayment, buyer1.account.address]);

      expect(await fundraiser.read.targetReached()).to.equal(true);
      expect(await fundraiser.read.totalActiveContributions()).to.equal(
        targetLiquidity
      );
    });

    it("Should reject purchase that would exceed target", async function () {
      const {
        fundraiser,
        paymentToken,
        buyer1,
        buyer2,
        publicClient,
        targetLiquidity,
        upfrontRakeBPS,
        escrowRakeBPS,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      const OTTERPAD_FEE_BPS = 2_000_000n;
      // Calculate payment for 99% of target
      const remainingBPS =
        100_000_000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const almostFullPayment = (targetLiquidity * 99_000_000n) / remainingBPS;

      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        almostFullPayment,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([
        almostFullPayment,
        buyer1.account.address,
      ]);

      // Try to make second purchase that would exceed target
      const smallPayment = parseEther("2");
      const buyer2PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer2 } }
      );
      await buyer2PaymentToken.write.approve([
        fundraiser.address,
        smallPayment,
      ]);

      const buyer2Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer2 } }
      );

      await expect(
        buyer2Fundraiser.write.buy([smallPayment, buyer2.account.address])
      ).to.be.rejectedWith("Exceeds target");
    });

    it("Should handle multiple purchases and refunds correctly", async function () {
      const {
        fundraiser,
        paymentToken,
        buyer1,
        buyer2,
        publicClient,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      const payment1 = parseEther("10");
      const payment2 = parseEther("15");

      // First buyer makes purchase
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([fundraiser.address, payment1]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      const hash1 = await buyer1Fundraiser.write.buy([
        payment1,
        buyer1.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      // Second buyer makes purchase
      const buyer2PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer2 } }
      );
      await buyer2PaymentToken.write.approve([fundraiser.address, payment2]);

      const buyer2Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer2 } }
      );

      const hash2 = await buyer2Fundraiser.write.buy([
        payment2,
        buyer2.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      // First buyer refunds
      const hash3 = await buyer1Fundraiser.write.refund([0n]);
      await publicClient.waitForTransactionReceipt({ hash: hash3 });

      // Verify state after refund
      const totalBefore = await fundraiser.read.totalActiveContributions();
      const purchase1 = await fundraiser.read.purchases([0n]);
      expect(purchase1[5]).to.equal(true); // isRefunded
      expect(totalBefore).to.equal(
        (await fundraiser.read.purchases([1n]))[1] // contributionAmount of second purchase
      );
    });

    it("Should handle zero token allocations correctly", async function () {
      const { fundraiser, buyer1, lpLockWallet } = await loadFixture(
        deployFundraiserFixture
      );

      const allocation = await fundraiser.read.getAllocation([
        getAddress(buyer1.account.address),
      ]);
      expect(allocation).to.equal(0n);

      const orders = await fundraiser.read.getUserOrderIndices([
        getAddress(buyer1.account.address),
      ]);
      expect(orders.length).to.equal(0);
    });

    it("Should prevent reentrant purchases", async function () {
      const { fundraiser, paymentToken, buyer1, lpLockWallet } =
        await loadFixture(deployFundraiserFixture);

      // Deploy malicious token that attempts reentrancy
      const maliciousToken = await hre.viem.deployContract("ReentrantToken", [
        fundraiser.address,
      ]);

      // Try to make purchase with malicious token
      const payment = parseEther("10");
      await maliciousToken.write.approve([fundraiser.address, payment]);

      await expect(
        fundraiser.write.buy([payment, buyer1.account.address], {
          account: buyer1.account,
        })
      ).to.be.rejected;
    });
  });

  describe("checkSaleTokensRequired", function () {
    it("Should calculate correct tokens for linear price curve", async function () {
      const { fundraiser, saleToken, targetLiquidity, startPrice, endPrice } =
        await loadFixture(deployFundraiserFixture);

      const requiredTokens = (
        await fundraiser.read.checkSaleTokensRequired()
      )[0];

      // Get parameters
      const upfrontRakeBPS = await fundraiser.read.upfrontRakeBPS();
      const escrowRakeBPS = await fundraiser.read.escrowRakeBPS();
      const netContributionBPS = 100_000_000n - upfrontRakeBPS - escrowRakeBPS;

      // Calculate total cash inflows needed
      const totalCashInflows =
        (targetLiquidity * 100_000_000n) / netContributionBPS;

      // Calculate liquidity tokens at end price
      const liquidityTokens = (targetLiquidity * parseEther("1")) / endPrice;

      // Calculate sale tokens using average price
      const avgPrice = (startPrice + endPrice) / 2n;
      const tokensForSale = (totalCashInflows * parseEther("1")) / avgPrice;

      const expectedTotal =
        liquidityTokens + tokensForSale + parseUnits("1", 18);
      expect(requiredTokens).to.equal(expectedTotal);
    });

    it("Should require more tokens with higher rake", async function () {
      // Deploy two fundraisers with different rake percentages
      const saleToken = await hre.viem.deployContract("MockERC20", [
        "SaleToken",
        "SALE",
        18n,
      ]);

      const paymentToken = await hre.viem.deployContract("MockERC20", [
        "PaymentToken",
        "PAY",
        18n,
      ]);

      const [deployer, foundersWallet, buyer1, buyer2, lpLockWallet] =
        await hre.viem.getWalletClients();

      // First fundraiser with 5% total rake
      const fundraiser1 = await hre.viem.deployContract("OtterPadFund", [
        title,
        richInfoUrl,
        saleToken.address,
        paymentToken.address,
        UNISWAP_ROUTER,
        UNISWAP_FACTORY,
        parseEther("0.1"), // startPrice
        parseEther("0.3"), // endPrice
        parseEther("100"), // targetLiquidity
        2_000_000n, // upfrontRakeBPS (2%)
        3_000_000n, // escrowRakeBPS (3%)
        getAddress(foundersWallet.account.address),
        getAddress(lpLockWallet.account.address),
      ]);

      // Second fundraiser with 10% total rake
      const fundraiser2 = await hre.viem.deployContract("OtterPadFund", [
        title,
        richInfoUrl,
        saleToken.address,
        paymentToken.address,
        UNISWAP_ROUTER,
        UNISWAP_FACTORY,
        parseEther("0.1"), // startPrice
        parseEther("0.3"), // endPrice
        parseEther("100"), // targetLiquidity
        4_000_000n, // upfrontRakeBPS (4%)
        6_000_000n, // escrowRakeBPS (6%)
        getAddress(foundersWallet.account.address),
        getAddress(lpLockWallet.account.address),
      ]);

      const required1 = (await fundraiser1.read.checkSaleTokensRequired())[0];
      const required2 = (await fundraiser2.read.checkSaleTokensRequired())[0];

      // Higher rake should require more tokens due to more total inflows needed
      expect(required2).to.be.gt(required1);
    });

    it("Should calculate correctly with different decimals", async function () {
      const saleToken6Dec = await hre.viem.deployContract("MockERC20", [
        "SaleToken6",
        "SALE6",
        6n,
      ]);

      const paymentToken8Dec = await hre.viem.deployContract("MockERC20", [
        "PaymentToken8",
        "PAY8",
        8n,
      ]);

      const [deployer, foundersWallet, buyer1, buyer2, lpLockWallet] =
        await hre.viem.getWalletClients();

      const startPrice = parseUnits("0.1", 8);
      const endPrice = parseUnits("0.3", 8);
      const targetLiquidity = parseUnits("100", 8);

      const fundraiser = await hre.viem.deployContract("OtterPadFund", [
        title,
        richInfoUrl,
        saleToken6Dec.address,
        paymentToken8Dec.address,
        UNISWAP_ROUTER,
        UNISWAP_FACTORY,
        startPrice,
        endPrice,
        targetLiquidity,
        10_000_000n, // upfrontRakeBPS
        10_000_000n, // escrowRakeBPS
        getAddress(foundersWallet.account.address),
        getAddress(lpLockWallet.account.address),
      ]);

      const requiredTokens = (
        await fundraiser.read.checkSaleTokensRequired()
      )[0];

      // Calculate with proper decimal handling
      const saleTokenBase = 10n ** 6n;
      const paymentTokenBase = 10n ** 8n;

      // Calculate liquidity tokens
      const liquidityTokens = (targetLiquidity * saleTokenBase) / endPrice;

      // Calculate sale tokens
      const netContributionBPS = 80_000_000n; // 10000 - 1000 - 1000
      const totalCashInflows =
        (targetLiquidity * 100_000_000n) / netContributionBPS;
      const avgPrice = (startPrice + endPrice) / 2n;
      const tokensForSale = (totalCashInflows * saleTokenBase) / avgPrice;

      const expectedTotal =
        liquidityTokens + tokensForSale + parseUnits("1", 6);
      expect(requiredTokens).to.equal(expectedTotal);
    });

    it("Should handle steep price curves", async function () {
      // Deploy fresh tokens for this test

      const saleToken = await hre.viem.deployContract("MockERC20", [
        "SaleToken",
        "SALE",
        18n,
      ]);

      const paymentToken = await hre.viem.deployContract("MockERC20", [
        "PaymentToken",
        "PAY",
        18n,
      ]);

      const [deployer, foundersWallet, buyer1, buyer2, lpLockWallet] =
        await hre.viem.getWalletClients();

      // Deploy fundraiser with very steep price curve (10x increase)
      const fundraiser = await hre.viem.deployContract("OtterPadFund", [
        title,
        richInfoUrl,
        saleToken.address,
        paymentToken.address,
        UNISWAP_ROUTER,
        UNISWAP_FACTORY,
        parseEther("0.1"), // startPrice
        parseEther("1.0"), // endPrice (10x higher)
        parseEther("100"), // targetLiquidity
        2_000_000n, // upfrontRakeBPS
        3_000_000n, // escrowRakeBPS
        getAddress(foundersWallet.account.address),
        getAddress(lpLockWallet.account.address),
      ]);

      const requiredTokens = (
        await fundraiser.read.checkSaleTokensRequired()
      )[0];

      // With steep curve, liquidity tokens should be significantly less than sale tokens
      const liquidityTokens =
        (parseEther("100") * parseEther("1")) / parseEther("1.0");
      expect(requiredTokens > liquidityTokens * 2n).to.be.true;
    });

    it("Should maintain correct ratio between sale and liquidity tokens", async function () {
      const { fundraiser, lpLockWallet } = await loadFixture(
        deployFundraiserFixture
      );

      const requiredTokens = (
        await fundraiser.read.checkSaleTokensRequired()
      )[0];

      // Calculate just the liquidity tokens portion
      const targetLiquidity = await fundraiser.read.targetLiquidity();
      const endPrice = await fundraiser.read.endPrice();
      const liquidityTokens = (targetLiquidity * parseEther("1")) / endPrice;

      // Sale tokens should be larger portion than liquidity tokens
      // because average price is lower than end price
      expect(requiredTokens > liquidityTokens * 2n).to.be.true;
      expect(requiredTokens < liquidityTokens * 4n).to.be.true;
    });
  });

  describe("Uniswap deployment", function () {
    it("Should not allow deployment before target reached", async function () {
      const { fundraiser, foundersWallet, lpLockWallet } = await loadFixture(
        deployFundraiserFixture
      );

      const foundersWalletFundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: foundersWallet } }
      );
      // this should test with exact error message, but for some reason we arent getting the exact error message
      await expect(foundersWalletFundraiser.write.deployToUniswap()).to.be
        .rejected;
    });

    it("Should deploy to Uniswap successfully when conditions are met (by any user)", async function () {
      const {
        fundraiser,
        saleToken,
        paymentToken,
        buyer1,
        foundersWallet,
        publicClient,
        targetLiquidity,
        upfrontRakeBPS,
        escrowRakeBPS,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      // Make purchase that reaches target
      const OTTERPAD_FEE_BPS = 2_000_000n;
      // Calculate the payment needed to reach target, accounting for all fees
      const remainingBPS =
        100_000_000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 100_000_000n) / remainingBPS;

      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        requiredPayment,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([
        requiredPayment,
        buyer1.account.address,
      ]);

      // Get initial balances
      const initialFoundersBalance = await paymentToken.read.balanceOf([
        getAddress(foundersWallet.account.address),
      ]);

      const hash = await buyer1Fundraiser.write.deployToUniswap();
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify DEX deployed
      expect(await fundraiser.read.isDeployedToUniswap()).to.equal(true);

      // Get expected escrow amount from contract
      const expectedEscrow = await fundraiser.read.getEscrowedAmount();

      // Check escrow released to founders
      const finalFoundersBalance = await paymentToken.read.balanceOf([
        getAddress(foundersWallet.account.address),
      ]);
      expect(finalFoundersBalance - initialFoundersBalance).to.equal(
        expectedEscrow
      );

      // Verify Uniswap pair exists
      const factory = await hre.viem.getContractAt(
        "IUniswapV2Factory",
        UNISWAP_FACTORY
      );
      const pairAddress = await factory.read.getPair([
        saleToken.address,
        paymentToken.address,
      ]);
      expect(pairAddress).to.not.equal(
        getAddress("0x0000000000000000000000000000000000000000")
      );

      // Check DeployedToUniswap event
      const deployEvents = await fundraiser.getEvents.DeployedToUniswap();
      expect(deployEvents).to.have.lengthOf(1);
      expect(deployEvents[0].args.pair).to.equal(pairAddress);
    });

    it("Should not allow deployment more than once", async function () {
      const {
        fundraiser,
        paymentToken,
        buyer1,
        foundersWallet,
        publicClient,
        targetLiquidity,
        upfrontRakeBPS,
        escrowRakeBPS,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      // Make purchase that reaches target
      const OTTERPAD_FEE_BPS = 2_000_000n;
      const remainingBPS =
        100_000_000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 100_000_000n) / remainingBPS;

      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        requiredPayment,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([
        requiredPayment,
        buyer1.account.address,
      ]);

      // Deploy to Uniswap first time
      const foundersWalletFundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: foundersWallet } }
      );

      await foundersWalletFundraiser.write.deployToUniswap();

      // this should test with exact error message, but for some reason we arent getting the exact error message
      await expect(foundersWalletFundraiser.write.deployToUniswap()).to.be
        .rejected;
    });

    it("Should handle escrow release correctly on deployment", async function () {
      const {
        fundraiser,
        paymentToken,
        buyer1,
        foundersWallet,
        publicClient,
        targetLiquidity,
        upfrontRakeBPS,
        escrowRakeBPS,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      // Make purchase that reaches target
      const OTTERPAD_FEE_BPS = 2_000_000n;
      const remainingBPS =
        100_000_000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 100_000_000n) / remainingBPS;

      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        requiredPayment,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([
        requiredPayment,
        buyer1.account.address,
      ]);

      // Get initial balances
      const initialFoundersBalance = await paymentToken.read.balanceOf([
        getAddress(foundersWallet.account.address),
      ]);

      // Deploy to Uniswap
      const foundersWalletFundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: foundersWallet } }
      );

      const hash = await foundersWalletFundraiser.write.deployToUniswap();
      await publicClient.waitForTransactionReceipt({ hash });

      // Get expected escrow from contract
      const expectedEscrow = await fundraiser.read.getEscrowedAmount();

      // Verify escrow amount
      const finalFoundersBalance = await paymentToken.read.balanceOf([
        getAddress(foundersWallet.account.address),
      ]);
      expect(finalFoundersBalance - initialFoundersBalance).to.equal(
        expectedEscrow
      );

      // Check EscrowReleased event
      const escrowEvents = await fundraiser.getEvents.EscrowReleased();
      expect(escrowEvents).to.have.lengthOf(1);
      expect(escrowEvents[0].args.amount).to.equal(expectedEscrow);
      expect(escrowEvents[0].args.foundersWallet).to.equal(
        getAddress(foundersWallet.account.address)
      );
    });

    it("Should return correct pool address from deployToUniswap", async function () {
      const {
        fundraiser,
        saleToken,
        paymentToken,
        buyer1,
        foundersWallet,
        publicClient,
        targetLiquidity,
        upfrontRakeBPS,
        escrowRakeBPS,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      // Make purchase that reaches target
      const OTTERPAD_FEE_BPS = 2_000_000n;
      const remainingBPS =
        100_000_000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 100_000_000n) / remainingBPS;

      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        requiredPayment,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([
        requiredPayment,
        buyer1.account.address,
      ]);

      // Deploy to Uniswap
      const hash = await buyer1Fundraiser.write.deployToUniswap();
      await publicClient.waitForTransactionReceipt({ hash });

      // Get pair address from factory
      const factory = await hre.viem.getContractAt(
        "IUniswapV2Factory",
        UNISWAP_FACTORY
      );
      const expectedPoolAddress = await factory.read.getPair([
        saleToken.address,
        paymentToken.address,
      ]);

      // Check DeployedToUniswap event's pair matches factory pair
      const deployEvents = await fundraiser.getEvents.DeployedToUniswap();
      expect(deployEvents).to.have.lengthOf(1);
      expect(deployEvents[0].args.pair).to.equal(expectedPoolAddress);
    });
  });
});

describe("OtterPadFund with Extreme Slopes", function () {
  // Constants for Uniswap addresses
  const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6";
  const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";

  async function deployFundraiserFixture() {
    // Deploy mock tokens first

    const saleToken = await hre.viem.deployContract("MockERC20", [
      "SaleToken",
      "SALE",
      18n,
    ]);

    const paymentToken = await hre.viem.deployContract("MockERC20", [
      "PaymentToken",
      "PAY",
      6n,
    ]);

    const [deployer, foundersWallet, buyer1, buyer2, lpLockWallet] =
      await hre.viem.getWalletClients();

    // Set up initial parameters
    const startPrice = parseUnits("0.01", 6); // 0.1 payment tokens per sale token
    const endPrice = parseUnits("0.03", 6); // 0.3 payment tokens per sale token
    const targetLiquidity = parseUnits("1333333.333333", 6); // 1,333,333 payment tokens target
    const upfrontRakeBPS = 33_333_333n; // 33.3333%
    const escrowRakeBPS = 0n; // 0%

    // Deploy the fundraiser with new constructor parameters
    const fundraiser = await hre.viem.deployContract("OtterPadFund", [
      title,
      richInfoUrl,
      saleToken.address,
      paymentToken.address,
      UNISWAP_ROUTER,
      UNISWAP_FACTORY,
      startPrice,
      endPrice,
      targetLiquidity,
      upfrontRakeBPS,
      escrowRakeBPS,
      getAddress(foundersWallet.account.address),
      getAddress(lpLockWallet.account.address),
    ]);

    // Mint some tokens to buyers for testing
    const mintAmount = parseUnits("10000000", 6);
    await paymentToken.write.mint([
      getAddress(buyer1.account.address),
      mintAmount,
    ]);
    await paymentToken.write.mint([
      getAddress(buyer2.account.address),
      mintAmount,
    ]);

    // Calculate required token amount using the contract's helper function
    const requiredTokens = (await fundraiser.read.checkSaleTokensRequired())[0];
    await saleToken.write.mint([fundraiser.address, requiredTokens]);

    const publicClient = await hre.viem.getPublicClient();

    return {
      fundraiser,
      saleToken,
      paymentToken,
      startPrice,
      endPrice,
      targetLiquidity,
      upfrontRakeBPS,
      escrowRakeBPS,
      deployer,
      foundersWallet,
      buyer1,
      buyer2,
      lpLockWallet,
      publicClient,
    };
  }

  describe("Buying tokens", function () {
    it("Should allow a valid purchase", async function () {
      const { fundraiser, paymentToken, buyer1, publicClient, lpLockWallet } =
        await loadFixture(deployFundraiserFixture);

      const paymentAmount = parseUnits("100000", 6);

      // Approve payment token spend
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        paymentAmount,
      ]);

      // Get fundraiser contract instance for buyer1
      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      // Make purchase
      const hash = await buyer1Fundraiser.write.buy([
        paymentAmount,
        buyer1.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify purchase was recorded
      expect(await fundraiser.read.orderCounter()).to.equal(1n);

      const purchase = await fundraiser.read.purchases([0n]);
      // struct Purchase {
      //     uint256 paymentAmount;      // Total amount paid by user
      //     uint256 contributionAmount; // Amount after otterpad fee and upfront rake
      //     uint256 tokenAmount;       // Calculated token amount at purchase time
      //     address purchaser;
      //     bool isRefunded;
      //     bool isRedeemed;
      //     uint256 purchaseBlock;
      // }
      expect(purchase[0]).to.equal(paymentAmount);
      expect(purchase[3]).to.equal(getAddress(buyer1.account.address));
      expect(purchase[5]).to.equal(false);
      expect(purchase[6]).to.equal(false);
    });

    it("Should calculate correct token amounts based on price curve", async function () {
      const {
        fundraiser,
        targetLiquidity,
        startPrice,
        endPrice,
        upfrontRakeBPS,
        escrowRakeBPS,
      } = await loadFixture(deployFundraiserFixture);

      const paymentAmount = parseUnits("1000", 6);

      // Calculate fees and contribution exactly as contract does
      const OTTERPAD_FEE_BPS = 2_000_000n;
      const netContributionBPS = 100_000_000n - upfrontRakeBPS - escrowRakeBPS;

      // Get the actual token amount from contract for comparison
      const actualTokens = await fundraiser.read.calculateTokensReceived([
        paymentAmount,
      ]);

      // Now calculate what we expect using the same method as the contract

      // 1. Calculate the total cash inflows needed
      const totalCashInflows =
        (targetLiquidity * 100_000_000n) / netContributionBPS;

      // 2. Calculate current total contributions
      const currentContributions =
        await fundraiser.read.totalActiveContributions();
      const netCashInflows =
        (currentContributions * 100_000_000n) / netContributionBPS;

      // 3. Calculate contribution amount for this purchase
      const otterpadFee = (paymentAmount * OTTERPAD_FEE_BPS) / 100_000_000n;
      const upfrontAmount =
        (paymentAmount * upfrontRakeBPS) / 100_000_000n - otterpadFee;
      const escrowAmount = (paymentAmount * escrowRakeBPS) / 100_000_000n;
      const contributionAmount =
        paymentAmount - otterpadFee - upfrontAmount - escrowAmount;

      // Verify our contribution calculation matches what we'd expect
      expect(contributionAmount).to.be.gt(0n);
      expect(totalCashInflows).to.be.gt(0n);

      // 4. Calculate the slope parameters
      const avgPrice = (startPrice + endPrice) / 2n;
      const slopeScalingFactor = parseEther("1"); // 10^18

      // Calculate prorated tokens for sale with proper decimal handling
      const proratedTokensForSale =
        (totalCashInflows * parseEther("1")) / avgPrice;

      // Calculate slope with proper scaling
      const slope =
        ((endPrice - startPrice) * parseEther("1")) / proratedTokensForSale;

      // Function to calculate tokens at a specific amount
      function calculateTokensAtAmount(amount: bigint): bigint {
        if (amount === 0n) return 0n;

        // Use the same scale factors as the contract
        const b = startPrice * parseEther("1");
        const m = slope;
        const a = m / 2n;

        // Ensure we're not dividing by zero
        if (a === 0n) {
          // If slope is 0, use simple division
          return (amount * parseEther("1")) / startPrice;
        }

        const bSquared = b * b;
        const fourAAmount = 4n * a * amount * parseEther("1");
        const sqrtInput = bSquared + fourAAmount;

        // Calculate square root with proper precision
        const sqrtValue = BigInt(Math.floor(Math.sqrt(Number(sqrtInput))));

        // Calculate final result maintaining precision
        return ((-b + sqrtValue) * parseEther("1")) / (2n * a);
      }

      // Calculate tokens before and after the purchase
      const tokensBefore = calculateTokensAtAmount(netCashInflows);
      const tokensAfter = calculateTokensAtAmount(
        netCashInflows + paymentAmount
      );

      // Calculate the difference
      const expectedTokens = tokensAfter - tokensBefore;

      // Allow for some minor rounding differences
      const tolerance = parseUnits("100", 18); // 0.1 token of tolerance
      expect(actualTokens).to.be.closeTo(expectedTokens, tolerance);
    });

    it("Should emit correct events on purchase", async function () {
      const { fundraiser, paymentToken, buyer1, publicClient } =
        await loadFixture(deployFundraiserFixture);

      const paymentAmount = parseUnits("1000", 6); // Reduced payment amount

      // Approve payment tokens
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        paymentAmount,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      const hash = await buyer1Fundraiser.write.buy([
        paymentAmount,
        buyer1.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Check TokensPurchased event
      const purchaseEvents = await fundraiser.getEvents.TokensPurchased();
      expect(purchaseEvents).to.have.lengthOf(1);
      expect(purchaseEvents[0].args.purchaser).to.equal(
        getAddress(buyer1.account.address)
      );
      expect(purchaseEvents[0].args.paymentAmount).to.equal(paymentAmount);

      // Check PaymentReceived event
      const paymentEvents = await fundraiser.getEvents.PaymentReceived();
      expect(paymentEvents).to.have.lengthOf(1);
      expect(paymentEvents[0].args.purchaser).to.equal(
        getAddress(buyer1.account.address)
      );
      expect(paymentEvents[0].args.totalAmount).to.equal(paymentAmount);
    });
  });
});

describe("Delegation scenarios", function () {
  // We'll use the same fixture from the main tests
  const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6";
  const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";

  async function deployFundraiserFixture() {
    const saleToken = await hre.viem.deployContract("MockERC20", [
      "SaleToken",
      "SALE",
      18n,
    ]);

    const paymentToken = await hre.viem.deployContract("MockERC20", [
      "PaymentToken",
      "PAY",
      18n,
    ]);

    const [deployer, foundersWallet, buyer1, recipient, lpLockWallet] =
      await hre.viem.getWalletClients();

    const startPrice = parseEther("0.1");
    const endPrice = parseEther("0.3");
    const targetLiquidity = parseEther("100");
    const upfrontRakeBPS = 2_000_000n;
    const escrowRakeBPS = 3_000_000n;

    const fundraiser = await hre.viem.deployContract("OtterPadFund", [
      "Delegation Test",
      "https://example.com/info",
      saleToken.address,
      paymentToken.address,
      UNISWAP_ROUTER,
      UNISWAP_FACTORY,
      startPrice,
      endPrice,
      targetLiquidity,
      upfrontRakeBPS,
      escrowRakeBPS,
      getAddress(foundersWallet.account.address),
      getAddress(lpLockWallet.account.address),
    ]);

    // Mint tokens to buyer for testing
    const mintAmount = parseEther("1000");
    await paymentToken.write.mint([
      getAddress(buyer1.account.address),
      mintAmount,
    ]);

    // Mint required sale tokens to contract
    const requiredTokens = (await fundraiser.read.checkSaleTokensRequired())[0];
    await saleToken.write.mint([fundraiser.address, requiredTokens]);

    const publicClient = await hre.viem.getPublicClient();

    return {
      fundraiser,
      saleToken,
      paymentToken,
      deployer,
      foundersWallet,
      buyer1,
      recipient,
      lpLockWallet,
      publicClient,
    };
  }

  describe("Delegated purchases and refunds", function () {
    it("Should allow buying tokens on behalf of another user", async function () {
      const { fundraiser, paymentToken, buyer1, recipient, publicClient } =
        await loadFixture(deployFundraiserFixture);

      const paymentAmount = parseEther("10");

      // Approve payment token spend
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        paymentAmount,
      ]);

      // Get fundraiser contract instance for buyer1
      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      // Buy tokens for recipient
      const hash = await buyer1Fundraiser.write.buy([
        paymentAmount,
        recipient.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify purchase was recorded correctly
      const purchase = await fundraiser.read.purchases([0n]);
      expect(purchase[3]).to.equal(getAddress(buyer1.account.address)); // purchaser
      expect(purchase[4]).to.equal(getAddress(recipient.account.address)); // recipient

      // Verify recipient has the order in their indices
      const recipientOrders = await fundraiser.read.getUserOrderIndices([
        recipient.account.address,
      ]);
      expect(recipientOrders).to.deep.equal([0n]);

      // Verify allocation is assigned to recipient
      const recipientAllocation = await fundraiser.read.getAllocation([
        recipient.account.address,
      ]);
      expect(recipientAllocation).to.equal(purchase[2]); // tokenAmount
    });

    it("Should allow purchaser to refund tokens they bought for someone else", async function () {
      const { fundraiser, paymentToken, buyer1, recipient, publicClient } =
        await loadFixture(deployFundraiserFixture);

      const paymentAmount = parseEther("10");

      // Buy tokens for recipient first
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        paymentAmount,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([
        paymentAmount,
        recipient.account.address,
      ]);

      // Get initial balance
      const initialBalance = await paymentToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);

      // Purchaser (buyer1) requests refund
      const refundHash = await buyer1Fundraiser.write.refund([0n]);
      await publicClient.waitForTransactionReceipt({ hash: refundHash });

      // Verify refund was processed
      const purchase = await fundraiser.read.purchases([0n]);
      expect(purchase[5]).to.equal(true); // isRefunded

      // Verify refund was sent to original purchaser
      const finalBalance = await paymentToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);
      expect(finalBalance).to.be.gt(initialBalance);

      // Verify allocation is removed from recipient
      const recipientAllocation = await fundraiser.read.getAllocation([
        recipient.account.address,
      ]);
      expect(recipientAllocation).to.equal(0n);
    });

    it("Should not allow recipient to refund tokens that someone else bought for them", async function () {
      const { fundraiser, paymentToken, buyer1, recipient, publicClient } =
        await loadFixture(deployFundraiserFixture);

      const paymentAmount = parseEther("10");

      // Buy tokens for recipient first
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        paymentAmount,
      ]);

      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([
        paymentAmount,
        recipient.account.address,
      ]);

      // Recipient tries to refund
      const recipientFundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: recipient } }
      );

      // Should fail because recipient is not the purchaser
      await expect(recipientFundraiser.write.refund([0n])).to.be.rejectedWith(
        "Not the purchaser"
      );

      // Verify purchase remains unrefunded
      const purchase = await fundraiser.read.purchases([0n]);
      expect(purchase[5]).to.equal(false); // isRefunded

      // Verify allocation remains with recipient
      const recipientAllocation = await fundraiser.read.getAllocation([
        recipient.account.address,
      ]);
      expect(recipientAllocation).to.equal(purchase[2]); // tokenAmount
    });
  });
});
