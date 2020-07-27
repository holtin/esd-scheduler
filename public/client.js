console.log('client running');

$("#datepicker-submit").on("click", function() {
    var strDate = $("#datepicker").val();
    var datepicker = new Date(strDate);
    fetch('/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            date : {
                fullDate : strDate,
                day : datepicker.getDate(),
                month : datepicker.getMonth()+1,
                year : datepicker.getFullYear(),
                weekday : datepicker.getDay()
            }
        })
    });
    document.getElementById("feedback").innerHTML = "<h3>Generated a report for " + strDate + "!</h3>"
    console.log("client sent date " + strDate + " to server");

    /*
    var xhr = new XMLHttpRequest();
    var data = {
        param1: datepicker
    };
    xhr.open('POST', '/data');
    xhr.onload = function(data) {
        console.log('loaded', this.responseText);
    };
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(data));
    */
});