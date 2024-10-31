// npx hardhat test

import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther, parseUnits, getAddress } from "viem";

describe("OtterPadFundraiser", function () {
  // We'll use a fixture to reuse the same setup in every test
  async function deployFundraiserFixture() {
    // Deploy mock tokens first
    const saleToken = await hre.viem.deployContract("MockERC20", [
      "SaleToken",
      "SALE",
    ]);
    const paymentToken = await hre.viem.deployContract("MockERC20", [
      "PaymentToken",
      "PAY",
    ]);

    const [deployer, foundersWallet, buyer1, buyer2] =
      await hre.viem.getWalletClients();

    // Set up initial parameters
    const startPrice = parseEther("0.1"); // 0.1 payment tokens per sale token
    const endPrice = parseEther("0.3"); // 0.3 payment tokens per sale token
    const targetLiquidity = parseEther("100"); // 100 payment tokens target
    const upfrontRakeBPS = 200n; // 2%
    const escrowRakeBPS = 300n; // 3%

    // Deploy the fundraiser
    const fundraiser = await hre.viem.deployContract("OtterPadFundraiser", [
      saleToken.address,
      paymentToken.address,
      startPrice,
      endPrice,
      targetLiquidity,
      upfrontRakeBPS,
      escrowRakeBPS,
      getAddress(foundersWallet.account.address),
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

    // Mint sale tokens to the contract
    await saleToken.write.mint([fundraiser.address, parseEther("10000")]); // we need 5000 tokens for DEX and 5000 for sale

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
      } = await loadFixture(deployFundraiserFixture);

      expect(await fundraiser.read.saleToken()).to.equal(
        getAddress(saleToken.address)
      );
      expect(await fundraiser.read.paymentToken()).to.equal(
        getAddress(paymentToken.address)
      );
      expect(await fundraiser.read.startPrice()).to.equal(startPrice);
      expect(await fundraiser.read.endPrice()).to.equal(endPrice);
      expect(await fundraiser.read.targetLiquidity()).to.equal(targetLiquidity);
      expect(await fundraiser.read.upfrontRakeBPS()).to.equal(upfrontRakeBPS);
      expect(await fundraiser.read.escrowRakeBPS()).to.equal(escrowRakeBPS);
      expect(await fundraiser.read.foundersWallet()).to.equal(
        getAddress(foundersWallet.account.address)
      );
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
      const { fundraiser, paymentToken, buyer1, publicClient } =
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
        "OtterPadFundraiser",
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
      const { fundraiser, targetLiquidity, startPrice, endPrice } =
        await loadFixture(deployFundraiserFixture);

      const testAmount = parseEther("10");
      const expectedPrice =
        startPrice + ((endPrice - startPrice) * testAmount) / targetLiquidity;
      const averagePrice = (startPrice + expectedPrice) / 2n;
      const expectedTokens = (testAmount * parseEther("1")) / averagePrice;

      const tokenAmount = await fundraiser.read.calculateTokensReceived([
        testAmount,
      ]);

      expect(tokenAmount).to.equal(expectedTokens);
    });

    it("Should emit correct events on purchase", async function () {
      const { fundraiser, paymentToken, buyer1, publicClient } =
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
        "OtterPadFundraiser",
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
      const { fundraiser, paymentToken, buyer1, publicClient } =
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
        "OtterPadFundraiser",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fundraiser.write.buy([paymentAmount]);

      // Try to redeem
      await expect(buyer1Fundraiser.write.redeem([0n])).to.be.rejectedWith(
        "Target not reached yet"
      );
    });

    it("Should allow redemption after target is reached", async function () {
      const {
        fundraiser,
        paymentToken,
        buyer1,
        publicClient,
        targetLiquidity,
        upfrontRakeBPS,
        escrowRakeBPS,
      } = await loadFixture(deployFundraiserFixture);

      // Calculate required payment to reach target
      // If target = 100 ETH and total rake is 5%, we need 100/(1-0.05) = ~105.26 ETH
      const totalRakeBPS = upfrontRakeBPS + escrowRakeBPS; // Adding OTTERPAD_FEE_BPS (100)
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
        "OtterPadFundraiser",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      // Buy to reach target
      const hash = await buyer1Fundraiser.write.buy([requiredPayment]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify target reached
      expect(await fundraiser.read.targetReached()).to.equal(true);

      // Should now be able to redeem
      await expect(buyer1Fundraiser.write.redeem([0n])).to.be.fulfilled;

      // Verify redemption recorded
      const purchase = await fundraiser.read.purchases([0n]);
      expect(purchase[5]).to.equal(true);
    });
  });

  describe("Refunds", function () {
    it("Should allow refund before target reached", async function () {
      const { fundraiser, paymentToken, buyer1, publicClient } =
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
        "OtterPadFundraiser",
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
        "OtterPadFundraiser",
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
      const { fundraiser, paymentToken, buyer1, publicClient } =
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
        "OtterPadFundraiser",
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
      const { fundraiser, paymentToken, buyer1 } = await loadFixture(
        deployFundraiserFixture
      );

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
        "OtterPadFundraiser",
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
      } = await loadFixture(deployFundraiserFixture);

      // Calculate exact payment needed for target
      const totalRakeBPS = upfrontRakeBPS + escrowRakeBPS; // Including OTTERPAD_FEE_BPS
      const exactPayment = (targetLiquidity * 10000n) / (10000n - totalRakeBPS);

      // Approve and make purchase
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
        "OtterPadFundraiser",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      const hash = await buyer1Fundraiser.write.buy([exactPayment]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify target exactly reached
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
      } = await loadFixture(deployFundraiserFixture);

      // Make first purchase that almost reaches target
      const totalRakeBPS = upfrontRakeBPS + escrowRakeBPS;
      const almostFullPayment =
        (targetLiquidity * 9900n) / (10000n - totalRakeBPS);

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
        "OtterPadFundraiser",
        fundraiser.address,
        { client: { wallet: buyer1 } }
      );

      const hash = await buyer1Fundraiser.write.buy([almostFullPayment]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Try to make second purchase that would exceed target
      const smallPayment = parseEther("1.1");
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
        "OtterPadFundraiser",
        fundraiser.address,
        { client: { wallet: buyer2 } }
      );

      await expect(
        buyer2Fundraiser.write.buy([smallPayment])
      ).to.be.rejectedWith("Exceeds target");
    });

    it("Should handle multiple purchases and refunds correctly", async function () {
      const { fundraiser, paymentToken, buyer1, buyer2, publicClient } =
        await loadFixture(deployFundraiserFixture);

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
        "OtterPadFundraiser",
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
        "OtterPadFundraiser",
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
      const { fundraiser, buyer1 } = await loadFixture(deployFundraiserFixture);

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
      const { fundraiser, paymentToken, buyer1 } = await loadFixture(
        deployFundraiserFixture
      );

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
});
