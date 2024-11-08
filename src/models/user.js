// src/models/user.js
const mongoose = require("../db/mongoose");

const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    privateKey: { type: String, required: true },
    trxBalance: { type: String, default: "0" },
});

const User = mongoose.model("User", userSchema);

module.exports = User;

