// src/handlers/Buy.js
const { ethers } = require("ethers");
const User = require("../models/user");
const {
  fetchTokenDetails,
  getTokenBalance,
  createTokenContract,
  provider,
} = require("./TokenInfo");

const CAMELOT_ROUTER_ABI = [
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, address referrer, uint deadline) external payable",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
];

const CAMELOT_ROUTER_ADDRESS = process.env.SWAP_CONTRACT_ADDRESS;
const WETH_ADDRESS = process.env.WETH_ADDRESS;
const REFERRER_ADDRESS =
  process.env.REFERRER_ADDRESS || "0x0000000000000000000000000000000000000000";

// Default slippage tolerance (1%)
const DEFAULT_SLIPPAGE = 1;

async function initiateBuy(ctx) {
  try {
    // Get user's Telegram ID
    const telegramId = ctx.from.id;

    // Check if user exists in database
    const user = await User.findOne({ telegramId: telegramId });

    if (!user) {
      await ctx.reply("User not found. Please start the bot first.");
      return;
    }

    // Initialize state
    ctx.session.buyState = "waiting_for_address";
    ctx.session.sellState = null;

    // Send initial prompt
    await ctx.reply("Enter the token address you want to buy:");
  } catch (error) {
    console.error("Buy initiation error:", error);
    await ctx.reply(`An error occurred: ${error.message}`);
    delete ctx.session.buyState;
  }
}

/* async function handleBuyStep(ctx) {
  if (!ctx.session.buyState) return;

  const msg = ctx.message.text;

  try {
    switch (ctx.session.buyState) {
      case "waiting_for_address":
        if (!ethers.isAddress(msg)) {
          await ctx.reply(
            "Invalid address. Please enter a valid token address:"
          );
          return;
        }

        const tokenDetails = await fetchTokenDetails(msg);
        ctx.session.tokenAddress = msg;
        ctx.session.tokenDetails = tokenDetails;

        await ctx.reply(
          `Token Details:\n\n` +
            `Symbol: ${tokenDetails.symbol}\n` +
            `Price: $${tokenDetails.price}\n\n` +
            `How much ETH would you like to spend?`
        );
        ctx.session.buyState = "waiting_for_amount";
        break;

      case "waiting_for_amount":
        const amount = parseFloat(msg);
        if (isNaN(amount) || amount <= 0) {
          await ctx.reply("Please enter a valid positive number.");
          return;
        }

        try {
          await ctx.reply("Processing your purchase...");

          const user = await User.findOne({ telegramId: ctx.from.id });
          const txHash = await swapETHForToken(
            user,
            ctx.session.tokenAddress,
            amount
          );

          await ctx.reply(
            `Purchase completed!\n` +
              `Transaction Hash: ${txHash}\n` +
              `View on Arbiscan: https://arbiscan.io/tx/${txHash}`
          );

          // Clear state
          delete ctx.session.buyState;
          delete ctx.session.tokenAddress;
          delete ctx.session.tokenDetails;
        } catch (error) {
          await ctx.reply(`Purchase error: ${error.message}`);
          delete ctx.session.buyState;
          delete ctx.session.tokenAddress;
          delete ctx.session.tokenDetails;
        }
        break;
    }
  } catch (error) {
    console.error("Message handler error:", error);
    await ctx.reply(`An error occurred: ${error.message}`);
    delete ctx.session.buyState;
    delete ctx.session.tokenAddress;
    delete ctx.session.tokenDetails;
  }
} */

async function handleBuyStep(ctx) {
  if (!ctx.session.buyState) return;

  const msg = ctx.message.text;

  try {
    switch (ctx.session.buyState) {
      case "waiting_for_address":
        if (!ethers.isAddress(msg)) {
          await ctx.reply(
            "Invalid address. Please enter a valid token address:"
          );
          return;
        }

        try {
          const tokenDetails = await fetchTokenDetails(msg);

          // Validate token details
          if (
            !tokenDetails ||
            !tokenDetails.symbol ||
            !tokenDetails.price ||
            isNaN(tokenDetails.price)
          ) {
            await ctx.reply(
              `⚠️ Warning: Could not fetch complete token details.\n\n` +
                `Symbol: ${tokenDetails?.symbol || "Unknown"}\n` +
                `Price: ${
                  tokenDetails?.price ? `$${tokenDetails.price}` : "Unknown"
                }\n\n` +
                `Would you still like to proceed with the purchase? (Enter amount in ETH or type 'cancel')`
            );

            ctx.session.tokenAddress = msg;
            ctx.session.tokenDetails = {
              symbol: tokenDetails?.symbol || "Unknown",
              price: tokenDetails?.price || "Unknown",
            };
            ctx.session.buyState = "waiting_for_amount";
          } else {
            // Normal flow with valid token details
            ctx.session.tokenAddress = msg;
            ctx.session.tokenDetails = tokenDetails;

            await ctx.reply(
              `Token Details:\n\n` +
                `Symbol: ${tokenDetails.symbol}\n` +
                `Price: $${tokenDetails.price}\n\n` +
                `How much ETH would you like to spend?`
            );
            ctx.session.buyState = "waiting_for_amount";
          }
        } catch (error) {
          console.error("Token details fetch error:", error);
          await ctx.reply(
            `⚠️ Warning: Could not fetch token details.\n` +
              `Would you still like to proceed with the purchase? (Enter amount in ETH or type 'cancel')`
          );
          ctx.session.tokenAddress = msg;
          ctx.session.tokenDetails = {
            symbol: "Unknown",
            price: "Unknown",
          };
          ctx.session.buyState = "waiting_for_amount";
        }
        break;

      case "waiting_for_amount":
        if (msg.toLowerCase() === "cancel") {
          await ctx.reply("Purchase cancelled.");
          delete ctx.session.buyState;
          delete ctx.session.tokenAddress;
          delete ctx.session.tokenDetails;
          return;
        }

        const amount = parseFloat(msg);
        if (isNaN(amount) || amount <= 0) {
          await ctx.reply(
            "Please enter a valid positive number or type 'cancel' to cancel."
          );
          return;
        }

        try {
          await ctx.reply(
            `⏳ Processing your purchase...\n\n` +
              `Token: ${ctx.session.tokenDetails.symbol}\n` +
              `Amount: ${amount} ETH`
          );

          const user = await User.findOne({ telegramId: ctx.from.id });
          const txHash = await swapETHForToken(
            user,
            ctx.session.tokenAddress,
            amount
          );

          await ctx.reply(
            `✅ Purchase completed!\n\n` +
              `Transaction Hash: ${txHash}\n` +
              `View on Scan: https://sepolia.etherscan.io//tx/${txHash}`
          );

          // Clear state
          delete ctx.session.buyState;
          delete ctx.session.tokenAddress;
          delete ctx.session.tokenDetails;
        } catch (error) {
          await ctx.reply(
            `❌ Purchase error: ${error.message}\n\n` +
              `Type a new amount to try again or 'cancel' to cancel.`
          );
          // Don't clear state here to allow retrying
        }
        break;
    }
  } catch (error) {
    console.error("Message handler error:", error);
    await ctx.reply(
      `❌ An error occurred: ${error.message}\n` +
        `The purchase process has been cancelled.`
    );
    delete ctx.session.buyState;
    delete ctx.session.tokenAddress;
    delete ctx.session.tokenDetails;
  }
}

async function swapETHForToken(privateKey, tokenAddress, ethAmount) {
  try {
    // Connect to Ethereum network
    const provider = new ethers.JsonRpcProvider(process.env.ETH_TESTNET_URL);
    const wallet = new ethers.Wallet(privateKey.privateKey, provider);

    // Log connection details for debugging
    console.log("Connected to network:", await provider.getNetwork());
    console.log("Wallet address:", wallet.address);

    // Check ETH balance
    const balance = await provider.getBalance(wallet.address);
    const ethBalance = ethers.formatEther(balance);
    console.log("ETH Balance:", ethBalance);

    if (balance < ethers.parseEther(ethAmount.toString())) {
      throw new Error("Insufficient ETH balance");
    }

    // Uniswap V2 Router address and ABI
    const uniswapV2RouterAddress = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";
    const uniswapV2RouterABI = [
      "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
      "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
      "function WETH() external pure returns (address)",
    ];

    const uniswapRouter = new ethers.Contract(
      uniswapV2RouterAddress,
      uniswapV2RouterABI,
      wallet
    );

    // Get the WETH address
    const WETH = await uniswapRouter.WETH();
    console.log("WETH address:", WETH);

    // Define the path for swapping: ETH -> Token
    const path = [WETH, tokenAddress];
    console.log("Swap path:", path);

    // Convert ETH amount to wei
    const ethAmountInWei = ethers.parseEther(ethAmount.toString());
    console.log("ETH amount in wei:", ethAmountInWei.toString());

    // Get expected output amount
    let amountsOut;
    try {
      amountsOut = await uniswapRouter.getAmountsOut(ethAmountInWei, path);
      console.log("Expected output amount:", amountsOut[1].toString());
    } catch (error) {
      console.error("Error getting amounts out:", error);
      throw new Error(
        "Failed to calculate output amount. The pool might not exist or have enough liquidity."
      );
    }

    // Calculate minimum amount out with higher slippage tolerance
    const slippageTolerance = BigInt(1); // 1% slippage
    const slippageMultiplier = BigInt(100) - slippageTolerance;
    const minAmountOut = (amountsOut[1] * slippageMultiplier) / BigInt(100);
    console.log("Minimum output amount:", minAmountOut.toString());

    // Deadline for transaction (current time + 20 minutes)
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    // Prepare transaction with higher gas limit
    const txParams = {
      value: ethAmountInWei,
      gasLimit: 500000, // Increased gas limit
      gasPrice: await provider.getFeeData().then((fee) => fee.gasPrice),
    };

    console.log("Transaction parameters:", txParams);

    // Perform the swap
    console.log("Initiating swap...");
    const tx =
      await uniswapRouter.swapExactETHForTokensSupportingFeeOnTransferTokens(
        minAmountOut,
        path,
        wallet.address,
        deadline,
        txParams
      );

    console.log("Swap transaction hash:", tx.hash);

    // Wait for transaction with more details
    const receipt = await tx.wait();
    console.log("Transaction receipt:", receipt);

    return tx.hash;
  } catch (error) {
    console.error("Detailed error:", error);

    // Format user-friendly error message
    let errorMessage = "Swap failed: ";

    if (error.message.includes("insufficient funds")) {
      errorMessage += "Insufficient ETH balance for this trade";
    } else if (error.message.includes("INSUFFICIENT_LIQUIDITY")) {
      errorMessage += "Not enough liquidity in the trading pool";
    } else if (error.message.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
      errorMessage +=
        "Price impact too high, try increasing slippage tolerance";
    } else if (error.message.includes("EXECUTION_REVERTED")) {
      errorMessage += "Transaction reverted by the contract";
    } else if (error.message.includes("user rejected")) {
      errorMessage += "Transaction was rejected";
    } else {
      errorMessage += error.message || "Unknown error occurred";
    }

    throw new Error(errorMessage);
  }
}
// Helper function to calculate minimum output considering slippage
async function getMinAmountOut(
  uniswapRouter,
  ethAmountInWei,
  path,
  slippageTolerance
) {
  try {
    const amountsOut = await uniswapRouter.getAmountsOut(ethAmountInWei, path);
    console.log(
      "Amounts out:",
      amountsOut.map((a) => a.toString())
    );

    // Calculate minimum amount considering slippage
    const expectedAmount = amountsOut[1];
    const minAmountOut =
      expectedAmount - (expectedAmount * slippageTolerance) / 100;

    console.log("Expected amount:", expectedAmount.toString());
    console.log("Minimum amount out:", minAmountOut.toString());

    return minAmountOut;
  } catch (error) {
    console.error("Error in getMinAmountOut:", error);
    throw new Error(`Failed to calculate minimum output: ${error.message}`);
  }
}

module.exports = { initiateBuy, handleBuyStep };
