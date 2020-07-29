const fs = require("fs");
const carbone = require("carbone");
const express = require("express");
const app = express();
const port = 3000;

const schedulerPath = "./json/scheduler.json";
const oneOffPath = "./json/oneOff.json";
const todoPath = "./json/toDoList.json";
const phPath = "./json/ph.json";
const templatePath = "template.docx";
const resultPath = 'public/result.docx';

app.use(express.static(__dirname + "/public"));
app.listen(port);
console.log("server running on port " + port);

app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json()); // Parse JSON bodies (as sent by API clients)
app.post('/', function (req, res) { // Access the parse results as request.body

    date = req.body.date;
    var scheduler = require(schedulerPath);
    var oneOff = require(oneOffPath);
    var loaded_task = false;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let dateArray = [date.day, months[date.month - 1], date.year, date.weekday]; //[date, month, year, day]
    const numberOfDayInFirstWeek = 3; //need edit every year
    filtering(scheduler, dateArray, numberOfDayInFirstWeek, loaded_task);
    loaded_task = !loaded_task;
    filtering(oneOff, dateArray, numberOfDayInFirstWeek, loaded_task);
    loaded_task = !loaded_task;
    sortTodo();
    var todo = require(todoPath);
    todo[0].date = date;
    console.log(todo);
    carbone.render(templatePath, todo, function (err, result) {
        if (err) return console.log(err);
        fs.writeFileSync(resultPath, result);
        console.log("server generated report with date " + date.fullDate);
    });
});

function sortTodo() {
    var final = fs.readFileSync(todoPath, 'utf8');
    final = JSON.parse(final);
    final[0].tasks.sort(getSortOrder("StartTime"));
    fs.writeFileSync(todoPath, JSON.stringify(final), 'utf8');
}

// By Carson

function append(task) {
    const fs = require('fs');
    //Here is the data to be appended
    const startTime = task["StartTime"];
    const taskName = task["JobName"];
    const server = task["Server"];
    const remarks = task["Remarks"];
    const rules = task["Rules"];

    var oriJson = fs.readFileSync(todoPath, 'utf8');
    oriJson = JSON.parse(oriJson);
    var to_append = { StartTime: startTime, JobName: taskName, Server: server, Remarks: remarks, Rules: rules };
    oriJson[0]["tasks"].push(to_append);
    //console.log(oriJson);
    fs.writeFileSync(todoPath, JSON.stringify(oriJson), 'utf8');
};

function filtering(data, inputDate, firstWeek, loaded_task) {
    var phs = require(phPath);
    const numberOfData = Object.keys(data).length;
    const date = inputDate[0];
    const month = inputDate[1];
    const year = inputDate[2];
    const day = inputDate[3];
    var ph = false;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (!loaded_task) {
        console.log("clearing ToDoList.json...")
        var reset = '[{ "tasks": [] }]';
        fs.writeFileSync(todoPath, reset, 'utf8');
    }
    var datesOfMonths = [];
    if (year % 4 == 0) { datesOfMonths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; }
    else { datesOfMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; };

    for (i = 0; i < Object.keys(phs).length; ++i) {
        if ((phs[i]["date"] == date && phs[i]["month"] == month) || day == "0") {
            ph = true;
            break;
        }
    }
    for (i = 0; i < numberOfData; ++i) {
        const task = data[i];
        const rules = task["Rules"].split("?");
        const include = rules[0];
        const exclude = rules[1];
        var valid = false;

        if (include.substring(0, 5) == "daily") {
            append(task);
            //Eliminating the selected one-off Tasks
            if (task["Rules"][task["Rules"].length - 1] == "@") {
                var OOJson = fs.readFileSync(oneOffPath, 'utf8');
                OOJson = JSON.parse(OOJson);
                OOJson.splice(i, 1);
                fs.writeFileSync(oneOffPath, JSON.stringify(OOJson), 'utf8');
            };
            continue;
        };

        const subrules = include.split(";");
        const numberOfRules = subrules.length;
        for (j = 0; j < numberOfRules - 1; ++j) {
            if (subrules[j].includes("week")) {
                const weeklyRules = subrules[j].substring(5,).split(",");
                const numberOfRules = weeklyRules.length;
                for (k = 0; k < numberOfRules; ++k) {
                    if (weeklyRules[k] == day) {
                        valid = true;
                        break;
                    };
                };
            };
            if (subrules[j].includes("month")) {
                const monthlyRules = subrules[j].substring(6,).split(",");
                const numberOfRules = monthlyRules.length;
                for (k = 0; k < numberOfRules; ++k) {
                    if (monthlyRules[k] == date) {
                        valid = true;
                        break;
                    };
                };
            };
            if (subrules[j].includes("year")) {
                const yearlyRules = subrules[j].substring(5,).split(",")
                const numberOfRules = yearlyRules.length;
                for (k = 0; k < numberOfRules; ++k) {
                    if (yearlyRules[k].substring(0, 2) == date && yearlyRules[k].substring(2,) == month) {
                        valid = true;
                        break;
                    };
                };
            };
            if (subrules[j].includes("workingday") && !ph) {
                const wdRules = subrules[j].substring(11,).split(",")
                const numberOfRules = wdRules.length;
                for (k = 0; k < numberOfRules; ++k) {
                    var numberOfPh = 1;
                    var numberOfWd = 0;
                    for (x = date - 1; x > date - day; --x) {
                        for (y = 0; y < Object.keys(phs).length; ++y) {
                            if (phs[y]["date"] == x && phs[y]["month"] == month) {
                                numberOfPh++;
                            };
                        };
                    };
                    numberOfWd = Number(day) - numberOfPh + 1;
                    if (numberOfWd == wdRules[k]) {
                        valid = true;
                        break;
                    }
                };
            };
            if (subrules[j].includes("lastday")) {
                const ldRules = subrules[j].substring(8,).split(",");
                const numberOfRules = ldRules.length;
                for (k = 0; k < numberOfRules; ++k) {
                    for (x = 0; x < months.length; ++x) {
                        if (months[x] == month) {
                            if (datesOfMonths[x] - Number(ldRules[k]) + 1 == date) {
                                valid = true;
                                break;
                            };
                        };
                    };
                };
            };


            if (subrules[j].includes("biweekly")) {
                let bw = false;
                let numberOfDay = Number(date);
                for (k = 0; k < months.length; ++k) {
                    if (months[k] == month) { numberOfDay -= firstWeek; break; }
                    else { numberOfDay += datesOfMonths[k]; };
                };
                if (numberOfDay / 7 % 2 == 0) { bw = true; };
                if (bw) {
                    const bwRules = subrules[j].substring(9,).split(",");
                    const numberOfRules = bwRules.length;
                    for (k = 0; k < numberOfRules; ++k) {
                        if (bwRules[k] == day) {
                            valid = true;
                            break;
                        }
                    };
                };
            };
        };
        if (exclude) {
            const subConstraints = exclude.split(";");
            const numberOfConstraint = subConstraints.length;
            for (j = 0; j < numberOfConstraint - 1; ++j) {
                if (subConstraints[j].includes("ph") && ph) {
                    valid = false;
                    break;
                };
                if (subConstraints[j].includes("week")) {
                    const weeklyRules = subConstraints[j].substring(5,).split(",");
                    const numberOfRules = weeklyRules.length;
                    for (k = 0; k < numberOfRules; ++k) {
                        if (weeklyRules[k] == day) {
                            valid = false;
                            break;
                        };
                    };
                };
                if (subConstraints[j].includes("month")) {
                    const monthlyRules = subConstraints[j].substring(6,).split(",");
                    const numberOfRules = monthlyRules.length;
                    for (k = 0; k < numberOfRules; ++k) {
                        if (monthlyRules[k] == date) {
                            valid = false;
                            break;
                        };
                    };
                };
                if (subConstraints[j].includes("year")) {
                    const yearlyRules = subConstraints[j].substring(5,).split(",")
                    const numberOfRules = yearlyRules.length;
                    for (k = 0; k < numberOfRules; ++k) {
                        if (yearlyRules[k].substring(0, 2) == date && yearlyRules[k].substring(2,) == month) {
                            valid = false;
                            break;
                        };
                    };
                };
                if (subConstraints[j].includes("workingday") && !ph) {
                    const wdRules = subConstraints[j].substring(11,).split(",")
                    const numberOfRules = wdRules.length;
                    for (k = 0; k < numberOfRules; ++k) {
                        var numberOfPh = 1;
                        var numberOfWd = 0;
                        for (x = date - 1; x < date - day; --x) {
                            for (y = 0; y < Object.keys(phs).length; ++y) {
                                if (phs[y]["date"] == x && phs[y]["month"] == month) {
                                    numberOfPh++;
                                };
                            };
                        };
                        numberOfWd = Number(day) - numberOfPh + 1;
                        if (numberOfWd == wdRules[k]) {
                            valid = true;
                            break;
                        }
                    };
                };
            };
        };
        //Special Cases
        if (include == "SC1") {
            if (day == "2" && date != "28" && month != "Jan") valid = true;
            if (date == "29" && month == "Jan") valid = true;
        };
        //2Jan 29Jan 6Apr 14Apr 2May 26Jun 2Jul 3Oct 28Dec
        if (include == "SC2") {
            if ((day == "2" || day == "29") & month == "Jan") valid = true;
            if ((day == "6" || day == "14") & month == "Apr") valid = true;
            if ((day == "2") & month == "May") valid = true;
            if ((day == "26") & month == "Jun") valid = true;
            if ((day == "2") & month == "Jul") valid = true;
            if ((day == "3") & month == "Oct") valid = true;
            if ((day == "28") & month == "DEC") valid = true;
        };
        //Eliminating the selected one-off Tasks
        if (valid && task["Rules"][task["Rules"].length - 1] == "@") {
            var OOJson = fs.readFileSync(oneOffPath, 'utf8');
            OOJson = JSON.parse(OOJson);
            OOJson.splice(i, 1);
            fs.writeFileSync(oneOffPath, JSON.stringify(OOJson), 'utf8');

        };
        //Append the task to ToDoList.json
        if (valid) {
            append(task);
        };
    };
};

function getSortOrder(prop) {    
    return function(a, b) {
        let a_hr = Number(a[prop].split(":")[0]);
        let a_min = Number(a[prop].split(":")[1]);
        let b_hr = Number(b[prop].split(":")[0]);
        let b_min = Number(b[prop].split(":")[1]);

        if (a_hr < 8){a_hr += 24};
        if (b_hr < 8){b_hr += 24};    
        if (a_hr > b_hr) {    
            return 1;    
        } else if (a_hr < b_hr) {    
            return -1;    
        } else {
            if (a_min > b_min) {    
                return 1;    
            } else if (a_min < b_min) {    
                return -1;    
            }
        }
    }    
};