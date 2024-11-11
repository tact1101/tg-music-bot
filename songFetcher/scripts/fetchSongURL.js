"use strict";

// Function to fetch data from local server
import fetch from 'node-fetch';
import WebSocket from 'ws';


async function getWsId() {
    try {
        const response = await fetch('http://localhost:8000/chrome/start');
        const data = await response.json();
        console.log(data);

        if (data.ws_id) {
            return data.ws_id;
        } else {
            console.error("WebSocket URL not found.", data);
            return null;
        }
    }
    catch (error) {
        console.error("Error fetching WebSocket", error);
        return null;
    }
}

async function interactWithChrome(userReq, downloadURL, titleURL) {
    const ws_id = await getWsId();
    if (!ws_id) {
        console.error("Failed to get WebSocketId");
        return;
    }
    const ws = new WebSocket(ws_id);

    ws.onopen = () => {
        console.log("Successfully connected to Chrome DevTools");

        // Navigate to the target page
        const navigateCommand = {
            id: 1,
            method: 'Page.navigate',
            params: {
                url: 'https://y2mate.nu/en-YFhY/'
            }
        };
        ws.send(JSON.stringify(navigateCommand));
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("Recieved WebSocket message:", message);

        // Handle the page load message
        if (message.id === 1 && message.result) {
            console.log("Page loaded successfully");

            // Send the input command
            setTimeout(() => {
                const inputCommand = {
                    id: 2,
                    method: "Runtime.evaluate",
                    params: {
                        expression: `document.getElementById("video").value = "${userReq}";`
                    }
                };
                ws.send(JSON.stringify(inputCommand));
            }, 3000); 
            console.log("Set value for url input field");


            // Inject XMLHttpRequest overrides
            const overrideMethods = {
                id: 4,
                method: 'Runtime.evaluate',
                params: {
                    expression: `
                        (function() {
                            const originalOpen = XMLHttpRequest.prototype.open;
                            const originalSend = XMLHttpRequest.prototype.send;
                            let requestCounter = 0;
                            let downloadURL = null;
                            let titleURL = null;

                            XMLHttpRequest.prototype.open = function(method, url, async) {
                                this._url = url;
                                this._method = method;
                                return originalOpen.apply(this, arguments);
                            };

                            XMLHttpRequest.prototype.send = function(body) {
                                requestCounter++;

                                if (requestCounter === 3) {
                                    downloadURL = this._url;
                                }
                                if (requestCounter === 4) {
                                    titleURL = this._url;
                                }

                                // Send URLs back to Node.js after capture
                                if (requestCounter === 3 || requestCounter === 4) {
                                    console.log(JSON.stringify({
                                        type: 'urlCapture',
                                        downloadURL: downloadURL || '',
                                        titleURL: titleURL || ''
                                    }));
                                }

                                return originalSend.apply(this, arguments);
                            };
                        })();
                    `
                }
            };
            ws.send(JSON.stringify(overrideMethods));
            console.log("Pasted the script in");

            // Click the convert button
            setTimeout(() => { const clickConvertButton = {
                id: 3,
                method: 'Runtime.evaluate',
                params: {
                    expression: `
                        Array.from(document.getElementsByTagName('button'))
                        .find(button => button.innerText === 'Convert')
                        ?.click();
                `
                }
            };
            ws.send(JSON.stringify(clickConvertButton));
            }, 4000);
        };
        console.log("Clicked the convert button");

        // Handle the captured URL message
        // Check if the message is a console log output
    if (message.method === "Runtime.consoleAPICalled" && message.params) {
        console.log("Captured URLs found...");
        // Check each argument in the console message parameters
        const logArgs = message.params.args || [];
        logArgs.forEach(arg => {
            // Ensure `arg` contains the expected string with `urlCapture`
            if (arg.type === "string" && arg.value.includes("urlCapture")) {
                console.log("Parsing captured URL data:", arg.value);  // Debug log for the URL data
                
                try {
                    const urlData = JSON.parse(arg.value);  // Attempt to parse JSON
                    downloadURL = urlData.downloadURL;
                    titleURL = urlData.titleURL;
                    console.log("Captured Download URL:", downloadURL);
                    console.log("Captured Title URL:", titleURL);
                } catch (error) {
                    console.error("Failed to parse URL data:", error);
                }
            }
        });
    }
        // Handle error messages if they exist
        if (message.error) {
            console.error("Error navigating to page:", message.error);
        }
    };

    ws.onclose = () => {
        console.log("WebSocket connection closed");
    };

    ws.onerror = (error) => {
        console.log("WebSocket error:", error);
    };
}

async function sendSongURLs(downloadURL, titleURL) {
    try {
        fetch("http://localhost:8000/get-song-urls", {
            method: "POST",
            body: JSON.stringify({
                downloadURL: downloadURL,
                titleURL: titleURL
                }),
            headers: {
                "Content-Type": "application/json; charset=UTF-8"
            }
        });
    }
    catch(error) {
        console.log("Error posting data to server")
    }
} 

// Async function to fetch data from the user and run main logic
async function main(userReq) {
    let downloadURL, titleURL;
    if (!userReq) { 
        return; 
    }
    await interactWithChrome(userReq, downloadURL, titleURL);
    setTimeout(() => sendSongURLs(downloadURL, titleURL), 300);
};

const userReq = process.argv[2];
console.log(userReq);
if (userReq) {
    main(userReq);
} else {
    console.error("No user request agument provided.");
}

