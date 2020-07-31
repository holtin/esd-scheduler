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
        }),
        success: console.log("client sent date " + strDate + " to server")
    })
        .then(data => console.log(data));

    let fileName = 'VALID V Daily Job Schedule.docx';
    let feedback = '<div class="row border mx-auto px-2 py-2 my-2"><div class="col-9 py-2">' + fileName;
    feedback += '</div><div class="col-3"><a href="' + fileName;
    feedback += '" class="btn btn-success">Download</a></div></div>';
    document.getElementById("forms").innerHTML = feedback;
});