$(document).ready(function() { 
    $(".media-player").each(function () {
        let button = $("<button></button>").attr("class", "btn_" + $(this).attr("class")).attr("id", "btn_" + $(this).attr("id")).attr("type", "button").text("Start");
        button.click(() => {
            if (button.text() === "Start") {
                button.text("Stop");
                $(this)[0].dispatchEvent(new Event("start"));
            } else if (button.text() === "Stop") {
                button.remove();
                // $(this)[0].dispatchEvent(new Event("stop"));
                $(this).remove();
            }
        });
        $(this).after(button);
    });
});

// logger: proper level, auto add id for ws and vp
// network from mp to mpl