import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther, parseUnits, getAddress } from "viem";

describe("OtterPadFactory", function () {
  // Constants for Uniswap addresses - using the same test addresses as in Fund tests
  const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6";
  const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";

  async function deployFactoryFixture() {
    // Deploy the factory first
    const factory = await hre.viem.deployContract("OtterPadFactory", [
      UNISWAP_ROUTER,
      UNISWAP_FACTORY,
    ]);

    // Deploy mock tokens for testing
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

    const [deployer, foundersWallet, user1, user2] =
      await hre.viem.getWalletClients();

    // Standard parameters for fund creation
    const defaultParams = {
      title: "Test Fund",
      richInfoUrl: "https://example.com/info",
      startPrice: parseEther("0.1"),
      endPrice: parseEther("0.3"),
      targetLiquidity: parseEther("100"),
      upfrontRakeBPS: 200n,
      escrowRakeBPS: 300n,
    };

    return {
      factory,
      saleToken,
      paymentToken,
      deployer,
      foundersWallet,
      user1,
      user2,
      defaultParams,
    };
  }

  describe("Deployment", function () {
    it("Should deploy with correct initial state", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);

      expect(await factory.read.uniswapRouter()).to.equal(UNISWAP_ROUTER);
      expect(await factory.read.uniswapFactory()).to.equal(UNISWAP_FACTORY);
      expect(await factory.read.fundCounterIndex()).to.equal(0n);
    });

    it("Should reject deployment with zero addresses", async function () {
      await expect(
        hre.viem.deployContract("OtterPadFactory", [
          "0x0000000000000000000000000000000000000000",
          UNISWAP_FACTORY,
        ])
      ).to.be.rejectedWith("Invalid router address");

      await expect(
        hre.viem.deployContract("OtterPadFactory", [
          UNISWAP_ROUTER,
          "0x0000000000000000000000000000000000000000",
        ])
      ).to.be.rejectedWith("Invalid factory address");
    });
  });

  describe("Fund Creation", function () {
    it("Should create a new fund with valid parameters", async function () {
      const {
        factory,
        saleToken,
        paymentToken,
        foundersWallet,
        defaultParams,
      } = await loadFixture(deployFactoryFixture);

      const createFundTx = await factory.write.createFundraiser([
        defaultParams.upfrontRakeBPS,
        defaultParams.escrowRakeBPS,
        defaultParams.startPrice,
        defaultParams.endPrice,
        defaultParams.targetLiquidity,
        saleToken.address,
        paymentToken.address,
        getAddress(foundersWallet.account.address),
        defaultParams.title,
        defaultParams.richInfoUrl,
      ]);

      // Verify fund counter increased
      expect(await factory.read.fundCounterIndex()).to.equal(1n);

      // Get fund address and verify it's not zero
      const fundAddress = await factory.read.funds([0n]);
      expect(fundAddress).to.not.equal(
        "0x0000000000000000000000000000000000000000"
      );

      // Check emitted event
      const events = await factory.getEvents.FundCreated();
      expect(events).to.have.lengthOf(1);
      expect(events[0].args.fundIndex).to.equal(0n);
      expect(events[0].args.fund).to.equal(fundAddress);
      expect(events[0].args.saleToken).to.equal(getAddress(saleToken.address));
      expect(events[0].args.paymentToken).to.equal(
        getAddress(paymentToken.address)
      );
      expect(events[0].args.title).to.equal(defaultParams.title);
      expect(events[0].args.targetLiquidity).to.equal(
        defaultParams.targetLiquidity
      );
      expect(events[0].args.upfrontRakeBPS).to.equal(
        defaultParams.upfrontRakeBPS
      );
      expect(events[0].args.escrowRakeBPS).to.equal(
        defaultParams.escrowRakeBPS
      );
      expect(events[0].args.foundersWallet).to.equal(
        getAddress(foundersWallet.account.address)
      );
    });

    it("Should reject invalid creation parameters", async function () {
      const {
        factory,
        saleToken,
        paymentToken,
        foundersWallet,
        defaultParams,
      } = await loadFixture(deployFactoryFixture);

      // Test zero address for sale token
      await expect(
        factory.write.createFundraiser([
          defaultParams.upfrontRakeBPS,
          defaultParams.escrowRakeBPS,
          defaultParams.startPrice,
          defaultParams.endPrice,
          defaultParams.targetLiquidity,
          "0x0000000000000000000000000000000000000000",
          paymentToken.address,
          getAddress(foundersWallet.account.address),
          defaultParams.title,
          defaultParams.richInfoUrl,
        ])
      ).to.be.rejectedWith("Invalid sale token");

      // Test zero start price
      await expect(
        factory.write.createFundraiser([
          defaultParams.upfrontRakeBPS,
          defaultParams.escrowRakeBPS,
          0n,
          defaultParams.endPrice,
          defaultParams.targetLiquidity,
          saleToken.address,
          paymentToken.address,
          getAddress(foundersWallet.account.address),
          defaultParams.title,
          defaultParams.richInfoUrl,
        ])
      ).to.be.rejectedWith("Invalid start price");

      // Test end price <= start price
      await expect(
        factory.write.createFundraiser([
          defaultParams.upfrontRakeBPS,
          defaultParams.escrowRakeBPS,
          defaultParams.startPrice,
          defaultParams.startPrice,
          defaultParams.targetLiquidity,
          saleToken.address,
          paymentToken.address,
          getAddress(foundersWallet.account.address),
          defaultParams.title,
          defaultParams.richInfoUrl,
        ])
      ).to.be.rejectedWith("End price must exceed start price");

      // Test empty title
      await expect(
        factory.write.createFundraiser([
          defaultParams.upfrontRakeBPS,
          defaultParams.escrowRakeBPS,
          defaultParams.startPrice,
          defaultParams.endPrice,
          defaultParams.targetLiquidity,
          saleToken.address,
          paymentToken.address,
          getAddress(foundersWallet.account.address),
          "",
          defaultParams.richInfoUrl,
        ])
      ).to.be.rejectedWith("Empty title");
    });

    it("Should create multiple funds correctly", async function () {
      const {
        factory,
        saleToken,
        paymentToken,
        foundersWallet,
        defaultParams,
      } = await loadFixture(deployFactoryFixture);

      // Create first fund
      await factory.write.createFundraiser([
        defaultParams.upfrontRakeBPS,
        defaultParams.escrowRakeBPS,
        defaultParams.startPrice,
        defaultParams.endPrice,
        defaultParams.targetLiquidity,
        saleToken.address,
        paymentToken.address,
        getAddress(foundersWallet.account.address),
        defaultParams.title,
        defaultParams.richInfoUrl,
      ]);

      // Create second fund with different title
      await factory.write.createFundraiser([
        defaultParams.upfrontRakeBPS,
        defaultParams.escrowRakeBPS,
        defaultParams.startPrice,
        defaultParams.endPrice,
        defaultParams.targetLiquidity,
        saleToken.address,
        paymentToken.address,
        getAddress(foundersWallet.account.address),
        "Second Fund",
        defaultParams.richInfoUrl,
      ]);

      // Verify counter and individual fund addresses
      expect(await factory.read.fundCounterIndex()).to.equal(2n);

      const fund0 = await factory.read.funds([0n]);
      const fund1 = await factory.read.funds([1n]);

      expect(fund0).to.not.equal("0x0000000000000000000000000000000000000000");
      expect(fund1).to.not.equal("0x0000000000000000000000000000000000000000");
      expect(fund0).to.not.equal(fund1);
    });
  });

  describe("Created Fund Integration", function () {
    it("Should create a working fund that accepts investments", async function () {
      const {
        factory,
        saleToken,
        paymentToken,
        foundersWallet,
        user1,
        defaultParams,
      } = await loadFixture(deployFactoryFixture);

      // Create fund
      await factory.write.createFundraiser([
        defaultParams.upfrontRakeBPS,
        defaultParams.escrowRakeBPS,
        defaultParams.startPrice,
        defaultParams.endPrice,
        defaultParams.targetLiquidity,
        saleToken.address,
        paymentToken.address,
        getAddress(foundersWallet.account.address),
        defaultParams.title,
        defaultParams.richInfoUrl,
      ]);

      // Get fund address
      const fundAddress = await factory.read.funds([0n]);
      const fund = await hre.viem.getContractAt("OtterPadFund", fundAddress);

      // Mint tokens to fund and user
      const requiredTokens = await fund.read.checkSaleTokensRequired();
      await saleToken.write.mint([fundAddress, requiredTokens]);

      const userPaymentAmount = parseEther("10");
      await paymentToken.write.mint([
        getAddress(user1.account.address),
        userPaymentAmount,
      ]);

      // User approves and buys tokens
      const user1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: user1 } }
      );
      await user1PaymentToken.write.approve([fundAddress, userPaymentAmount]);

      const user1Fund = await hre.viem.getContractAt(
        "OtterPadFund",
        fundAddress,
        {
          client: { wallet: user1 },
        }
      );

      // Make purchase
      await user1Fund.write.buy([userPaymentAmount]);

      // Verify purchase was recorded
      expect(await fund.read.orderCounter()).to.equal(1n);
      const purchase = await fund.read.purchases([0n]);
      expect(purchase[0]).to.equal(userPaymentAmount); // paymentAmount
      expect(purchase[3]).to.equal(getAddress(user1.account.address)); // purchaser
      expect(purchase[4]).to.equal(false); // isRefunded
    });
  });
});
