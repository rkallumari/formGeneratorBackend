var UserInputs = require("./models/userInput");
require("./mongoConnect");
function createUserInput(objToSave, callback) {
  new UserInputs(objToSave).save(callback);
}

function getUserInput(callback) {
  UserInputs.find({}, {}, {}, callback);
}

module.exports = {
  createUserInput,
  getUserInput
};
