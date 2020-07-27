const fs = require('fs');
const carbone = require('carbone');
const express = require("express");
const app = express();
const port = 3000;

app.use(express.static(__dirname + "/public"));
app.listen(port);
console.log("server running on port " + port);

app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json()); // Parse JSON bodies (as sent by API clients)
app.post('/', function (req, res) { // Access the parse results as request.body
    date = req.body.date;
    var scheduler = require("./json/scheduler.json");
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    let dateArray = [date.day, monthNames[date.month - 1], date.year, date.weekday]; //[date, month, year, day]
    const numberOfDayInFirstWeek = 3; //need edit every year
    filtering(scheduler, dateArray, numberOfDayInFirstWeek);
    var todo = require("./json/ToDoList.json");
    todo[0].date = date;
    console.log(todo);
    carbone.render('template.docx', todo, function (err, result) {
        if (err) return console.log(err);
        let fileName = 'public/result' + '.docx';
        fs.writeFileSync(fileName, result);
        console.log("server generated report with date " + date.fullDate);
    });
});


// By Carson

function append(task) {
    const fs = require('fs');
    //Here is the data to be appended
    const startTime = task["StartTime"];
    const taskName  = task["JobName"];
    const server    = task["Server"];
    const remarks   = task["Remarks"];
    const rules     = task["Rules"];

    var oriJson = fs.readFileSync('./json/ToDoList.json', 'utf8');
    oriJson = JSON.parse(oriJson);
    var to_append = {StartTime: startTime, JobName: taskName, Server: server, Remarks: remarks, Rules: rules};
    oriJson[0]["tasks"].push(to_append);
    //console.log(oriJson);
    fs.writeFileSync("./json/ToDoList.json", JSON.stringify(oriJson), 'utf8');
};

function filtering(data, inputDate, firstWeek){
    var phs = require("./json/ph.json");
    const fs = require('fs');
    const numberOfData = Object.keys(data).length;
    const date    = inputDate[0];
    const month   = inputDate[1];
    const year    = inputDate[2];
    const day     = inputDate[3];
    var ph        = false;
    const months  = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    var reset = fs.readFileSync('./json/ToDoList.json', 'utf8');
    reset = [{"tasks":[]}];
    fs.writeFileSync("./json/ToDoList.json", JSON.stringify(reset), 'utf8');

    var datesOfMonths = [];
    if(year%4 == 0){datesOfMonths=[31,29,31,30,31,30,31,31,30,31,30,31];}
    else{datesOfMonths=[31,28,31,30,31,30,31,31,30,31,30,31];};

    for(i=0; i<Object.keys(phs).length; ++i){
        if((phs[i]["date"] == date && phs[i]["month"] == month) || day == "0"){
            ph = true;
            break;
        };
    };
    for(i=0; i<numberOfData; ++i){
        const task    = data[i];
        const rules   = task["Rules"].split("?");
        const include = rules[0];
        const exclude = rules[1];
        
        var valid     = false;

        if(include == "daily"){
            //console.log(task);
            append(task);
            continue;
        };

        const subrules = include.split(";");
        const numberOfRules = subrules.length;
        for(j=0; j<numberOfRules-1; ++j){
            if (subrules[j].includes("week")){
                const weeklyRules = subrules[j].substring(5,).split(",");
                const numberOfRules = weeklyRules.length;
                for(k=0; k<numberOfRules; ++k){
                    if(weeklyRules[k] == day){
                        valid = true;
                        break;
                    };
                };
            };
            if (subrules[j].includes("month")){
                const monthlyRules = subrules[j].substring(6,).split(",");
                const numberOfRules = monthlyRules.length;
                for(k=0; k<numberOfRules; ++k){
                    if(monthlyRules[k] == date){
                        valid = true;
                        break;
                    };
                };
            };
            if (subrules[j].includes("year")){
                const yearlyRules = subrules[j].substring(5,).split(",")
                const numberOfRules = yearlyRules.length;
                for(k=0; k<numberOfRules; ++k){
                    if(yearlyRules[k].substring(0,2) == date && yearlyRules[k].substring(2,) == month){
                        valid = true;
                        break;
                    };
                };
            };
            if (subrules[j].includes("workingday") && !ph){
                const wdRules = subrules[j].substring(11,).split(",")
                const numberOfRules = wdRules.length;
                for(k=0; k<numberOfRules; ++k){
                    var numberOfPh = 1;
                    var numberOfWd = 0;
                    for(x=date - 1; x<date - day; --x){
                        for(y=0; y<Object.keys(phs).length; ++y){
                            if(phs[y]["date"] == x && phs[y]["month"] == month){
                                numberOfPh++;
                            };
                        };
                    };
                    numberOfWd = Number(day)-numberOfPh+1;
                    if(numberOfWd == wdRules[k]){
                        valid = true;
                        break;
                    }
                };
            };
            if (subrules[j].includes("lastday")){
                const ldRules = subrules[j].substring(8,).split(",");
                const numberOfRules = ldRules.length;
                for (k=0; k<numberOfRules; ++k){
                    for(x=0; x<months.length; ++x){
                        if(months[x] == month){
                            if(datesOfMonths[x]-Number(ldRules[k]) == date){
                                valid = true;
                                break;
                            };
                        };
                    };
                };
            };
            /*
            if(subrules[j].includes("ph")){
                const phRules = subrules[j].substring(3,);
                if(phRules[0] == "a"){
                    //To be edit
                }
                else if(phRules[0] == "b"){
                    //To be edit
                };
            };
            */

            if(subrules[j].includes("biweekly")){
                let bw = false;
                let numberOfDay = Number(date);
                for(k=0; k<months.length; ++k){
                     if(months[k] == month){numberOfDay-=firstWeek;break;}
                     else{numberOfDay += datesOfMonths[k];};
                };
                if(numberOfDay/7%2 == 0){bw=true;};
                if(bw){
                    const bwRules = subrules[j].substring(9,).split(",");
                    const numberOfRules = bwRules.length;
                    for(k=0; k<numberOfRules; ++k){
                        if(bwRules[k] == day){
                            valid = true;
                            break;
                        }
                    };
                };
            };
        };
        if(exclude){
            const subConstraints = exclude.split(";");
            const numberOfConstraint = subConstraints.length;
            for(j=0; j<numberOfConstraint-1; ++j){
                if (subConstraints[j].includes("ph") && ph){
                    valid = false;
                    break;
                };
                if (subConstraints[j].includes("week")){
                    const weeklyRules = subConstraints[j].substring(5,).split(",");
                    const numberOfRules = weeklyRules.length;
                    for(k=0; k<numberOfRules; ++k){
                        if(weeklyRules[k] == day){
                            valid = false;
                            break;
                        };
                    };
                };
                if (subConstraints[j].includes("month")){
                    const monthlyRules = subConstraints[j].substring(6,).split(",");
                    const numberOfRules = monthlyRules.length;
                    for(k=0; k<numberOfRules; ++k){
                        if(monthlyRules[k] == date){
                            valid = false;
                            break;
                        };
                    };
                };
                if (subConstraints[j].includes("year")){
                    const yearlyRules = subConstraints[j].substring(5,).split(",")
                    const numberOfRules = yearlyRules.length;
                    for(k=0; k<numberOfRules; ++k){
                        if(yearlyRules[k].substring(0,2) == date && yearlyRules[k].substring(2,) == month){
                            valid = false;
                            break;
                        };
                    };
                };
                if (subConstraints[j].includes("workingday") && ph){
                    const wdRules = subConstraints[j].substring(11,).split(",")
                    const numberOfRules = wdRules.length;
                    for(k=0; k<numberOfRules; ++k){
                        var numberOfPh = 1;
                        var numberOfWd = 0;
                        for(x=date - 1; x<date - day; --x){
                            for(y=0; y<Object.keys(phs).length; ++y){
                                if(phs[y]["date"] == x && phs[y]["month"] == month){
                                    numberOfPh++;
                                };
                            };
                        };
                        numberOfWd = Number(day)-numberOfPh+1;
                        if(numberOfWd == wdRules[k]){
                            valid = true;
                            break;
                        }
                    };
                };
            };
        };
        //Speical Cases
        if(include == "SC1"){
            if(day == "2" && date != "28" && month != "Jan"){
                valid = true;
                break;
            };
            if(date == "29" && month == "Jan"){
                valid = true;
                break;
            }
        };
        //2Jan 29Jan 6Apr 14Apr 2May 26Jun 2Jul 3Oct 28Dec
        if(include == "SC2"){
            if((day == "2" || day == "29") & month == "Jan"){
                valid = true;
                break;
            };
            if((day == "6" || day == "14") & month == "Apr"){
                valid = true;
                break;
            };
            if((day == "2") & month == "May"){
                valid = true;
                break;
            };
            if((day == "26") & month == "Jun"){
                valid = true;
                break;
            };
            if((day == "2") & month == "Jul"){
                valid = true;
                break;
            };
            if((day == "3") & month == "Oct"){
                valid = true;
                break;
            };
            if((day == "28") & month == "DEC"){
                valid = true;
                break;
            }
        };
        //Eliminating the selected one-off Tasks
        if(valid && task["Rules"][task["Rules"].length - 1] == "@"){
            
            var OOJson = fs.readFileSync('./json/scheduler.json', 'utf8');
            OOJson = JSON.parse(OOJson);
            OOJson.splice(i,1);
            fs.writeFileSync("./scheduler.json", JSON.stringify(OOJson), 'utf8');

            console.log("delete");
        };
        //Append the task to ToDoList.json
        if(valid){
            //console.log(task);
            append(task);
        };
    };
};