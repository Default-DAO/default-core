const { expect } = require("chai");
const { incrementWeek } = require("../utils")


describe("Members Module", function () {

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
    this.DefaultMembersInstaller = await ethers.getContractFactory("def_MembersInstaller");

    this.tokenModule = await this.DefaultTokenInstaller.deploy();
    await this.tokenModule.deployed();

    this.epochModule = await this.DefaultEpochInstaller.deploy();
    await this.epochModule.deployed();

    this.membersModule = await this.DefaultMembersInstaller.deploy();
    await this.membersModule.deployed();
  })

  beforeEach(async function () {
    this.factory = await this.DefaultOSFactory.deploy()
    await this.factory.deployed()

    this.defaultOS = await this.DefaultOS.deploy("Default DAO", "default", this.factory.address);
    this.default = await this.defaultOS.deployed();

    await this.default.installModule(this.tokenModule.address);
    this.token = await ethers.getContractAt("def_Token", await this.default.getModule("0x544b4e")); // "TKN"

    await this.default.installModule(this.epochModule.address);
    this.epoch = await ethers.getContractAt("def_Epoch", await this.default.getModule("0x455043")); // "EPC"        

    await this.default.installModule(this.membersModule.address);
    this.members = await ethers.getContractAt("def_Members", await this.default.getModule("0x4d4252")); // "MBR"

    await this.token.mint(this.userA.address, 100000);
    await this.token.connect(this.userA).approve(this.members.address, 100000);
  })

  describe("setAlias()", async function () {
    it("Should set alias", async function () {
      const aliasInBytes = ethers.utils.formatBytes32String("sgc")
      await this.members.setAlias(aliasInBytes)
      const alias = await this.members.getAliasForMember(this.dev.address)
      expect(alias).to.equal(aliasInBytes)

      await expect(this.members.setAlias(aliasInBytes)).to.be.revertedWith("alias is already taken")
    })

    it("Should emit registerMember event", async function () {
      const aliasInBytes = ethers.utils.formatBytes32String("sgc")
      await expect(this.members.setAlias(aliasInBytes))
        .to.emit(this.members, "MemberRegistered")
        .withArgs(this.dev.address, aliasInBytes, 1)
    })
  })

  describe("mintEndorsements()", async function () {

    it("1x multiplier for 50 epochs", async function () {
      const userCalls = this.members.connect(this.userA);
      await expect(userCalls.mintEndorsements(50, 10000))
        .to.emit(this.members, "TokensStaked")
        .withArgs(this.userA.address, 10000, 50, 1);

      const userStakes = await this.members.getStakesForMember(this.userA.address);
      expect(userStakes.numStakes).to.equal(1);
      expect(userStakes.totalTokensStaked).to.equal(10000);

      // test endorsements
      expect(await this.members.totalEndorsementsAvailableToGive(this.userA.address)).to.equal(10000);

      // test token transfer successful
      expect(await this.token.balanceOf(this.userA.address)).to.equal(90000);
      expect(await this.token.balanceOf(this.members.address)).to.equal(10000);
    })

    it("3x multiplier for 100 epochs", async function () {
      const userCalls = this.members.connect(this.userA);
      await expect(userCalls.mintEndorsements(100, 1000))
        .to.emit(this.members, "TokensStaked")
        .withArgs(this.userA.address, 1000, 100, 1);

      expect(await this.members.totalEndorsementsAvailableToGive(this.userA.address)).to.equal(3000);
    })

    it("6x multiplier for 150 epochs", async function () {
      const userCalls = this.members.connect(this.userA);
      await expect(userCalls.mintEndorsements(150, 1000))
        .to.emit(this.members, "TokensStaked")
        .withArgs(this.userA.address, 1000, 150, 1);

      expect(await this.members.totalEndorsementsAvailableToGive(this.userA.address)).to.equal(6000);
    })

    it("10x multiplier for 200 epochs", async function () {
      const userCalls = this.members.connect(this.userA);
      await expect(userCalls.mintEndorsements(200, 1000))
        .to.emit(this.members, "TokensStaked")
        .withArgs(this.userA.address, 1000, 200, 1);

      expect(await this.members.totalEndorsementsAvailableToGive(this.userA.address)).to.equal(10000);
    })
  })

  describe("endorseMember()", async function () {
    beforeEach(async function () {
      const userCalls = this.members.connect(this.userA);
      // user gets 10000 endorsements
      await userCalls.mintEndorsements(200, 100000);
      expect(await this.members.totalEndorsementsAvailableToGive(this.userA.address)).to.be.equal(1000000);
    })

    it("rejects endorsements if they are past the threshold", async function () {
      const userCalls = this.members.connect(this.userA);
      await userCalls.endorseMember(this.userB.address, 300000);
      await expect(userCalls.endorseMember(this.userB.address, 1)).to.be.revertedWith("def_Members | endorseMember(): total endorsements cannot exceed the max limit");
    })

    it("rejects if user tries to gives more endorsements than they have", async function () {
      const userCalls = this.members.connect(this.userA);
      await userCalls.endorseMember(this.userB.address, 300000);
      await userCalls.endorseMember(this.userC.address, 300000);
      await userCalls.endorseMember(this.userD.address, 300000);
      await expect(userCalls.endorseMember(this.dev.address, 300000)).to.be.revertedWith("def_Members | endorseMember(): Member does not have available endorsements to give");
    })

    it("successfully endorses multiple registered members and changes the right state", async function () {
      const userCalls = this.members.connect(this.userA);

      // Test events
      await expect(userCalls.endorseMember(this.userB.address, 3000))
        .to.emit(this.members, "EndorsementGiven")
        .withArgs(this.userA.address, this.userB.address, 3000, 1);

      await expect(userCalls.endorseMember(this.dev.address, 5000))
        .to.emit(this.members, "EndorsementGiven")
        .withArgs(this.userA.address, this.dev.address, 5000, 1);

      expect(await this.members.totalEndorsementsGiven(this.userA.address)).to.equal(8000);
      expect(await this.members.totalEndorsementsReceived(this.userB.address)).to.equal(3000);
      expect(await this.members.totalEndorsementsReceived(this.dev.address)).to.equal(5000);

      expect(await this.members.endorsementsGiven(this.userA.address, this.userB.address)).to.equal(3000);
      expect(await this.members.endorsementsReceived(this.userB.address, this.userA.address)).to.equal(3000);

      expect(await this.members.endorsementsGiven(this.userA.address, this.dev.address)).to.equal(5000);
      expect(await this.members.endorsementsReceived(this.dev.address, this.userA.address)).to.equal(5000);
    })

    it("successfully endorses registered members from multiple members", async function () {
      await this.token.mint(this.dev.address, 5000);
      await this.token.approve(this.members.address, 5000);

      await this.members.mintEndorsements(50, 1200);

      // Test events
      await this.members.connect(this.userA).endorseMember(this.userB.address, 3000)
      await this.members.connect(this.dev).endorseMember(this.userB.address, 1100)

      expect(await this.members.totalEndorsementsReceived(this.userB.address)).to.equal(4100);

      expect(await this.members.endorsementsGiven(this.userA.address, this.userB.address)).to.equal(3000);
      expect(await this.members.endorsementsReceived(this.userB.address, this.userA.address)).to.equal(3000);

      expect(await this.members.endorsementsGiven(this.dev.address, this.userB.address)).to.equal(1100);
      expect(await this.members.endorsementsReceived(this.userB.address, this.dev.address)).to.equal(1100);
    })
  })

  describe("withdrawEndorsementFrom()", async function () {
    beforeEach(async function () {
      // user gets 10000 endorsements
      const userCalls = this.members.connect(this.userA);
      await userCalls.mintEndorsements(200, 1000);
      expect(await this.members.totalEndorsementsAvailableToGive(this.userA.address)).to.be.equal(10000);

      await userCalls.endorseMember(this.userB.address, 3000);
      await userCalls.endorseMember(this.dev.address, 5000);
    })

    it("reverts if the user does not have enough endorsements to withdraw", async function () {
      await expect(this.members.connect(this.userA).endorseMember(this.userB.address, 10001)).to.be.revertedWith("Member does not have available endorsements to give");
    })

    it("successfully withdraws endorsements members and changes the right state", async function () {
      await expect(this.members.connect(this.userA).withdrawEndorsementFrom(this.userB.address, 2500))
        .to.emit(this.members, "EndorsementWithdrawn")
        .withArgs(this.userA.address, this.userB.address, 2500, 1);

      expect(await this.members.totalEndorsementsGiven(this.userA.address)).to.equal(5500);
      expect(await this.members.totalEndorsementsReceived(this.userB.address)).to.equal(500);
      expect(await this.members.endorsementsGiven(this.userA.address, this.userB.address)).to.equal(500);
      expect(await this.members.endorsementsReceived(this.userB.address, this.userA.address)).to.equal(500);

      await expect(this.members.connect(this.userA).withdrawEndorsementFrom(this.dev.address, 4000))
        .to.emit(this.members, "EndorsementWithdrawn")
        .withArgs(this.userA.address, this.dev.address, 4000, 1);

      expect(await this.members.totalEndorsementsGiven(this.userA.address)).to.equal(1500);
      expect(await this.members.totalEndorsementsReceived(this.dev.address)).to.equal(1000);
      expect(await this.members.endorsementsGiven(this.userA.address, this.dev.address)).to.equal(1000);
      expect(await this.members.endorsementsReceived(this.dev.address, this.userA.address)).to.equal(1000);
    })
  })

  describe("reclaimTokens()", async function () {

    beforeEach(async function () {
      const userCalls = this.members.connect(this.userA);

      await userCalls.mintEndorsements(50, 1000);
      await incrementWeek()
      await this.epoch.incrementEpoch();

      await userCalls.mintEndorsements(100, 1000);
      await incrementWeek()
      await this.epoch.incrementEpoch();

      await userCalls.mintEndorsements(150, 1000);
      await incrementWeek()
      await this.epoch.incrementEpoch();

      await userCalls.mintEndorsements(200, 1000);

      for (let i = 1; i <= 46; i++) {
        await incrementWeek()
        await this.epoch.incrementEpoch();
      }
    })

    it("sanity check", async function () {
      expect(await this.token.balanceOf(this.userA.address)).to.equal(96000);
      expect(await this.token.balanceOf(this.members.address)).to.equal(4000);
      expect(await this.members.totalEndorsementsAvailableToGive(this.userA.address)).to.equal(20000);
      expect(await this.epoch.current()).to.equal(50);
    })

    it("Reverts nothing when no stakes have vested/expired", async function () {
      expect(await this.epoch.current()).to.equal(50);
      const userCalls = this.members.connect(this.userA);
      await expect(userCalls.reclaimTokens()).to.be.revertedWith("No expired stakes available for withdraw")
    })

    it("Unstakes correctly if vested/expired", async function () {
      // epoch 50 -> first stake expires
      await incrementWeek()
      await this.epoch.incrementEpoch();
      expect(await this.epoch.current()).to.equal(51);

      let userStakes = await this.members.getStakesForMember(this.userA.address);
      const userCalls = this.members.connect(this.userA);
      expect(userStakes.numStakes).to.equal(4);

      await expect(userCalls.reclaimTokens())
        .to.emit(this.members, "TokensUnstaked")
        .withArgs(this.userA.address, 1000, 50, 51);

      userStakes = await this.members.getStakesForMember(this.userA.address);

      expect(userStakes.numStakes).to.equal(3);
      expect(userStakes.totalTokensStaked).to.equal(3000);
      expect(await this.members.totalEndorsementsAvailableToGive(this.userA.address)).to.equal(19000);
      expect(await this.token.balanceOf(this.userA.address)).to.equal(97000);
      expect(await this.token.balanceOf(this.members.address)).to.equal(3000);

      // epoch 101 -> second stake expires
      for (let i = 0; i <= 50; i++) {
        await incrementWeek()
        await this.epoch.incrementEpoch();
      }

      expect(await this.epoch.current()).to.equal(102);
      await expect(userCalls.reclaimTokens())
        .to.emit(this.members, "TokensUnstaked")
        .withArgs(this.userA.address, 1000, 100, 102);

      userStakes = await this.members.getStakesForMember(this.userA.address);

      expect(userStakes.numStakes).to.equal(2);
      expect(userStakes.totalTokensStaked).to.equal(2000);
      expect(await this.members.totalEndorsementsAvailableToGive(this.userA.address)).to.equal(16000);
      expect(await this.token.balanceOf(this.userA.address)).to.equal(98000);
      expect(await this.token.balanceOf(this.members.address)).to.equal(2000);

      // epoch 152 -> third stake expires
      for (let i = 0; i <= 50; i++) {
        await incrementWeek()
        await this.epoch.incrementEpoch();
      }

      expect(await this.epoch.current()).to.equal(153);
      await expect(userCalls.reclaimTokens())
        .to.emit(this.members, "TokensUnstaked")
        .withArgs(this.userA.address, 1000, 150, 153);

      userStakes = await this.members.getStakesForMember(this.userA.address);

      expect(userStakes.numStakes).to.equal(1);
      expect(userStakes.totalTokensStaked).to.equal(1000);
      expect(await this.members.totalEndorsementsAvailableToGive(this.userA.address)).to.equal(10000);
      expect(await this.token.balanceOf(this.userA.address)).to.equal(99000);
      expect(await this.token.balanceOf(this.members.address)).to.equal(1000);

      // epoch 203 -> last stake expires
      for (let i = 0; i <= 50; i++) {
        await incrementWeek()
        await this.epoch.incrementEpoch();
      }

      expect(await this.epoch.current()).to.equal(204);
      await expect(userCalls.reclaimTokens())
        .to.emit(this.members, "TokensUnstaked")
        .withArgs(this.userA.address, 1000, 200, 204);

      userStakes = await this.members.getStakesForMember(this.userA.address);

      expect(userStakes.numStakes).to.equal(0);
      expect(userStakes.totalTokensStaked).to.equal(0);
      expect(await this.members.totalEndorsementsAvailableToGive(this.userA.address)).to.equal(0);
      expect(await this.token.balanceOf(this.userA.address)).to.equal(100000);
      expect(await this.token.balanceOf(this.members.address)).to.equal(0);
    })

    it("reverts if user doesn't have enough endorsements after unstaking", async function () {
      const userCalls = this.members.connect(this.userA);

      await incrementWeek()
      await this.epoch.incrementEpoch();
      expect(await this.epoch.current()).to.equal(51);

      await userCalls.endorseMember(this.userB.address, 20000)
      await expect(userCalls.reclaimTokens()).to.be.revertedWith("Not enough endorsements remaining after unstaking");
    })
  })
})