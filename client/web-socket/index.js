$(document).ready(function() { 
    
    isDefined = (v) => {
        return typeof v !== 'undefined';
    }

    isUndefined = (v) => {
        return typeof v === 'undefined';
    }

    class WS {
        constructor (url) {
            this.vpDict = {};
            this.url = url;
            this.ws = null;
            this.resetReconnect();
        }

        static getInstance = (url) => {
            if (!WS.wsDict) {
                WS.wsDict = {};
            }
            if (!WS.wsDict[url]) {
                WS.wsDict[url] = new WS(url);
            }
            return WS.wsDict[url];
        }

        connect = () => {
            console.log(this.url, ": connecting web-socket");
            this.ws = new WebSocket(this.url);
            this.ws.binaryType = "arraybuffer";

            this.ws.onopen = this.onOpen;
            this.ws.onclose = this.onClose;
            this.ws.onerror = this.onError;
            this.ws.onmessage = this.onMessage;
        }

        disconnect = () => {
            console.log(this.url, ": disconnecting web-socket");
            this.shouldReconnect = false;
            if (this.ws != null) {
                this.ws.close();
                this.ws = null;
            } else {
                this.resetReconnect();
            }
        }

        reconnect = () => {
            console.log(this.url, ": reconnecting web-socket in", this.reconnectDelay / 1000, "seconds...");
            this.ws = null;
            this.reconnectTimeout = setTimeout(() => {
                if (this.shouldReconnect) {
                    this.backoffReconnectDelay();
                    this.connect();
                }
            }, this.reconnectDelay);
        }

        resetReconnect = () => {
            if (isDefined(this.reconnectTimeout) && this.reconnectTimeout != null) {
                clearTimeout(this.reconnectTimeout);
            }
            this.shouldReconnect = true;
            this.reconnectDelay = 1000;
            this.reconnectTimeout = null;
        }

        backoffReconnectDelay = () => {
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        }

        onOpen = () => {
            console.log("WebSocket connected");
            this.resetReconnect();
        }

        onClose = () => {
            console.log("WebSocket disconnected");
            if (this.shouldReconnect) {
                this.reconnect();
            } else {
                this.resetReconnect();
            }
        }

        onError = (error) => {
            console.log("WebSocket error:", error);
        }

        onMessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                try {
                    const json = JSON.parse(new TextDecoder("utf-8").decode(event.data.slice(0, 100)));
                    const data = new Uint8Array(event.data.slice(100));
                    this.ifVPExists(this.client(json), (vp) => {
                        vp.onWSMessage({
                            json: json,
                            data: data
                        });
                    });
                } catch (e) {
                    console.log("Error reading received message (ArrayBuffer):", e);
                }
            } else {
                try {
                    const json = JSON.parse(event.data);
                    this.ifVPExists(this.client(json), (vp) => {
                        vp.onWSMessage({
                            json: json
                        });
                    });
                } catch (e) {
                    console.log("Unknown message received:", event.data);
                }
            }
        }

        isOpen = () => {
            return (this.ws != null && this.ws.readyState === this.ws.OPEN);
        }
        
        send = (vp, json) => {
            json["client"] = vp.id();
            this.ws.send(JSON.stringify(json));
        }

        registerVP = (vp) => {
            if (Object.keys(this.vpDict).length === 0) {
                this.connect();
            }
            this.vpDict[vp.id()] = vp;
        }

        unregisterVP = (vp) => {
            delete this.vpDict[vp.id()];
            if (Object.keys(this.vpDict).length === 0) {
                this.disconnect();
            }
        }

        vp = (id) => {
            return this.vpDict[id];
        }

        vpExists = (id) => {
            return isDefined(this.vp(id));
        }

        ifVPExists = (id, cb) => {
            if (this.vpExists(id) === false) {
                console.log("VP client id not exists:", id);
                return;
            }
            cb(this.vp(id));
        }

        client = (json) => {
            return json["client"];
        }
    }
    
    class VideoPlayer {
        constructor (element) {
            console.log("constructing: ", element.attr("id"));

            this.element = element;
            this.mediaSource = null;
            this.sourceBuffer = null;

            this.autoPlay = false;
            if (isDefined(this.element.data("autoplay"))) {
                this.autoPlay = true;
            }
            this.isPaused = !this.autoPlay;

            this.startTimestampEpoch = Number(this.element.data("starttimestampepoch"));
            this.durationSec = Number(this.element.data("durationsec"));
            this.endTimestampEpoch = this.startTimestampEpoch + this.durationSec - 1;
            // currentTimestamp = startTimestamp;
            this.segmentDurationSec = Number(this.element.data("segmentdurationsec"));
            this.startTime = -1 * this.segmentDurationSec * this.startTimestampEpoch;
            this.endTime = this.segmentDurationSec * (this.endTimestampEpoch - this.startTimestampEpoch);

            $(this.element)[0].addEventListener('error', this.handleEvent);
            $(this.element)[0].addEventListener('canplay', this.handleEvent);
            $(this.element)[0].addEventListener('pause', this.handleEvent);
            $(this.element)[0].addEventListener('play', this.handleEvent);

            const webSocketURL = this.element.data("websocketurl");
            this.ws = WS.getInstance(webSocketURL);
            this.ws.registerVP(this);
        }

        handleEvent = (event) => {
            console.log(this.id(), ":", event);

            if (event.type === 'error') {

            } else if (event.type === 'canplay') {
                if (this.autoPlay && !this.isPaused) {
                    $(this.element)[0].play();
                }
            } else if (event.type === 'pause') {
                this.isPaused = true;
            } else if (event.type === 'play') {
                this.isPaused = false;
            } else {
                console.log(this.id(), ": unhandled:", event.type);
            }
        }

        init = () => {
            if (!this.ws.isOpen()) {
                console.log("WebSocket is not open");
                return;
            }

            this.mediaSource = new MediaSource();

            this.element.attr("src", URL.createObjectURL(this.mediaSource));

            this.mediaSource.addEventListener("sourceopen", () => {
                console.log(this.id(), ": media-source is open");
                const mimeCodec = 'video/mp4; codecs="avc1.640028"';
                this.sourceBuffer = this.mediaSource.addSourceBuffer(mimeCodec);
                console.log(this.id(), ": source-buffer added:", mimeCodec);

                this.sourceBuffer.timestampOffset = this.startTime;
                this.mediaSource.duration = this.endTime;

                this.sourceBuffer.addEventListener("updateend", () => {
                    // mediaSource.endOfStream();
                    // video.play();
                    // console.log(this.id() + " " + this.mediaSource.readyState);
                });

                // video.addEventListener('timeupdate', checkBuffer);

                this.sourceBuffer.addEventListener("error", (e) => {
                    console.log("SourceBuffer error:", e);
                });

                this.ws.send(this, {
                    type: "segment",
                    segment: this.startTimestampEpoch.toString() + ".m4s"
                });
                // currentTimestamp++;
            });

            this.mediaSource.addEventListener("sourceended", () => {
                console.log(this.id(), ": media-source ended");
            });
        }

        destroy = () => {
            this.ws.unregisterVP(this);

            if (this.mediaSource) {
                if (this.sourceBuffer) {
                    if (!this.sourceBuffer.updating) {
                        try {
                            this.sourceBuffer.remove(0, this.mediaSource.duration);
                            console.log(this.id(), ": cleared source-buffer");
                        } catch (e) {
                            console.log(this.id(), ": Error clearing SourceBuffer:", e);
                        }
                    }
                    this.sourceBuffer = null;
                }
                this.mediaSource = null;
                console.log(this.id(), ": media-source deinitialized");
            }

            this.element.attr("src", "");
        }

        id = () => {
            return this.element.attr("id");
        }

        onWSMessage = ({json, data}={}) => {
            if (isUndefined(data)) {
                console.log(this.id(), ": JSON message received: ", json);
            } else {
                console.log(this.id(), ": Received media segment (ArrayBuffer)");

                if (!this.sourceBuffer || this.sourceBuffer.updating) {
                    console.log(this.id(), ": SourceBuffer is not ready or updating");
                    return;
                }

                try {
                    this.sourceBuffer.appendBuffer(data);
                    console.log(this.id(), ": Appended segment");
                } catch (e) {
                    console.log(this.id(), ": Error appending segment:", e);
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

    $(".video-player").each(function () {
        let vp = new VideoPlayer($(this));
        let button = $("<button></button>").attr("id", "btn_" + $(this).attr("id")).attr("type", "button").text("Start");
        button.click(() => {
            if (button.text() === "Start") {
                button.text("Stop");
                vp.init();
            } else if (button.text() === "Stop") {
                button.remove();
                vp.destroy();
                $(this).remove();
            }
        });
        $(this).after( button);
    });
});