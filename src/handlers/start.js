// src/handlers/start.js
const { ethers } = require("ethers");
const User = require("../models/user");
const { Markup } = require("../bot");
const { initiateSend } = require("./send"); // Import initiateSend
const { initiateBuy } = require("./Buy"); // Import buy handler
const { initiateSell } = require("./Sell");

// Ethereum provider - using Infura or similar service
const provider = new ethers.JsonRpcProvider(process.env.ETH_TESTNET_URL);
// For testnet (e.g., Goerli):
// const provider = new ethers.JsonRpcProvider('https://goerli.infura.io/v3/YOUR_INFURA_KEY');

async function getWalletBalance(address) {
  try {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance); // Convert from Wei to ETH
  } catch (error) {
    console.error("Error fetching balance:", error);
    return "0";
  }
}

async function startHandler(ctx) {
  const chatId = ctx.chat.id;

  // Check if user already has a wallet
  let user = await User.findOne({ telegramId: chatId });
  if (!user) {
    // Create a new wallet for the user
    const wallet = ethers.Wallet.createRandom();

    // Save wallet details to database
    user = new User({
      telegramId: chatId,
      address: wallet.address,
      privateKey: wallet.privateKey, // Encrypt in production
    });
    await user.save();
  }

  // Get wallet balance
  const balance = await getWalletBalance(user.address);

  const welcomeMessage = `
  Welcome to Medusabot 🚀
  The fastest bot to trade ETH tokens!
  
  Your wallet details:
  📍 Address: *${user.address}* (tap to copy)
  💰 Balance: *${balance} ETH*
  
  ${
    Number(balance) === 0
      ? "To get started, deposit ETH to your Medusabot wallet address above."
      : ""
  }
  
  To purchase a token, simply enter the token address or paste a URL.
  
  🔐 _Your funds are secure with Medusabot, but if your private key is exposed, we won't be able to protect you!_
  `;

  await ctx.replyWithMarkdown(
    welcomeMessage,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("Buy", "buy"),
        Markup.button.callback("Sell", "sell"),
      ],
      [Markup.button.callback("Send ETH", "send_eth")], // Add Send ETH button]
      [
        /*   Markup.button.callback("Community", "community"), */
        Markup.button.callback("Refer Friends", "refer_friends"),
      ],
      /* [Markup.button.callback("🤖 Backup Bots", "backup_bots")],
      [
        Markup.button.callback("Current Wallet", "current_wallet"),
        Markup.button.callback("Wallet Manager", "wallet_manager"),
      ],
      [
        Markup.button.callback("Settings", "settings"),
        Markup.button.callback("Pin", "pin"),
      ],
      [
        Markup.button.callback("Refresh", "refresh"),
        Markup.button.callback("Staking 🔥", "staking"), 
      ], */
    ])
  );
}

// Define action handlers for each button
async function registerActionHandlers(bot) {
  bot.action("buy", (ctx) => initiateBuy(ctx, bot));
  bot.action("sell", (ctx) => initiateSell(ctx, bot));
  bot.action("send_eth", (ctx) => initiateSend(ctx, bot)); // Pass the bot instance
  bot.action("community", (ctx) =>
    ctx.reply("Community functionality coming soon!")
  );
  bot.action("refer_friends", (ctx) =>
    ctx.reply("Refer Friends functionality coming soon!")
  );
  bot.action("backup_bots", (ctx) =>
    ctx.reply("Backup Bots functionality coming soon!")
  );
  bot.action("current_wallet", (ctx) =>
    ctx.reply("Current Wallet functionality coming soon!")
  );
  bot.action("wallet_manager", (ctx) =>
    ctx.reply("Wallet Manager functionality coming soon!")
  );
  bot.action("settings", (ctx) =>
    ctx.reply("Settings functionality coming soon!")
  );
  bot.action("pin", (ctx) => ctx.reply("Pin functionality coming soon!"));
  bot.action("refresh", (ctx) =>
    ctx.reply("Refresh functionality coming soon!")
  );
  bot.action("staking", (ctx) =>
    ctx.reply("Staking functionality coming soon!")
  );
}

module.exports = { startHandler, registerActionHandlers };
