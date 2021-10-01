const { ethers } = require("hardhat");
const faker = require('faker');
const deploy = require('./init');

// populate the addresses in the config object to reuse existing contracts.
// otherwise new contracts will be deployed.
const config = {
  factoryAddress: null,
  tokenInstallerAddress: null,
  epochInstallerAddress: null,
  treasuryInstallerAddress: null,
  miningInstallerAddress: null,
  membersInstallerAddress: null,
  rewardsInstallerAddress: null,
};

const tokenModInfo = createModInfo('def_Token', 'TKN');
const epochModInfo = createModInfo('def_Epoch', 'EPC');
const treasuryModInfo = createModInfo('def_Treasury', 'TSY');
const miningModInfo = createModInfo('def_Mining', 'MNG');
const membersModInfo = createModInfo('def_Members', 'MBR');
const peerRewardsModInfo = createModInfo('def_PeerRewards', 'PAY');

seedData();

async function seedData() {  
  const accounts = await ethers.getSigners();

  const testOsName = ethers.utils.formatBytes32String('testOs');
  const otherOsName = ethers.utils.formatBytes32String('otherOs');

  let { 
    factoryAddress,
    tokenInstallerAddress, 
    epochInstallerAddress,
    treasuryInstallerAddress,
    miningInstallerAddress,
    membersInstallerAddress,
    rewardsInstallerAddress,
  } = config;

  // if all required addresses are populated then use them, otherwise 
  // run the deploy script
  if (Object.keys(config).every(key => config[key] !== null)) {
    console.log('Using existing contract addresses');
    console.log(`[USING CONTRACT] DefaultOSFactory: ${factoryAddress}`)
    console.log(`[USING CONTRACT] DefaultTokenInstaller: ${tokenInstallerAddress}`);
    console.log(`[USING CONTRACT] DefaultEpochInstaller: ${epochInstallerAddress}`);
    console.log(`[USING CONTRACT] DefaultTreasuryInstaller: ${treasuryInstallerAddress}`);
    console.log(`[USING CONTRACT] DefaultMiningInstaller: ${miningInstallerAddress}`);
    console.log(`[USING CONTRACT] DefaultMembersInstaller: ${membersInstallerAddress}`);
    console.log(`[USING CONTRACT] DefaultPeerRewardsInstaller: ${rewardsInstallerAddress}`);
    factory = await ethers.getContractAt("DefaultOSFactory", factoryAddress);    
  } else {
    const { 
      defaultOsFactory,
      defaultTokenInstaller,
      defaultEpochInstaller,
      defaultTreasuryInstaller,
      defaultMiningInstaller,
      defaultMembersInstaller,
      defaultPeerRewardsInstaller,
    } = await deploy();
    factory = defaultOsFactory;
    tokenInstallerAddress = defaultTokenInstaller.address;
    epochInstallerAddress = defaultEpochInstaller.address;
    treasuryInstallerAddress = defaultTreasuryInstaller.address;
    miningInstallerAddress = defaultMiningInstaller.address;
    membersInstallerAddress = defaultMembersInstaller.address;
    rewardsInstallerAddress = defaultPeerRewardsInstaller.address;
  }

  // create two new test OSs
  await factory.setOS(testOsName);
  await factory.setOS(otherOsName);
  
  const testOsAddress = await factory.osMap(testOsName);
  const otherOsAddress = await factory.osMap(otherOsName);

  const testOs = await ethers.getContractAt("DefaultOS", testOsAddress);
  const otherOs = await ethers.getContractAt("DefaultOS", otherOsAddress);
  console.log('[CONTRACT DEPLOYED] testOs: ', testOs.address);
  console.log('[CONTRACT DEPLOYED] otherOs: ', otherOs.address);

  // split the available accounts into each os
  const half = Math.ceil(accounts.length / 2); 
  const testOsMembers = accounts.slice(0, half);
  const otherOsMembers = accounts.slice(-half);

  // install all modules for each os
  await testOs.installModule(tokenInstallerAddress);
  await testOs.installModule(epochInstallerAddress);
  await testOs.installModule(treasuryInstallerAddress);
  await testOs.installModule(miningInstallerAddress);
  await testOs.installModule(membersInstallerAddress);
  await testOs.installModule(rewardsInstallerAddress);

  await otherOs.installModule(tokenInstallerAddress);
  await otherOs.installModule(epochInstallerAddress);
  await otherOs.installModule(treasuryInstallerAddress);
  await otherOs.installModule(miningInstallerAddress);
  await otherOs.installModule(membersInstallerAddress);
  await otherOs.installModule(rewardsInstallerAddress);

  // get members module contract info
  const testOsMemMod = await getModuleContract(testOs, membersModInfo);
  const otherOsMemMod = await getModuleContract(otherOs, membersModInfo);

  // get token module contract info
  const testOsTokenMod = await getModuleContract(testOs, tokenModInfo);
  const otherOsTokenMod = await getModuleContract(otherOs, tokenModInfo);

  // get peer rewards contract info
  const testOsRewardsMod = await getModuleContract(testOs, peerRewardsModInfo);
  const otherOsRewardsMod = await getModuleContract(otherOs, peerRewardsModInfo);

  // get epoch contract info
  const testOsEpochMod = await getModuleContract(testOs, epochModInfo);
  const otherOsEpochMod = await getModuleContract(otherOs, epochModInfo);
  
  // set thresholds to 0 for ease of data population
  testOsRewardsMod.setParticipationThreshold(0);
  testOsRewardsMod.setRewardsThreshold(0);
  otherOsRewardsMod.setParticipationThreshold(0);
  otherOsRewardsMod.setRewardsThreshold(0);

  // create memberships
  await bulkRegisterMembers(testOs, testOsMemMod, testOsMembers);
  await bulkRegisterMembers(otherOs, otherOsMemMod, otherOsMembers);

  // mint tokens
  await bulkMintTokens(testOs, testOsTokenMod, testOsMemMod, testOsMembers);
  await bulkMintTokens(otherOs, otherOsTokenMod, otherOsMemMod, otherOsMembers);

  // stake tokens
  await bulkStakeForMembers(testOs, testOsMemMod, testOsTokenMod,testOsMembers);
  await bulkStakeForMembers(otherOs, otherOsMemMod, otherOsTokenMod,otherOsMembers);

  // endorse members
  await bulkEndorseMembers(testOs, testOsMemMod, testOsTokenMod, testOsMembers);
  await bulkEndorseMembers(otherOs, otherOsMemMod, otherOsTokenMod, otherOsMembers);

  // register for allocations for first time
  await firstTimeAllocationRegistration(testOs, testOsMemMod, testOsRewardsMod, testOsMembers);
  await firstTimeAllocationRegistration(otherOs, otherOsMemMod, otherOsRewardsMod, otherOsMembers);


  // increment epoch after all registrations
  // we cannot allocate for the first epoch. we can only endorse.
  await incrementEpochAfterRegistration(testOs, testOsEpochMod, testOsRewardsMod, testOsMembers, 1);
  await incrementEpochAfterRegistration(otherOs, otherOsEpochMod, otherOsRewardsMod, otherOsMembers, 1);

  await bulkRegisterForAllocations(testOs, testOsEpochMod, testOsRewardsMod, testOsMembers, 2);
  await bulkRegisterForAllocations(otherOs, otherOsEpochMod, otherOsRewardsMod, otherOsMembers, 2);


  // set and commit allocations for the current epoch
  await bulkAllocateAndEndEpoch(testOs, testOsRewardsMod, testOsEpochMod, testOsMembers, 2);
  await bulkAllocateAndEndEpoch(otherOs, otherOsRewardsMod, otherOsEpochMod, otherOsMembers, 2);

  // claim rewards from previous epoch 
  await bulkClaimRewards(testOs, testOsRewardsMod, testOsEpochMod, testOsMembers, 3);
  await bulkClaimRewards(otherOs, otherOsRewardsMod, otherOsEpochMod, otherOsMembers, 3);

}

async function bulkRegisterMembers(os, membersModule, members) {
  const osName = ethers.utils.parseBytes32String(await os.organizationName());
  members.forEach(async member => {
    const signer = await ethers.getSigner(member.address);
    const alias = ethers.utils.formatBytes32String(faker.internet.userName());
  
    // set alias
    await membersModule.connect(signer).setAlias(alias);
  
    // confirm alias
    const memAdd = await membersModule.getMemberForAlias(alias);
    console.log(
      `[OS ${osName}][Member Registered] alias: ${ethers.utils.parseBytes32String(alias)}, address:${memAdd}`
    );
  });
}

async function bulkMintTokens(os, tokenModule, membersModule, members) {
  const osName = ethers.utils.parseBytes32String(await os.organizationName());
  await members.forEach(async member => {
    await tokenModule.mint(member.address, ethers.BigNumber.from("1000"));
    // verify 
    const balance = await tokenModule.balanceOf(member.address);
    await tokenModule.connect(member).approve(membersModule.address, balance);
    console.log(
      `[OS ${osName}][Tokens Minted] address: ${member.address}, balance: ${balance}`
    );
  });
  
}

async function bulkStakeForMembers(os, membersModule, tokenModule, members) {
  // stake half of each members tokens after theyve been minted and approved
  const osName = ethers.utils.parseBytes32String(await os.organizationName());
  await members.forEach(async member => {
    tokenModule.once(tokenModule.filters.Approval(member.address, membersModule.address), async () => {
      
      const acctBalance = await tokenModule.balanceOf(member.address);
      const halfOfAcctBalance = acctBalance.div(2);
      const lockDuration = ethers.BigNumber.from(faker.datatype.number({ min: 50, max: 180 }));
  
      await membersModule.connect(member).mintEndorsements(lockDuration, halfOfAcctBalance);
      const totalEndorsements = await membersModule.totalEndorsementsAvailableToGive(member.address);
      console.log(
        `[OS ${osName}][Tokens Staked] address: ${member.address}, totalEndorsements: ${totalEndorsements}`
      );
    });
  });
}

async function bulkEndorseMembers(os, membersModule, tokenModule, members) {
  const osName = ethers.utils.parseBytes32String(await os.organizationName());
  const endorseableList = members.map(m => m.address ); // copy the member list
  await members.forEach( async (member, index) => {

    membersModule.once(
      membersModule.filters.TokensStaked(os.address, member.address), 
      async (_os, _member, _amount, _lockDuration, _epoch) => {
      
      // pick a random member to endorse to
      let randomIndex = null;
      while(randomIndex === null || randomIndex === index) {
        randomIndex = faker.datatype.number({min: 0, max: endorseableList.length - 1});
      }

      // endorse (use the endorseableList to ensure every member gets at least one endorsement)
      const totalEndorsements = await membersModule.totalEndorsementsAvailableToGive(member.address);
      const addressToEndorse = endorseableList.pop(randomIndex);
      await membersModule.connect(member).endorseMember(addressToEndorse, totalEndorsements);

      // verify
      membersModule.once(
        membersModule.filters.EndorsementGiven(os.address, member.address, null, null, _epoch), 
        async (os_, fromMember_, toMember_, endorsementsGiven_, epoch_) => {
          console.log(`[OS ${osName}][Endorsements Received] ${toMember_} received ${endorsementsGiven_.toString()} from ${fromMember_}`);

          // randomly create a few withdrawals
          if (faker.datatype.boolean()) {
            const signer = await ethers.getSigner(fromMember_);
            const amtToWithdrawl = ethers.BigNumber.from(faker.datatype.number({min: 1, max: 100})); // there should never be less than 100 endorsements given
            await membersModule.connect(signer).withdrawEndorsementFrom(toMember_, amtToWithdrawl);

            // verify withdrawals
            membersModule.once(
              membersModule.filters.EndorsementWithdrawn(os.address, fromMember_, null, null, _epoch), 
              async (_os_, _fromMember_, _toMember_, _endorsementsWithdrawn_, _epoch_) => {
                console.log(`[OS ${osName}][Endorsement Withdrawn] ${_fromMember_} withdrew ${_endorsementsWithdrawn_.toString()} from their endorsement to ${_toMember_}`);
              },
            );
          }
        },
      );
    });
  });
}

async function firstTimeAllocationRegistration(os, membersModule, rewardsModule, members) {
  const threshold = await rewardsModule.REWARDS_THRESHOLD();
  const registeredMembers = []; // use array to prevent adding the same member more than once.
  let registrationCount = 0;


  // catch every endorsement given event and check if member is able to register for allocations
  // after receiving the endorsement.
  // once the member has registered for allocations remove the event listener
  membersModule.on(
    membersModule.filters.EndorsementGiven(os.address, null, null, null, null),
    async (_os, _fromMember, _toMember, _endorsementsGiven, _epoch) => {
      const endorsementTotal = await membersModule.totalEndorsementsReceived(_toMember);
      if (endorsementTotal >= threshold && !registeredMembers.includes(_toMember)) {
        
        // register member for allocation
        const signer = await ethers.getSigner(_toMember);
        await rewardsModule.connect(signer).register();
        registrationCount++;
        registeredMembers.push(_toMember);

        if (registrationCount === members.length) {
          // once we've registered every member remove the listener
          membersModule.off(membersModule.filters.EndorsementGiven(os.address, null, null, null, null));
        }
      }
    },
  );
}

async function bulkRegisterForAllocations(os, epochModule, rewardsModule, members, epoch) {
  const osName = ethers.utils.parseBytes32String(await os.organizationName());
  epochModule.once(
    epochModule.filters.EpochIncremented(os.address, epoch, null),
    (_os, _epoch, _epochTime) => {
      members.forEach( async member => {
        await rewardsModule.connect(member).register();
        rewardsModule.once(
          rewardsModule.filters.MemberRegistered(os.address, member.address, null, epoch+1),
          (_os, _member, _ptsRegistered, _epochRegisteredFor) => {
            console.log(
              `[OS ${osName}][Member Registered for Allocations] ${_member} registered for allocations in epoch: ${_epochRegisteredFor}`
            );
          },
        );
      });
    },
  );
}

async function incrementEpochAfterRegistration(os, epochModule, rewardsModule, members, epoch) {
  const osName = ethers.utils.parseBytes32String(await os.organizationName());
  const registrationEpoch = epoch + 1;
  let registrationCount = 0;

  rewardsModule.on(
    rewardsModule.filters.MemberRegistered(os.address, null, null, registrationEpoch),
    async (_os, _member, _ptsRegistered, _epochRegisteredFor) => {

      registrationCount++;


      // once all members have registered then increment the epoch
      if (registrationCount === members.length) {
        // remove the registration event listener
        rewardsModule.off(rewardsModule.filters.MemberRegistered(os.address, null, null, registrationEpoch));

        console.log(`[OS ${osName}][Member Registered for Allocations] Finished Registering for 1st allocation. Incrementing Epoch...`);

        await incrementEpoch(epochModule, members);
      }
    },
  );

}

async function bulkAllocateAndEndEpoch(os, rewardsModule, epochModule, members, epoch) {
  /*
    This function sets allocations, committs those allocations, and then
    finally increments the epochs once all allocations have been committed.
  */
  const osName = ethers.utils.parseBytes32String(await os.organizationName());
  let memberCommittedCount = 0; // running total of number of members who committed their allocations

  epochModule.once(
    epochModule.filters.EpochIncremented(os.address, epoch, null),
    (_os, _epoch, _epochTime) => {
      console.log(`[OS ${osName}][Epoch Incremented] Epoch Number ${_epoch}`);
      // catch the OS epoch incremented event. We can safely assume
      // all members have registered for the epoch at this point
      members.forEach(member => {
        
        // choose a few members to allocate to
        const potentialRewardees = members.filter(m => m.address !== member.address);
        const numMembersToReward = faker.datatype.number({min: 3, max: potentialRewardees.length});
        const membersToReward = faker.random.arrayElements(
          potentialRewardees,
          numMembersToReward,
        );
        
        // allocate to those randomly selected members
        const totalPoints = faker.datatype.number({min: membersToReward.length, max: 255}); // use a random uint8 number, min 1 point per member
        const pointsPerMember = Math.floor(totalPoints / membersToReward.length);
        membersToReward.forEach( memberToReward => {
          rewardsModule.connect(member).configureAllocation(
            memberToReward.address, 
            pointsPerMember,
            {gasLimit: ethers.BigNumber.from("12450000")}, // provide max gas.
          );
        });

        // wait until last member allocation event. then commit allocations.
        let allocationsSetCount = 0;
        rewardsModule.on(
          rewardsModule.filters.AllocationSet(null, member.address, null, null),
          async (os_, fromMember_, toMember_, allocPts_, currentEpoch_) => {
            // count all allocations from this member. once we've counted the final one
            // then commit the allocations.
            allocationsSetCount++;
            if (allocationsSetCount === numMembersToReward) {
              rewardsModule.off(rewardsModule.filters.AllocationSet(null, member.address, null, null));
              console.log(`[OS ${osName}][Allocations Set] ${fromMember_} gave ${numMembersToReward} rewards in epoch ${currentEpoch_}`);
              rewardsModule.connect(member).commitAllocation();
              
  
              // verify allocations have been committed by counting each AllocationGiven event.
              let allocationsCommittedCount = 0;
              rewardsModule.on(
                rewardsModule.filters.AllocationGiven(null, member.address, null, null, _epoch),
                async (_os_, _fromMember_, _toMember_, _allocGiven_, _currentEpoch_) => {
                  allocationsCommittedCount++;
                  if (allocationsCommittedCount === numMembersToReward) {
                    rewardsModule.off(rewardsModule.filters.AllocationGiven(null, member.address, null, null, _epoch));
                    console.log(`[OS ${osName}][Allocations Committed] ${_fromMember_} committed their allocations for epoch: ${_currentEpoch_}`);
                    memberCommittedCount++;

                    if (memberCommittedCount === members.length) {
                      // once all members have committed their allocations then increment the epoch
                      await incrementEpoch(epochModule, members);
                    }
                  }
                },
              );
            }
          },
        );
      });
    },
  );
}

async function bulkClaimRewards(os, rewardsModule, epochModule, members, epoch) {
  const osName = ethers.utils.parseBytes32String(await os.organizationName());

  epochModule.once(
    epochModule.filters.EpochIncremented(os.address, epoch, null),
    async (_os, _epoch, _epochTime) => {

      members.forEach( async member => {
        await rewardsModule.connect(member).claimRewards();

        rewardsModule.once(
          rewardsModule.filters.RewardsClaimed(os.address, member.address, null, epoch), 
          async (os_, member_, totalRewardsClaimed_, epochClaimed_) => {
            console.log(`[OS ${osName}][Rewards Claimed] ${member_} claimed ${totalRewardsClaimed_} they received from the previous epoch (current epoch is ${epochClaimed_})`);
          },
        );
      });
    },
  );

}

async function incrementEpoch(epochModule, members) {
  const oneWeek = 7 * 24 * 60 * 60;

  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore.timestamp;
  
  // choose a random member to increment the epoch and receive the reward
  const randomMemberIndex = faker.datatype.number(
    {min: 0, max: members.length - 1}
  );

  const justIncrement = (e) => epochModule.connect(members[randomMemberIndex]).incrementEpoch();
  const mineThenIncrement = () => {
    ethers.provider.send('evm_mine').then( () => {
      epochModule.connect(members[randomMemberIndex]).incrementEpoch();
    });
  };

  ethers.provider.send(
    'evm_setNextBlockTimestamp',
     [timestampBefore + oneWeek]
  ).then(mineThenIncrement).catch(justIncrement);
}

async function getModuleContract(os, moduleInfo) {
  const modAddress = await os.getModule(moduleInfo.keyCode);
  const mod = await ethers.getContractAt(moduleInfo.name, modAddress);
  return mod;
}

function createModInfo(name, keyCode) { 
  return { name, keyCode: ethers.utils.toUtf8Bytes(keyCode) };
}