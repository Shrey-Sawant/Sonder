import uvicorn
import socket
import sys


def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


def find_free_port(start_port: int, max_attempts: int = 10) -> int:
    for port in range(start_port, start_port + max_attempts):
        if not is_port_in_use(port):
            return port
    raise RuntimeError("No free ports found")


if __name__ == "__main__":
    try:
        # Prefer 8000, fallback to 8081+
        port = find_free_port(8000)
        print(f"Starting server on http://localhost:{port}")

        # Update Config/Env dynamically if needed (or just rely on Main to use relative URLs if possible,
        # but for now we assume Frontend points to 8000 or 8081.
        # We will print the port so user knows.)

        uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
    except Exception as e:
        print(f"Error starting server: {e}")
        input("Press Enter to exit...")
