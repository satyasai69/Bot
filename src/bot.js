// src/bot.js
require("dotenv").config();
const { Telegraf, Markup, session } = require("telegraf");
const LocalSession = require("telegraf-session-local");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Initialize and use session middleware
const localSession = new LocalSession({
  database: "sessions.json",
  property: "session",
  storage: LocalSession.storageMemory,
});

bot.use(localSession.middleware());

module.exports = { bot, Markup };
