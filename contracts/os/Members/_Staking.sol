// Quick Notes
//
// Stakes are not ERC20 tokens—they are simply locked in the contract. No ERC20/composability
// Around the staked tokens so as to not reduce the opportunity cost of the liquidity preference
// e.g. staking DEF is less of a commitment if someone can swap their sDEF for DEF/USDC immediately.
// And less confusing for the user when participating in governance/selling their tokens (see vBNT/BNT).
//
// Implementation
//
// The way we implement staking is with a sorted doubly linked list of "Stakes", or individual staking
// blocks of tokens that are locked for some amount of time. The list is sorted by FIRST expiration date 
// (basically the FIRST staking block to be unlocked). This makes it easy to insert arbitrary length stakes,
// allowing us to experiment with things like multipliers for longer stakes in future design iterations.
// (shoutout to https://curve.fi/ for the mechanism inspiration).
//
// ADDED NOTES (8/17/21): Originally we used the expiry epoch as the primary id to sort each stake, but this was changed
// due to the fact that different lock durations generate different multipliers for endorsements, so each
// individual stake needs to be recorded (even if two stakes expire on the same epoch). This creates some constraints
// because the length of total stakes increases.
// 
//
// Concerns/Improvements
//
// This contract has some issues, namely around the length of the list + traversals in staking and unstaking logic.
// There is a storage write for every stake dequeued, which can get expensive in the unstaking process.
// These inefficiencies probably create an upper bound around the max number of Stakes stored due to gas limits, so
// a top dev priority should be 1) testing the bounds of the contract for staking and 2) creating safety barriers around them.
// In the beginning I think things are okay because the only real failure points are staking with low duration after a lot of high
// duration staking (e.g. inserting a 1 year stake after 100 2 year stakes) and unstaking a large amount of tokens at once after a lot
// of stakes have expired.
//
// ADDED NOTES (8/17/21): Another potential (but slight) issue with this implementation arises when it comes to unstaking.
// In the current implementation, unstaking happens by dequeuing the first stake in the list (since it has the earliest expiry)
// However, because different stakes have different endorsement multipliers, a user may in theory want to withdraw/unstake
// a later stake in the linked list while preserving the first one (especially if it has a high multiplier). However,
// I think this is a very nuanced edge case that I cannot forsee causing major issues in the immediate future, but we'll see.
//
// - fully
//

// SPDX-License-Identifier: MIT 

pragma solidity ^0.8.0;

import "../DefaultOS.sol";
import "hardhat/console.sol";

/// @title Staking contract
/// @notice Add and remove token stakes.
contract Staking {

    // pack the struct variables--order declaration matters!
    // single stake object for a list of stakes
    struct Stake {
        uint16 expiryEpoch; // epoch when this batch of staked tokens expire => (lock duration + epoch staked). used as the comparison for the list sort.
        uint16 lockDuration; // # of epochs that token will be staked for 
        uint32 prevStakeId; // id of prev stake to expire in sorted linked list of staking blocks
        uint32 nextStakeId; // id of next stake to expire in linked list of staking blocks
        uint256 amountStaked; // DEF tokens amount staked in this batch
    }

    // sorted doubly linked list of stakes for a given user
    struct StakesList {
        uint8 numStakes; // number of Stakes for the user
        uint32 FIRST; // the FIRST stake to expire
        uint32 LAST; // the LAST stake to expire
        uint256 totalTokensStaked;// total amount of staked tokens for the user
        mapping(uint32 => Stake) getStakeForId; // key is a composite id consisting of expiryEpoch + lockDuration
    }

    /// @notice Get the list of stakes for a given member;
    mapping(address => StakesList) public getStakesForMember;



    // **********************************************************************
    //                          GENERATE STAKE ID
    // **********************************************************************

    /// @notice Construct stake ID. Used as the comparison for the list sort
    /// @param expiryEpoch_ Epoch when this batch of staked tokens expire
    /// @param lockDuration_ # of epochs that token will be staked for
    /// @return stakeId Composite stake ID
    function _packStakeId(uint16 expiryEpoch_, uint16 lockDuration_) internal pure returns(uint32 stakeId) {

        // shift expiry epoch 16 bits to the left and append the 16bit lock duration at the end to create a composite ID
        return (uint32(expiryEpoch_) << 16) | uint32(lockDuration_);
    }



    // **********************************************************************
    //              GET STAKE EXPIRY AND DURATION FROM STAKE ID
    // **********************************************************************

    /// @notice Deconstruct the composite ID of the stake to get the expiry epoch and lock duration
    /// @param stakeId_ Composite stake ID
    /// @return lockDuration # of epochs that token will be staked for
    /// @return expiryEpoch Epoch when this batch of staked tokens expire
    function _unpackStakeId(uint32 stakeId_) internal pure returns(uint16 lockDuration, uint16 expiryEpoch) {

        // save the left 16 bits of the Id as the expiry Epoch
        expiryEpoch = uint16(stakeId_ >> 16);

        // save the right 16 bits of the Id as the duration
        lockDuration = uint16(stakeId_);
        
        return (expiryEpoch, lockDuration);
    }



    // **********************************************************************
    //                        REGISTER A NEW STAKE
    // **********************************************************************

    /// @notice Register a new stake
    /// @dev Does a sorted insert into the doubly linked list based on expiryEpoch
    /// @param expiryEpoch_ Epoch when this batch of staked tokens expire
    /// @param lockDuration_ # of epochs that token will be staked for
    /// @param amount_ Number of tokens to stake
    function _registerNewStake(uint16 expiryEpoch_, uint16 lockDuration_, uint256 amount_) internal {

        StakesList storage stakes = getStakesForMember[msg.sender];

        uint32 newStakeId = _packStakeId(expiryEpoch_, lockDuration_);
        Stake memory newStake = stakes.getStakeForId[newStakeId];
        Stake memory lastStake = stakes.getStakeForId[stakes.LAST];

        // If a stake exists for the expiryEpoch + lockDuration, then
        // user wants to re-up (so add amount to existing stake) 
        if (newStake.expiryEpoch != 0) {
            newStake.amountStaked += amount_;
            stakes.getStakeForId[newStakeId] = newStake;
            stakes.totalTokensStaked += amount_;
            // then push the stake to the end of list

        // If no stakes exist, or if the current stake's expiry Epoch is greater than or equal to the last expiry,
        } else if (stakes.numStakes == 0 || expiryEpoch_ >= lastStake.expiryEpoch) { 
            _pushStake(expiryEpoch_, lockDuration_, amount_);

        // Otherwise, loop through the linked list starting from the end until the appropriate spot for the 
        // new stake is found, and insert the stake in the correct position.
        } else {
            Stake memory prevStake = stakes.getStakeForId[lastStake.prevStakeId];
            while (prevStake.expiryEpoch != 0 && prevStake.expiryEpoch > expiryEpoch_) {
                lastStake = prevStake;
                prevStake = stakes.getStakeForId[prevStake.prevStakeId];
            }

            uint32 existingStakeId = _packStakeId(lastStake.expiryEpoch, lastStake.lockDuration);
            _insertStakeBefore(existingStakeId, expiryEpoch_, lockDuration_, amount_);
        }
    }

    /// @notice Push stake to end of list
    /// @param expiryEpoch_ Epoch when this batch of staked tokens expire
    /// @param lockDuration_ # of epochs that token will be staked for
    /// @param amount_ Number of tokens to stake
    function _pushStake(uint16 expiryEpoch_, uint16 lockDuration_, uint256 amount_) internal {

        StakesList storage stakes = getStakesForMember[msg.sender];

        // create and map new Stake
        uint32 newStakeId = _packStakeId(expiryEpoch_, lockDuration_);
        stakes.getStakeForId[newStakeId] = Stake(expiryEpoch_, lockDuration_, stakes.LAST, 0, amount_);

        // if stake is the only item in the list, make it the new FIRST as well.
        if (stakes.numStakes == 0) { 
            stakes.FIRST = newStakeId;

        // otherwise, find the last stake and set its next stake to the new stake.
        } else {
            Stake storage curLAST = stakes.getStakeForId[stakes.LAST];
            curLAST.nextStakeId = newStakeId;
        }

        // set the current stake to be the new LAST item in the linked list & update the appropriate state variables
        stakes.LAST = newStakeId;
        stakes.totalTokensStaked += amount_;    
        stakes.numStakes++;
    }

    /// @notice Insert a new stake before given stake
    /// @param insertedBeforeStakeId_ Composite ID of stake that new stake will be inserted before
    /// @param expiryEpoch_ Epoch when this batch of staked tokens expire
    /// @param lockDuration_ # of epochs that token will be staked for
    /// @param amount_ Number of tokens to stake
    function _insertStakeBefore(uint32 insertedBeforeStakeId_, uint16 expiryEpoch_, uint16 lockDuration_, uint256 amount_) internal {

        // ensure there are existing stakes before inserting new stake before anything
        StakesList storage stakes = getStakesForMember[msg.sender];
        require (stakes.numStakes != 0, "Staking.sol: cannot insertStakeBefore() in empty list of Stakes");
        
        // get the object of the stake expiring after the new stake
        Stake memory afterNewStake = stakes.getStakeForId[insertedBeforeStakeId_];

        // create, configure, and map new Stake
        uint32 newStakeId = _packStakeId(expiryEpoch_, lockDuration_);
        stakes.getStakeForId[newStakeId] = Stake(expiryEpoch_, lockDuration_, afterNewStake.prevStakeId, insertedBeforeStakeId_, amount_);

        // If the old stake was the FIRST, make the inserted stake the new FIRST.
        if (insertedBeforeStakeId_ == stakes.FIRST) {
            stakes.FIRST = newStakeId;

        // Otherwise, change the "next" pointer for the stake expiring before the new stake
        } else {
            Stake memory beforeNewStake = stakes.getStakeForId[afterNewStake.prevStakeId];
            beforeNewStake.nextStakeId = newStakeId;
            stakes.getStakeForId[afterNewStake.prevStakeId] = beforeNewStake;
        }

        // Set the next stake's prev pointer to the newly inserted Stake.
        afterNewStake.prevStakeId = newStakeId;
        stakes.getStakeForId[insertedBeforeStakeId_] = afterNewStake;

        // update the appropriate state variables
        stakes.totalTokensStaked += amount_;    
        stakes.numStakes++;
    }



    // **********************************************************************
    //                        DEQUEUE A NEW STAKE
    // **********************************************************************


    /// @notice Dequeue the first stake in the queue
    /// @return lockDuration_ # of epochs that token will be staked for
    /// @return expiryEpoch_ Epoch when this batch of staked tokens expire
    /// @return amountStaked_ Number of tokens that were staked
    function _dequeueStake() internal returns (uint16 lockDuration_, uint16 expiryEpoch_, uint256 amountStaked_) {

        // Ensure stakes exist before dequeueing
        StakesList storage stakes = getStakesForMember[msg.sender];
        require (stakes.numStakes > 0, "cannot dequeue empty stakes list");

        Stake memory firstStake = stakes.getStakeForId[stakes.FIRST];
        
        // reset stake at FIRST stakeId
        stakes.getStakeForId[stakes.FIRST] = Stake(0, 0, 0, 0, 0);

        if (stakes.numStakes == 1) {
            stakes.FIRST = 0;
            stakes.LAST = 0;
            
        } else {
            // set the nextStake of the dequeued stake to be the first stake in the list        
            Stake memory nextStake = stakes.getStakeForId[firstStake.nextStakeId];
            nextStake.prevStakeId = 0;
            stakes.getStakeForId[firstStake.nextStakeId] = nextStake;
            stakes.FIRST = firstStake.nextStakeId;
        }

        // update the appropriate state variables
        stakes.totalTokensStaked -= firstStake.amountStaked;
        stakes.numStakes--;

        return (firstStake.lockDuration, firstStake.expiryEpoch, firstStake.amountStaked);
    }
}