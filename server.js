const fs = require('fs');
const carbone = require('carbone');

/* function to parse json file

function jsonReader(filePath, cb) {
    fs.readFile(filePath, (err, fileData) => {
        if (err) {
            return cb && cb(err);
        }
        try {
            const object = JSON.parse(fileData);
            return cb && cb(null, object);
        } catch(err) {
            return cb && cb(err);
        }
    })
}
jsonReader('./schedule.json', (err, rule) => {
    if (err) {
        console.log(err);
        return;
    }
})

*/
var data = [
    {
        movieName: 'Matrix',
        actors: [{
            firstname: 'Keanu',
            lastname: 'Reeves'
        }, {
            firstname: 'Laurence',
            lastname: 'Fishburne'
        }, {
            firstname: 'Carrie-Anne',
            lastname: 'Moss'
        }]
    },
    {
        movieName: 'Back To The Future',
        actors: [{
            firstname: 'Michael',
            lastname: 'J. Fox'
        }, {
            firstname: 'Christopher',
            lastname: 'Lloyd'
        }]
    },
    {
        movieName: 'Test',
        actors: [{
            firstname: 'tempfirst',
            lastname: 'templast'
        }, {
            firstname: 'temp2first',
            lastname: 'temp2last'
        }]
    }
];

var tempData = {
    tasks : [{
        StartTime: "8:00",
        JobName: "Distribute upsurge reminder letter issued to users via email",
        Server: "m5ppc01/02",
        Remarks: "(Remarks: RE:COPM 28)",
        Rules: "daily"
    },
    {
        StartTime: "8:00",
        JobName: "Check PPS daily backup, take off the last day offsite tape PPSPRD-L4-GEN4, PPSPRD-R16-GEN4",
        Server: "PPSPRD-SVR1",
        Remarks: "(Remarks: PPS COPM 6.5 & 9.1.2)",
        Rules: "daily"
    },
    {
        StartTime: "8:00",
        JobName: "Perform PPS System Health Check and send comfirmed email to related parties. (https://pps.td.hksarg/pps/)",
        Server: "TDOA",
        Remarks: "(Re : PPS COPM 11)",
        Rules: "daily"
    }]
};

var http = require("http");
const express = require("express");
const app = express();
const port = 3000;

app.use(express.static(__dirname + "/public"));
app.listen(port);
console.log("server running on port " + port);

app.use(express.urlencoded({extended : true})); // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json()); // Parse JSON bodies (as sent by API clients)
app.post('/', function(req, res){ // Access the parse results as request.body
    date = req.body.date;
    tempData.date = date;
    carbone.render('template.docx', tempData, function (err, result) {
        if (err) return console.log(err);
        fs.writeFileSync('public/result.docx', result);
        console.log("server generated report with date " + date.fullDate);
    });    
});