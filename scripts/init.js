// npx hardhat run scripts/deploy.js --network <network-name>

// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers } = require("hardhat");

async function main() {

  const DefaultOSFactory = await ethers.getContractFactory("DefaultOSFactory");

  const DefaultOS = await ethers.getContractFactory("DefaultOS");

  const DefaultTokenInstaller = await ethers.getContractFactory("def_TokenInstaller");
  const DefaultEpochInstaller = await ethers.getContractFactory("def_EpochInstaller");
  const DefaultTreasuryInstaller = await ethers.getContractFactory("def_TreasuryInstaller");
  const DefaultMiningInstaller = await ethers.getContractFactory("def_MiningInstaller");
  const DefaultTokenInstaller = await ethers.getContractFactory("def_TokenInstaller");
  const DefaultMembersInstaller = await ethers.getContractFactory("def_MembersInstaller");
  const DefaultPeerRewardsInstaller = await ethers.getContractFactory("def_PeerRewardsInstaller");

  const defaultOSFactory = await DefaultOSFactory.deploy()
  await defaultOSFactory.deployed();
  console.log("[CONTRACT DEPLOYED] DefaultOSFactory: ", defaultOSFactory.address);

  const defaultOS = await DefaultOS.deploy("Default DAO", "default", defaultOSFactory.address)
  await defaultOS.deployed();
  console.log("[CONTRACT DEPLOYED] DefaultOS: ", defaultOS.address);
  
  const defaultTokenInstaller = await DefaultTokenInstaller.deploy();
  await defaultTokenInstaller.deployed();
  console.log("[CONTRACT DEPLOYED] DefaultTokenInstaller: ", defaultTokenInstaller.address);

  const defaultEpochInstaller = await DefaultEpochInstaller.deploy();
  await defaultEpochInstaller.deployed();
  console.log("[CONTRACT DEPLOYED] DefaultEpochInstaller: ", defaultEpochInstaller.address);

  const defaultTreasuryInstaller = await DefaultTreasuryInstaller.deploy();
  await defaultTreasuryInstaller.deployed();
  console.log("[CONTRACT DEPLOYED] DefaultTreasuryInstaller: ", defaultTreasuryInstaller.address);

  const defaultMiningInstaller = await DefaultMiningInstaller.deploy();
  await defaultMiningInstaller.deployed();
  console.log("[CONTRACT DEPLOYED] DefaultMiningInstaller: ", defaultMiningInstaller.address);

  const defaultMembersInstaller = await DefaultMembersInstaller.deploy();
  await defaultMembersInstaller.deployed();
  console.log("[CONTRACT DEPLOYED] DefaultMembersInstaller: ", defaultMembersInstaller.address);
  
  const defaultPeerRewardsInstaller = await DefaultPeerRewardsInstaller.deploy();
  await defaultPeerRewardsInstaller.deployed();
  console.log("[CONTRACT DEPLOYED] DefaultMembersInstaller: ", defaultPeerRewardsInstaller.address);

  await defaultOSFactory.setDao(defaultOS.address)
  await defaultOS.installModule(defaultTokenInstaller.address);
  await defaultOS.installModule(defaultEpochInstaller.address);
  await defaultOS.installModule(defaultTreasuryInstaller.address);
  await defaultOS.installModule(defaultMiningInstaller.address);
  await defaultOS.installModule(defaultMembersInstaller.address);
  await defaultOS.installModule(defaultPeerRewardsInstaller.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
