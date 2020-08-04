console.log('client running');

$("#datepicker-submit").on("click", function () {
    var strDate = $("#datepicker").val();
    var datepicker = new Date(strDate);

    $.ajax({
        url: '/',
        type: 'POST',
        data: {
            fullDate: strDate,
            day: datepicker.getDate(),
            month: datepicker.getMonth() + 1,
            year: datepicker.getFullYear(),
            weekday: datepicker.getDay(),
            forms: [""]
        },
        dataType: 'json',
    }).done(function (data) {
        //data.forms.splice(0, 1);
        console.log(data);
        document.getElementById("forms").innerHTML = '<h5 class="text-center">[' + strDate + ']</h5>';

        for (let i = 0; i < data.forms.length; ++i) {
            let fileName = data.forms[i];
            let feedback = '<div class="row border mx-auto px-2 py-2 my-2"><div class="col-9 py-2">' + fileName;
            feedback += '</div><div class="col-3"><a href="' + './doc/' + fileName;
            feedback += '" class="btn btn-success">Download</a></div></div>';
            document.getElementById("forms").innerHTML += feedback;
        }
    });
});