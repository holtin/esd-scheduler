console.log('client running');
document.getElementById("defaultOpen").click();

function printFile(fileName) {
    console.log("issued command to print " + fileName);
}

function openLocationPage(pageName, element) {
    let i, locationContent, navLinks;
    locationContent = document.getElementsByClassName("location-content");
    for (i = 0; i < locationContent.length; i++) {
        locationContent[i].style.display = "none";
    }

    navLinks = document.getElementsByClassName("nav-link");
    for (i = 0; i < navLinks.length; i++) {
        navLinks[i].style.fontWeight = 400;
        navLinks[i].style.borderWidth = "0px";
        navLinks[i].classList.remove("active");
    }

    document.getElementById(pageName).style.display = "block";
    element.classList.add("active");
    element.style.fontWeight = 700;
    element.style.borderWidth = "10px";
}

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
            forms: [""],
            location: [""]
        },
        dataType: 'json',
    }).done((data) => {
        console.log(data);
        document.getElementById("forms").innerHTML = '<h5 class="text-center">[' + strDate + ']</h5>';

        for (let i = 0; i < data.forms.length; ++i) {
            let fileName = data.forms[i];
            let feedback = '<div class="row border mx-auto px-2 py-2 my-2">';
            feedback += '<div class="col-9 py-2">' + fileName.split(".")[0] + '</div>';
            feedback += '<div class="col-3"><a href="' + './doc/' + fileName + '" class="btn btn-success w-100 px-0 text-center">Download</a></div>';
            //feedback += '<div class="col-3"><a onclick="printFile(\'./doc/'+ fileName + '\')" class="btn btn-primary w-100 px-0 text-center text-light">Print (Disabled)</a></div>';
            feedback += '</div>';
            document.getElementById("forms").innerHTML += feedback;
        }

        let SCC = data.location[0].SCC;
        let PCC = data.location[1].PCC;
        let feedback = '';
        let empty = false;
        for (let i = 0; i < PCC.length; ++i) {
            let key = Object.keys(PCC[i])[0];
            if (PCC[i][key].length == 0) continue;
            feedback += '<div class="location-box my-3 px-3 py-3">';
            feedback += '<h5>' + Object.keys(PCC[i])[0] + '</h5>';
            feedback += '<div class="row">';
            for (let j = 0; j < PCC[i][key].length; ++j) {
                feedback += '<div class="col-md"><ul>';
                for (let k = 0; k < PCC[i][key][j].length; ++k) {
                    feedback += '<li>'+ PCC[i][key][j][k] + '</li>';
                }
                feedback += '</ul></div>';
            }
            feedback += '</div></div>';
        }
        document.getElementById("pcc").innerHTML = feedback;
        feedback = '';
        empty = true;
        for (let i = 0; i < SCC.length; ++i) {
            let key = Object.keys(SCC[i])[0];
            if (SCC[i][key].length == 0) continue;
            empty = false;
            feedback += '<div class="location-box my-3 px-3 py-3">';
            feedback += '<h5>' + Object.keys(SCC[i])[0] + '</h5>';
            feedback += '<div class="row">';
            for (let j = 0; j < SCC[i][key].length; ++j) {
                feedback += '<div class="col-md"><ul>';
                for (let k = 0; k < SCC[i][key][j].length; ++k) {
                    feedback += '<li>'+ SCC[i][key][j][k] + '</li>';
                }
                feedback += '</ul></div>';
            }
            feedback += '</div></div>';
        }
        if (empty) {
            feedback += '<h5 class="text-center">No tapes here</h5>';
        }
        document.getElementById("scc").innerHTML = feedback;
    });
});