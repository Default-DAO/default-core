# Default DAO

## Goal of default-core

The purpose of `default-core` is to give teams the core contracts they need to confidently create, run, and evolve a DAO. `default-core` currently consists of the following features:

- **The Default OS module system**: A way to extend a DAOs functionality by installing modules.
- **The Token module**: Create a ERC20 token for the DAO.
- **Peer rewards system**: Determine how much to reward each member for their contribution to the DAO.
- **Treasury**: Members can lock away their ERC20 tokens in "vaults" in exchange for shares.
- **Mining**: Members who lock away the DAO's native ERC20 token in a vault receive token rewards.

## Contract overview

**Core DefaultOS**

- `DefaultOSFactory`: Mapping of all Default OS DAOs instances stringIDs to their respective addresses.
- `DefaultOS`: Instance of a DAO using Default OS. Contains mapping of DAO's modules to their respective addresses.
- `DefaultOSModule`: Shell of a Default OS Module that ties together an instance of a module to an instance of Default OS.
- `DefaultOSModuleInstaller`: Defines signature of the `install` function, which is part of each module's installer contract.

**Epoch**: The `Epoch` contract defines the basic unit of time that the DAO operates in for minting, staking, mining, etc. Currently, the basic unit of time is hardcoded to 7 days.

**Token**: The `Token` module creates an ERC20 token for the DAO.

**Members**

- `_Staking`: When staking, members can lock away their tokens with the DAO for an arbitrary length of time. In the `Members` contract, members are rewarded with "endorsements" for staking their tokens.
- `Members`: The purpose of this contract is to determine who which members will have the power to determine which other members get token rewards each week, and what % of the total rewards those members will be responsible for allocating. You are only eligible to give rewards if you have enough "endorsements". You cannot create your own endorsements - they can only be given to you by another member. For a member to create a weekly allotment of endorsements to give, they must stake their tokens.
- `PeerRewards`: There's a set amount of rewards that can be given each epoch, and the purpose of this contract is to determine how these rewards are split between members. Each week, members with an adequate number of endorsements decide how to split the reward amongst the team. In essence, each member has a certain number of votes they can cast for how to allocate the rewards, and the number of votes a member has is determined by a combination of their endorsements and how many weeks in a row they have consecutively participated in the peer rewards program. At the end of the week, the total pot of available rewards are distributed amongst members of the team according to the number of votes they received from other members.

**Treasury**

- `_Vault`: Vault allows a member to deposit an ERC20 tokens with a DAO. The member receives shares in the vault in exchange, and these shares are themselves ERC20 tokens that can only be transferred by the DAO. Each vault holds a single token.
- `Treasury`: A treasury is a collection of vaults and each vault can store a single token. Members can deposit and withdraw from vaults, and the treasury takes a % fee from each withdraw.
- `Mining`: Allows members of DAO to mine the DAO's native token. Rewards have a set value that can be changed by the DAO. Rewards are distributed equally to each token held in the vault.

## Running locally

TBC

## Events

### Epoch

- event EpochIncremented(uint16 epoch, uint256 epochTime)

### Members

- event MemberRegistered(address member, bytes32 alias\_, uint16 epoch);
- event TokensStaked(address member, uint256 amount, uint16 lockDuration, uint16 epoch);
- event TokensUnstaked(address member, uint256 amount, uint16 lockDuration, uint16 epoch);
- event EndorsementGiven(address fromMember, address toMember, uint256 endorsementsGiven, uint16 epoch);
- event EndorsementWithdrawn(address fromMember, address toMember, uint256 endorsementsWithdrawn, uint16 epoch);

### PeerRewards

- event MemberRegistered(address member, uint16 epochRegisteredFor, uint256 ptsRegistered);
- event AllocationSet(address fromMember, address toMember, uint8 allocPts);
- event AllocationGiven(address fromMember, address toMember, uint256 allocGiven, uint16 epoch);
- event RewardsClaimed(address member, uint256 totalRewardsClaimed, uint16 epochClaimed);

### Mining

- event RewardsIssued(uint16 currentEpoch, uint256 newRewardsPerShare);
- event RewardsClaimed(uint16 epochClaimed, address member, uint256 totalRewardsClaimed);
- event Registered(uint16 currentEpoch, address member);

### Treasury

- event VaultOpened(Vault vault, uint16 epochOpened);
- event VaultFeeChanged(Vault vault, uint8 newFee, uint16 epochOpened);
- event Deposited(Vault vault, address member, uint256 amount, uint16 epoch);
- event Withdrawn(Vault vault, address member, uint256 amount, uint16 epoch);

### DefaultOS

- event ModuleInstalled(bytes3 moduleKeycode, address OSAddress, address moduleAddress);

### DefaultOSFactory

- event DaoCreated(address os, string id);
