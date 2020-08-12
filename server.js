const numberOfDayInFirstWeek = 4; //need edit every year

const fs = require("fs");
const carbone = require("carbone");
const express = require("express");
const app = express();
const port = 3000;

const schedulerPath = "./json/scheduler.json";
const oneOffPath = "./json/oneOff.json";
const todoPath = "./tmp/toDoList.json";
const phPath = "./json/ph.json";

const pps_path = './json/tape_inventory/PPS.json';
const v5_path = './json/tape_inventory/V5.json';
const vrms_path = './json/tape_inventory/VRMS.json';
const OTCL_path = './tmp/forms/OTCL.json';
const delivery_path = './tmp/forms/tape_delivery.json';
const location_path = './tmp/forms/tape_location.json';

const schedule_templatePath = "./tmp/schedule_template.docx";
const OTCL_templatePath = "./tmp/offsite_tapes_check_list_template.docx";
const stockCheckList_templatePath = './tmp/stock_check_list_template.docx';
const collection_templatePath = './tmp/collection_form_template.docx';
const sccCheckList_templatePath = './tmp/scc_attendance_check_list_template.docx';

const resultPath = './public/doc/VALID V Daily Job Schedule.docx';
const OTCL_resultPath = "./public/doc/Offsite Tapes Check List.docx";
const stockCheckList_resultPath = './public/doc/Stock Check List.docx';
const collection_resultPath = './public/doc/Collection Form.docx';
const sccCheckList_resultPath = './public/doc/SCC Attendance Check List.docx';

var forms = [];

app.use(express.static(__dirname + "/public"));
app.listen(port);
console.log("server running on port " + port);

app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json()); // Parse JSON bodies (as sent by API clients)
app.post('/', function (req, res) { // Access the parse results as req.body
    var date = req.body;
    var scheduler = require(schedulerPath);
    var oneOff = require(oneOffPath);
    var loaded_task = false;
    //var options = {
    //    convertTo: 'pdf' //can be docx, txt, ...
    //};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let dateArray = [date.day, months[date.month - 1], date.year, date.weekday]; //[date, month, year, day]
    forms = [];
    if (date.weekday == 0) forms.push(stockCheckList_resultPath.split("/")[3]);
    filtering(scheduler, dateArray, numberOfDayInFirstWeek, loaded_task);
    loaded_task = !loaded_task;
    filtering(oneOff, dateArray, numberOfDayInFirstWeek, loaded_task);
    loaded_task = !loaded_task;
    sortTodo();
    var todo = fs.readFileSync(todoPath, 'utf8');
    todo = JSON.parse(todo);
    todo[0].date = date;
    console.log("number of tasks: " + todo[0].tasks.length);
    carbone.render(schedule_templatePath, todo, function (err, result) {
        if (err) return console.log(err);
        fs.writeFileSync(resultPath, result);
        console.log("server generated schedule with date " + date.fullDate);
    });
    forms.push(resultPath.split("/")[3]);

    var pps = require(pps_path);
    var v5 = require(v5_path);
    var vrms = require(vrms_path);
    formFiltering(v5, vrms, pps, dateArray, numberOfDayInFirstWeek);

    for (let i = 0; i < forms.length; ++i) {
        if (forms[i].includes(OTCL_resultPath.split("/")[3])) {
            var otcl = fs.readFileSync(OTCL_path, 'utf8');
            otcl = JSON.parse(otcl);
            otcl.push(date);
            carbone.render(OTCL_templatePath, otcl, function (err, result) {
                if (err) return console.log(err);
                fs.writeFileSync(OTCL_resultPath, result);
                console.log("server generated OTCL with date " + date.fullDate);
            });
        }
        if (forms[i].includes(collection_resultPath.split("/")[3])) {
            carbone.render(collection_templatePath, date, function (err, result) {
                if (err) return console.log(err);
                fs.writeFileSync(collection_resultPath, result);
                console.log("server generated collection form with date " + date.fullDate);
            });
        }
        if (forms[i].includes(stockCheckList_resultPath.split("/")[3])) {
            carbone.render(stockCheckList_templatePath, date, function (err, result) {
                if (err) return console.log(err);
                fs.writeFileSync(stockCheckList_resultPath, result);
                console.log("server generated stock check list with date " + date.fullDate);
            });
        }
        if (forms[i].includes(sccCheckList_resultPath.split("/")[3])) {
            carbone.render(sccCheckList_templatePath, date, function (err, result) {
                if (err) return console.log(err);
                fs.writeFileSync(sccCheckList_resultPath, result);
                console.log("server generated ssc attendance check list with date " + date.fullDate);
            });
        }
    }

    var loc = fs.readFileSync(location_path, 'utf8');
    loc = JSON.parse(loc);
    req.body.location = loc;
    req.body.forms = forms;
    res.json(req.body);
});


function sortTodo() {
    var final = fs.readFileSync(todoPath, 'utf8');
    final = JSON.parse(final);
    final[0].tasks.sort(getSortOrder("StartTime"));
    fs.writeFileSync(todoPath, JSON.stringify(final), 'utf8');
}

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

    var rules2 = rules.split("?");
    var subrules = rules2[0].split(";");
    for (let j = 0; j < subrules.length; ++j) {
        if (subrules[j].includes("print")) { // for printing forms
            const printPath = subrules[j].substring(6,);
            let duplicate = false;
            for (let i = 0; i < forms.length; ++i) {
                if (forms[i].includes(printPath)) {
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) forms.push(printPath);
        }
    }
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
    var oriJson = fs.readFileSync(todoPath, 'utf8');
    oriJson = JSON.parse(oriJson);
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
            }
            continue;
        }

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
                    }
                }
            }
            if (subrules[j].includes("month")) {
                const monthlyRules = subrules[j].substring(6,).split(",");
                const numberOfRules = monthlyRules.length;
                for (k = 0; k < numberOfRules; ++k) {
                    if (monthlyRules[k] == date) {
                        valid = true;
                        break;
                    }
                }
            }
            if (subrules[j].includes("year")) {
                const yearlyRules = subrules[j].substring(5,).split(",")
                const numberOfRules = yearlyRules.length;
                for (k = 0; k < numberOfRules; ++k) {
                    if (yearlyRules[k].substring(0, 2) == date && yearlyRules[k].substring(2,5) == month && (yearlyRules[k].substring(5,) == year || !yearlyRules[k].substring(5,))) {
                        valid = true;
                        break;
                    }
                }
            }
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
                            }
                        }
                    }
                    numberOfWd = Number(day) - numberOfPh + 1;
                    if (numberOfWd == wdRules[k]) {
                        valid = true;
                        break;
                    }
                }
            }
            if (subrules[j].includes("lastday")) {
                const ldRules = subrules[j].substring(8,).split(",");
                const numberOfRules = ldRules.length;
                for (k = 0; k < numberOfRules; ++k) {
                    for (x = 0; x < months.length; ++x) {
                        if (months[x] == month) {
                            if (datesOfMonths[x] - Number(ldRules[k]) + 1 == date) {
                                valid = true;
                                break;
                            }
                        }
                    }
                }
            }


            if (subrules[j].includes("biweekly")) {
                let bw = false;
                let numberOfDay = Number(date);
                for (k = 0; k < months.length; ++k) {
                    if (months[k] == month) { numberOfDay -= firstWeek; break; }
                    else { numberOfDay += datesOfMonths[k]; };
                }
                if (Math.floor(numberOfDay / 7) % 2 == 1) { bw = true; };
                if (bw) {
                    const bwRules = subrules[j].substring(9,).split(",");
                    const numberOfRules = bwRules.length;
                    for (k = 0; k < numberOfRules; ++k) {
                        if (bwRules[k] == day) {
                            valid = true;
                            break;
                        }
                    }
                }
            }
        }
        if (exclude) {
            const subConstraints = exclude.split(";");
            const numberOfConstraint = subConstraints.length;
            for (j = 0; j < numberOfConstraint - 1; ++j) {
                if (subConstraints[j].includes("ph") && ph) {
                    valid = false;
                    break;
                }
                if (subConstraints[j].includes("week")) {
                    const weeklyRules = subConstraints[j].substring(5,).split(",");
                    const numberOfRules = weeklyRules.length;
                    for (k = 0; k < numberOfRules; ++k) {
                        if (weeklyRules[k] == day) {
                            valid = false;
                            break;
                        }
                    }
                }
                if (subConstraints[j].includes("month")) {
                    const monthlyRules = subConstraints[j].substring(6,).split(",");
                    const numberOfRules = monthlyRules.length;
                    for (k = 0; k < numberOfRules; ++k) {
                        if (monthlyRules[k] == date) {
                            valid = false;
                            break;
                        }
                    }
                }
                if (subConstraints[j].includes("year")) {
                    const yearlyRules = subConstraints[j].substring(5,).split(",")
                    const numberOfRules = yearlyRules.length;
                    for (k = 0; k < numberOfRules; ++k) {
                        if (yearlyRules[k].substring(0, 2) == date && yearlyRules[k].substring(2,5) == month && (yearlyRules[k].substring(5,) == year || !yearlyRules[k].substring(5,))) {
                            valid = false;
                            break;
                        }
                    }
                }
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
                            valid = false;
                            break;
                        }
                    }
                }
                if (subConstraints[j].includes("biweekly")) {
                  let bw = false;
                  let numberOfDay = Number(date);
                  for (k = 0; k < months.length; ++k) {
                      if (months[k] == month) { numberOfDay -= firstWeek; break; }
                      else { numberOfDay += datesOfMonths[k]; };
                  }
                  if (Math.floor(numberOfDay / 7) % 2 == 1) { bw = true; };
                  if (bw) {
                      const bwRules = subConstraints[j].substring(9,).split(",");
                      const numberOfRules = bwRules.length;
                      for (k = 0; k < numberOfRules; ++k) {
                          if (bwRules[k] == day) {
                              valid = false;
                              break;
                          }
                      }
                  }
              }
            }
        }
        //Special Cases
        if (include == "SC1") {
            if (date == "2" && date != "28" && month != "Jan") {
                valid = true;
            }
            else if (date == "29" && month == "Jan") {
                valid = true;
            }
        };
        //2Jan 29Jan 6Apr 14Apr 2May 26Jun 2Jul 3Oct 28Dec
        if (include == "SC2") {
            if ((date == "2" || date == "29") & month == "Jan") valid = true;
            else if ((date == "6" || date == "14") & month == "Apr") valid = true;
            else if ((date == "2") & month == "May") valid = true;
            else if ((date == "26") & month == "Jun") valid = true;
            else if ((date == "2") & month == "Jul") valid = true;
            else if ((date == "3") & month == "Oct") valid = true;
            else if ((date == "28") & month == "Aug") valid = true;
        };
        //27Jan 24Feb 30Mar 27Apr 1Jun 29Jun 27Jul 31Aug 28Sep 26Oct 30Nov 28Dec
        if (include == "SC3") {
            if ((date == "27") & month == "Jan") valid = true;
            else if ((date == "24") & month == "Feb") valid = true;
            else if ((date == "30") & month == "Mar") valid = true;
            else if ((date == "27") & month == "Apr") valid = true;
            else if ((date == "1" || date == "29") & month == "Jun") valid = true;
            else if ((date == "27") & month == "Jul") valid = true;
            else if ((date == "31") & month == "Aug") valid = true;
            else if ((date == "28") & month == "Sep") valid = true;
            else if ((date == "26") & month == "Oct") valid = true;
            else if ((date == "30") & month == "Nov") valid = true;
            else if ((date == "28") & month == "Dec") valid = true;
        };
        //Append the task to ToDoList.json
        if (valid) {
            append(task);
        };
    };
    var oriJson = fs.readFileSync(todoPath, 'utf8');
    oriJson = JSON.parse(oriJson);
};

function getSortOrder(prop) {
    return function (a, b) {
        let a_hr = Number(a[prop].split(":")[0]);
        let a_min = Number(a[prop].split(":")[1]);
        let b_hr = Number(b[prop].split(":")[0]);
        let b_min = Number(b[prop].split(":")[1]);

        if (a_hr < 8) { a_hr += 24 };
        if (b_hr < 8) { b_hr += 24 };
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

function formAppend(task, path, destination, type, freq) {
    const fs = require('fs');
    var objectList = [];
    if ((type == "backup") && (freq == "weekly")) {
        objectList.push({ name: task });
    } else {
        for (let i = 0; i < task.length; ++i) {
            objectList.push({ name: task[i] });
        }
    }

    var oriJson = fs.readFileSync(path, 'utf8');
    oriJson = JSON.parse(oriJson);
    var to_append = "";
    if (destination == "SCC") {
        to_append = { ToSCC: objectList };
    }
    else if (destination == "PCC") {
        to_append = { ToPCC: objectList };
    };
    if (freq == "weekly") {
        if (type == "V5") {
            oriJson[0]["weekly"][0]["V5"].push(to_append);
        }
        else if (type == "VRMS") {
            oriJson[0]["weekly"][2]["VRMS"].push(to_append);
        }
        else if (type == "PPS") {
            oriJson[0]["weekly"][1]["PPS"].push(to_append);
        }
        else if (type == "backup") {
            oriJson[0]["weekly"][3]["Copy"].push(to_append);
        }
    }
    else if (freq == "monthly") {
        oriJson[1]["monthly"].push(to_append);
    };
    fs.writeFileSync(path, JSON.stringify(oriJson), 'utf8');
};

function append_location(title, task, path, destination){
    const fs = require('fs');
    var oriJson = fs.readFileSync(path, 'utf8');
    oriJson = JSON.parse(oriJson);
    var to_append = {[title]: task};
    if(destination == "SCC"){
        oriJson[0]["SCC"].push(to_append);
    }
    else if(destination == "PCC"){
        oriJson[1]["PCC"].push(to_append);
    };
    fs.writeFileSync(path, JSON.stringify(oriJson), 'utf8');
}

function formFiltering(data_1, data_2, data_3, inputDate, firstWeek){
    const fs = require('fs');
    var date    = inputDate[0];
    var month   = inputDate[1];
    const year    = inputDate[2];
    const day     = inputDate[3];

    var datesOfMonths = [];
    if(year%4 == 0){datesOfMonths=[31,29,31,30,31,30,31,31,30,31,30,31];}
    else{datesOfMonths=[31,28,31,30,31,30,31,31,30,31,30,31];};

    const months  = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var numberOfDay = Number(date);
    for(k=0; k<months.length; ++k){
        if(months[k] == month){
            numberOfDay-=firstWeek;break;
        }
        else{
            numberOfDay += datesOfMonths[k];
        };
    };
    var numberOfMon = Math.floor(numberOfDay/7);
    if(firstWeek >= 6){numberOfMon++;};
    if(day >= 1){numberOfMon++;};
    console.log(numberOfMon);

    var reset_1 = fs.readFileSync(OTCL_path, 'utf8');
    reset_1 = [{"weekly":[{"V5":[]},{"PPS":[]},{"VRMS":[]},{"Copy":[]}]}, {"monthly":[]}];
    fs.writeFileSync(OTCL_path, JSON.stringify(reset_1), 'utf8');

    var reset_2 = fs.readFileSync(delivery_path, 'utf8');
    reset_2 = [];
    fs.writeFileSync(delivery_path, JSON.stringify(reset_2), 'utf8');

    var reset_3 = fs.readFileSync(location_path, 'utf8');
    reset_3 = [{"SCC":[]},{"PCC":[]}];
    fs.writeFileSync(location_path, JSON.stringify(reset_3), 'utf8');

    const numberOfData_1 = Object.keys(data_1).length;
    var delivery_scc = [];
    var delivery_pcc = [];
    for(i=0; i<numberOfData_1; ++i){
        let task = data_1[i];
        let rules = task["Rules"].split("/");
        let rule = rules[0];
        let destination = rules[1];
        let to_be_append_OFF = [];
        let to_be_append_ON = [];

        if(rule == "constant"){
            let numberOfTapes = Object.keys(task["Tapes"]).length;
            var to_be_append_location = [];
            for(j=0; j<numberOfTapes; ++j){
                to_be_append_location.push(task["Tapes"][j])
            };
            append_location(task["Title"], to_be_append_location, location_path, "PCC");
        }

        else if(rule == "weekly"){
            if(day =="0"){
                --numberOfMon;
            };
            var to_be_append_location_pcc = [];
            var to_be_append_location_scc = [];
            let numberOfTapes = Object.keys(task["Tapes"]).length;
            if(numberOfMon % 5 == 2){
                if(destination == "SCC"){
                    let keyss = 0;
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                    to_be_append_OFF = (task["Tapes"][0]);
                    to_be_append_ON = (task["Tapes"][4]);
                    delivery_scc.push("1-mirror");                    
                    delivery_pcc.push("5-mirror");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "V5", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "V5", rule);
                }
                else if(destination == "PCC"){
                    let keyss = 0;
                    for(j=0; j<numberOfTapes; ++j){
                        if(j != keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                    to_be_append_OFF = (task["Tapes"][4]);
                    to_be_append_ON = (task["Tapes"][0]);
                    delivery_scc.push("5");                    
                    delivery_pcc.push("1");
                    formAppend(to_be_append_OFF, OTCL_path,  "SCC", "V5", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "V5", rule);
                }
            }
            else if(numberOfMon % 5 == 3){
                if(destination == "SCC"){
                    let keyss = 1;
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                    to_be_append_OFF = (task["Tapes"][1]);
                    to_be_append_ON = (task["Tapes"][0]);
                    delivery_scc.push("2-mirror");                    
                    delivery_pcc.push("1-mirror");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "V5", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "V5", rule);
                }
                else if(destination == "PCC"){
                    let keyss = 1;
                    for(j=0; j<numberOfTapes; ++j){
                        if(j != keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                    to_be_append_OFF = (task["Tapes"][0]);
                    to_be_append_ON = (task["Tapes"][1]);
                    delivery_scc.push("1");                    
                    delivery_pcc.push("2");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "V5", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "V5", rule);
                }
            }
            else if(numberOfMon % 5 == 4){
                if(destination == "SCC"){
                    let keyss = 2;
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                    to_be_append_OFF = (task["Tapes"][2]);
                    to_be_append_ON = (task["Tapes"][1]);
                    delivery_scc.push("3-mirror");                    
                    delivery_pcc.push("2-mirror");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "V5", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "V5", rule);
                }
                else if(destination == "PCC"){
                    let keyss = 2;
                    for(j=0; j<numberOfTapes; ++j){
                        if(j != keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                    to_be_append_OFF = (task["Tapes"][1]);
                    to_be_append_ON = (task["Tapes"][2]);
                    delivery_scc.push("2");                    
                    delivery_pcc.push("3");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "V5", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "V5", rule);
                }
            }
            else if(numberOfMon % 5 == 0){
                if(destination == "SCC"){
                    let keyss = 3;
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                    to_be_append_OFF = (task["Tapes"][3]);
                    to_be_append_ON = (task["Tapes"][2]);
                    delivery_scc.push("4-mirror");                    
                    delivery_pcc.push("3-mirror");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "V5", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "V5", rule);
                }
                else if(destination == "PCC"){
                    let keyss = 3;
                    for(j=0; j<numberOfTapes; ++j){
                        if(j != keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                    to_be_append_OFF = (task["Tapes"][2]);
                    to_be_append_ON = (task["Tapes"][3]);
                    delivery_scc.push("3");                    
                    delivery_pcc.push("4");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "V5", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "V5", rule);
                }
            }
            else if(numberOfMon % 5 == 1){
                if(destination == "SCC"){
                    let keyss = 4;
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                    to_be_append_OFF = (task["Tapes"][4]);
                    to_be_append_ON = (task["Tapes"][3]);
                    delivery_scc.push("5-mirror");                    
                    delivery_pcc.push("4-mirror");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "V5", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "V5", rule);
                }
                else if(destination == "PCC"){
                    let keyss = 4;
                    for(j=0; j<numberOfTapes; ++j){
                        if(j != keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                    to_be_append_OFF = (task["Tapes"][3]);
                    to_be_append_ON = (task["Tapes"][4]);
                    delivery_scc.push("4");                    
                    delivery_pcc.push("5");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "V5", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "V5", rule);
                }
            };
            append_location(task["Title"], to_be_append_location_pcc, location_path, "PCC");
            append_location(task["Title"], to_be_append_location_scc, location_path, "SCC");
        }
        else if(rule == "monthly"){
            const months  = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            var numberOfMonth = 0;
            var numberOfMonth_loc = 0;
            for(j=0; j<months.length; ++j){
                if(months[j] == month){
                    numberOfMonth = j+1;
                    numberOfMonth_loc = j+1;
                }
            };
            if(Number(date) == 1 || (Number(date) < 8 && day =="0")){
                --numberOfMonth_loc;
            };
            var to_be_append_location_pcc = [];
            var to_be_append_location_scc = [];
            let numberOfTapes = Object.keys(task["Tapes"]).length;
            if(numberOfMonth_loc % 4 == 1){
                let keyss = 2;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j != keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
            }
            else if(numberOfMonth_loc % 4 == 2){
                let keyss = 3;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j != keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
            }
            else if(numberOfMonth_loc % 4 == 3){
                let keyss = 0;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j != keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
            }
            else if(numberOfMonth_loc % 4 == 0){
                let keyss = 1;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j != keyss){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
            };
            append_location(task["Title"], to_be_append_location_pcc, location_path, "PCC");
            append_location(task["Title"], to_be_append_location_scc, location_path, "SCC");
            if(numberOfMonth % 4 == 1){
                if(destination == "SCC"){
                    to_be_append_OFF = task["Tapes"][2];
                    to_be_append_ON = task["Tapes"][1];
                    delivery_scc.push("3", "3", "3");                    
                    delivery_pcc.push("2", "2", "2");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "", rule);
                }
                else if(destination == "PCC"){
                    to_be_append_OFF = task["Tapes"][1];
                    to_be_append_ON = task["Tapes"][2];
                    delivery_scc.push("2", "2", "2");                    
                    delivery_pcc.push("3", "3", "3");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "", rule);
                }
            }
            else if(numberOfMonth % 4 == 2){
                if(destination == "SCC"){
                    to_be_append_OFF = task["Tapes"][3];
                    to_be_append_ON = task["Tapes"][2];
                    delivery_scc.push("4", "4", "4");                    
                    delivery_pcc.push("3", "3", "3");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "", rule);
                }
                else if(destination == "PCC"){
                    to_be_append_OFF = task["Tapes"][2];
                    to_be_append_ON = task["Tapes"][3];
                    delivery_scc.push("3", "3", "3");                    
                    delivery_pcc.push("4", "4", "4");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "", rule);
                }
            }
            else if(numberOfMonth % 4 == 3){
                if(destination == "SCC"){
                    to_be_append_OFF = task["Tapes"][0];
                    to_be_append_ON = task["Tapes"][3];
                    delivery_scc.push("1", "1", "1");                    
                    delivery_pcc.push("4", "4", "4");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "", rule);
                }
                else if(destination == "PCC"){
                    to_be_append_OFF = task["Tapes"][3];
                    to_be_append_ON = task["Tapes"][0];
                    delivery_scc.push("4", "4", "4");                    
                    delivery_pcc.push("1", "1", "1");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "", rule);
                }
            }
            else if(numberOfMonth % 4 == 0){
                if(destination == "SCC"){
                    to_be_append_OFF = task["Tapes"][1];
                    to_be_append_ON = task["Tapes"][0];
                    delivery_scc.push("2", "2", "2");                    
                    delivery_pcc.push("1", "1", "1");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "", rule);
                }
                else if(destination == "PCC"){
                    to_be_append_OFF = task["Tapes"][0];
                    to_be_append_ON = task["Tapes"][1];
                    delivery_scc.push("1", "1", "1");                    
                    delivery_pcc.push("2", "2", "2");
                    formAppend(to_be_append_OFF, OTCL_path, "SCC", "", rule);
                    formAppend(to_be_append_ON, OTCL_path, "PCC", "",rule);
                }
            }
        }
        else if(rule == "backup"){
            var month_number = "";
            for(j=0; j<months.length; ++j){
                if(months[j] == month){
                    month_number = j + 1 ;
                    month_number = "0" + month_number.toString();
                }
            };
            to_be_append = (task["Tapes"][0]);
            to_be_append[0] = to_be_append[0].replace('YYYY', year.toString());
            to_be_append[0] = to_be_append[0].replace('MM', month_number.toString()); 
            formAppend(to_be_append[0], OTCL_path, "SCC", rule, "weekly");
            delivery_scc.push(year.toString() + month_number.toString());   
        }
    };
    const numberOfData_2 = Object.keys(data_2).length;
    for(i=0; i<numberOfData_2; ++i){
        let task = data_2[i];
        let rules = task["Rules"].split("/");
        let rule = rules[0];
        let destination = rules[1];
        let to_be_append_OFF = [];
        let to_be_append_ON = [];
        if(rule == "constant"){
            let numberOfTapes = Object.keys(task["Tapes"]).length;
            var to_be_append_location = [];
            for(j=0; j<numberOfTapes; ++j){
                to_be_append_location.push(task["Tapes"][j])
            };
            append_location(task["Title"], to_be_append_location, location_path, "PCC");
        }
        else if(rule == "weekly"){
            if(day =="0"){
                --numberOfMon;
            };
            var to_be_append_location_pcc = [];
            var to_be_append_location_scc = [];
            let numberOfTapes = Object.keys(task["Tapes"]).length;
            if(numberOfMon % 5 == 0){
                let keyss = 0;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss || j == keyss+3 || j == keyss+4){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(!(j == keyss || j == keyss+3 || j == keyss+4)){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                };
                to_be_append_OFF = (task["Tapes"][0]);
                to_be_append_ON = (task["Tapes"][2]);
                delivery_scc.push("1-OFF");                    
                delivery_pcc.push("3-OFF");
                formAppend(to_be_append_OFF, OTCL_path, "SCC", "VRMS", rule);
                formAppend(to_be_append_ON, OTCL_path, "PCC", "VRMS", rule);
            }
            else if(numberOfMon % 5 == 1){
                let keyss = 1;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss || j == keyss+2 || j == keyss+3){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(!(j == keyss || j == keyss+2 || j == keyss+3)){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                };
                to_be_append_OFF = (task["Tapes"][1]);
                to_be_append_ON = (task["Tapes"][3]);
                delivery_scc.push("2-OFF");                    
                delivery_pcc.push("4-OFF");
                formAppend(to_be_append_OFF, OTCL_path, "SCC", "VRMS", rule);
                formAppend(to_be_append_ON, OTCL_path, "PCC", "VRMS", rule);
            }
            else if(numberOfMon % 5 == 2){
                let keyss = 2;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss || j == keyss-1 || j == keyss-2){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(!(j == keyss || j == keyss-1 || j == keyss-2)){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                };
                to_be_append_OFF = (task["Tapes"][2]);
                to_be_append_ON = (task["Tapes"][4]);
                delivery_scc.push("3-OFF");                    
                delivery_pcc.push("5-OFF");
                formAppend(to_be_append_OFF, OTCL_path, "SCC", "VRMS", rule);
                formAppend(to_be_append_ON, OTCL_path, "PCC", "VRMS", rule);
            }
            else if(numberOfMon % 5 == 3){
                let keyss = 3;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss || j == keyss-1 || j == keyss-2){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(!(j == keyss || j == keyss-1 || j == keyss-2)){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                };
                to_be_append_OFF = (task["Tapes"][3]);
                to_be_append_ON = (task["Tapes"][0]);
                delivery_scc.push("4-OFF");                    
                delivery_pcc.push("1-OFF");
                formAppend(to_be_append_OFF, OTCL_path, "SCC", "VRMS", rule);
                formAppend(to_be_append_ON, OTCL_path, "PCC", "VRMS", rule);
            }
            else if(numberOfMon % 5 == 4){
                let keyss = 4;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss || j == keyss-1 || j == keyss-2){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(!(j == keyss || j == keyss-1 || j == keyss-2)){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                };
                to_be_append_OFF = (task["Tapes"][0]);
                to_be_append_ON = (task["Tapes"][1]);
                delivery_scc.push("1-OFF");                    
                delivery_pcc.push("2-OFF");
                formAppend(to_be_append_OFF, OTCL_path, "SCC", "VRMS", rule);
                formAppend(to_be_append_ON, OTCL_path, "PCC", "VRMS", rule);
            };
            append_location(task["Title"], to_be_append_location_pcc, location_path, "PCC");
            append_location(task["Title"], to_be_append_location_scc, location_path, "SCC");
        }
        else if(rule == "monthly"){
            var date    = inputDate[0];
            var month   = inputDate[1];
            if(day != "1"){
                if(day == "0"){
                    date = Number(date) + 1;
                }
                else{
                    date = Number(date) + 1 - day;
                }
            };
            var to_be_append_location_pcc = [];
            var to_be_append_location_scc = [];
            let numberOfTapes = Object.keys(task["Tapes"]).length;
            var location_form = false ;
            var date_index = 0;
            do{
                date = Number(date) - date_index*7;
                if(Number(date) < 1){
                    for(k=0; k<months.length; ++k){
                        if(months[k] == month){
                            month = months[k-1];
                            date = datesOfMonths[k-1] + Number(date)
                        }
                    };
                    date_index = 0;
                };
                if(Number(date) == 1 && month == "Jun"){
                    let keys = 3;
                    if(destination == "SCC"){
                        for(j=0; j<numberOfTapes; ++j){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        };
                    }
                    else if(destination == "PCC"){
                        for(j=0; j<numberOfTapes; ++j){
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        };
                    };
                    location_form = true;
                };
                if(Number(date) == 18 && month == "May"){
                    let keyss = 3;
                    if(destination == "SCC"){
                        for(j=0; j<numberOfTapes; ++j){
                            if(j == keyss){to_be_append_location_pcc.push(task["Tapes"][j]);}
                            else{to_be_append_location_scc.push(task["Tapes"][j]);}
                        };
                    }
                    else if(destination == "PCC"){
                        for(j=0; j<numberOfTapes; ++j){
                            if(j != keyss){to_be_append_location_pcc.push(task["Tapes"][j]);}
                            else{to_be_append_location_scc.push(task["Tapes"][j]);}
                        };
                    };
                    location_form = true;
                }
                for(k=0; k<months.length; ++k){
                    if(months[k] == month){
                        const keyss = (k+1)%3;
                        if(Number(date) + 7 > datesOfMonths[k]){
                            if(destination == "SCC"){
                                for(j=0; j<numberOfTapes; ++j){
                                    to_be_append_location_scc.push(task["Tapes"][j]);
                                };
                            }
                            else if(destination == "PCC"){
                                for(j=0; j<numberOfTapes; ++j){
                                    to_be_append_location_pcc.push(task["Tapes"][j]);
                                };
                            };
                            location_form = true;
                        }
                        else if(Number(date) + 14 < datesOfMonths[k] && Number(date) + 21 > datesOfMonths[k]){
                            if(destination == "SCC"){
                                for(j=0; j<numberOfTapes; ++j){
                                    if(j == keyss){to_be_append_location_pcc.push(task["Tapes"][j]);}
                                    else{to_be_append_location_scc.push(task["Tapes"][j]);}
                                };
                            }
                            else if(destination == "PCC"){
                                for(j=0; j<numberOfTapes; ++j){
                                    if(j != keyss){to_be_append_location_pcc.push(task["Tapes"][j]);}
                                    else{to_be_append_location_scc.push(task["Tapes"][j]);}
                                };
                            };
                            location_form = true;
                        }
                    }
                };
                if(location_form){
                    append_location(task["Title"], to_be_append_location_pcc, location_path, "PCC");
                    append_location(task["Title"], to_be_append_location_scc, location_path, "SCC");
                }
                else{
                    ++date_index;
                }
            }
            while(!location_form);
        }
    };

    const numberOfData_3 = Object.keys(data_3).length;
    for(i=0; i<numberOfData_3; ++i){
        let task = data_3[i];
        let rules = task["Rules"].split("/");
        let rule = rules[0];
        let destination = rules[1];
        let to_be_append_OFF = [];
        let to_be_append_ON = [];
        if(rule == "constant"){
            let numberOfTapes = Object.keys(task["Tapes"]).length;
            var to_be_append_location = [];
            for(j=0; j<numberOfTapes; ++j){
                to_be_append_location.push(task["Tapes"][j])
            };
            append_location(task["Title"], to_be_append_location, location_path, "PCC");
        }
        else if(rule == "weekly"){
            if(day =="0"){
                --numberOfMon;
            };
            if(numberOfMon % 4 == 1){
                var to_be_append_location_pcc = [];
                var to_be_append_location_scc = [];
                let numberOfTapes = Object.keys(task["Tapes"]).length;
                let keyss = 1;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss || j == keyss-1 ){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(!(j == keyss || j == keyss-1 )){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                };
                append_location(task["Title"], to_be_append_location_pcc, location_path, "PCC");
                append_location(task["Title"], to_be_append_location_scc, location_path, "SCC");
                to_be_append_OFF = (task["Tapes"][3]);
                to_be_append_ON = (task["Tapes"][1]);
                delivery_scc.push("4");                    
                delivery_pcc.push("2");
                formAppend(to_be_append_OFF, OTCL_path, "SCC", "PPS", rule);
                formAppend(to_be_append_ON, OTCL_path, "PCC", "PPS", rule);
            }
            else if(numberOfMon % 4 == 2){
                var to_be_append_location_pcc = [];
                var to_be_append_location_scc = [];
                let numberOfTapes = Object.keys(task["Tapes"]).length;
                let keyss = 0;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss || j == keyss+3 ){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(!(j == keyss || j == keyss+3 )){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                };
                append_location(task["Title"], to_be_append_location_pcc, location_path, "PCC");
                append_location(task["Title"], to_be_append_location_scc, location_path, "SCC");
                to_be_append_OFF = (task["Tapes"][0]);
                to_be_append_ON = (task["Tapes"][2]);
                delivery_scc.push("1");                    
                delivery_pcc.push("3");
                formAppend(to_be_append_OFF, OTCL_path, "SCC", "PPS", rule);
                formAppend(to_be_append_ON, OTCL_path, "PCC", "PPS", rule);
            }
            else if(numberOfMon % 4 == 3){
                var to_be_append_location_pcc = [];
                var to_be_append_location_scc = [];
                let numberOfTapes = Object.keys(task["Tapes"]).length;
                let keyss = 2;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss || j == keyss-1 ){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(!(j == keyss || j == keyss-1)){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                };
                append_location(task["Title"], to_be_append_location_pcc, location_path, "PCC");
                append_location(task["Title"], to_be_append_location_scc, location_path, "SCC");
                to_be_append_OFF = (task["Tapes"][1]);
                to_be_append_ON = (task["Tapes"][3]);
                delivery_scc.push("2");                    
                delivery_pcc.push("4");
                formAppend(to_be_append_OFF, OTCL_path, "SCC", "PPS", rule);
                formAppend(to_be_append_ON, OTCL_path, "PCC", "PPS", rule);
            }
            else if(numberOfMon % 4 == 0){
                var to_be_append_location_pcc = [];
                var to_be_append_location_scc = [];
                let numberOfTapes = Object.keys(task["Tapes"]).length;
                let keyss = 3;
                if(destination == "SCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(j == keyss || j == keyss-1){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                }
                else if(destination == "PCC"){
                    for(j=0; j<numberOfTapes; ++j){
                        if(!(j == keyss || j == keyss-1)){
                            to_be_append_location_scc.push(task["Tapes"][j]);
                        }
                        else{
                            to_be_append_location_pcc.push(task["Tapes"][j]);
                        }
                    };
                };
                append_location(task["Title"], to_be_append_location_pcc, location_path, "PCC");
                append_location(task["Title"], to_be_append_location_scc, location_path, "SCC");
                to_be_append_OFF = (task["Tapes"][2]);
                to_be_append_ON = (task["Tapes"][0]);
                delivery_scc.push("3");                    
                delivery_pcc.push("1");
                formAppend(to_be_append_OFF, OTCL_path, "SCC", "PPS", rule);
                formAppend(to_be_append_ON, OTCL_path, "PCC", "PPS", rule);
            }
        }
        else if(rule == "monthly"){
            var date    = inputDate[0];
            var month   = inputDate[1];
            if(day != "1"){
                if(day == "0"){
                    date = Number(date) + 1;
                }
                else{
                    date = Number(date) + 1 - day;
                }
            };
            if(date == "25" && month == "May"){continue;};

            var to_be_append_location_pcc = [];
            var to_be_append_location_scc = [];
            let numberOfTapes = Object.keys(task["Tapes"]).length;
            var location_form = false ;
            var date_index = 0;
            do{
                var date    = inputDate[0];
                date = Number(date) - date_index*7;
                if(Number(date) < 1){
                    for(k=0; k<months.length; ++k){
                        if(months[k] == month){
                            month = months[k-1];
                            date = datesOfMonths[k-1] + Number(date)
                        }
                    };
                    date_index = 0;
                };
                // console.log("Date: "+date);
                // console.log("Month: "+month);
                if(date == "01" && month == "Jun"){
                    let keyss = 5;
                    if(destination == "SCC"){
                        for(j=0; j<numberOfTapes; ++j){
                            if(j == keyss){
                                to_be_append_location_pcc.push(task["Tapes"][j]);
                            }
                            else{
                                to_be_append_location_scc.push(task["Tapes"][j]);
                            }
                        };
                    }
                    else if(destination == "PCC"){
                        for(j=0; j<numberOfTapes; ++j){
                            if(j != keyss){
                                to_be_append_location_pcc.push(task["Tapes"][j]);
                            }
                            else{
                                to_be_append_location_scc.push(task["Tapes"][j]);
                            }
                        };
                    };
                    location_form = true;
                };
                for(let k=0; k<months.length; ++k){
                    if(months[k] == month){
                        if(Number(date) + 7 > datesOfMonths[k]){
                            let numberOfTapes = Object.keys(task["Tapes"][0]).length;
                            let keyss = k + 1;
                            if(keyss == 13){keyss = 0};
                            if(destination == "SCC"){
                                for(j=0; j<numberOfTapes; ++j){
                                    if(j == keyss){
                                        to_be_append_location_pcc.push(task["Tapes"][0][j]);
                                    }
                                    else{
                                        to_be_append_location_scc.push(task["Tapes"][0][j]);
                                    }
                                };
                            }
                            else if(destination == "PCC"){
                                console.log(k);
                                for(j=0; j<numberOfTapes; ++j){
                                    if(j != keyss){
                                        to_be_append_location_pcc.push(task["Tapes"][0][j]);
                                    }
                                    else{
                                        to_be_append_location_scc.push(task["Tapes"][0][j]);
                                    }
                                };
                            };
                            location_form = true;
                        }
                    }
                };
                if(location_form){
                    append_location(task["Title"], to_be_append_location_pcc, location_path, "PCC");
                    append_location(task["Title"], to_be_append_location_scc, location_path, "SCC");
                }
                else{
                    ++date_index;
                }
            }
            while(!location_form)
        }
    };
    // console.log(delivery_scc);
    // console.log(delivery_pcc);
    var oriJson = fs.readFileSync(delivery_path, 'utf8');
    oriJson = JSON.parse(oriJson);
    var to_append_1 = {ToScc: delivery_scc};
    var to_append_2 = {ToPcc: delivery_pcc};
    oriJson.push(to_append_1);
    oriJson.push(to_append_2);
    fs.writeFileSync(delivery_path, JSON.stringify(oriJson), 'utf8');
};
