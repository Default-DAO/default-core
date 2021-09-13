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
- `DAOTracker`: Mapping of all Default OS DAOs instances stringIDs to their respective addresses.
- `DefaultOS`: Instance of a DAO using Default OS. Contains mapping of DAO's modules to their respective addresses.
- `DefaultOSModule`: Shell of a Default OS Module that ties together an instance of a module to an instance of Default OS.
- `DefaultOSModuleInstaller`: Defines signature of the `install` function, which is part of each module's installer contract.

**Epoch**: The `Epoch` contract defines the basic unit of time that the DAO operates in for minting, staking, mining, etc. Currently, the basic unit of time is hardcoded to 7 days.

**Token**: The `Token` module creates an ERC20 token for the DAO.

**Members**
- `_Staking`: When staking, members can lock away their tokens with the DAO for an arbitrary length of time. In the `Members` contract, members are rewarded with "endorsements" for staking their tokens. 
- `Members`: The purpose of this contract is to determine who which members will have the power to determine which other members get token rewards each week.  You are only eligible to give rewards if you have enough "endorsements". You cannot create your own endorsements, they are given to you by another member. For a member to be able to create endorsements to give, they stake their tokens which gives the member a weekly allotment of endorsements to distribute to other members. Members incur an opportunity cost (lost rewards from mining and liquidity) by endorsing another member. This opportunity cost gives an "endorsement" tangible meaning.
- `PeerRewards`: There's a set amount of rewards that can be given each epoch, and this purpose of this contract is to determine how these rewards are split between members. Each week, members with an adequate number of endorsements decide how to split the reward amongst the team. In essence, each member has a certain number of votes they can cast for how to allocate the rewards, and the number of votes a member has is determined by a combination of their endorsements and how many weeks in a row they have consecutively participated in the peer rewards program. At the end of the week, the total pot of available rewards are distributed amongst members of the team according to the number of votes they received from other members. 

**Treasury**
- `_Vault`: Vault allows a member to deposit an ERC20 tokens with a DAO. The member receives shares in the vault in exchange, and these shares are themselves ERC20 tokens that can only be transferred by the DAO. Each vault holds a single token.
- `Treasury`: A treasury is a collection of vaults and each vault can store a single token. Members can deposit and withdraw from vaults, and the treasury takes a % fee from each withdraw.
- `Mining`: Allows members of DAO to mine the DAO's native token. Rewards have a set value that can be changed by the DAO. Rewards are distributed equally to all each held in the vault.

## Running locally

TBC


