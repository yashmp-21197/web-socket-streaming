import argparse
import asyncio
import json
import os
import websockets


MAX_SEG_REQ_MSG_LEN = 100


def parse_arguments():
    parser = argparse.ArgumentParser(description="web-socket server command line arguments.")
    
    parser.add_argument("-p", "--port", type=int, required=True, help="port number.")
    parser.add_argument("-d", "--directory", type=str, required=True, help="directory path.")
    parser.add_argument("-v", "--verbose", action="store_true", help="enable verbose mode.")
    
    args = parser.parse_args()

    port = args.port
    directory = args.directory
    verbose = args.verbose

    if verbose:
        print(f'port: {port}')
        print(f'directory: {directory}')
        print(f'verbose: {verbose}')
    
    return port, directory, verbose


async def handler(websocket, directory, verbose):
    client = websocket.remote_address
    print(f"WebSocket connection opened: {client}")

    try:
        async for message in websocket:
            if verbose:
                print(message)
            
            request = json.loads(message)

            if request.get("type") == "segment":
                if len(message) > MAX_SEG_REQ_MSG_LEN:
                    if verbose:
                        print(f'message too long: {message}: {len(message)}')
                    request["error"] = "MessageTooLong"
                    await websocket.send(json.dumps(request))
                else:
                    try:
                        with open(os.path.join(directory, request.get("segment")), "rb") as f:
                            file_data = f.read()
                            additional_data = (message + (' ' * (MAX_SEG_REQ_MSG_LEN - len(message)))).encode()
                            combined_data = additional_data + file_data
                            await websocket.send(combined_data)
                    except FileNotFoundError as e:
                        if verbose:
                            print(f'file not found: {request.get("segment")}')
                        request["error"] = "FileNotFound"
                        await websocket.send(json.dumps(request))
                    except Exception as e:
                        if verbose:
                            print(f'Exception: {e}')
                        request["error"] = "Exception"
                        await websocket.send(json.dumps(request))
    finally:
        print(f"WebSocket connection closed: {client}")


async def main(port, directory, verbose):
    server = await websockets.serve(lambda ws: handler(ws, directory, verbose), 'localhost', port)
    if verbose:
        print(f"Server started on port {port}")
    await server.wait_closed()


if __name__ == "__main__":
    port, directory, verbose = parse_arguments()
    asyncio.run(main(port, directory, verbose))