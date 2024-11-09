import pytest
from fastapi.testclient import TestClient
from server.chrome import router
import httpx

"""
This test simulates a request to /chrome/start/ endpoint and checks 
if the response contains a Websocket ID
"""
def test_start_chrome():
    client = TestClient(router)
    response = client.get("/chrome/start/")
    assert response.status_code == 200
    
    json_resp = response.json()
    assert "ws_id" in json_resp
    assert isinstance(json_resp['ws_id'], str)
    assert len(json_resp['ws_id']) > 0