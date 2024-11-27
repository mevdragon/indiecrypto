// npx hardhat test test/PresaleLock.test.ts

import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther, parseUnits, getAddress, zeroAddress } from "viem";

describe("PresaleLock", function () {
  async function deployFixture() {
    // Deploy mock tokens first
    const saleToken = await hre.viem.deployContract("MockERC20", [
      "SaleToken",
      "SALE",
      18n,
    ]);

    const randomToken = await hre.viem.deployContract("MockERC20", [
      "RandomToken",
      "RAND",
      18n,
    ]);

    const [deployer, foundersWallet, buyer1, buyer2, lpLockWallet] =
      await hre.viem.getWalletClients();

    // Deploy presale lock
    const presaleLock = await hre.viem.deployContract("PresaleLock", [
      "Test Presale",
      getAddress(foundersWallet.account.address),
    ]);

    // Mint some tokens to test with
    const mintAmount = parseEther("1000");
    await randomToken.write.mint([presaleLock.address, mintAmount]);
    await saleToken.write.mint([
      getAddress(foundersWallet.account.address),
      mintAmount,
    ]);

    // Deploy OtterPad fund (but don't set it yet)
    const startPrice = parseEther("0.1");
    const endPrice = parseEther("0.3");
    const targetLiquidity = parseEther("100");
    const upfrontRakeBPS = 2_000_000n;
    const escrowRakeBPS = 3_000_000n;

    const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6";
    const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";

    const fund = await hre.viem.deployContract("OtterPadFund", [
      "Test Fund",
      "https://example.com",
      saleToken.address,
      randomToken.address,
      UNISWAP_ROUTER,
      UNISWAP_FACTORY,
      startPrice,
      endPrice,
      targetLiquidity,
      upfrontRakeBPS,
      escrowRakeBPS,
      getAddress(foundersWallet.account.address),
      getAddress(lpLockWallet.account.address),
      zeroAddress, // mock factory
    ]);

    const publicClient = await hre.viem.getPublicClient();

    return {
      presaleLock,
      saleToken,
      randomToken,
      fund,
      deployer,
      foundersWallet,
      buyer1,
      buyer2,
      lpLockWallet,
      publicClient,
      mintAmount,
    };
  }

  describe("Collecting tokens", function () {
    it("Should collect tokens with correct fee distribution", async function () {
      const {
        presaleLock,
        randomToken,
        foundersWallet,
        publicClient,
        mintAmount,
      } = await loadFixture(deployFixture);

      // Check initial balances
      const OTTERPAD_DAO = await presaleLock.read.OTTERPAD_DAO();
      const initialDaoBalance = await randomToken.read.balanceOf([
        OTTERPAD_DAO,
      ]);
      const initialFoundersBalance = await randomToken.read.balanceOf([
        getAddress(foundersWallet.account.address),
      ]);

      // Founder collects tokens
      const founderPresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: foundersWallet } }
      );

      const hash = await founderPresaleLock.write.collectTokensAsFounders([
        randomToken.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify fee split
      const OTTERPAD_FEE_BPS = await presaleLock.read.OTTERPAD_FEE_BPS();
      const BPS_FACTOR = await presaleLock.read.BPS_FACTOR();

      const expectedFee = (mintAmount * OTTERPAD_FEE_BPS) / BPS_FACTOR;
      const expectedFounders = mintAmount - expectedFee;

      const finalDaoBalance = await randomToken.read.balanceOf([OTTERPAD_DAO]);
      const finalFoundersBalance = await randomToken.read.balanceOf([
        getAddress(foundersWallet.account.address),
      ]);

      expect(finalDaoBalance - initialDaoBalance).to.equal(expectedFee);
      expect(finalFoundersBalance - initialFoundersBalance).to.equal(
        expectedFounders
      );
    });

    it("Should not allow collecting sale token", async function () {
      const { presaleLock, saleToken, fund, foundersWallet, publicClient } =
        await loadFixture(deployFixture);

      // Set fundraiser
      const founderPresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: foundersWallet } }
      );

      await founderPresaleLock.write.setFundraiser([fund.address]);

      // Try to collect sale token
      await expect(
        founderPresaleLock.write.collectTokensAsFounders([saleToken.address])
      ).to.be.rejectedWith("Cannot recover sale token");
    });
  });

  describe("Fund integration", function () {
    it("Should set fundraiser and enable deposits", async function () {
      const {
        presaleLock,
        saleToken,
        fund,
        foundersWallet,
        buyer1,
        publicClient,
      } = await loadFixture(deployFixture);

      // Check initial state
      expect(await presaleLock.read.otterpadFund()).to.equal(
        "0x0000000000000000000000000000000000000000"
      );
      expect(await presaleLock.read.saleToken()).to.equal(
        "0x0000000000000000000000000000000000000000"
      );

      // Set fundraiser
      const founderPresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: foundersWallet } }
      );

      await founderPresaleLock.write.setFundraiser([fund.address]);

      // Verify state after setting fundraiser
      expect((await presaleLock.read.otterpadFund()).toLowerCase()).to.equal(
        fund.address
      );
      expect((await presaleLock.read.saleToken()).toLowerCase()).to.equal(
        saleToken.address
      );

      // Try deposit
      const depositAmount = parseEther("10");
      const unlockTime = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24 hours from now
      const txHash =
        "0x1234567890123456789012345678901234567890123456789012345678901234";

      // Approve tokens first
      const founderSaleToken = await hre.viem.getContractAt(
        "MockERC20",
        saleToken.address,
        { client: { wallet: foundersWallet } }
      );

      await founderSaleToken.write.approve([
        presaleLock.address,
        depositAmount,
      ]);

      // Make deposit
      const hash = await founderPresaleLock.write.deposit([
        depositAmount,
        getAddress(buyer1.account.address),
        unlockTime,
        txHash,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify deposit was created
      const depositId = 0n; // First deposit
      const deposit = await presaleLock.read.deposits([depositId]);

      expect(deposit[0]).to.equal(getAddress(buyer1.account.address)); // recipient
      expect(deposit[1]).to.equal(depositAmount); // amount
      expect(deposit[2]).to.equal(unlockTime); // unlockUnixTime
      expect(deposit[3]).to.equal(depositId); // depositId
      expect(deposit[4]).to.equal(false); // isRedeemed
      expect(deposit[6]).to.equal(txHash); // txHash

      // Verify tracking arrays
      const userDepositIds = await presaleLock.read.getUserDepositIds([
        getAddress(buyer1.account.address),
      ]);
      expect(userDepositIds).to.deep.equal([depositId]);

      const txHashDepositIds = await presaleLock.read.checkIfTxHashHasDeposits([
        txHash,
      ]);
      expect(txHashDepositIds).to.deep.equal([depositId]);
    });

    it("Should fail deposit if fundraiser not set", async function () {
      const { presaleLock, foundersWallet, buyer1, saleToken } =
        await loadFixture(deployFixture);

      const depositAmount = parseEther("10");
      const unlockTime = BigInt(Math.floor(Date.now() / 1000) + 86400);
      const txHash =
        "0x1234567890123456789012345678901234567890123456789012345678901234";

      const founderPresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: foundersWallet } }
      );

      await expect(
        founderPresaleLock.write.deposit([
          depositAmount,
          getAddress(buyer1.account.address),
          unlockTime,
          txHash,
        ])
      ).to.be.rejectedWith("OtterPad fund not set yet");
    });

    it("Should allow founders to cancel deposits", async function () {
      const {
        presaleLock,
        saleToken,
        fund,
        foundersWallet,
        buyer1,
        publicClient,
      } = await loadFixture(deployFixture);

      // Set up presale and create deposit
      const founderPresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: foundersWallet } }
      );
      await founderPresaleLock.write.setFundraiser([fund.address]);

      const depositAmount = parseEther("10");
      const txHash =
        "0x1234567890123456789012345678901234567890123456789012345678901234";

      const founderSaleToken = await hre.viem.getContractAt(
        "MockERC20",
        saleToken.address,
        { client: { wallet: foundersWallet } }
      );

      await founderSaleToken.write.approve([
        presaleLock.address,
        depositAmount,
      ]);
      await founderPresaleLock.write.deposit([
        depositAmount,
        getAddress(buyer1.account.address),
        0n,
        txHash,
      ]);

      const initialBalance = await saleToken.read.balanceOf([
        getAddress(foundersWallet.account.address),
      ]);

      // Cancel deposit
      const hash = await founderPresaleLock.write.cancelDeposit([0n]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify canceled state
      const deposit = await presaleLock.read.deposits([0n]);
      expect(deposit[5]).to.be.true; // isCanceled

      // Verify tokens returned
      const finalBalance = await saleToken.read.balanceOf([
        getAddress(foundersWallet.account.address),
      ]);
      expect(finalBalance - initialBalance).to.equal(depositAmount);
    });

    it("Should prevent non-founders from canceling deposits", async function () {
      const { presaleLock, saleToken, fund, foundersWallet, buyer1, buyer2 } =
        await loadFixture(deployFixture);

      // Set up presale and create deposit
      const founderPresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: foundersWallet } }
      );
      await founderPresaleLock.write.setFundraiser([fund.address]);

      const depositAmount = parseEther("10");
      const txHash =
        "0x1234567890123456789012345678901234567890123456789012345678901234";

      const founderSaleToken = await hre.viem.getContractAt(
        "MockERC20",
        saleToken.address,
        { client: { wallet: foundersWallet } }
      );

      await founderSaleToken.write.approve([
        presaleLock.address,
        depositAmount,
      ]);
      await founderPresaleLock.write.deposit([
        depositAmount,
        getAddress(buyer1.account.address),
        0n,
        txHash,
      ]);

      // Try to cancel as non-founder
      const buyer2PresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: buyer2 } }
      );

      await expect(
        buyer2PresaleLock.write.cancelDeposit([0n])
      ).to.be.rejectedWith("Only founders can cancel deposits");
    });
  });

  describe("Redemption with timestamp locks", function () {
    async function setupFundAndPresale() {
      const baseFixture = await loadFixture(deployFixture);
      const {
        presaleLock,
        saleToken,
        randomToken: paymentToken,
        fund,
        foundersWallet,
        buyer1,
        buyer2,
        lpLockWallet,
      } = baseFixture;

      // Set up presale lock
      const founderPresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: foundersWallet } }
      );
      await founderPresaleLock.write.setFundraiser([fund.address]);

      // Create deposit with future unlock time
      const currentTime = BigInt(Math.floor(Date.now() / 1000));
      const unlockTime = currentTime + 3600n; // 1 hour from now
      const depositAmount = parseEther("100");
      const txHash =
        "0x1234567890123456789012345678901234567890123456789012345678901234";

      const founderSaleToken = await hre.viem.getContractAt(
        "MockERC20",
        saleToken.address,
        { client: { wallet: foundersWallet } }
      );

      await founderSaleToken.write.approve([
        presaleLock.address,
        depositAmount,
      ]);
      await founderPresaleLock.write.deposit([
        depositAmount,
        getAddress(buyer1.account.address),
        unlockTime,
        txHash,
      ]);

      // Complete fund sale
      const targetLiquidity = await fund.read.targetLiquidity();
      const upfrontRakeBPS = await fund.read.upfrontRakeBPS();
      const escrowRakeBPS = await fund.read.escrowRakeBPS();
      const OTTERPAD_FEE_BPS = 2_000_000n;

      const remainingBPS =
        100_000_000n -
        (upfrontRakeBPS - OTTERPAD_FEE_BPS + escrowRakeBPS + OTTERPAD_FEE_BPS);
      const requiredPayment = (targetLiquidity * 100_000_000n) / remainingBPS;

      await paymentToken.write.mint([
        getAddress(buyer1.account.address),
        requiredPayment * 2n,
      ]);

      const buyer1PaymentToken = await hre.viem.getContractAt(
        "MockERC20",
        paymentToken.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1PaymentToken.write.approve([fund.address, requiredPayment]);

      const buyer1Fund = await hre.viem.getContractAt(
        "OtterPadFund",
        fund.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1Fund.write.buy([requiredPayment, buyer1.account.address]);

      // Deploy to Uniswap
      const founderFund = await hre.viem.getContractAt(
        "OtterPadFund",
        fund.address,
        { client: { wallet: foundersWallet } }
      );

      const requiredTokens = (await fund.read.checkSaleTokensRequired())[0];
      await saleToken.write.mint([fund.address, requiredTokens * 2n]);

      await founderFund.write.deployToUniswap();

      return {
        ...baseFixture,
        depositAmount,
        unlockTime,
      };
    }

    it("Should not allow redemption before unlock time", async function () {
      const { presaleLock, buyer1 } = await loadFixture(setupFundAndPresale);

      const buyer1PresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: buyer1 } }
      );

      await expect(buyer1PresaleLock.write.redeem([0n])).to.be.rejectedWith(
        "Tokens still locked"
      );
    });

    it("Should allow redemption after unlock time", async function () {
      const {
        presaleLock,
        saleToken,
        buyer1,
        buyer2,
        depositAmount,
        unlockTime,
      } = await loadFixture(setupFundAndPresale);

      // Increase time past unlock
      await time.increaseTo(unlockTime + 1n);

      const initialBalance = await saleToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);

      const buyer2PresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: buyer2 } }
      );

      await buyer2PresaleLock.write.redeem([0n]);

      const finalBalance = await saleToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);

      expect(finalBalance - initialBalance).to.equal(depositAmount);
    });

    it("Should prevent double redemption after unlock", async function () {
      const { presaleLock, buyer1, unlockTime } = await loadFixture(
        setupFundAndPresale
      );

      await time.increaseTo(unlockTime + 1n);

      const buyer1PresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: buyer1 } }
      );

      await buyer1PresaleLock.write.redeem([0n]);

      await expect(buyer1PresaleLock.write.redeem([0n])).to.be.rejectedWith(
        "Already redeemed"
      );
    });

    it("Should allow non-recipient to redeem deposit", async function () {
      const {
        presaleLock,
        saleToken,
        buyer1,
        buyer2,
        publicClient,
        unlockTime,
        depositAmount,
      } = await loadFixture(setupFundAndPresale);

      const initialBalance = await saleToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);

      // buyer2 redeems for buyer1
      const buyer2PresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: buyer2 } }
      );

      // Increase time past unlock
      await time.increaseTo(unlockTime + 1n);

      const hash = await buyer2PresaleLock.write.redeem([0n]);
      await publicClient.waitForTransactionReceipt({ hash });

      const finalBalance = await saleToken.read.balanceOf([
        getAddress(buyer1.account.address),
      ]);
      expect(finalBalance - initialBalance).to.equal(depositAmount);
    });

    it("Should allow new deposits after DEX deployment", async function () {
      const {
        presaleLock,
        saleToken,
        fund,
        foundersWallet,
        buyer2,
        publicClient,
      } = await loadFixture(setupFundAndPresale);

      // Verify fund is deployed
      expect(await fund.read.isDeployedToUniswap()).to.be.true;

      const founderPresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: foundersWallet } }
      );

      // Make new deposit
      const depositAmount = parseEther("10");
      const NEW_TX_HASH =
        "0x2234567890123456789012345678901234567890123456789012345678901234";

      const founderSaleToken = await hre.viem.getContractAt(
        "MockERC20",
        saleToken.address,
        { client: { wallet: foundersWallet } }
      );

      await founderSaleToken.write.approve([
        presaleLock.address,
        depositAmount,
      ]);

      const hash = await founderPresaleLock.write.deposit([
        depositAmount,
        getAddress(buyer2.account.address),
        0n,
        NEW_TX_HASH,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify deposit was created
      const userDeposits = await presaleLock.read.getUserDepositIds([
        getAddress(buyer2.account.address),
      ]);
      expect(userDeposits.length).to.equal(1);
    });

    it("Should prevent canceling already redeemed deposits", async function () {
      const { presaleLock, buyer1, foundersWallet, unlockTime } =
        await loadFixture(setupFundAndPresale);

      // Increase time past unlock
      await time.increaseTo(unlockTime + 1n);

      // Redeem first
      const buyer1PresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PresaleLock.write.redeem([0n]);

      // Try to cancel redeemed deposit
      const founderPresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: foundersWallet } }
      );

      await expect(
        founderPresaleLock.write.cancelDeposit([0n])
      ).to.be.rejectedWith("Already redeemed");
    });

    it("Should prevent canceling already redeemed or canceled deposits", async function () {
      const {
        presaleLock,
        saleToken,
        buyer1,
        foundersWallet,
        publicClient,
        unlockTime,
      } = await loadFixture(setupFundAndPresale);

      // Create a second deposit
      const founderPresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: foundersWallet } }
      );

      const depositAmount = parseEther("10");
      const NEW_TX_HASH =
        "0x2234567890123456789012345678901234567890123456789012345678901234";

      // Approve tokens for second deposit
      const founderSaleToken = await hre.viem.getContractAt(
        "MockERC20",
        saleToken.address,
        { client: { wallet: foundersWallet } }
      );

      await founderSaleToken.write.approve([
        presaleLock.address,
        depositAmount,
      ]);

      // Create second deposit
      await founderPresaleLock.write.deposit([
        depositAmount,
        getAddress(buyer1.account.address),
        0n,
        NEW_TX_HASH,
      ]);

      // Cancel the second deposit
      await founderPresaleLock.write.cancelDeposit([1n]);

      // Try to cancel again
      await expect(
        founderPresaleLock.write.cancelDeposit([1n])
      ).to.be.rejectedWith("Already canceled");

      // Increase time past unlock for first deposit
      await time.increaseTo(unlockTime + 1n);

      // Redeem first deposit
      const buyer1PresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: buyer1 } }
      );
      await buyer1PresaleLock.write.redeem([0n]);

      // Try to cancel redeemed deposit
      await expect(
        founderPresaleLock.write.cancelDeposit([0n])
      ).to.be.rejectedWith("Already redeemed");
    });
  });

  describe("Early ERC20 transfers and collection", function () {
    it("Should track ERC20 transfers received before fund setup", async function () {
      const { presaleLock, randomToken, mintAmount } = await loadFixture(
        deployFixture
      );

      // Direct transfer already happened in fixture
      const balance = await presaleLock.read.getERC20TokenBalance([
        randomToken.address,
      ]);
      expect(balance).to.equal(mintAmount);
    });
  });

  describe("Zero txHash deposits", function () {
    it("Should allow deposits with zero txHash", async function () {
      const { presaleLock, saleToken, fund, foundersWallet, buyer1 } =
        await loadFixture(deployFixture);

      const founderPresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: foundersWallet } }
      );

      // Set fundraiser first
      await founderPresaleLock.write.setFundraiser([fund.address]);

      const depositAmount = parseEther("10");
      const ZERO_HASH =
        "0x0000000000000000000000000000000000000000000000000000000000000000";

      const founderSaleToken = await hre.viem.getContractAt(
        "MockERC20",
        saleToken.address,
        { client: { wallet: foundersWallet } }
      );

      await founderSaleToken.write.approve([
        presaleLock.address,
        depositAmount,
      ]);

      // Make deposit with zero hash
      await founderPresaleLock.write.deposit([
        depositAmount,
        getAddress(buyer1.account.address),
        0n,
        ZERO_HASH,
      ]);

      const deposits = await presaleLock.read.checkIfTxHashHasDeposits([
        ZERO_HASH,
      ]);
      expect(deposits.length).to.equal(1);
    });
  });

  describe("Redeem requirements", function () {
    it("Should not allow redemption if fund not deployed to DEX", async function () {
      const {
        presaleLock,
        saleToken,
        fund,
        foundersWallet,
        buyer1,
        publicClient,
      } = await loadFixture(deployFixture);

      const founderPresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: foundersWallet } }
      );

      await founderPresaleLock.write.setFundraiser([fund.address]);

      const depositAmount = parseEther("10");
      const TX_HASH =
        "0x3234567890123456789012345678901234567890123456789012345678901234";

      const founderSaleToken = await hre.viem.getContractAt(
        "MockERC20",
        saleToken.address,
        { client: { wallet: foundersWallet } }
      );

      await founderSaleToken.write.approve([
        presaleLock.address,
        depositAmount,
      ]);

      const hash = await founderPresaleLock.write.deposit([
        depositAmount,
        getAddress(buyer1.account.address),
        0n,
        TX_HASH,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const buyer1PresaleLock = await hre.viem.getContractAt(
        "PresaleLock",
        presaleLock.address,
        { client: { wallet: buyer1 } }
      );

      await expect(buyer1PresaleLock.write.redeem([0n])).to.be.rejectedWith(
        "OtterPad sale not complete"
      );
    });
  });
});
