"""
mDNS advertiser for the Calculator MCP server.

Advertises the Calculator MCP server over mDNS so MCP clients can
discover it automatically.

Usage:
    python mdns_advertise.py

Optional:
    set MCP_IP=10.50.20.111
    python mdns_advertise.py
"""

import os
import socket
import sys
import time

from zeroconf import Zeroconf, ServiceInfo, NonUniqueNameException

SERVICE_TYPE = "_mcp._tcp.local."
BASE_NAME = "Calculator MCP"
PORT = 8000


def get_local_ip() -> str:
    """
    Determine the best IPv4 address to advertise.

    Priority:
    1. MCP_IP environment variable
    2. Preferred Wi-Fi subnet (10.50.x.x)
    3. Any non-loopback IPv4
    4. UDP routing trick
    5. 127.0.0.1
    """

    # Highest priority: user override
    env_ip = os.getenv("MCP_IP")
    if env_ip:
        return env_ip

    hostname = socket.gethostname()

    try:
        _, _, ips = socket.gethostbyname_ex(hostname)

        # Prefer your Wi-Fi subnet
        for ip in ips:
            if ip.startswith("10.50."):
                return ip

        # Otherwise any non-loopback IPv4
        for ip in ips:
            if not ip.startswith("127."):
                return ip

    except Exception:
        pass

    # Fallback: ask OS which interface would reach the internet
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        pass

    return "127.0.0.1"


def build_service_info(ip: str, name: str) -> ServiceInfo:
    return ServiceInfo(
        SERVICE_TYPE,
        f"{name}.{SERVICE_TYPE}",
        addresses=[socket.inet_aton(ip)],
        port=PORT,
        properties={
            b"version": b"1.0",
            b"type": b"calculator",
            b"transport": b"streamable-http",
            b"path": b"/mcp",
        },
    )


def register_with_retry(zc: Zeroconf, ip: str, max_attempts: int = 5):
    name = BASE_NAME

    for attempt in range(max_attempts):
        try:
            info = build_service_info(ip, name)
            zc.register_service(info)
            return info

        except NonUniqueNameException:
            name = f"{BASE_NAME} ({attempt + 1})"

    raise RuntimeError("Could not register a unique mDNS service name.")


def main():
    ip = get_local_ip()

    zc = Zeroconf()

    try:
        info = register_with_retry(zc, ip)

        print("=" * 60)
        print("Calculator MCP Advertiser")
        print("=" * 60)
        print(f"Service : {info.name}")
        print(f"IP      : {ip}")
        print(f"Port    : {PORT}")
        print(f"URL     : http://{ip}:{PORT}/mcp")
        print("=" * 60)

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\nStopping advertisement...")
        zc.unregister_service(info)
        zc.close()

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        zc.close()


if __name__ == "__main__":
    main()