import MediaPlayerLoader from './media-player-loader.js';
import Utils from './utils.js';

class MediaPlayer extends HTMLElement {

    static observedAttributes = [];

    #mpl;

    constructor () {
        super();

        const shadow = this.attachShadow({ mode: "open" });

        const videoElement = document.createElement("video");
        videoElement.setAttribute("class", `video-${this.className}`);
        videoElement.setAttribute("id", `video-${this.id}`);
        videoElement.setAttribute("controls", "");

        const videoElementStyle = document.createElement("style");
        videoElementStyle.textContent = `
            #${videoElement.getAttribute("id")} {
                width: 100%;
                border: 2px solid #000000;
                border-radius: 8px;
            }
        `;

        shadow.appendChild(videoElementStyle);
        shadow.appendChild(videoElement);

        const mplConfig = {
            autoPlay: this.getAttribute("autoPlay"),
            startTimestampEpoch: this.getAttribute("startTimestampEpoch"),
            durationSec: this.getAttribute("durationSec"),
            segmentDurationSec: this.getAttribute("segmentDurationSec"),
            webSocketURL: this.getAttribute("webSocketURL"),
        };

        this.#mpl = new MediaPlayerLoader(videoElement, mplConfig);
    }

    connectedCallback () {
        console.log("media-player element added to page.");
        this.addEventListener("start", (e) => {
            this.#mpl.init();
        }, false);
        this.addEventListener("stop", (e) => {
            this.#mpl.destroy();
        }, false);
    }
    
    disconnectedCallback () {
        console.log("media-player element removed from page.");
        this.#mpl.destroy();
    }
    
    adoptedCallback () {
        console.log("media-player element moved to new page.");
    }
    
    attributeChangedCallback (name, oldValue, newValue) {
        console.log(`media-player attribute ${name} has changed from ${oldValue} to ${newValue}.`);
    }
}

window.customElements.define("media-player", MediaPlayer);