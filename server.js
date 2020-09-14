const fs = require("fs");
const carbone = require("carbone");
const express = require("express");
const app = express();
const port = 3000;

//custom input json files
const schedulerPath = "./json/scheduler.json";
const oneOffPath = "./json/oneOff.json";
const phPath = "./json/ph.json";

//tmp file for storing the tasks of a given date
const todoPath = "./tmp/toDoList.json";

const pps_path = './json/tape_inventory/PPS.json';
const v5_path = './json/tape_inventory/V5.json';
const vrms_path = './json/tape_inventory/VRMS.json';

//tmp json file for tape checklist
const OTCL_path = './tmp/forms/OTCL.json';

//tmp json file for tape location offset?
//should be useless
const delivery_path = './tmp/forms/tape_delivery.json';

//tmp json file for displaying the tape location
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

//global variables

var forms = [];
var selectDate=new Date();
var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var datesOfMonths=[31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var dateArray;
var sday,smonth,syear,sweekday;
var scheduler,oneOff,phs,pps,v5,vrms;
var isPh =false;
var numOfWeek=0;

app.use(express.static(__dirname + "/public"));
app.listen(port);
console.log("server running on port " + port);

app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json()); // Parse JSON bodies (as sent by API clients)
app.post('/', function (req, res) { // Access the parse results as req.body
    var date = req.body;
	
	//load the json files
    scheduler = require(schedulerPath);
    oneOff = require(oneOffPath);
	phs = require(phPath);
	pps = require(pps_path);
    v5 = require(v5_path);
    vrms = require(vrms_path);    

	//init the date setting by the given date
	dateSetting(date);
	//reset the form
    forms = [];
	
    if (date.weekday == 0) forms.push(stockCheckList_resultPath.split("/")[3]);
    filteringForTaskScheduler(scheduler, true);    
    filteringForTaskScheduler(oneOff, false);    
    sortTodo();
    var todo = fs.readFileSync(todoPath, 'utf8');
    todo = JSON.parse(todo);
    todo[0].date = date;
    console.log("number of tasks: " + todo[0].tasks.length);
	//generate the schedule word file
    carbone.render(schedule_templatePath, todo, function (err, result) {
        if (err) return console.log(err);
        fs.writeFileSync(resultPath, result);
        console.log("server generated schedule with date " + date.fullDate);
    });
    forms.push(resultPath.split("/")[3]);

	//------------------------------------------------------------------------------------------
	//show the tape location table and prepare tape checklist form
    prepareTapeLocation();

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

//=======================functions for date handling==============================
function checkPH(date){
	for (let i = 0; i < Object.keys(phs).length; ++i) {
        if ((phs[i]["date"] == date.getDate() && phs[i]["month"] == months[date.getMonth()]) ) {
            return true;			      
        };    
	}
	return false;
}

function dateSetting(date){

    selectDate= new Date(date.year,date.month-1,date.day);		
    dateArray = [date.day, months[date.month - 1], date.year, date.weekday]; //[day, month, year, weekday]	
	sday=date.day;
	smonth=months[date.month - 1];
	syear=date.year;
	sweekday= date.weekday;
    if (leapYear(syear)) datesOfMonths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	
	//check if the date is public holiday
	isPh=checkPH(selectDate);
	
	//set number of week of the year by the given date
	numOfWeek = ISO8601_week_no(selectDate);

}

function leapYear(year){
  return ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0);
}

//returning the number of week of the year
function ISO8601_week_no(dt) {
     var tdt = new Date(dt.valueOf());
     var dayn = (tdt.getDay() + 6) % 7;
     tdt.setDate(tdt.getDate() - dayn + 3);
     var firstThursday = tdt.valueOf();
     tdt.setMonth(0, 1);
     if (tdt.getDay() !== 4) 
       {
      tdt.setMonth(0, 1 + ((4 - tdt.getDay()) + 7) % 7);
        }
     return 1 + Math.ceil((firstThursday - tdt) / 604800000);
        }

function lastSundayOfSelectedMonth(month) {

	var date= new Date();
	date.setFullYear(syear, month, datesOfMonths[month]);
	date.setDate(date.getDate() - date.getDay());
	date.setHours(0,0,0,0);	
	return date;
}

//===============functions for the scheduler=========================

//return true if the date meet the rule in json file
function mappingTheRule(rule){
			if(rule.includes("ph"))
			{
				if(isPh || sweekday==0)
					return true;
			}
	
	       if (rule.includes("week")) {
                var weeklyRules = rule.substring(5,).split(",");
                for (let k = 0; k < weeklyRules.length; ++k) {
                    if (parseInt(weeklyRules[k]) == parseInt(sweekday)) {
                        return true;
                       
                    };
                };
            };
            if (rule.includes("month")) {
                var monthlyRules = rule.substring(6,).split(",");
                for (let k = 0; k < monthlyRules.length; ++k) {
                    if (parseInt(monthlyRules[k]) == parseInt(sday)) {					
                        return true;
                    };
                };
            };
            if (rule.includes("year")) {
                var yearlyRules = rule.substring(5,).split(",");          
                for (let k = 0; k < yearlyRules.length; ++k) {
					 var yearlydate = yearlyRules[k].split("-");
                    if (parseInt(yearlydate[0]) == sday && yearlydate[1] == smonth) {
						if( !yearlydate[2])
						{							
							return true;
						} else
						{
							if( yearlydate[2] == syear)
							{						
								return true;
							}
						}

                    };
                };
            };
		
			
			if (rule.includes("1stworkingdayAfterSun")) {				
				//first working after every sunday
				if(!isPh)
				{					
					var yesterday = new Date(selectDate);
					yesterday.setDate(yesterday.getDate()-1);
				
					while(checkPH(yesterday)||yesterday.getDay()==0)
					{						
						if(yesterday.getDay()==0)
						{							
							return true;						
						}
						yesterday.setDate(yesterday.getDate()-1);	
					}					
				}
            };
            if (rule.includes("lastday")) {
                var ldRules = rule.substring(8,).split(",");
                for (let k = 0; k < ldRules.length; ++k) {
                    for (let x = 0; x < months.length; ++x) {
                        if (months[x] == smonth) {
                            if (datesOfMonths[x] - Number(ldRules[k]) + 1 == sday) {
							return true;
                            };
                        };
                    };
                };
            };

            if (rule.includes("biweekly")) {                				
	
                if (numOfWeek % 2 == 1) 
				 {					 
                    const bwRules = rule.substring(9,).split(",");
                    for (let k = 0; k < bwRules.length; ++k) {
                        if (bwRules[k] == sweekday) {							
                            return true;
                        }
                    };
                };
            };
			
			return false;
 
}

//Based on the rules, to sort out the tasks of given date into a tmp json file for output
function sortTodo() {
    var final = fs.readFileSync(todoPath, 'utf8');
    final = JSON.parse(final);
    final[0].tasks.sort(getSortOrder("StartTime"));
    fs.writeFileSync(todoPath, JSON.stringify(final), 'utf8');
}

//sorting order function for sort to do function
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

//append the tasks for a given date to a tmp json file called todolist.json in the filtering function
function appendTaskToScheduler(task) {

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

//to filter the tasks of a given date by the defined rules (schedule or one-off)
function filteringForTaskScheduler(data, first_loaded) {
    
    var numberOfData = Object.keys(data).length;
 
//init the json file for first loading 
    if (first_loaded) {
        var reset = fs.readFileSync(todoPath, 'utf8');
        reset = [{ "tasks": [] }];
        fs.writeFileSync(todoPath, JSON.stringify(reset), 'utf8');
    };

//for each task, processing		
    for (let i = 0; i < numberOfData; ++i) {
        var task = data[i];
		
        var rules = task["Rules"].split("?");
        var include = rules[0];
        var exclude = rules[1];
        var metTheRule = false;

		//append daily task
        if (include.substring(0, 5) == "daily") {
            appendTaskToScheduler(task);
        };

        var subrules = include.split(";");
        var numberOfRules = subrules.length;
		
		// for each rule of the task, check and append
        for (let j = 0; j < numberOfRules - 1; ++j) {
			//map all included rules, except daily rules or special cases
			metTheRule = mappingTheRule(subrules[j]);
			if(metTheRule)
				break;
		};
		
		
        //Special Cases
		//SC1 : Every Tuesday, if tuesday is ph, then the next working day
        if (include == "SC1") {
			if(sweekday==2 && !isPh)
			{
				//today is tuesday and not a ph, met the rule
				metTheRule=true;
			}else
			{
				//check if today is a PH or sunday, if so, then skip
				if(!isPh && sweekday!=0)
				{
					var yesterday = new Date(selectDate);
					yesterday.setDate(yesterday.getDate()-1);	
					while(checkPH(yesterday)||yesterday.getDay()==0)
					{
						if(yesterday.getDay()==2)
						{
							metTheRule=true;
							break;
						}
						yesterday.setDate(yesterday.getDate()-1);	
					}
				}				
			}
        }
        //2Jan 29Jan 6Apr 14Apr 2May 26Jun 2Jul 3Oct 28Dec
        if (include == "SC2") {
			//today is a working day
			if(!isPh && sweekday!=0)
			{
				var yesterday = new Date(selectDate);
				yesterday.setDate(yesterday.getDate()-1);
				//check if yesterday was a sunday, go back one day
				if(yesterday.getDay()==0)
				{
					yesterday.setDate(yesterday.getDate()-1);
				}				
				if(checkPH(yesterday))
				{
					//if yesterday is a PH, loop to last working day , such as not a PH or Sunday
					do{
						yesterday.setDate(yesterday.getDate()-1);
						console.log('check yesterday' + yesterday);
					}while(checkPH(yesterday) || yesterday.getDay()==0)
					//if last working day is not sat, then meet
					if(yesterday.getDay!=6)
					{
						metTheRule=true;						
					}					
				}
				//if yesterday is not a holiday or sunday, skip
			}
        };
        //SC3 : the next day of last sunday of each month
        if (include == "SC3") {
			//only match for monday			
			if(sweekday==1)
			{				
				var thisMonthLastSunday = lastSundayOfSelectedMonth(selectDate.getMonth());
				var lastMonthLastSunday = lastSundayOfSelectedMonth(selectDate.getMonth()-1);
				thisMonthLastSunday.setDate(thisMonthLastSunday.getDate()+1);
				lastMonthLastSunday.setDate(lastMonthLastSunday.getDate()+1);

				if(selectDate.getDate()==thisMonthLastSunday.getDate() || (selectDate.getDate()==lastMonthLastSunday.getDate()&& selectDate.getMonth()==lastMonthLastSunday.getMonth()))
				{					
					metTheRule=true;
				}					
			}		
        };
     
		//if excluded rule exists and the regular rule met, check one by one
        if (metTheRule && exclude) {			
            var subConstraints = exclude.split(";");
            var numberOfConstraint = subConstraints.length;
            for (let j = 0; j < numberOfConstraint - 1; ++j) {
				metTheRule=!mappingTheRule(subConstraints[j]);
				if(!metTheRule)
					break;
			};
        };

        //Append the task to ToDoList.json
        if (metTheRule) {
            appendTaskToScheduler(task);
        };
    };
};

//==========================function for the tape checklist form====================================

//function for appending the tapes checklist into a tmp json file called OTCL.json for the tape checklist file 
function appendToTapeChecklist(task, path, destination, type, freq) {

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

//=============================function for the tape location table==================================

//function for appending the tapes location into a tmp json file called tape_location.json for the tape table
function appendToTapeLocationTable(title, task, destination) {

    var oriJson = fs.readFileSync(location_path, 'utf8');
    oriJson = JSON.parse(oriJson);
    var to_append = { [title]: task };
    if (destination == "SCC") {
        oriJson[0]["SCC"].push(to_append);
    }
    else if (destination == "PCC") {
        oriJson[1]["PCC"].push(to_append);
    };
    fs.writeFileSync(location_path, JSON.stringify(oriJson), 'utf8');
}

function resetFileForTapeLocation(){

    var reset_1 = fs.readFileSync(OTCL_path, 'utf8');
    reset_1 = [{ "weekly": [{ "V5": [] }, { "PPS": [] }, { "VRMS": [] }, { "Copy": [] }] }, { "monthly": [] }];
    fs.writeFileSync(OTCL_path, JSON.stringify(reset_1), 'utf8');

    var reset_2 = fs.readFileSync(delivery_path, 'utf8');
    reset_2 = [];
    fs.writeFileSync(delivery_path, JSON.stringify(reset_2), 'utf8');

    var reset_3 = fs.readFileSync(location_path, 'utf8');
    reset_3 = [{ "SCC": [] }, { "PCC": [] }];
    fs.writeFileSync(location_path, JSON.stringify(reset_3), 'utf8');	
}

//handle all weekly tapes
function tapeLocationForWeekly(task,numberOfTapesSet,destination,offset,boffset,SysName){
    //offset=2;
	var tapesInPCC = [];
	var tapesInSCC = [];	
	var toSCCForm,toPCCForm;
	
	//tape would be sent on every monday for all systems
	//if given date is a sunday, it counts for the last week
	var numberOfMon =numOfWeek;
	if(sweekday==0){ 
	var yesterday=new Date(selectDate);
		yesterday.setDate(selectDate.getDate()-1);
		numberOfMon = ISO8601_week_no(yesterday);
	}	
	
	//which set of tape would be sent out and came back
	var base =numberOfMon % numberOfTapesSet;
	var tapeSent = (base + offset)%numberOfTapesSet;
	var tapeNext = (tapeSent+1)%numberOfTapesSet;
	var tapeBack = (tapeSent + boffset)%numberOfTapesSet;
	
	
	if(destination== "SCC")
	{
		//send to SCC
		//for each tapes set, mark the location				
		for(var k=0;k<numberOfTapesSet;k++)
		{
			if(SysName=='V5')
			{
				//if VALID, keep 1 set in SCC, where the rest in PCC
				if(tapeSent==k)
					tapesInSCC.push(task["Tapes"][k]);
				else
					tapesInPCC.push(task["Tapes"][k]);						
			}else
			{
				//for PPS and VRMS,only tapeBack and next week tape in PCC, the rest are in SCC
				if(k==tapeBack || k==tapeNext)									
					tapesInPCC.push(task["Tapes"][k]);
				else										
					tapesInSCC.push(task["Tapes"][k]);						
			}
		}		
		toSCCForm = (task["Tapes"][tapeSent]);
		toPCCForm = (task["Tapes"][tapeBack]);		
	}else
	{
		//to PCC
		//only VALID will offsite to PCC, not need to take care other system
		for(var k=0;k<numberOfTapesSet;k++)
		{
			if(tapeSent==k)
			{
				//send to PCC
				tapesInPCC.push(task["Tapes"][k]);
			}else
			{
				//keep in SCC
				tapesInSCC.push(task["Tapes"][k]);
			}
		}		
		toPCCForm = (task["Tapes"][tapeSent]);
		toSCCForm = (task["Tapes"][tapeBack]);		
	}	

	appendToTapeLocationTable(task["Title"], tapesInPCC,  "PCC");
	appendToTapeLocationTable(task["Title"], tapesInSCC,  "SCC");
	appendToTapeChecklist(toSCCForm, OTCL_path, "SCC", SysName, 'weekly');
	appendToTapeChecklist(toPCCForm, OTCL_path, "PCC", SysName, 'weekly');			

}

//handle all monthly tapes
function tapeLocationForMonthly(task,numberOfTapesSet,destination,offset,boffset,SysName){
	//offset=1;
	var numberOfMonth = selectDate.getMonth()+1;
	var sendToSCC=[];
	var sendToPCC=[];
	var base=numberOfMonth%numberOfTapesSet;
	var toSCCForm,toPCCForm;
	
	if(SysName=='V5')
	{
		//monthly tape will be dispatched on first monday after 1st day.
		//rules for VALID only
		if(sday<=7)
		{		
			var weekday = sweekday;
			if(weekday==0)
				weekday=7;
			if(sday-weekday<1)
			{
				//not delivered, count back to last month
				base=base-1;
				if(base==-1)
					base=numberOfTapesSet-1;
			}
		}	
	}else
	{
		//for PPS and VRMS, the tape would be dispatched on the next day of last sunday of the month
		var dispatchDate = lastSundayOfSelectedMonth(selectDate.getMonth());
		dispatchDate.setDate(dispatchDate.getDate()+1);
		//dispatchDate.setHours(0,0,0,0)
		if(selectDate<dispatchDate)
		{	
			base=base-1;
			if(base==-1)
				base=numberOfTapesSet-1;
		}		
		
	}

	
	//which set of tape would be sent out and came back
	var tapeSent = (base + offset)%numberOfTapesSet;
	var tapeBack = (tapeSent +boffset)%numberOfTapesSet;
	//console.log(task["Title"]);
	//console.log('tape sent ' +tapeSent);
	//console.log('tape back ' +tapeBack);
	if(destination=='SCC')
	{
		//to SCC
		for (var i=0;i<numberOfTapesSet;i++)
		{
			if(tapeSent==i)
			{
				sendToSCC.push(task["Tapes"][i]);
			}else
			{
				sendToPCC.push(task["Tapes"][i]);
			}
		}
		toSCCForm = (task["Tapes"][tapeSent]);
		toPCCForm = (task["Tapes"][tapeBack]);	
	}else
	{	//to PCC
		for (i=0;i<numberOfTapesSet;i++)
		{
			if(tapeSent==i)
			{
				sendToPCC.push(task["Tapes"][i]);
			}else
			{
				sendToSCC.push(task["Tapes"][i]);
			}
		}
		toSCCForm = (task["Tapes"][tapeBack]);
		toPCCForm = (task["Tapes"][tapeSent]);	
	}
	appendToTapeLocationTable(task["Title"], sendToPCC,  "PCC");
	appendToTapeLocationTable(task["Title"], sendToSCC,  "SCC");
	appendToTapeChecklist(toSCCForm, OTCL_path, "SCC", "", 'monthly');
	appendToTapeChecklist(toPCCForm, OTCL_path, "PCC", "", 'monthly');
	     
}

function tapelocationArrangment(system,moffset,mboffset,woffset,wboffset,SysName){
	var numberOfTapesSet;
	//for each kind of Systems' tapes in the location json file
    for (let i = 0; i < Object.keys(system).length; ++i) {
        let task = system[i];
        let rules = task["Rules"].split("/");
        let rule = rules[0];
        let destination = rules[1];
		numberOfTapesSet=Object.keys(task["Tapes"]).length;

		//constant, just append
        if (rule == "constant") {            
            var to_be_append_location = [];
            for (let j = 0; j < Object.keys(task["Tapes"]).length; ++j) {
                to_be_append_location.push(task["Tapes"][j])
            };
            appendToTapeLocationTable(task["Title"], to_be_append_location,  "PCC");
        }

		//weekly backup tapes
        else if (rule == "weekly") {
			tapeLocationForWeekly(task,numberOfTapesSet,destination,woffset,wboffset,SysName);
        }
        else if (rule == "monthly") {            
			tapeLocationForMonthly(task,numberOfTapesSet,destination,moffset,mboffset,SysName);		
		}      
		
		else if (rule == "backup") {
			//only backup the tape to SCC??
			
            var month_number = "";
			month_number=(selectDate.getMonth()+1).toString();
			if(selectDate.getMonth()<9)
			{
				month_number='0'+month_number;
			}
            var to_be_append = (task["Tapes"][0]);
            to_be_append[0] = to_be_append[0].replace('YYYY', syear);
            to_be_append[0] = to_be_append[0].replace('MM', month_number);
            appendToTapeChecklist(to_be_append[0], OTCL_path, "SCC", 'backup', "weekly");
            //delivery_scc.push(year.toString() + month_number.toString());
        }
    };
	
}

function prepareTapeLocation() {

	//reset tape location files
	resetFileForTapeLocation();

	//handle VALID tape location
	tapelocationArrangment(v5,1,3,2,4,'V5');

	//handle VRMS tape location
	tapelocationArrangment(vrms,1,2,4,2,'VRMS');

	//handle PPS tape location
	tapelocationArrangment(pps,11,1,1,2,'PPS');

};

