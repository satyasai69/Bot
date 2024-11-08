// src/handlers/sell.js
const { ethers } = require("ethers");
const User = require("../models/user");
const {
  fetchTokenDetails,
  getTokenBalance,
  createTokenContract,
  provider,
} = require("./TokenInfo");

// Camelot Router ABI with referrer parameter
const CAMELOT_ROUTER_ABI = [
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, address referrer, uint deadline) external",
];

// Camelot Router address - add to your .env
const CAMELOT_ROUTER_ADDRESS = process.env.SWAP_CONTRACT_ADDRESS;
const WETH_ADDRESS = process.env.WETH_ADDRESS;
const REFERRER_ADDRESS =
  process.env.REFERRER_ADDRESS || "0x0000000000000000000000000000000000000000";

async function initiateSell(ctx, bot) {
  try {
    // Get user's Telegram ID
    const telegramId = ctx.from.id;

    // Check if user exists in database
    const user = await User.findOne({ telegramId: telegramId });
    console.log(user);

    if (!user) {
      await ctx.reply("User not found. Please start the bot first.");
      return;
    }

    // Initialize state
    ctx.session.sellState = "waiting_for_address_Sell";
    ctx.session.buyState = null;

    // Send initial prompt
    await ctx.reply("Enter the token address you want to sell:");
  } catch (error) {
    console.error("Sell initiation error:", error);
    await ctx.reply(`An error occurred: ${error.message}`);
    ctx.session.buyState = null;
  }
}

async function handleSellStep(ctx) {
  if (!ctx.session.sellState) return;

  const msg = ctx.message.text;

  try {
    switch (ctx.session.sellState) {
      case "waiting_for_address_Sell":
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
            isNaN(tokenDetails.price)
          ) {
            await ctx.reply(
              `⚠️ Warning: Could not fetch complete token details.\n\n` +
                `Symbol: ${tokenDetails?.symbol || "Unknown"}\n` +
                `Price: ${
                  tokenDetails?.price ? `$${tokenDetails.price}` : "Unknown"
                }\n\n` +
                `Would you still like to proceed with the sell? Enter the amount or type 'cancel'.`
            );

            // Update session state with token info and proceed to amount entry
            ctx.session.tokenAddress = msg;
            ctx.session.tokenDetails = {
              symbol: tokenDetails?.symbol || "Unknown",
              price: tokenDetails?.price || "Unknown",
            };
            ctx.session.sellState = "waiting_for_token_amount_Sell";
          } else {
            // Valid token details obtained, proceed as normal
            ctx.session.tokenAddress = msg;
            ctx.session.tokenDetails = tokenDetails;

            await ctx.reply(
              `Token Details:\n\n` +
                `Symbol: ${tokenDetails.symbol}\n` +
                `Price: $${tokenDetails.price}\n\n` +
                `How many tokens would you like to sell?`
            );

            // Move to next state for amount entry
            ctx.session.sellState = "waiting_for_token_amount_Sell";
          }
        } catch (error) {
          console.error("Token details fetch error:", error);
          await ctx.reply(
            `⚠️ Warning: Could not fetch token details.\n` +
              `Would you still like to proceed with the sell? Enter the amount or type 'cancel'.`
          );

          // Update session state for uncertain token details and proceed to amount entry
          ctx.session.tokenAddress = msg;
          ctx.session.tokenDetails = {
            symbol: "Unknown",
            price: "Unknown",
          };
          ctx.session.sellState = "waiting_for_token_amount_Sell";
        }
        break;

      case "waiting_for_token_amount_Sell":
        if (msg.toLowerCase() === "cancel") {
          await ctx.reply("Sell process cancelled.");
          delete ctx.session.sellState;
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
            `⏳ Processing your sell...\n\n` +
              `Token: ${ctx.session.tokenDetails.symbol}\n` +
              `Amount: ${amount} ${ctx.session.tokenDetails.symbol}`
          );

          const user = await User.findOne({ telegramId: ctx.from.id });
          const txHash = await swapTokenForETH(
            user,
            ctx.session.tokenAddress,
            amount
          );

          await ctx.reply(
            `✅ Sell completed!\n\n` +
              `Transaction Hash: ${txHash}\n` +
              `View on Etherscan: https://sepolia.etherscan.io/tx/${txHash}`
          );

          // Clear state after successful transaction
          delete ctx.session.sellState;
          delete ctx.session.tokenAddress;
          delete ctx.session.tokenDetails;
        } catch (error) {
          await ctx.reply(
            `❌ Sell error: ${error.message}\n\n` +
              `Please enter a new amount to try again or type 'cancel' to cancel.`
          );
          // Keep state for retry
        }
        break;
    }
  } catch (error) {
    console.error("Message handler error:", error);
    await ctx.reply(
      `❌ An error occurred: ${error.message}\n` +
        `The sell process has been cancelled.`
    );
    delete ctx.session.sellState;
    delete ctx.session.tokenAddress;
    delete ctx.session.tokenDetails;
  }
}

async function swapTokenForETH(privateKey, tokenAddress, tokenAmount) {
  try {
    // Connect to Ethereum network
    const provider = new ethers.JsonRpcProvider(process.env.ETH_TESTNET_URL);
    const wallet = new ethers.Wallet(privateKey.privateKey, provider);

    // Log connection details for debugging
    console.log("Connected to network:", await provider.getNetwork());
    console.log("Wallet address:", wallet.address);

    // Check token balance
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ["function balanceOf(address owner) view returns (uint256)"],
      wallet
    );

    const tokenBalance = await tokenContract.balanceOf(wallet.address);
    //const tokenDec = await tokenContract.decimals();
    console.log("Token Balance:", ethers.formatUnits(tokenBalance, 6));

    // Convert token amount to match token decimals
    const tokenAmountInWei = ethers.parseUnits(tokenAmount.toString(), 6);

    if (tokenBalance < tokenAmountInWei) {
      throw new Error("Insufficient token balance");
    }

    // Uniswap V2 Router address and ABI
    const uniswapV2RouterAddress = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";
    const uniswapV2RouterABI = [
      "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
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

    // Define the path for swapping: Token -> WETH
    const path = [tokenAddress, WETH];
    console.log("Swap path:", path);

    // Get expected output amount
    let amountsOut;
    try {
      amountsOut = await uniswapRouter.getAmountsOut(tokenAmountInWei, path);
      console.log(
        "Expected output amount in ETH:",
        ethers.utils.formatEther(amountsOut[1])
      );
    } catch (error) {
      console.error("Error getting amounts out:", error);
      throw new Error(
        "Failed to calculate output amount. Insufficient liquidity."
      );
    }

    // Calculate minimum amount out with higher slippage tolerance
    const slippageTolerance = BigInt(1); // 1% slippage
    const slippageMultiplier = BigInt(100) - slippageTolerance;
    const minAmountOut = (amountsOut[1] * slippageMultiplier) / BigInt(100);
    console.log("Minimum ETH output amount:", ethers.formatEther(minAmountOut));

    // Deadline for transaction (current time + 20 minutes)
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    // Approve Uniswap router to spend the tokens
    const tokenApproval = new ethers.Contract(
      tokenAddress,
      [
        "function approve(address spender, uint256 amount) external returns (bool)",
      ],
      wallet
    );

    const approvalTx = await tokenApproval.approve(
      uniswapV2RouterAddress,
      tokenAmountInWei
    );
    await approvalTx.wait();
    console.log("Token approved for swap.");

    // Prepare transaction parameters
    const txParams = {
      gasLimit: 500000, // Increased gas limit
      gasPrice: await provider.getFeeData().then((fee) => fee.gasPrice),
    };

    console.log("Transaction parameters:", txParams);

    // Perform the swap
    console.log("Initiating swap...");
    const tx =
      await uniswapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
        tokenAmountInWei,
        minAmountOut,
        path,
        wallet.address,
        deadline,
        txParams
      );

    console.log("Swap transaction hash:", tx.hash);

    // Wait for transaction to complete and log receipt
    const receipt = await tx.wait();
    console.log("Transaction receipt:", receipt);

    return tx.hash;
  } catch (error) {
    console.error("Detailed error:", error);

    // Format user-friendly error message
    let errorMessage = "Swap failed: ";

    if (error.message.includes("insufficient funds")) {
      errorMessage += "Insufficient ETH balance for gas";
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
  tokenAmountInWei,
  path,
  slippageTolerance
) {
  const amountsOut = await uniswapRouter.getAmountsOut(tokenAmountInWei, path);
  const minAmountOut = amountsOut[1].sub(
    amountsOut[1].mul(slippageTolerance).div(100)
  );
  return minAmountOut;
}

module.exports = { initiateSell, handleSellStep };
