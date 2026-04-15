// One shared tooltip for all charts. Positioned absolutely against the page.
class ChartTooltipSingleton {
    constructor() {
        this.el = document.createElement('div');
        this.el.className = 'chart-tooltip';
        this.el.hidden = true;
        document.body.appendChild(this.el);
    }
    show(html, event) {
        this.el.innerHTML = html;
        this.el.hidden = false;
        // Position relative to viewport; scroll offset baked in via pageX/Y.
        this.el.style.left = (event.pageX + 14) + 'px';
        this.el.style.top = (event.pageY + 14) + 'px';
    }
    move(event) {
        this.el.style.left = (event.pageX + 14) + 'px';
        this.el.style.top = (event.pageY + 14) + 'px';
    }
    hide() { this.el.hidden = true; }
}

export const chartTooltip = new ChartTooltipSingleton();
