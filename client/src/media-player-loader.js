import Utils from './utils.js';
import WebSocketLoader from './web-socket-loader.js';

class MediaPlayerLoader {

    #element;

    #mediaSource;
    #sourceBuffer;
    #msDuration;
    #sbTimestampOffset;

    #autoPlay;
    #isPaused;
    #startTimestampEpoch;
    #durationSec;
    #endTimestampEpoch;
    #segmentDurationSec;

    #wsl;

    constructor (element, config) {
        this.#element = element;
        console.log("constructing: ", this.id);
        this.#element.addEventListener('error', this.#handleEvent);
        this.#element.addEventListener('canplay', this.#handleEvent);
        this.#element.addEventListener('pause', this.#handleEvent);
        this.#element.addEventListener('play', this.#handleEvent);

        this.#mediaSource = null;
        this.#sourceBuffer = null;

        this.#autoPlay = Utils.isNotNull(config.autoPlay);
        this.#isPaused = !this.#autoPlay;

        this.#startTimestampEpoch = Number(config.startTimestampEpoch);
        this.#durationSec = Number(config.durationSec);
        this.#endTimestampEpoch = this.#startTimestampEpoch + this.#durationSec - 1;
        // currentTimestamp = startTimestamp;
        this.#segmentDurationSec = Number(config.segmentDurationSec);

        this.#sbTimestampOffset = -1 * this.#startTimestampEpoch;
        this.#msDuration = this.#durationSec;

        this.#wsl = WebSocketLoader.getInstance(config.webSocketURL);
        this.#wsl.registerMPL(this);
    }

    get id () {
        return this.#element.id;
    }

    #handleEvent = (event) => {
        console.log(this.id, ":", event);

        if (event.type === 'error') {

        } else if (event.type === 'canplay') {
            if (this.#autoPlay && !this.#isPaused) {
                this.#element.play();
            }
        } else if (event.type === 'pause') {
            this.#isPaused = true;
        } else if (event.type === 'play') {
            this.#isPaused = false;
        } else {
            console.log(this.id, ": unhandled:", event.type);
        }
    }

    init = () => {
        if (!this.#wsl.isOpen()) {
            console.log("WebSocket is not open");
            return;
        }

        this.#mediaSource = new MediaSource();

        this.#element.src = URL.createObjectURL(this.#mediaSource);

        this.#mediaSource.addEventListener("sourceopen", () => {
            console.log(this.id, ": media-source is open");
            const mimeCodec = 'video/mp4; codecs="avc1.640028"';
            this.#sourceBuffer = this.#mediaSource.addSourceBuffer(mimeCodec);
            console.log(this.id, ": source-buffer added:", mimeCodec);

            this.#mediaSource.duration = this.#msDuration;
            this.#sourceBuffer.timestampOffset = this.#sbTimestampOffset;

            this.#sourceBuffer.addEventListener("updateend", () => {
                // mediaSource.endOfStream();
                // video.play();
                // console.log(this.id + " " + this.mediaSource.readyState);
            });

            // video.addEventListener('timeupdate', checkBuffer);

            this.#sourceBuffer.addEventListener("error", (e) => {
                console.log("SourceBuffer error:", e);
            });

            this.#wsl.send(this, {
                type: "segment",
                segment: this.#startTimestampEpoch.toString() + ".m4s"
            });
            // currentTimestamp++;
        });

        this.#mediaSource.addEventListener("sourceended", () => {
            console.log(this.id, ": media-source ended");
        });
    }

    destroy = () => {
        this.#wsl.unregisterMPL(this);

        if (this.#mediaSource) {
            if (this.#sourceBuffer) {
                if (!this.#sourceBuffer.updating) {
                    try {
                        this.#sourceBuffer.remove(0, this.#mediaSource.duration);
                        console.log(this.id, ": cleared source-buffer");
                    } catch (e) {
                        console.log(this.id, ": Error clearing SourceBuffer:", e);
                    }
                }
                this.#sourceBuffer = null;
            }
            this.#mediaSource = null;
            console.log(this.id, ": media-source deinitialized");
        }

        this.#element.src = "";
    }

    onWSMessage = ({json, data}={}) => {
        if (Utils.isUndefined(data)) {
            console.log(this.id, ": JSON message received: ", json);
        } else {
            console.log(this.id, ": Received media segment (ArrayBuffer)");

            if (!this.#sourceBuffer || this.#sourceBuffer.updating) {
                console.log(this.id, ": SourceBuffer is not ready or updating");
                return;
            }

            try {
                this.#sourceBuffer.appendBuffer(data);
                console.log(this.id, ": Appended segment");
            } catch (e) {
                console.log(this.id, ": Error appending segment:", e);
            }

            // if(current <= end){
            //     ws.send({
            //         type: "segment",
            //         segment: current.toString().padStart(3, '0') + ".m4s"
            //     });
            // }

            // current++;
        }
    }
}

export default MediaPlayerLoader;