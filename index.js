const kue = require('kue');
const ui = require('kue-ui');
const request = require("request");
const _ = require("lodash");
var bodyParser = require('body-parser');
var express = require('express');
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

console.log("starting kued, redis: " + process.env.REDIS_URL + ", prefix: " + process.env.KUE_PREFIX);

var queue = kue.createQueue({
    prefix: process.env.KUE_PREFIX,
    redis: process.env.REDIS_URL || 'redis://redis:6379'
});

ui.setup({
    apiURL: '/api', // IMPORTANT: specify the api url
    baseURL: '/kue', // IMPORTANT: specify the base url
    updateInterval: 5000 // Optional: Fetches new data every 5000 ms
});

// Mount kue JSON api
app.use('/api', kue.app);
// Mount UI
app.use('/kue', ui.app);
// redir to gui from /
app.get("/", function (req, res) {
    res.redirect("/kue");
});

var jobTypes = {};
function processJob(type) {
    if (jobTypes[type]) return; // rest job type already defined
    jobTypes[type] = true;
    console.log("ADD rest job type: "+type);
    queue.process(type, 1, function (job, ctx, done) {
        console.log("PROCESS rest-job done: ", _.pick(job, "type", "id", "_error", "data"));
        doRestJob(job.data, function (err, resultLightResponse) {
            if (err) {
                console.log("ERROR processing rest-shit: " + err);
                done(err);
            } else {
                console.log("DONE processing rest-shit: ",resultLightResponse);
                done(undefined, resultLightResponse);
            }
        });
    });
}

app.post("/rest-job/:jobtype", function (req, res) {
    console.log("POST /rest-job/"+req.params.jobtype, req.body);
    var jobdef = req.body;
    // TODO: req.body.opts ignored ?

    processJob(req.params.jobtype);

    var job = queue.create(req.params.jobtype, jobdef.data).save(function (err) {
        //if (!err) console.log(job.id);
        if (err) throw err;
        console.log("CREATED job: "+job);
    });

    job.on("complete", function (resultLightResponse) {
        //res.json(result);
        res.set(resultLightResponse.headers).status(resultLightResponse.statusCode).send(_.isObject(resultLightResponse.body)?JSON.stringify(resultLightResponse.body):resultLightResponse.body);
    });

    job.on("failed", function (errorMessage, doneAttempts) {
        res.status(500).send(errorMessage);
    });
});

app.listen(5000);

console.log("started kued");


/////

function doRestJob(jobData, done) {
    jobData.url = jobData.jobTargetUrl;//encodeURIComponent(jobData.jobTargetUrl);
    console.log("doRestJob, url: "+jobData.url+", jobData: ",jobData);
    request(jobData, function (err, response) {
        console.log("doRestJob done, err: "+err+", status: "+(response?response.statusCode:null));
        var resultLightResponse = _.pick(response, "statusCode", "headers", "body");
        if (resultLightResponse.headers && resultLightResponse.headers["content-type"] && resultLightResponse.headers["content-type"].match(/^application\/json/)) {
            try {
                resultLightResponse.body = JSON.parse(resultLightResponse.body);
            } catch (err) {
                console.error("WARN! json parsing resultLightResponse.body failed even though content-type was json?! body: "+resultLightResponse.body);
            }
        }
        done(err, resultLightResponse);
    });
}