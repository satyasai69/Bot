// src/db/mongoose.js
const mongoose = require("mongoose");

mongoose.connect(process.env.MANGO_DB_LOCAL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

module.exports = mongoose;
