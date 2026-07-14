"""
mDNS advertiser for the Calculator MCP server.

Fixes applied vs. the original draft:
  1. Correct "type" property (was "filesystem", now "calculator").
  2. Robust LAN IP detection (gethostbyname can return 127.0.1.1 on
     Debian/WSL; we use a UDP "connect" trick instead, which never
     actually sends a packet, just forces the OS to pick the right
     outbound interface).
  3. Auto-retry with a suffixed name on NonUniqueNameException instead
     of crashing.
  4. Advertises the actual MCP path ("/mcp") and transport, so a
     discovery client knows exactly what URL to hit.
"""

import socket
import time
import sys

from zeroconf import Zeroconf, ServiceInfo, NonUniqueNameException

SERVICE_TYPE = "_mcp._tcp.local."
BASE_NAME = "Calculator MCP"
PORT = 8000


def get_local_ip() -> str:
    """Find the LAN-facing IP without relying on /etc/hosts entries."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # no packet actually sent (UDP)
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


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
    for attempt in range(1, max_attempts + 1):
        info = build_service_info(ip, name)
        try:
            zc.register_service(info)
            return info
        except NonUniqueNameException:
            name = f"{BASE_NAME} ({attempt})"
    raise RuntimeError("Could not register a unique mDNS service name.")


def main():
    ip = get_local_ip()
    zc = Zeroconf()

    try:
        info = register_with_retry(zc, ip)
    except RuntimeError as e:
        print(f"Failed to register service: {e}", file=sys.stderr)
        zc.close()
        sys.exit(1)

    print(f"Advertising '{info.name}' at http://{ip}:{PORT}/mcp (mDNS: {SERVICE_TYPE})")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nUnregistering service...")
        zc.unregister_service(info)
        zc.close()


if __name__ == "__main__":
    main()
