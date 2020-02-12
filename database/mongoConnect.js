// Using Node.js `require()`
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(
  MONGO_URI,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true
  },
  function(error) {
    if (error) {
      console.log("Error in connecting mongo db ", error);
      process.exit(1);
    } else {
      console.log("Mongo db connected!");
    }
  }
);

module.exports.Mongoose = mongoose;
