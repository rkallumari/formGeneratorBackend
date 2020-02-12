var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var IdGenerator = Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const IdGeneratorModel = mongoose.model("idGenerator", IdGenerator);

const autoIncrementDocumentID = function(modelName, doc, next) {
  IdGeneratorModel.findByIdAndUpdate(
    modelName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
    function(error, idGen) {
      if (error) return next(error);
      if (doc.docId) return next();

      doc.docId = idGen.seq;
      next();
    }
  );
};

module.exports = autoIncrementDocumentID;
