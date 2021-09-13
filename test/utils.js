async function incrementWeek(customTime) {
  const time = customTime ? customTime : 7 * 24 * 60 * 60;

  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore.timestamp;

  await ethers.provider.send('evm_setNextBlockTimestamp', [timestampBefore + time])
  await ethers.provider.send('evm_mine');
}

function makeHex(str, bytes) {
  var strArray = [];
  for (var n = 0, l = str.length; n < l; n++) {
    var hex = Number(str.charCodeAt(n)).toString(16);
    strArray.push(hex);
  }
  return ethers.utils.hexZeroPad("0x" + strArray.join(''), bytes)
}

module.exports = {
  incrementWeek
}