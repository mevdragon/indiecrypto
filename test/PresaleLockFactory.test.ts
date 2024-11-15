// npx hardhat test test/PresaleLockFactory.test.ts

import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("PresaleLockFactory", function () {
  this.timeout(60000);

  async function deployFactoryFixture() {
    const factory = await hre.viem.deployContract("PresaleLockFactory");
    const [deployer, foundersWallet, user1, user2] =
      await hre.viem.getWalletClients();

    const defaultParams = {
      title: "Test Lock",
      foundersWallet: getAddress(foundersWallet.account.address),
    };

    return {
      factory,
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
      expect(await factory.read.lockCounterIndex()).to.equal(0n);
    });
  });

  describe("Lock Creation", function () {
    it("Should create a new lock with valid parameters", async function () {
      const { factory, defaultParams } = await loadFixture(
        deployFactoryFixture
      );

      const createLockTx = await factory.write.createPresaleLock([
        defaultParams.title,
        defaultParams.foundersWallet,
      ]);

      expect(await factory.read.lockCounterIndex()).to.equal(1n);

      const lockAddress = await factory.read.locks([0n]);
      expect(lockAddress).to.not.equal(
        "0x0000000000000000000000000000000000000000"
      );

      const events = await factory.getEvents.LockCreated();
      expect(events).to.have.lengthOf(1);
      expect(events[0].args.lockIndex).to.equal(0n);
      expect(events[0].args.lock).to.equal(lockAddress);
      expect(events[0].args.title).to.equal(defaultParams.title);
      expect(events[0].args.foundersWallet).to.equal(
        defaultParams.foundersWallet
      );
      expect(events[0].args.timestamp).to.be.greaterThan(0n);
    });

    it("Should reject invalid creation parameters", async function () {
      const { factory, defaultParams } = await loadFixture(
        deployFactoryFixture
      );

      // Test zero address for founders wallet
      await expect(
        factory.write.createPresaleLock([
          defaultParams.title,
          "0x0000000000000000000000000000000000000000",
        ])
      ).to.be.rejected;

      // Test empty title
      await expect(
        factory.write.createPresaleLock(["", defaultParams.foundersWallet])
      ).to.be.rejected;
    });

    it("Should create multiple locks correctly", async function () {
      const { factory, defaultParams } = await loadFixture(
        deployFactoryFixture
      );

      // Create first lock
      await factory.write.createPresaleLock([
        defaultParams.title,
        defaultParams.foundersWallet,
      ]);

      // Create second lock with different title
      await factory.write.createPresaleLock([
        "Second Lock",
        defaultParams.foundersWallet,
      ]);

      expect(await factory.read.lockCounterIndex()).to.equal(2n);

      const lock0 = await factory.read.locks([0n]);
      const lock1 = await factory.read.locks([1n]);

      expect(lock0).to.not.equal("0x0000000000000000000000000000000000000000");
      expect(lock1).to.not.equal("0x0000000000000000000000000000000000000000");
      expect(lock0).to.not.equal(lock1);
    });
  });

  describe("Created Lock Integration", function () {
    it("Should create a working lock that can be initialized", async function () {
      const { factory, defaultParams } = await loadFixture(
        deployFactoryFixture
      );

      await factory.write.createPresaleLock([
        defaultParams.title,
        defaultParams.foundersWallet,
      ]);

      const lockAddress = await factory.read.locks([0n]);
      const lock = await hre.viem.getContractAt("PresaleLock", lockAddress);

      expect(await lock.read.title()).to.equal(defaultParams.title);
      expect(await lock.read.foundersWallet()).to.equal(
        defaultParams.foundersWallet
      );
    });
  });
});
