var PizZip = require("pizzip");
var Docxtemplater = require("docxtemplater");
require("dotenv").config();
var fs = require("fs");
var path = require("path");
const express = require("express");
const app = express();
const port = process.env.PORT;
const word2pdf = require("word2pdf");
var busboy = require("connect-busboy");
var bodyParser = require("body-parser");
var cors = require("cors");
var async = require("async");
var db = require("./database/db");

app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(
  bodyParser.urlencoded({
    // to support URL-encoded bodies
    extended: true
  })
);
app.use(cors());
app.use(busboy());
app.use(express.static(path.join(__dirname, "public")));

app.post("/generateDocument", function(req, res) {
  var docId;
  async.series(
    [
      function(cb) {
        let objToSave = {};
        var inputs = [];
        if (req.body.answers) {
          try {
            var fs = require("fs");
            var obj = JSON.parse(fs.readFileSync("Questions.json", "utf8"));
            var questionsPresent = JSON.parse(obj.Questions);
            var keys = Object.keys(req.body.answers);
            var filteredQuestion;
            var filteredAnswer;
            keys.forEach(value => {
              if (value) {
                filteredQuestion = questionsPresent.filter(
                  ques => ques.key === value
                );
                filteredAnswer = req.body.answers[value];
                if (
                  filteredQuestion &&
                  filteredQuestion.length &&
                  filteredAnswer
                ) {
                  inputs.push({
                    key: value,
                    question: filteredQuestion[0].question,
                    answer: filteredAnswer
                  });
                }
              }
            });
            objToSave["inputs"] = inputs;
            db.createUserInput(objToSave, function(error, result) {
              if (error) cb("Couldnt write the user details!");
              else {
                docId = result["docId"];
                cb();
              }
            });
          } catch (error) {
            cb("Canoot retrieve the current Questions!");
          }
        } else {
          cb("Answers not given!");
        }
      },
      function(cb) {
        try {
          var content = fs.readFileSync(
            path.resolve(__dirname, "template.DOCX"),
            "binary"
          );
          var zip = new PizZip(content);
          var doc = new Docxtemplater();
          doc.loadZip(zip);
          doc.setData(req.body.answers);
          doc.render();
          var buf = doc.getZip().generate({ type: "nodebuffer" });
          fs.writeFileSync(
            path.resolve(
              __dirname.concat("/docs/"),
              "output"
                .concat("_")
                .concat(docId)
                .concat(".docx")
            ),
            buf
          );
          cb();
        } catch (error) {
          cb("Error while resolving the template!");
        }
      }
    ],
    function(error) {
      if (error) res.sendStatus(500).send({ result: error });
      else {
        try {
          const convert = async () => {
            const data = await word2pdf(
              "./docs/output"
                .concat("_")
                .concat(docId)
                .concat(".docx")
            );
            fs.writeFileSync(
              "./docs/output"
                .concat("_")
                .concat(docId)
                .concat(".pdf"),
              data
            );
            res.download(
              "./docs/output"
                .concat("_")
                .concat(docId)
                .concat(".pdf")
            );
          };
          if (req.body.pdf) convert();
          else {
            res.download("./output.docx");
          }
        } catch (error) {
          res
            .sendStatus(500)
            .send({ result: "File generate but error while downloading!" });
        }
      }
    }
  );
});

app.route("/uploadTemplate").post(function(req, res, next) {
  var fstream;
  try {
    req.pipe(req.busboy);
    req.busboy.on("file", function(fieldname, file, filename) {
      console.log("Uploading: " + filename);
      fstream = fs.createWriteStream(__dirname + "/template.docx");
      file.pipe(fstream);
      fstream.on("close", function() {
        console.log("Upload Finished of " + filename);
        res.status(200).send({ result: "Upload the template Successfully!" });
      });
    });
  } catch (error) {
    res
      .status(500)
      .send({ result: "Sorry something went wrong while uploading the file!" });
  }
});

app.route("/uploadQuestion").post(function(req, res, next) {
  var fstream;
  try {
    req.pipe(req.busboy);
    req.busboy.on("file", function(fieldname, file, filename) {
      console.log("Uploading: " + filename);
      fstream = fs.createWriteStream(__dirname + "/Questions.json");
      file.pipe(fstream);
      fstream.on("close", function() {
        console.log("Upload Finished of " + filename);
        res
          .status(200)
          .send({ result: "Uploaded the Questions Successfully!" });
      });
    });
  } catch (error) {
    res
      .status(500)
      .send({ result: "Sorry something went wrong while uploading the file!" });
  }
});

app.get("/downloadQuestion", function(req, res) {
  try {
    var fs = require("fs");
    var obj = JSON.parse(fs.readFileSync("Questions.json", "utf8"));
    var questionsPresent = JSON.parse(obj.Questions);
    var questionPrettified = JSON.stringify({
      Questions: JSON.stringify(questionsPresent)
    });
    fs.writeFileSync("Questions.json", questionPrettified);
    res.download("./Questions.json");
  } catch (error) {
    res
      .status(500)
      .send({ error: "Error while retrieving the questions json file" });
  }
});

app.get("/downloadTemplate", function(req, res) {
  try {
    res.download("./template.docx");
  } catch (error) {
    res
      .status(500)
      .send({ error: "Error while retrieving the template docx file" });
  }
});

app.delete("/deleteQuestion", function(req, res) {
  var key = req.body.key;
  if (!(key && key.length))
    res.status(400).send({ error: "No question keys sent to be deleted!" });
  try {
    var fs = require("fs");
    var obj = JSON.parse(fs.readFileSync("Questions.json", "utf8"));
    var questionsPresent = JSON.parse(obj.Questions);
    var questionDeleted = JSON.stringify(
      {
        Questions: JSON.stringify(
          questionsPresent.filter(ques => key.indexOf(ques.key) === -1),
          null,
          2
        )
      },
      null,
      2
    );
    fs.writeFileSync("Questions.json", questionDeleted);
    res.status(200).send({ result: "Questions deleted Successfully!" });
  } catch (error) {
    res.status(500).send({ error: "Questions not updated or not present" });
  }
});

app.post("/addQuestion", function(req, res) {
  var key = req.body.key;
  var question = req.body.question;
  if (!key || !question)
    res.status(400).send({ error: "Both key and question are mandatory!" });
  try {
    var fs = require("fs");
    var obj = JSON.parse(fs.readFileSync("Questions.json", "utf8"));
    var questionsPresent = JSON.parse(obj.Questions);
    var keyRepeat = questionsPresent.filter(ques => ques.key === key);
    if (keyRepeat.length) {
      res.status(400).send({
        error: "Question with the Key already exists! The question configured is ".concat(
          keyRepeat[0].question
        )
      });
    } else {
      questionsPresent.push(req.body);
      var questionsUpdated = JSON.stringify(
        {
          Questions: JSON.stringify(questionsPresent, null, 2)
        },
        null,
        2
      );
      fs.writeFileSync("Questions.json", questionsUpdated);
      res.status(200).send({ result: "Questions Added Successfully!" });
    }
  } catch (error) {
    res.status(500).send({ error: "Questions not updated or not present" });
  }
});

app.put("/updateQuestion", function(req, res) {
  var key = req.body.key;
  var question = req.body.question;
  var currentKey = req.body.currentKey;
  if (!key || !question)
    res.status(400).send({ error: "Both key and question are mandatory!" });
  try {
    var fs = require("fs");
    var obj = JSON.parse(fs.readFileSync("Questions.json", "utf8"));
    var questionsPresent = JSON.parse(obj.Questions);
    if (key !== currentKey) {
      var keyRepeat = questionsPresent.filter(ques => ques.key === key);
      var questionsUpdated = questionsPresent;
      if (keyRepeat.length) {
        res.status(400).send({
          error: "Another Question with the Key name already exists! The question configured for the existing key is ".concat(
            keyRepeat.question
          )
        });
      } else {
        questionsPresent.push(req.body);
        questionsUpdated = JSON.stringify(
          {
            Questions: JSON.stringify(questionsPresent, null, 2)
          },
          null,
          2
        );
      }
      var questionDeleted = JSON.stringify(
        {
          Questions: JSON.stringify(
            questionsUpdated.filter(ques => {
              key.indexOf(ques.currentKey) === -1;
            }),
            null,
            2
          )
        },
        null,
        2
      );
      fs.writeFileSync("Questions.json", questionDeleted);
      res.status(200).send({ result: "Questions updated Successfully!" });
    } else {
      var keyFound = false;
      var questionsUpdated = JSON.stringify(
        {
          Questions: JSON.stringify(
            questionsPresent.map(ques => {
              if (ques.key === key) {
                ques.question = question;
                keyFound = true;
              }
              return ques;
            }),
            null,
            2
          )
        },
        null,
        2
      );
      if (keyFound) {
        fs.writeFileSync("Questions.json", questionsUpdated);
        res.status(200).send({ result: "Questions Updated Successfully!" });
      } else {
        res.status(404).send({ error: "Key given in request not found!" });
      }
    }
  } catch (error) {
    res.status(500).send({ error: "Questions not present or defined" });
  }
});

app.get("/getAllQuestions", function(req, res) {
  try {
    var fs = require("fs");
    var obj = JSON.parse(fs.readFileSync("Questions.json", "utf8"));
    res.status(200).send(obj.Questions);
  } catch (error) {
    res.status(500).send({ error: error });
  }
});

app.listen(port, () =>
  console.log(
    `Backend app for form to letter generator listening on port ${port}!`
  )
);
