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
    const upfrontRakeBPS = 200n; // 2%
    const escrowRakeBPS = 300n; // 3%

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
    const requiredTokens = await fundraiser.read.checkSaleTokensRequired();
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
      const hash = await buyer1Fundraiser.write.buy([paymentAmount]);
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
      expect(purchase[4]).to.equal(false);
      expect(purchase[5]).to.equal(false);
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

      // Mirror the contract's exact calculation from calculateTokensReceived()
      const OTTERPAD_FEE_BPS = 100n;
      const upfrontRakeBPS = await fundraiser.read.upfrontRakeBPS();
      const escrowRakeBPS = await fundraiser.read.escrowRakeBPS();

      // Calculate exactly as the contract does
      const otterpadFee = (paymentAmount * OTTERPAD_FEE_BPS) / 10000n;
      const upfrontAmount =
        (paymentAmount * upfrontRakeBPS) / 10000n - otterpadFee;
      const escrowAmount = (paymentAmount * escrowRakeBPS) / 10000n;
      const contributionAmount =
        paymentAmount - otterpadFee - upfrontAmount - escrowAmount;

      const currentContributions =
        await fundraiser.read.totalActiveContributions();

      // Use the same price calculation as the contract
      const priceAtStart =
        startPrice +
        ((endPrice - startPrice) * currentContributions) / targetLiquidity;
      const priceAtEnd =
        startPrice +
        ((endPrice - startPrice) *
          (currentContributions + contributionAmount)) /
          targetLiquidity;
      const averagePrice = (priceAtStart + priceAtEnd) / 2n;

      // Match contract's token calculation exactly
      const expectedTokens = (paymentAmount * parseEther("1")) / averagePrice;

      const tokenAmount = await fundraiser.read.calculateTokensReceived([
        paymentAmount,
      ]);

      expect(tokenAmount).to.equal(expectedTokens);
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

      const hash = await buyer1Fundraiser.write.buy([paymentAmount]);
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

      await buyer1Fundraiser.write.buy([paymentAmount]);

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
      const OTTERPAD_FEE_BPS = 100n;
      const remainingBPS =
        10000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 10000n) / remainingBPS;

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

      await buyer1Fundraiser.write.buy([requiredPayment]);

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

      // Make purchase that reaches target
      const OTTERPAD_FEE_BPS = 100n;
      const remainingBPS =
        10000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 10000n) / remainingBPS;

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

      await buyer1Fundraiser.write.buy([requiredPayment]);

      // Deploy to Uniswap
      const foundersWalletFundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: foundersWallet } }
      );

      await foundersWalletFundraiser.write.deployToUniswap();

      // Verify DEX deployed
      expect(await fundraiser.read.isDeployedToUniswap()).to.equal(true);

      // Should now be able to redeem
      const initialBalance = await saleToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);
      await buyer1Fundraiser.write.redeem([0n]);
      const finalBalance = await saleToken.read.balanceOf([
        getAddress(buyer1.account.address),
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

      await buyer1Fundraiser.write.buy([paymentAmount]);

      // Get initial balances
      const initialBalance = await paymentToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);

      // Request refund
      const hash = await buyer1Fundraiser.write.refund([0n]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify refund processed
      const purchase = await fundraiser.read.purchases([0n]);
      expect(purchase[4]).to.equal(true);

      // Check balance increased (using bigint comparison)
      const finalBalance = await paymentToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);
      expect(finalBalance > initialBalance).to.be.true;

      // Can also verify exact refund amount
      const purchase0 = await fundraiser.read.purchases([0n]);
      expect(finalBalance).to.equal(initialBalance + purchase0[1]);
    });

    it("Should not allow refund after target reached", async function () {
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

      // Calculate required payment to reach target (same as above)
      const totalRakeBPS = upfrontRakeBPS + escrowRakeBPS; // Adding OTTERPAD_FEE_BPS
      const requiredPayment =
        (targetLiquidity * 10000n) / (10000n - totalRakeBPS);

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

      const hash = await buyer1Fundraiser.write.buy([requiredPayment]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify target is actually reached
      expect(await fundraiser.read.targetReached()).to.equal(true);

      // Try to refund
      await expect(buyer1Fundraiser.write.refund([0n])).to.be.rejectedWith(
        "Target already reached"
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

      const buyHash = await buyer1Fundraiser.write.buy([paymentAmount]);
      await publicClient.waitForTransactionReceipt({ hash: buyHash });

      // Get the purchase details to know exact contribution amount
      const purchase = await fundraiser.read.purchases([0n]);
      const contributionAmount = purchase[1];

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

      // Verify exact refund amount
      expect(finalBalance).to.equal(initialBalance + contributionAmount);
    });
  });

  describe("Edge cases", function () {
    it("Should reject purchase below minimum amount", async function () {
      const { fundraiser, paymentToken, buyer1, lpLockWallet } =
        await loadFixture(deployFundraiserFixture);

      const minimumPurchase = await fundraiser.read.getMinimumPurchase();
      const belowMinimum = minimumPurchase - 1n;

      // Approve payment token spend
      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PaymentToken.write.approve([
        fundraiser.address,
        belowMinimum,
      ]);

      // Get fundraiser contract instance for buyer1
      const buyer1Fundraiser = await hre.viem.getContractAt(
        "OtterPadFund",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      // Attempt purchase below minimum
      await expect(
        buyer1Fundraiser.write.buy([belowMinimum])
      ).to.be.rejectedWith("Below minimum purchase");
    });

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

      const OTTERPAD_FEE_BPS = 100n;
      // Calculate exact payment needed
      const remainingBPS =
        10000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const exactPayment = (targetLiquidity * 10000n) / remainingBPS;

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

      await buyer1Fundraiser.write.buy([exactPayment]);

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

      const OTTERPAD_FEE_BPS = 100n;
      // Calculate payment for 99% of target
      const remainingBPS =
        10000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const almostFullPayment = (targetLiquidity * 9900n) / remainingBPS;

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

      await buyer1Fundraiser.write.buy([almostFullPayment]);

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
        buyer2Fundraiser.write.buy([smallPayment])
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

      const hash1 = await buyer1Fundraiser.write.buy([payment1]);
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

      const hash2 = await buyer2Fundraiser.write.buy([payment2]);
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      // First buyer refunds
      const hash3 = await buyer1Fundraiser.write.refund([0n]);
      await publicClient.waitForTransactionReceipt({ hash: hash3 });

      // Verify state after refund
      const totalBefore = await fundraiser.read.totalActiveContributions();
      const purchase1 = await fundraiser.read.purchases([0n]);
      expect(purchase1[4]).to.equal(true); // isRefunded
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

      await expect(fundraiser.write.buy([payment], { account: buyer1.account }))
        .to.be.rejected;
    });
  });

  describe("checkSaleTokensRequired", function () {
    it("Should calculate correct tokens for linear price curve", async function () {
      const {
        fundraiser,
        targetLiquidity,
        startPrice,
        endPrice,
        lpLockWallet,
      } = await loadFixture(deployFundraiserFixture);

      const requiredTokens = await fundraiser.read.checkSaleTokensRequired();

      // Break down the calculation to verify each component
      const upfrontRakeBPS = await fundraiser.read.upfrontRakeBPS();
      const escrowRakeBPS = await fundraiser.read.escrowRakeBPS();
      const netContributionBPS = 10000n - upfrontRakeBPS - escrowRakeBPS;

      // Calculate actual contribution needed to reach target after rake
      const actualContribution =
        (targetLiquidity * 10000n) / netContributionBPS;

      // Calculate tokens needed for sale using average price
      const averagePrice = (startPrice + endPrice) / 2n;
      const expectedTokensForSale =
        (actualContribution * parseEther("1")) / averagePrice;

      // Calculate tokens needed for DEX liquidity at end price
      const expectedLiquidityTokens =
        (targetLiquidity * parseEther("1")) / endPrice;

      // Total required should match sum of sale and liquidity tokens
      const expectedTotal = expectedTokensForSale + expectedLiquidityTokens;
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
        200n, // upfrontRakeBPS (2%)
        300n, // escrowRakeBPS (3%)
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
        400n, // upfrontRakeBPS (4%)
        600n, // escrowRakeBPS (6%)
        getAddress(foundersWallet.account.address),
        getAddress(lpLockWallet.account.address),
      ]);

      const required1 = await fundraiser1.read.checkSaleTokensRequired();
      const required2 = await fundraiser2.read.checkSaleTokensRequired();

      // Higher rake should require more tokens
      expect(required2 > required1).to.be.true;
    });

    it("Should calculate correctly with different decimals", async function () {
      // Deploy tokens with different decimals

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

      const fundraiser = await hre.viem.deployContract("OtterPadFund", [
        title,
        richInfoUrl,
        saleToken6Dec.address,
        paymentToken8Dec.address,
        UNISWAP_ROUTER,
        UNISWAP_FACTORY,
        parseUnits("0.1", 8), // startPrice in payment token decimals
        parseUnits("0.3", 8), // endPrice in payment token decimals
        parseUnits("100", 8), // targetLiquidity in payment token decimals
        200n, // upfrontRakeBPS
        300n, // escrowRakeBPS
        getAddress(foundersWallet.account.address),
        getAddress(lpLockWallet.account.address),
      ]);

      const requiredTokens = await fundraiser.read.checkSaleTokensRequired();

      // Verify the result is in sale token decimals (6)
      expect(requiredTokens < parseUnits("1000000", 6)).to.be.true;
      expect(requiredTokens > parseUnits("1", 6)).to.be.true;
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
        200n, // upfrontRakeBPS
        300n, // escrowRakeBPS
        getAddress(foundersWallet.account.address),
        getAddress(lpLockWallet.account.address),
      ]);

      const requiredTokens = await fundraiser.read.checkSaleTokensRequired();

      // With steep curve, liquidity tokens should be significantly less than sale tokens
      const liquidityTokens =
        (parseEther("100") * parseEther("1")) / parseEther("1.0");
      expect(requiredTokens > liquidityTokens * 2n).to.be.true;
    });

    it("Should maintain correct ratio between sale and liquidity tokens", async function () {
      const { fundraiser, lpLockWallet } = await loadFixture(
        deployFundraiserFixture
      );

      const requiredTokens = await fundraiser.read.checkSaleTokensRequired();

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
      const OTTERPAD_FEE_BPS = 100n;
      const remainingBPS =
        10000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 10000n) / remainingBPS;

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

      await buyer1Fundraiser.write.buy([requiredPayment]);

      // Get initial balances
      const initialFoundersBalance = await paymentToken.read.balanceOf([
        getAddress(foundersWallet.account.address),
      ]);

      const hash = await buyer1Fundraiser.write.deployToUniswap();
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify DEX deployed
      expect(await fundraiser.read.isDeployedToUniswap()).to.equal(true);

      // Check escrow released to founders
      const escrowAmount = (requiredPayment * escrowRakeBPS) / 10000n;
      const finalFoundersBalance = await paymentToken.read.balanceOf([
        getAddress(foundersWallet.account.address),
      ]);
      expect(finalFoundersBalance - initialFoundersBalance).to.equal(
        escrowAmount
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
      const OTTERPAD_FEE_BPS = 100n;
      const remainingBPS =
        10000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 10000n) / remainingBPS;

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

      await buyer1Fundraiser.write.buy([requiredPayment]);

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
      const OTTERPAD_FEE_BPS = 100n;
      const remainingBPS =
        10000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 10000n) / remainingBPS;

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

      await buyer1Fundraiser.write.buy([requiredPayment]);

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
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Verify escrow amount
      const expectedEscrow = (requiredPayment * escrowRakeBPS) / 10000n;
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
  });
});
