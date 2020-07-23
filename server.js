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



var http = require("http");
const express = require("express");
const app = express();
const port = 3000;

app.use(express.static(__dirname + "/public"));
app.listen(port);
console.log("server on " + port);

// Generate a report using the sample template provided by carbone module
// This LibreOffice template contains "Hello {d.firstname} {d.lastname} !"
// Of course, you can create your own templates!
carbone.render('./node_modules/carbone/examples/movies.docx', data, function (err, result) {
    if (err) return console.log(err);
    // write the result
    fs.writeFileSync('public/result.docx', result);
});