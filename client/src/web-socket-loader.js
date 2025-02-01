import Utils from './utils.js';

const wsDict = new Map();

const reconnectDelayInit = 1000;
const reconnectDelayMax = 30000;
const reconnectDelayMultiplier = 2;

const segResMsgLenMax = 100;

class WebSocketLoader {

    #mplDict;
    #url;
    #ws;

    #shouldReconnect;
    #reconnectDelay;
    #reconnectTimeout;

    constructor (url) {
        this.#mplDict = new Map();
        this.#url = url;
        this.#ws = null;
        this.#initReconnect();
    }

    static get #wsDict () {
        return wsDict;
    }

    static get #reconnectDelayInit () {
        return reconnectDelayInit;
    }

    static get #reconnectDelayMax () {
        return reconnectDelayMax;
    }

    static get #reconnectDelayMultiplier () {
        return reconnectDelayMultiplier;
    }

    static get #segResMsgLenMax () {
        return segResMsgLenMax;
    }

    static getInstance = (url) => {
        if (Utils.isUndefined(WebSocketLoader.#wsDict.get(url))) {
            WebSocketLoader.#wsDict.set(url, new WebSocketLoader(url));
        }
        return WebSocketLoader.#wsDict.get(url);
    }

    registerMPL = (mpl) => {
        if (this.#mplDict.size === 0) {
            this.#connect();
        }
        this.#mplDict.set(mpl.id, mpl);
    }

    unregisterMPL = (mpl) => {
        this.#mplDict.delete(mpl.id);
        if (this.#mplDict.size === 0) {
            this.#disconnect();
        }
    }

    #getMPL = (id) => {
        return this.#mplDict.get(id);
    }

    #isMPLRegistered = (id) => {
        return this.#mplDict.has(id);
    }

    #cbMPL = (id, cb) => {
        if (!this.#isMPLRegistered(id)) {
            console.log("MPL is not registered:", id);
            return;
        }
        cb(this.#getMPL(id));
    }

    static #getClientId = (json) => {
        return json["client"];
    }

    static #setClientId = (json, id) => {
        json["client"] = id;
    }

    #connect = () => {
        if(Utils.isNotNull(this.#ws)) {
            return;
        }

        console.log(this.#url, ": connecting web-socket");
        this.#ws = new WebSocket(this.#url);
        this.#ws.binaryType = "arraybuffer";

        this.#ws.onopen = this.#onOpen;
        this.#ws.onclose = this.#onClose;
        this.#ws.onerror = this.#onError;
        this.#ws.onmessage = this.#onMessage;
    }

    #disconnect = () => {
        console.log(this.#url, ": disconnecting web-socket");
        this.#shouldReconnect = false;
        if (this.#ws != null) {
            this.#ws.close();
        } else {
            this.#resetReconnect();
        }
    }

    #reconnect = () => {
        console.log(this.#url, ": reconnecting web-socket in", this.#reconnectDelay, "milliseconds...");
        this.#reconnectTimeout = setTimeout(() => {
            if (this.#shouldReconnect) {
                this.#backoffReconnectDelay();
                this.#connect();
            }
        }, this.#reconnectDelay);
    }

    #initReconnect = () => {
        this.#shouldReconnect = true;
        this.#reconnectDelay = WebSocketLoader.#reconnectDelayInit;
        this.#reconnectTimeout = null;
    }

    #resetReconnect = () => {
        if (Utils.isNotNull(this.#reconnectTimeout)) {
            clearTimeout(this.#reconnectTimeout);
        }
        this.#initReconnect();
    }

    #backoffReconnectDelay = () => {
        this.#reconnectDelay = Math.min(this.#reconnectDelay * WebSocketLoader.#reconnectDelayMultiplier, WebSocketLoader.#reconnectDelayMax);
    }

    isOpen = () => {
        return (this.#ws != null && this.#ws.readyState === this.#ws.OPEN);
    }

    send = (mpl, json) => {
        WebSocketLoader.#setClientId(json, mpl.id);
        this.#ws.send(JSON.stringify(json));
    }

    #onOpen = () => {
        console.log("WebSocket connected");
        this.#resetReconnect();
    }

    #onClose = () => {
        console.log("WebSocket disconnected");
        this.#ws = null;
        if (this.#shouldReconnect) {
            this.#reconnect();
        } else {
            this.#resetReconnect();
        }
    }

    #onError = (error) => {
        console.log("WebSocket error:", error);
    }

    #onMessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
            try {
                const json = JSON.parse(new TextDecoder("utf-8").decode(event.data.slice(0, WebSocketLoader.#segResMsgLenMax)));
                const data = new Uint8Array(event.data.slice(WebSocketLoader.#segResMsgLenMax));
                this.#cbMPL(WebSocketLoader.#getClientId(json), (mpl) => {
                    mpl.onWSMessage({
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
                this.#cbMPL(WebSocketLoader.#getClientId(json), (mpl) => {
                    mpl.onWSMessage({
                        json: json
                    });
                });
            } catch (e) {
                console.log("Unknown message received:", event.data);
            }
        }
    }
}

export default WebSocketLoader;