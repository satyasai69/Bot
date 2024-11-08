// src/handlers/send.js
const { ethers } = require("ethers");
const User = require("../models/user");
const provider = new ethers.JsonRpcProvider(process.env.ETH_TESTNET_URL);

async function sendEth(ctx, recipientAddress, amount, userPrivateKey) {
  const wallet = new ethers.Wallet(userPrivateKey, provider);

  const tx = {
    to: recipientAddress,
    value: ethers.parseEther(amount),
  };

  try {
    const transaction = await wallet.sendTransaction(tx);
    await transaction.wait();
    await ctx.reply(
      `✅ Successfully sent ${amount} ETH to ${recipientAddress}!\nTransaction hash: ${transaction.hash}`
    );
  } catch (error) {
    await ctx.reply(`❌ Failed to send ETH: ${error.message}`);
  }
}

async function initiateSend(ctx) {
  ctx.session.sendEthState = "AWAITING_ADDRESS";
  await ctx.reply("Please enter the recipient's address:");
}

// Handler for processing send ETH steps
async function handleSendEthStep(ctx) {
  const state = ctx.session.sendEthState;

  if (!state) return;

  if (state === "AWAITING_ADDRESS") {
    const recipientAddress = ctx.message.text;

    if (!ethers.isAddress(recipientAddress)) {
      await ctx.reply("Invalid address. Please try again.");
      return;
    }

    ctx.session.recipientAddress = recipientAddress;
    ctx.session.sendEthState = "AWAITING_AMOUNT";
    await ctx.reply("Please enter the amount of ETH to send:");
    return;
  }

  if (state === "AWAITING_AMOUNT") {
    const amount = ctx.message.text;

    if (isNaN(amount) || parseFloat(amount) <= 0) {
      await ctx.reply("Invalid amount. Please try again.");
      return;
    }

    const chatId = ctx.chat.id;
    const user = await User.findOne({ telegramId: chatId });

    if (!user || !user.privateKey) {
      await ctx.reply("User not found or private key is missing.");
      delete ctx.session.sendEthState;
      delete ctx.session.recipientAddress;
      return;
    }

    await sendEth(ctx, ctx.session.recipientAddress, amount, user.privateKey);

    // Clear the state
    delete ctx.session.sendEthState;
    delete ctx.session.recipientAddress;
  }
}

module.exports = {
  sendEth,
  initiateSend,
  handleSendEthStep,
};
