const { incrementWeek } = require("../utils");
const { expect } = require("chai");
const MULT = 1e12;

// dao: launch os, install token, epoch, treasury, mining. Call configure() on mining after deploy.
// user: get tokens, deposit into treasury to get shares. Call register() on mining after they get shares to start the program.

describe("Mining.sol", function () {
  before(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.userA = this.signers[1];
    this.userB = this.signers[2];
    this.userC = this.signers[3];
    this.userD = this.signers[4];

    this.DefaultOSFactory = await (await ethers.getContractFactory("DefaultOSFactory")).deploy()
    this.daos = await this.DefaultOSFactory.deployed()

    this.DefaultOS = await (await ethers.getContractFactory("DefaultOS")).deploy(
      "Default DAO",
      "default",
      this.daos.address
    );
    this.default = await this.DefaultOS.deployed();

    this.TokenInstaller = await ethers.getContractFactory("def_TokenInstaller");
    this.tokenModule = await this.TokenInstaller.deploy();
    await this.tokenModule.deployed();

    this.EpochInstaller = await ethers.getContractFactory("def_EpochInstaller");
    this.epochModule = await this.EpochInstaller.deploy();
    await this.epochModule.deployed();

    this.TreasuryInstaller = await ethers.getContractFactory("def_TreasuryInstaller");
    this.treasuryModule = await this.TreasuryInstaller.deploy();
    await this.treasuryModule.deployed();

    this.MiningInstaller = await ethers.getContractFactory("def_MiningInstaller");
    this.miningModule = await this.MiningInstaller.deploy();
    await this.miningModule.deployed();
  })

  beforeEach(async function () {
    await this.default.installModule(this.tokenModule.address);
    this.token = await ethers.getContractAt("def_Token", await this.default.getModule("0x544b4e"));

    this.lpTokenInstaller = await ethers.getContractFactory("TestToken")
    this.lpToken = await this.lpTokenInstaller.deploy();
    await this.lpToken.deployed();

    await this.default.installModule(this.epochModule.address);
    this.epoch = await ethers.getContractAt("def_Epoch", await this.default.getModule("0x455043"));

    await this.default.installModule(this.treasuryModule.address);
    this.treasury = await ethers.getContractAt("def_Treasury", await this.default.getModule("0x545359"));

    await this.default.installModule(this.miningModule.address);
    this.mining = await ethers.getContractAt("def_Mining", await this.default.getModule("0x4d4e47")); //MNG

    await this.treasury.openVault(this.lpToken.address, 50);
    const tsyVault = await this.treasury.getVault(this.lpToken.address);
    this.vault = await ethers.getContractAt("Vault", tsyVault);
  })

  describe("assignVault", async function () {
    it("allows only owner", async function () {
      const mining = await this.mining.connect(this.userA)
      await expect(mining.assignVault(this.lpToken.address)).to.be.revertedWith("only the os owner can make this call")
    })

    it("does not allow being set more than once", async function () {
      await this.mining.assignVault(this.lpToken.address)
      await expect(this.mining.assignVault(this.lpToken.address)).to.be.revertedWith("can only assign vault once")
    })
  })

  describe("setTokenBonus", async function () {
    beforeEach(async function () {
      await this.mining.assignVault(this.lpToken.address)
    })

    it("successfully sets token bonus", async function () {
      await this.mining.setTokenBonus(1)
      expect(await this.mining.TOKEN_BONUS()).to.equal(1)
    })

    it("allows only owner", async function () {
      const mining = await this.mining.connect(this.userA)
      await expect(mining.setTokenBonus(1)).to.be.revertedWith("only the os owner can make this call")
    })
  })

  describe("issueRewards", async function () {
    beforeEach(async function () {
      await this.mining.assignVault(this.lpToken.address)

      await this.lpToken.mint(this.dev.address, 50000);
      await this.lpToken.connect(this.dev).approve(this.vault.address, 50000);
      await this.treasury.connect(this.dev).deposit(this.vault.address, 50000);
    })

    it("successfully sets new accumulated rewards per share", async function () {
      await incrementWeek()
      await this.epoch.incrementEpoch()
      await this.mining.issueRewards()

      expect((await this.mining.accRewardsPerShare()).toNumber()).to.equal(10 * MULT)

      await incrementWeek()
      await this.epoch.incrementEpoch()
      await this.mining.issueRewards()

      expect((await this.mining.accRewardsPerShare()).toNumber()).to.equal(20 * MULT)

      await this.lpToken.mint(this.userA.address, 200000);
      await this.lpToken.connect(this.userA).approve(this.vault.address, 200000);
      await this.treasury.connect(this.userA).deposit(this.vault.address, 200000);

      await incrementWeek()
      await this.epoch.incrementEpoch()
      await this.mining.issueRewards()

      //2 = 500000 / 250000 where 500000 is the mint amount, and 250000 (200000 + 50000) is number of shares
      expect((await this.mining.accRewardsPerShare()).toNumber()).to.equal((20 + 2) * MULT)
    })

    it("successfully mints token bonus", async function () {
      await incrementWeek()
      await this.epoch.connect(this.userA).incrementEpoch()
      await this.mining.issueRewards()

      expect((await this.token.balanceOf(this.dev.address)).toNumber()).to.equal(5000)
    })

    it("disallows duplicate issuance in the same epoch", async function () {
      await incrementWeek()
      await this.epoch.incrementEpoch()
      await this.mining.issueRewards()

      await expect(this.mining.issueRewards()).to.be.revertedWith("rewards have already been accumulated for the current epoch")
    })

    it("emits event RewardsIssued", async function () {
      await incrementWeek()
      await this.epoch.incrementEpoch()
      await expect(this.mining.issueRewards())
        .to.emit(this.mining, "RewardsIssued")
        .withArgs(await this.epoch.current(), 10 * MULT);
    })
  })

  describe("pendingRewards", async function () {
    beforeEach(async function () {
      await this.mining.assignVault(this.lpToken.address)

      await this.lpToken.mint(this.dev.address, 50000);
      await this.lpToken.connect(this.dev).approve(this.vault.address, 50000);
      await this.treasury.connect(this.dev).deposit(this.vault.address, 50000);

      await this.mining.register()
    })

    it("successfully calculates rewards", async function () {
      const reward = (await this.mining.EPOCH_MINING_REWARDS()).toNumber()

      await incrementWeek()
      await this.epoch.incrementEpoch()
      await this.mining.issueRewards()

      await this.lpToken.mint(this.userA.address, 150000);
      await this.lpToken.connect(this.userA).approve(this.vault.address, 150000);
      await this.treasury.connect(this.userA).deposit(this.vault.address, 150000);

      await incrementWeek()
      await this.epoch.incrementEpoch()
      await this.mining.issueRewards()

      expect((await this.mining.pendingRewards()).toNumber()).to.equal(
        reward + (reward / 4)
      )
    })
  })

  describe("claimRewards", async function () {
    beforeEach(async function () {
      await this.mining.assignVault(this.lpToken.address)

      await this.lpToken.mint(this.dev.address, 50000);
      await this.lpToken.connect(this.dev).approve(this.vault.address, 50000);
      await this.treasury.connect(this.dev).deposit(this.vault.address, 50000);
    })

    it("successfully mints token to the user", async function () {
      const reward = (await this.mining.EPOCH_MINING_REWARDS()).toNumber()
      await this.mining.register()

      await incrementWeek()
      await this.epoch.connect(this.userA).incrementEpoch()
      await this.mining.connect(this.userA).issueRewards()

      await this.mining.claimRewards()
      expect(await this.token.balanceOf(this.dev.address)).to.equal(reward)

      await this.lpToken.mint(this.userA.address, 150000);
      await this.lpToken.connect(this.userA).approve(this.vault.address, 150000);
      await this.treasury.connect(this.userA).deposit(this.vault.address, 150000);

      await incrementWeek()
      await this.epoch.connect(this.userA).incrementEpoch()
      await this.mining.connect(this.userA).issueRewards()

      await this.mining.claimRewards()
      expect(await this.token.balanceOf(this.dev.address)).to.equal(
        reward + (reward / 4)
      )
    })

    it("successfully resets unclaimable rewards", async function () {
      const reward = (await this.mining.EPOCH_MINING_REWARDS()).toNumber()
      await this.mining.register()

      await incrementWeek()
      await this.epoch.connect(this.userA).incrementEpoch()
      await this.mining.connect(this.userA).issueRewards()

      await this.mining.claimRewards()
      expect(await this.token.balanceOf(this.dev.address)).to.equal(reward)

      await this.lpToken.mint(this.dev.address, 50000);
      await this.lpToken.connect(this.dev).approve(this.vault.address, 50000);
      await this.treasury.connect(this.dev).deposit(this.vault.address, 50000);

      await this.mining.register()

      await this.mining.claimRewards()
      expect(await this.token.balanceOf(this.dev.address)).to.equal(reward)
    })

    it("fails if not registered", async function () {
      await incrementWeek()
      await this.epoch.incrementEpoch()
      await this.mining.issueRewards()

      await expect(this.mining.claimRewards()).to.be.revertedWith(
        "member is not registered for mining program"
      )
    })
  })
})