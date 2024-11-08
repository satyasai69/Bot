const { bot } = require("./bot");
const { startHandler, registerActionHandlers } = require("./handlers/start");
const { initiateBuy, handleBuyStep } = require("./handlers/Buy");
const { initiateSend, handleSendEthStep } = require("./handlers/send");
const { handleSellStep } = require("./handlers/Sell");

// Register commands
bot.start(startHandler);

// Register buy command
bot.command("buy", initiateBuy);

// Register send command
bot.command("send", initiateSend);

// Register message handlers for both send and buy steps
bot.on("text", async (ctx, next) => {
  if (ctx.session.buyState) {
    await handleBuyStep(ctx);
  } else if (ctx.session.sendEthState) {
    await handleSendEthStep(ctx);
  } else if (ctx.session.sellState) {
    await handleSellStep(ctx);
  } else {
    await next();
  }
});

// Register action handlers
registerActionHandlers(bot);

// Error handling
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("An error occurred while processing your request.");
});

// Launch the bot
bot.launch().then(() => {
  console.log("Bot is up and running...");
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
