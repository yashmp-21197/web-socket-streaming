$(document).ready(function() {
    const video = document.getElementById("videoPlayer");
    const status = document.getElementById("status");
    const streamingBtn = document.getElementById("streamingBtn");

    let isStreaming = false;
    let mediaSource;
    let sourceBuffer;
    let ws;
    let start = 1;
    let end = 10;
    let current = start;
    let duration = 5.12
    let startTime = -(duration * (start-1));
    let maxTime = duration * (end-start+1);

    streamingBtn.addEventListener("click", () => {
        if(isStreaming){
            stopStreaming();
        }else{
            startStreaming();
        }
    });

    function initializeMediaSource() {
        mediaSource = new MediaSource();

        video.src = URL.createObjectURL(mediaSource);

        mediaSource.addEventListener("sourceopen", () => {
            console.log("MediaSource is open");
            const mimeCodec = 'video/mp4; codecs="avc1.640028"';
            sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
            console.log("SourceBuffer added:", mimeCodec);

            sourceBuffer.addEventListener("updateend", () => {
                // mediaSource.endOfStream();
                // video.play();
                console.log(mediaSource.readyState);
            });

            // video.addEventListener('timeupdate', checkBuffer);

            video.addEventListener('canplay', function () {
                video.play();
            });

            // video.addEventListener('seeking', (e) => {
            //     console.log(e);
            //     if (mediaSource.readyState === 'open') {
            //         sourceBuffer.abort();
            //         console.log(mediaSource.readyState);
            //     } else {
            //         console.log('seek but not open?');
            //         console.log(mediaSource.readyState);
            //     }
            // });

            sourceBuffer.addEventListener("error", (e) => {
                console.error("SourceBuffer error:", e);
            });

            sourceBuffer.timestampOffset = startTime;
            mediaSource.duration = maxTime;
            
            // ws.send(JSON.stringify({
            //     type: "segment",
            //     segment: current.toString().padStart(3, '0') + ".m4s"
            // }));
            ws.send(JSON.stringify({
                type: "segment",
                segment: "init.mp4"
            }));
        });

        mediaSource.addEventListener("sourceended", () => {
            console.log("MediaSource ended");
        });
    }

    function deinitializeMediaSource() {
        if (mediaSource) {
            if (sourceBuffer && !sourceBuffer.updating) {
                try {
                    sourceBuffer.remove(0, mediaSource.duration);
                    console.log("Cleared SourceBuffer");
                } catch (e) {
                    console.error("Error clearing SourceBuffer:", e);
                }
            }
            mediaSource.endOfStream();
            video.src = "";
            mediaSource = null;
            sourceBuffer = null;
            console.log("MediaSource deinitialized");
        }
    }

    function startStreaming() {
        ws = new WebSocket("ws://localhost:12345");

        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
            streamingBtn.textContent = "Stop Streaming";
            status.textContent = "Status: Connected to WebSocket";
            console.log("WebSocket connected");
            initializeMediaSource();
            isStreaming = true;
        };

        ws.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                console.log("Received media segment (ArrayBuffer)");

                if (!sourceBuffer || sourceBuffer.updating) {
                    console.log("SourceBuffer is not ready or updating");
                    return;
                }
    
                try {
                    sourceBuffer.appendBuffer(new Uint8Array(event.data));
                    console.log("Appended segment");
                } catch (e) {
                    console.error("Error appending segment:", e);
                }

                if(current <= end){
                    ws.send(JSON.stringify({
                        type: "segment",
                        segment: current.toString().padStart(3, '0') + ".m4s"
                    }));
                }

                current++;

            } else {
                console.log("Non-binary message received:", event.data);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            status.textContent = "Status: WebSocket error";
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected");
            streamingBtn.textContent = "Start Streaming";
            status.textContent = "Status: Disconnected from WebSocket";
            deinitializeMediaSource();
            isStreaming = false;
        };
    }

    function stopStreaming() {
        if (ws) {
            ws.close();
            console.log("WebSocket closed");
        }
    }
});