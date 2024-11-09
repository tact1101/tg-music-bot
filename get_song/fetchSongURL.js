"use strict";

// Function to fetch data from local server
async function fetchData() {
    try {
        const response = await fetch('http://localhost:8000/get_video_data');
        if (!response.ok) {
            console.error('Failed to fetch data:', response.status);
            throw new Error('Network response was not ok');
        }
        return response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

async function getWsId() {
    try {
        const response = await fetch('http://localhost:8000/start/chrome');
        const data = await response.json(); 

        if (data.ws_id) {
            return data.ws_id;
        } else {
            console.error("WebSocket URL not found.");
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
        console.error("Failed to get WebSockerId");
        return;        
    }
    const ws = new WebSocket('ws://localhost:9225/devtools/browser/' + ws_id);

    ws.open = () => {
        console.log("Successfully connnected to Chrome DevTools");
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
        if (message.id === 1 && message.result) {
            console.log("Page loaded successfully");

            const inputCommand = {
                id: 2,
                method: "Runtime.evaluate",
                params: {
                    expression: `
                            document.getElementById("video").value = "${userReq}"; 
                    `
                }
            };
            ws.send((JSON.stringify(inputCommand)));

            const clickConvertButton = {
                id: 3,
                method: 'Runtime.evaluate',
                params: {
                    expression: `
                        document.querySelector("button[type='submit']").click();
                    `
                }
            };
            ws.send(JSON.stringify(clickConvertButton))

            // inject ajax using XMLHttpRequest
            const overrideMethods = {
                id: 4,
                method: 'Runtime.evaluate',
                params: {
                    expression: `
                        (function() {
                            let i = 0;
                            XMLHttpRequest.prototype.originalOpen = XMLHttpRequest.prototype.open;
                            XMLHttpRequest.prototype.originalSend = XMLHttpRequest.prototype.send;

                            XMLHttpRequest.prototype.open = function(method, url, async) {
                                this._url = url;
                                i++;
                                if (i === 6) { downloadURL = this._url; }
                                else if (i === 8) { titleURL = this._url; }
                                this._method = method;
                                return XMLHttpRequest.prototype.originalOpen.apply(this, arguments);
                            };

                            XMLHttpRequest.prototype.send = function(body) {
                                if (this._url.includes("dl?id=") || this._url.includes("convertURL")) {
                                    const params = new URLSearchParams(this._url.split('?')[1]);
                                    console.log("Captured parameters:", params.toString());
                                }
                                console.log("Request URL:", this._url);
                                return XMLHttpRequest.prototype.originalSend.apply(this, arguments);
                            };
                        })();
                    `
                }
            };
            ws.send(JSON.stringify(overrideMethods));

            if (message.id === 4) {
                const retrieveURLsCommand = {
                    id: 5,
                    method: 'Runtime.evaluate',
                    params: {
                        expression: `JSON.stringify({ downloadURL, titleURL });`
                    }
                };
                window.send(JSON.stringify(retrieveURLsCommand));
            }
            if (message.id === 5 && message.result) {
                const urls = JSON.parse(message.result.value);
                downloadURL = urls.downloadURL;
                titleURL = urls.titleURL;

                console.log("Download URL:", downloadURL);
                console.log("Title URL:", titleURL);
            }
        } else if (message.error) {
            console.error("Error navigatinng to page:", message.error);
        }
    };

    ws.onclose = () => {
        console.log("WebSocket connection closed");
    }

    ws.onerror = (error) => {
        console.log("WebSocket error:", error);
    };

    ws.sendMessage = () => {

    };
}

async function sendSongURLs(downloadURL, titleURL) {
    try {
        fetch("https://localhost:8000/get-song-urls", {
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

const eventSource = new EventSource("http://localhost:8000/events");
eventSource.onmessage = async (e) => {
    if (e.data == 'user request available') {
        const [, userReq] = await fetchData();
        if(userReq) {
            await main(userReq);
        }
    }
}

// Function to simulate download action
// function downloadSong() {
//     const downloadButton = document.querySelector("div button[type='button']:first-child");
//     if (downloadButton) {
//         downloadButton.click();
//     } else {
//         console.log("Download button not found.");
//     }
// }
