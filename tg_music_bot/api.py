from fastapi import FastAPI
from pydantic import BaseModel
import time

app = FastAPI()

class Video(BaseModel):
    video_url: str

@app.get("/get/video_data")
async def get_video():
    """Takes user input from telegram bot and sends it to js"""
    # perform fetch of user's input
    url = "https://youtu.be/TFsZy9t-qDc"
    return {"message": url}