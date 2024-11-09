from fastapi import APIRouter, HTTPException, FastAPI
from fastapi.responses import StreamingResponse 
from pydantic import BaseModel
import asyncio
import subprocess
import time
import aiohttp
import logging


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# router = APIRouter()
router = FastAPI()

class WebSocketresponse(BaseModel):
    ws_id: str
    
class SongURlsResponse(BaseModel):
    titleURL: str
    downloadURL: str

class ChromeHandler:    
    
    def __init__(self):
        self.start_chrome_client()
        # self.command = "C:\Program Files\Google\Chrome Dev\Application\chrome.exe --remote-debugging-port=9223 --headless"
       
    def start_chrome_client(self):
        """This function is run on the start of an app in headless mode."""
        try:
            subprocess.call([r"'C:\Program Files\Google\Chrome Dev\Application\chrome.exe'",
                            "--remote-debugging-port=9225",
                            "--headless"], shell=True)
            time.sleep(2)
            logging.info("Chrome started in headless mode")
        except subprocess.CalledProcessError as e:
            logging.error(f'Failed to start Chrome: {e}')
            raise HTTPException(status_code=500, detail="Chrome failed to start :(")
    
    async def get_ws_url(self):
        """gets the WebSocket Url for js"""
        try:
            async with aiohttp.ClientSession() as client:
                response = await client.get('http://localhost:9225/json') 
                pages = await response.json()
                if pages:
                    return pages[0]['webSocketDebuggerUrl']
                else:
                    logging.error(f"No pages found: {e}")
                    return None
        except HTTPException as e:
           logging.error(f"Error fetching WebSocker URL: {e}")
           return None
       
chrome_handler = ChromeHandler()

@router.get("/events")
async def sse():
    async def event_stream():
        while True:
            await asyncio.sleep(1)
            # wait
            yield "data: user request available\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")
        
@router.get("/chrome/start/", response_model=WebSocketresponse)
async def start_chrome():
    ws_url = await chrome_handler.get_ws_url() 
    if ws_url:
        logging.info(f"ws_url: {ws_url}")
        print(f"ws_url: {ws_url}")
        return {"ws_id": ws_url}
    else:
        return HTTPException(status_code=500, details='Failed to retrieve a Web Socket URL.')
    
# for the time being here is used a list of tuples. Later should be implemented stroing in redis.
song_URLs_dict = []
    
@router.post("/chrome/get-song-urls/")
async def add_song(SongURLs: SongURlsResponse):
    if isinstance(SongURLs.downloadURL, str) and isinstance(SongURLs.titleURL, str):
        song_URLs_dict.append((SongURLs.downloadURL, SongURLs.titleURL))
    return None