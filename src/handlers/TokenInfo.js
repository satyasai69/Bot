// src/handlers/TokenInfo.js
const { ethers } = require("ethers");
const axios = require("axios");
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
];

async function fetchTokenDetails(tokenAddress) {
  try {
    const response = await axios.get(
      `https://api.diadata.org/v1/assetQuotation/Metis/${tokenAddress}`
    );

    const tokenData = response.data;
    if (!tokenData) {
      throw new Error("Token not found");
    }

    return {
      price: tokenData.Price,
      symbol: tokenData.Symbol,
      name: tokenData.Name,
    };
  } catch (error) {
    throw new Error(`Error fetching token details: ${error.message}`);
  }
}

async function getTokenBalance(tokenAddress, userAddress) {
  try {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      provider
    );
    const balance = await tokenContract.balanceOf(userAddress);
    return ethers.formatEther(balance);
  } catch (error) {
    throw new Error(`Error getting token balance: ${error.message}`);
  }
}

async function createTokenContract(tokenAddress) {
  return new ethers.Contract(tokenAddress, ERC20_ABI, provider);
}

module.exports = {
  fetchTokenDetails,
  getTokenBalance,
  createTokenContract,
  provider,
};
