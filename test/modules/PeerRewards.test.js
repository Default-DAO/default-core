//@dev 
// testing could be a lot more robust. Good onboarding task to learn the algo.

const { expect } = require("chai");
const { incrementWeek } = require("../utils");
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe("Peer Rewards Module", async function () {

  before(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.userA = this.signers[1];
    this.userB = this.signers[2];
    this.userC = this.signers[3];
    this.userD = this.signers[4];
    this.userE = this.signers[5];

    this.DefaultOSFactory = await ethers.getContractFactory("DefaultOSFactory")
    this.DefaultOS = await ethers.getContractFactory("DefaultOS");
    this.DefaultTokenInstaller = await ethers.getContractFactory("def_TokenInstaller");
    this.DefaultMembersInstaller = await ethers.getContractFactory("def_MembersInstaller");
    this.DefaultPeerRewardsInstaller = await ethers.getContractFactory("def_PeerRewardsInstaller");
    this.DefaultEpochInstaller = await ethers.getContractFactory("def_EpochInstaller");

    this.membersModule = await this.DefaultMembersInstaller.deploy();
    await this.membersModule.deployed();

    this.factory = await this.DefaultOSFactory.deploy()
    await this.factory.deployed()

    this.defaultOS = await this.DefaultOS.deploy("Default DAO", "default", this.factory.address);
    this.default = await this.defaultOS.deployed();

    this.tokenModule = await this.DefaultTokenInstaller.deploy();
    await this.tokenModule.deployed();

    this.epochModule = await this.DefaultEpochInstaller.deploy();
    await this.epochModule.deployed();

    this.membersModule = await this.DefaultMembersInstaller.deploy();
    await this.membersModule.deployed();

    this.peerRewardsModule = await this.DefaultPeerRewardsInstaller.deploy();
    await this.peerRewardsModule.deployed();

    await this.default.installModule(this.tokenModule.address);
    this.token = await ethers.getContractAt("def_Token", await this.default.getModule("0x544b4e")); // "TKN"

    await this.default.installModule(this.epochModule.address);
    this.epoch = await ethers.getContractAt("def_Epoch", await this.default.getModule("0x455043")); // "EPC"

    await this.default.installModule(this.membersModule.address);
    this.members = await ethers.getContractAt("def_Members", await this.default.getModule("0x4d4252")); // "MBR"

    await this.token.mint(this.userA.address, 100000);
    await this.token.connect(this.userA).approve(this.members.address, 100000);
    await this.members.connect(this.userA).mintEndorsements(200, 100000)

    await this.token.mint(this.userB.address, 100000);
    await this.token.connect(this.userB).approve(this.members.address, 100000)
    await this.members.connect(this.userB).mintEndorsements(200, 100000);

    await this.token.mint(this.userC.address, 100000);
    await this.token.connect(this.userC).approve(this.members.address, 100000);
    await this.members.connect(this.userC).mintEndorsements(200, 100000)

    await this.token.mint(this.userD.address, 100000);
    await this.token.connect(this.userD).approve(this.members.address, 100000);
    await this.members.connect(this.userD).mintEndorsements(200, 100000)

    await this.token.mint(this.userE.address, 100000);
    await this.token.connect(this.userE).approve(this.members.address, 100000);
    await this.members.connect(this.userE).mintEndorsements(200, 100000)

    // A has 900k endorsements
    await this.members.connect(this.userA).endorseMember(this.userA.address, 300000);
    await this.members.connect(this.userB).endorseMember(this.userA.address, 300000);
    await this.members.connect(this.userC).endorseMember(this.userA.address, 300000);

    // B has 899999 endorsements
    await this.members.connect(this.userA).endorseMember(this.userB.address, 250000);
    await this.members.connect(this.userB).endorseMember(this.userB.address, 250000);
    await this.members.connect(this.userC).endorseMember(this.userB.address, 200000);
    await this.members.connect(this.userD).endorseMember(this.userB.address, 199999);

    // C has 400000 endorsements
    await this.members.connect(this.userA).endorseMember(this.userC.address, 200000);
    await this.members.connect(this.userD).endorseMember(this.userC.address, 200000);

    // D has 399999 endorsements
    await this.members.connect(this.userA).endorseMember(this.userD.address, 200000);
    await this.members.connect(this.userE).endorseMember(this.userD.address, 199999);

    // E has 0 endorsements

  })

  beforeEach(async function () {
    await this.default.installModule(this.peerRewardsModule.address);
    this.rewards = await ethers.getContractAt("def_PeerRewards", await this.default.getModule("0x504159")); // "PAY"
  })

  describe("Registration", async function () {

    it("doesn't register members below the reward threshold", async function () {
      await expect(this.rewards.connect(this.userD).register()).to.be.revertedWith("def_PeerRewards | register(): not enough endorsements to participate!");
      await expect(this.rewards.connect(this.userE).register()).to.be.revertedWith("def_PeerRewards | register(): not enough endorsements to participate!");
    })

    it("registers members to receive rewards even if they don't qualify to allocate", async function () {

      await expect(this.rewards.connect(this.userB).register())
        .to.emit(this.rewards, "MemberRegistered")
        .withArgs(this.userB.address, 2, 0)

      await expect(this.rewards.connect(this.userC).register())
        .to.emit(this.rewards, "MemberRegistered")
        .withArgs(this.userC.address, 2, 0)

      expect(await this.rewards.pointsRegisteredForEpoch(2, this.userB.address)).to.equal(0);
      expect(await this.rewards.pointsRegisteredForEpoch(2, this.userC.address)).to.equal(0);
      expect(await this.rewards.totalPointsRegisteredForEpoch(2)).to.equal(0);

      expect(await this.rewards.eligibleForRewards(2, this.userB.address)).to.equal(true);
      expect(await this.rewards.eligibleForRewards(2, this.userC.address)).to.equal(true);
    })

    it("registers members to receive and give rewards if they qualify", async function () {
      await expect(this.rewards.connect(this.userA).register())
        .to.emit(this.rewards, "MemberRegistered")
        .withArgs(this.userA.address, 2, 90000);

      expect(await this.rewards.pointsRegisteredForEpoch(2, this.userA.address)).to.equal(90000); // 10% because of streak
      expect(await this.rewards.totalPointsRegisteredForEpoch(2)).to.equal(90000);
      expect(await this.rewards.eligibleForRewards(2, this.userA.address)).to.equal(true);
    })
  })

  describe("Allocation List Configuration", async function () {
    // before(async function() {

    //     // add to existing endorsements for allocations

    //     // A has 1.2M endorsements
    //     // await this.members.connect(this.userA).endorseMember(this.userA.address, 300000);
    //     // await this.members.connect(this.userB).endorseMember(this.userA.address, 300000);
    //     // await this.members.connect(this.userC).endorseMember(this.userA.address, 300000);
    //     await this.members.connect(this.userD).endorseMember(this.userA.address, 300000);

    //     // B has 1M endorsements
    //     // await this.members.connect(this.userA).endorseMember(this.userB.address, 250000);
    //     // await this.members.connect(this.userB).endorseMember(this.userB.address, 250000);
    //     // await this.members.connect(this.userC).endorseMember(this.userB.address, 200000);
    //     // await this.members.connect(this.userD).endorseMember(this.userB.address, 199999);
    //     await this.members.connect(this.userC).endorseMember(this.userB.address, 100000);
    //     await this.members.connect(this.userD).endorseMember(this.userB.address, 1);


    //     // C has 900k endorsements
    //     // await this.members.connect(this.userA).endorseMember(this.userC.address, 200000);
    //     // await this.members.connect(this.userD).endorseMember(this.userC.address, 200000);
    //     await this.members.connect(this.userC).endorseMember(this.userC.address, 200000);
    //     await this.members.connect(this.userE).endorseMember(this.userC.address, 300000);

    //     // D has 950k endorsements
    //     // await this.members.connect(this.userA).endorseMember(this.userD.address, 200000);
    //     // await this.members.connect(this.userE).endorseMember(this.userD.address, 199999);
    //     await this.members.connect(this.userE).endorseMember(this.userD.address, 100001);
    //     await this.members.connect(this.userB).endorseMember(this.userD.address, 300000);
    //     await this.members.connect(this.userD).endorseMember(this.userD.address, 150000)
    // })

    // it("sanity check", async function() {
    //     expect(await this.members.totalEndorsementsReceived(this.userA.address)).to.equal(1200000);
    //     expect(await this.members.totalEndorsementsReceived(this.userB.address)).to.equal(1000000);
    //     expect(await this.members.totalEndorsementsReceived(this.userC.address)).to.equal(900000);
    //     expect(await this.members.totalEndorsementsReceived(this.userD.address)).to.equal(950000);
    // })

    it("doesn't allow members to allocate to themselves", async function () {
      await expect(this.rewards.connect(this.userA).configureAllocation(this.userA.address, 2)).to.be.revertedWith("def_PeerRewards | configureAllocation(): cannot allocate to self!");
    })

    it("adds an allocation to empty list", async function () {
      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 2);
      const allocList = await this.rewards.getAllocationsListFor(this.userA.address);
      expect(allocList.numAllocs).to.equal(1);
      expect(allocList.highestPts).to.equal(2);
      expect(allocList.lowestPts).to.equal(2);
      expect(allocList.totalPts).to.equal(2);
      expect(allocList.TAIL).to.equal(this.userB.address);
    })

    it("remove allocation from list", async function () {
      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 2);
      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 0);
      const allocList = await this.rewards.getAllocationsListFor(this.userA.address);
      expect(allocList.numAllocs).to.equal(0);
      expect(allocList.highestPts).to.equal(0);
      expect(allocList.lowestPts).to.equal(0);
      expect(allocList.totalPts).to.equal(0);
      expect(allocList.TAIL).to.equal(ZERO_ADDRESS);
    })

    it("adds an allocation to non empty list", async function () {
      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 1);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 6);
      const allocList = await this.rewards.getAllocationsListFor(this.userA.address);
      expect(allocList.numAllocs).to.equal(2);
      expect(allocList.highestPts).to.equal(6);
      expect(allocList.lowestPts).to.equal(1);
      expect(allocList.totalPts).to.equal(7);
      expect(allocList.TAIL).to.equal(this.userC.address);
    })

    it("changes an allocation in non empty list", async function () {
      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 1);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 6);
      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 3);

      const allocList = await this.rewards.getAllocationsListFor(this.userA.address);
      expect(allocList.numAllocs).to.equal(2);
      expect(allocList.highestPts).to.equal(6);
      expect(allocList.lowestPts).to.equal(3);
      expect(allocList.totalPts).to.equal(9);
      expect(allocList.TAIL).to.equal(this.userC.address);
    })

    it("removes an allocation in non empty list", async function () {
      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 1);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 6);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 0);

      const allocList = await this.rewards.getAllocationsListFor(this.userA.address);
      expect(allocList.numAllocs).to.equal(1);
      expect(allocList.highestPts).to.equal(1);
      expect(allocList.lowestPts).to.equal(1);
      expect(allocList.totalPts).to.equal(1);
      expect(allocList.TAIL).to.equal(this.userB.address);
    })

    it("removes an allocation in non empty list x2", async function () {
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 1);
      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 5);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 0);
      // await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 10);

      const allocList = await this.rewards.getAllocationsListFor(this.userA.address);
      expect(allocList.numAllocs).to.equal(1);
      expect(allocList.highestPts).to.equal(5);
      expect(allocList.lowestPts).to.equal(5);
      expect(allocList.totalPts).to.equal(5);
      expect(allocList.TAIL).to.equal(this.userB.address);
    })

    it("re-adds an allocation", async function () {
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 1);
      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 5);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 0);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 10);

      const allocList = await this.rewards.getAllocationsListFor(this.userA.address);
      expect(allocList.numAllocs).to.equal(2);
      expect(allocList.highestPts).to.equal(10);
      expect(allocList.lowestPts).to.equal(5);
      expect(allocList.totalPts).to.equal(15);
      expect(allocList.TAIL).to.equal(this.userC.address);
    })

  })

  describe("Committing Allocations", async function () {

    it("requires the member to have registered in the previous epoch", async function () {
      await expect(this.rewards.connect(this.userA).commitAllocation()).to.be.revertedWith("def_PeerRewards | commitAllocation(): from member did not register for peer rewards this epoch");
    })

    it("requires the member to have enough endorsements for the allocation", async function () {
      await this.rewards.connect(this.userA).register();
      await incrementWeek()
      await this.epoch.incrementEpoch(); // epoch: 2

      await this.members.connect(this.userA).withdrawEndorsementFrom(this.userA.address, 1);
      await expect(this.rewards.connect(this.userA).commitAllocation()).to.be.revertedWith("def_PeerRewards | commitAllocation(): from member does not enough endorsements received to participate");

      // restore endorsement for next tests
      await this.members.connect(this.userA).endorseMember(this.userA.address, 1);
    })


    it("requires the member allocations to be within the mix/max threshold", async function () {
      await this.rewards.connect(this.userA).register();
      await incrementWeek()
      await this.epoch.incrementEpoch(); // epoch: 3


      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 1);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 2);
      await this.rewards.connect(this.userA).configureAllocation(this.userD.address, 3);
      await this.rewards.connect(this.userA).configureAllocation(this.userE.address, 5);

      await expect(this.rewards.connect(this.userA).commitAllocation()).to.be.revertedWith("def_PeerRewards | commitAllocation(): allocations do not comply with threshold boundaries");

      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 4);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 26);
      await this.rewards.connect(this.userA).configureAllocation(this.userD.address, 35);
      await this.rewards.connect(this.userA).configureAllocation(this.userE.address, 35);

      await expect(this.rewards.connect(this.userA).commitAllocation()).to.be.revertedWith("def_PeerRewards | commitAllocation(): allocations do not comply with threshold boundaries");

    })

    it("requires receiving allocations to meet the reward threshold", async function () {
      await this.rewards.connect(this.userA).register();
      await incrementWeek()
      await this.epoch.incrementEpoch(); // epoch: 4

      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 1);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 2);
      await this.rewards.connect(this.userA).configureAllocation(this.userD.address, 3);
      await this.rewards.connect(this.userA).configureAllocation(this.userE.address, 4);

      await expect(this.rewards.connect(this.userA).commitAllocation()).to.be.revertedWith("def_PeerRewards | commitAllocation(): to member does not have enough endorsements to receive allocation");
    })

    it("requires receiving members to register for rewards each epoch", async function () {
      await this.rewards.connect(this.userA).register();
      await incrementWeek()
      await this.epoch.incrementEpoch(); // epoch: 5

      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 1);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 2);
      await this.rewards.connect(this.userA).configureAllocation(this.userD.address, 3);
      await this.rewards.connect(this.userA).configureAllocation(this.userE.address, 4);

      await this.members.connect(this.userA).endorseMember(this.userD.address, 1);
      await this.members.connect(this.userD).endorseMember(this.userE.address, 300000);
      await this.members.connect(this.userC).endorseMember(this.userE.address, 100000);

      await expect(this.rewards.connect(this.userA).commitAllocation()).to.be.revertedWith("def_PeerRewards | commitAllocation(): member did not register for rewards this epoch");
    })


    it("requires receiving members to register for rewards each epoch", async function () {
      // endorsements carry over from last test
      await this.rewards.connect(this.userA).register();
      await this.rewards.connect(this.userB).register();
      await this.rewards.connect(this.userC).register();
      await this.rewards.connect(this.userD).register();
      await this.rewards.connect(this.userE).register();

      await incrementWeek()
      await this.epoch.incrementEpoch(); // epoch: 6

      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 1);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 2);
      await this.rewards.connect(this.userA).configureAllocation(this.userD.address, 3);
      await this.rewards.connect(this.userA).configureAllocation(this.userE.address, 4);

      await this.rewards.connect(this.userA).commitAllocation();

      expect(await this.rewards.mintableRewards(6, this.userB.address)).to.equal(500000 * 1 / 10);
      expect(await this.rewards.mintableRewards(6, this.userC.address)).to.equal(500000 * 2 / 10);
      expect(await this.rewards.mintableRewards(6, this.userD.address)).to.equal(500000 * 3 / 10);
      expect(await this.rewards.mintableRewards(6, this.userE.address)).to.equal(500000 * 4 / 10);

      // don't let members commit twice in the same epoch
      await expect(this.rewards.connect(this.userA).commitAllocation()).to.be.revertedWith("def_PeerRewards | commitAllocation(): cannot participate more than once per epoch")
    })
  })

  describe("claiming rewards", async function () {
    it("cannot be claimed in the same epoch", async function () {
      await expect(this.rewards.connect(this.userB).claimRewards()).to.be.revertedWith("user must have rewards to claim");
    })

    it("rewards can be claimed after 1 epoch", async function () {
      // allocate rewards
      await this.rewards.connect(this.userA).register();
      await this.rewards.connect(this.userB).register();
      await this.rewards.connect(this.userC).register();
      await this.rewards.connect(this.userD).register();
      await this.rewards.connect(this.userE).register();

      await incrementWeek()
      await this.epoch.incrementEpoch(); // epoch: 7

      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 1);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 2);
      await this.rewards.connect(this.userA).configureAllocation(this.userD.address, 3);
      await this.rewards.connect(this.userA).configureAllocation(this.userE.address, 4);

      await this.rewards.connect(this.userA).commitAllocation();

      await incrementWeek()
      await this.epoch.incrementEpoch(); // epoch: 8

      expect(await this.rewards.mintableRewards(7, this.userB.address)).to.equal(50000);
      expect(await this.rewards.lastEpochClaimed(this.userB.address)).to.equal(0);

      await expect(this.rewards.connect(this.userB).claimRewards())
        .to.emit(this.rewards, "RewardsClaimed")
        .withArgs(this.userB.address, 50000, 8);

      expect(await this.rewards.lastEpochClaimed(this.userB.address)).to.equal(
        await this.epoch.current() - 1
      );
    })

    it("rewards can be claimed after 1 epoch", async function () {
      // allocate rewards
      await this.rewards.connect(this.userA).register();
      await this.rewards.connect(this.userB).register();
      await this.rewards.connect(this.userC).register();
      await this.rewards.connect(this.userD).register();
      await this.rewards.connect(this.userE).register();

      await incrementWeek()
      await this.epoch.incrementEpoch(); // epoch: 9

      await this.rewards.connect(this.userA).configureAllocation(this.userB.address, 1);
      await this.rewards.connect(this.userA).configureAllocation(this.userC.address, 2);
      await this.rewards.connect(this.userA).configureAllocation(this.userD.address, 3);
      await this.rewards.connect(this.userA).configureAllocation(this.userE.address, 4);

      await this.rewards.connect(this.userA).commitAllocation();

      // register for epoch 10
      await this.rewards.connect(this.userA).register();
      await this.rewards.connect(this.userB).register();
      await this.rewards.connect(this.userC).register();
      await this.rewards.connect(this.userD).register();
      await this.rewards.connect(this.userE).register();

      await incrementWeek()
      await this.epoch.incrementEpoch(); // 10
      await this.rewards.connect(this.userA).commitAllocation();

      await this.rewards.connect(this.userA).register();
      await this.rewards.connect(this.userB).register();
      await this.rewards.connect(this.userC).register();
      await this.rewards.connect(this.userD).register();
      await this.rewards.connect(this.userE).register();

      await incrementWeek()
      await this.epoch.incrementEpoch(); // 11
      await this.rewards.connect(this.userA).commitAllocation();

      await incrementWeek()
      await this.epoch.incrementEpoch(); // 12
      await incrementWeek()
      await this.epoch.incrementEpoch(); // 13

      expect(await this.rewards.mintableRewards(9, this.userB.address)).to.equal(50000);
      expect(await this.rewards.lastEpochClaimed(this.userB.address)).to.equal(0);

      expect(await this.rewards.mintableRewards(10, this.userB.address)).to.equal(50000);
      expect(await this.rewards.lastEpochClaimed(this.userB.address)).to.equal(0);

      expect(await this.rewards.mintableRewards(11, this.userB.address)).to.equal(50000);
      expect(await this.rewards.lastEpochClaimed(this.userB.address)).to.equal(0);

      await expect(this.rewards.connect(this.userB).claimRewards())
        .to.emit(this.rewards, "RewardsClaimed")
        .withArgs(this.userB.address, 150000, 13);

      expect(await this.token.balanceOf(this.userB.address)).to.equal(200000);

      expect(await this.rewards.lastEpochClaimed(this.userB.address)).to.equal(await this.epoch.current() - 1);      

      await expect(this.rewards.connect(this.userB).claimRewards()).to.be.revertedWith("nothing available to claim")
    })
  })
})