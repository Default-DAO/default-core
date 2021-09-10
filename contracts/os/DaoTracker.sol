pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

/// @title DAO Tracker
/// @notice Keep track of global state of full list of DAOs and the addresses these DAOs map to
contract DaoTracker is Ownable {  
  event DaoCreated(address os, string id);

  mapping(string => address) public daoMap;
  address[] private daoList;

  /// @notice Get the address associated with a DAO's string ID
  /// @param daoId Human readable ID of DAO
  /// @return address Address associated with the the DAO
  function getDao(string memory daoId) public view returns (address) {
    return daoMap[daoId];
  }

  /// @notice Add a new DAO to list of DAOs. Cannot be used to change address of existing DAO
  /// @param daoId Human readable ID of DAO
  function setDao(string memory daoId, address os) public {
    require(daoMap[daoId] == address(0), "DaoTracker | setDao(): Alias already taken");
    daoMap[daoId] = os;
    daoList.push(daoMap[daoId]);

    emit DaoCreated(os, daoId);
  }
}