/* Close button for alerts */
/* to start support close button in alerts you need to add
<span class="alert-close" data-close="alert" title="Close">&times;</span>
into alert div and include this file to your template */
var close = document.querySelectorAll('[data-close="alert"]');
for (var i = 0; i < close.length; i++) {
    close[i].onclick = function(){
        var div = this.parentElement;
        div.style.opacity = '0';
        setTimeout(function(){div.style.display = 'none';}, 400);
    }
}
