window.addEventListener("resize", toggleLogo);
window.addEventListener("DOMContentLoaded", toggleLogo);

let lrw = window.matchMedia("(max-width: 735px)");
let law = window.matchMedia("(min-width: 735px)");

function toggleLogo(){
    document.getElementById("logo-mobile").classList.remove("hidden");
    document.getElementById("logo-desktop").classList.remove("hidden");

    console.log("toogle")
    if (lrw.matches) {
        console.log("lrw.matches")
        document.getElementById("logo-mobile").classList.remove("hidden");
        document.getElementById("logo-desktop").classList.add("hidden");
    }
    else if (law.matches) {
        console.log("law.matches")
        document.getElementById("logo-mobile").classList.add("hidden");
        document.getElementById("logo-desktop").classList.remove("hidden");
    }
}