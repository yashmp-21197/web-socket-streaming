import asyncio
import json
import websockets


async def handler(websocket):
    async for message in websocket:
        print(message)
        request = json.loads(message)
        if request.get("type") == "segment":
            with open(f'../media/{request.get("segment")}', "rb") as f:
                await websocket.send(f.read())
        # await websocket.send(message)


async def main():
    server = await websockets.serve(handler, 'localhost', 12345)
    await server.wait_closed()


if __name__ == "__main__":
    asyncio.run(main())