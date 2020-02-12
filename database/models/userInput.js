var mongoose = require("mongoose");
var Schema = mongoose.Schema;
var autoIncrementDocumentID = require("./idGenerator");

const Questions = new Schema({
  key: { type: String, required: true },
  question: { type: String, required: true },
  answer: { type: String },
  docId: { type: Number }
});
const UserInputs = new Schema({
  inputs: [Questions],
  createdAt: { type: Date, default: Date.now() }
});

UserInputs.pre("save", function(next) {
  if (!this.isNew) {
    next();
    return;
  }
  autoIncrementDocumentID("questions", this, next);
});

module.exports = mongoose.model("UserInputs", UserInputs);
