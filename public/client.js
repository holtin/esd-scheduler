console.log('Client-side code running');

$("#datepicker-submit").on("click", function() {
    var datepicker = $("#datepicker").val();

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

});