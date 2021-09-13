const { expect } = require("chai");
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe("Treasury", function () {

  before(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.userA = this.signers[1];
    this.userB = this.signers[2];
    this.userC = this.signers[3];
    this.userD = this.signers[4];

    this.DefaultOSFactory = await ethers.getContractFactory("DefaultOSFactory")
    this.DefaultOS = await ethers.getContractFactory("DefaultOS");
    this.DefaultTokenInstaller = await ethers.getContractFactory("def_TokenInstaller");
    this.DefaultEpochInstaller = await ethers.getContractFactory("def_EpochInstaller");
    this.DefaultTreasuryInstaller = await ethers.getContractFactory("def_TreasuryInstaller");

    this.factory = await this.DefaultOSFactory.deploy()
    await this.factory.deployed()

    this.defaultOS = await this.DefaultOS.deploy("Default DAO", "default", this.factory.address);
    this.default = await this.defaultOS.deployed();

    this.treasuryModule = await this.DefaultTreasuryInstaller.deploy();
    await this.treasuryModule.deployed();

    this.tokenModule = await this.DefaultTokenInstaller.deploy();
    await this.tokenModule.deployed();

    this.epochModule = await this.DefaultEpochInstaller.deploy();
    await this.epochModule.deployed();
  })

  beforeEach(async function () {
    await this.default.installModule(this.tokenModule.address);
    this.token = await ethers.getContractAt("def_Token", await this.default.getModule("0x544b4e"));
    
    await this.default.installModule(this.epochModule.address);
    this.epoch = await ethers.getContractAt("def_Epoch", await this.default.getModule("0x455043"));

    await this.default.installModule(this.treasuryModule.address);
    this.treasury = await ethers.getContractAt("def_Treasury", await this.default.getModule("0x545359"));

    await this.token.mint(this.userA.address, 100000);
    await this.token.mint(this.userB.address, 100000);
    await this.token.mint(this.userC.address, 100000);
  })


  describe("opening a vault", async function () {
    it("opens a vault sccessfully", async function () {

      await this.treasury.openVault(this.token.address, 50);
      const tsyVault = await this.treasury.getVault(this.token.address);
      expect(tsyVault).not.to.equal(ZERO_ADDRESS);
      this.vault = await ethers.getContractAt("Vault", tsyVault);

      expect(await this.vault.name()).to.equal("Default Treasury Vault: DEF");
      expect(await this.vault.symbol()).to.equal("DEF-VS");
      expect(await this.vault.decimals()).to.equal(3);

      // vault security:
      await expect(this.vault.deposit(this.userA.address, 0)).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(this.vault.withdraw(this.userA.address, 0)).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(this.vault.transfer(this.userA.address, 0)).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(this.vault.transferFrom(this.userA.address, this.userB.address, 0)).to.be.revertedWith("Ownable: caller is not the owner");
    })

    it("cannot open the same vault twice", async function () {
      await this.treasury.openVault(this.token.address, 50);
      await expect(this.treasury.openVault(this.token.address, 50)).to.be.revertedWith("vault already exists")
    })

    it("cannot exceed 0% or 100% fee", async function () {
      await expect(this.treasury.openVault(this.token.address, 101)).to.be.revertedWith("fee must be 0 <= fee <= 100");
    })
  })


  it("deposits successfully", async function () {
    await this.treasury.openVault(this.token.address, 50);

    const tsyVault = await this.treasury.getVault(this.token.address);
    this.vault = await ethers.getContractAt("Vault", tsyVault);

    await this.token.connect(this.userA).approve(this.vault.address, 40000);
    await this.treasury.connect(this.userA).deposit(this.vault.address, 40000);

    expect(await this.token.balanceOf(this.userA.address)).to.equal(60000);
    expect(await this.token.balanceOf(this.vault.address)).to.equal(40000);
    expect(await this.vault.balanceOf(this.userA.address)).to.equal(40000);
  })

  it("withdraws successfully", async function () {
    await this.treasury.openVault(this.token.address, 50);

    const tsyVault = await this.treasury.getVault(this.token.address);
    this.vault = await ethers.getContractAt("Vault", tsyVault);

    await this.token.connect(this.userA).approve(this.vault.address, 30000); // 60k tokens left
    await this.treasury.connect(this.userA).deposit(this.vault.address, 30000); // 30k tokens after deposit
    await this.treasury.connect(this.userA).withdraw(this.vault.address, 30000); // 45k tokens after 50% fee

    expect(await this.token.balanceOf(this.userA.address)).to.equal(85000);
    expect(await this.token.balanceOf(this.vault.address)).to.equal(15000);
    expect(await this.vault.balanceOf(this.userA.address)).to.equal(00000);
    expect(await this.vault.balanceOf(this.default.address)).to.equal(15000);
  })

  it("OS withdraws for free", async function () {
    await this.treasury.openVault(this.token.address, 50);

    const tsyVault = await this.treasury.getVault(this.token.address);
    this.vault = await ethers.getContractAt("Vault", tsyVault);

    await this.token.connect(this.userA).approve(this.vault.address, 20000); // 45k tokens left
    await this.treasury.connect(this.userA).deposit(this.vault.address, 20000); // 30k tokens after deposit
    await this.treasury.connect(this.userA).withdraw(this.vault.address, 20000); // 45k tokens after 50% fee
    await this.treasury.withdrawFromVault(this.vault.address, 10000);

    expect(await this.token.balanceOf(this.userA.address)).to.equal(90000);
    expect(await this.token.balanceOf(this.default.address)).to.equal(10000);
    expect(await this.token.balanceOf(this.vault.address)).to.equal(00000);
    expect(await this.vault.balanceOf(this.default.address)).to.equal(00000);
  })

  it("changes the fee", async function () {
    await this.treasury.openVault(this.token.address, 50);

    const tsyVault = await this.treasury.getVault(this.token.address);
    this.vault = await ethers.getContractAt("Vault", tsyVault);

    await this.token.connect(this.userA).approve(this.vault.address, 20000); // 45k tokens left
    await this.treasury.connect(this.userA).deposit(this.vault.address, 20000); // 30k tokens after deposit
    await this.treasury.changeFee(this.vault.address, 75);

    await this.treasury.connect(this.userA).withdraw(this.vault.address, 20000); // 45k tokens after 50% fee

    expect(await this.token.balanceOf(this.userA.address)).to.equal(85000);
    expect(await this.token.balanceOf(this.default.address)).to.equal(00000);
    expect(await this.token.balanceOf(this.vault.address)).to.equal(15000);
    expect(await this.vault.balanceOf(this.default.address)).to.equal(15000);
  })
})