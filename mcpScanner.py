from zeroconf import ServiceBrowser, ServiceListener, Zeroconf
import socket
import time


class MCPListener(ServiceListener):
    def add_service(self, zeroconf, service_type, name):
        info = zeroconf.get_service_info(service_type, name)

        if info:
            ip = socket.inet_ntoa(info.addresses[0])

            print("=" * 50)
            print("MCP Server Found")
            print("=" * 50)
            print(f"Name : {name}")
            print(f"IP   : {ip}")
            print(f"Port : {info.port}")

            if info.properties:
                print("Properties:")
                for k, v in info.properties.items():
                    print(f"  {k.decode()} : {v.decode()}")

            print()

    def remove_service(self, zeroconf, service_type, name):
        print(f"Removed: {name}")

    def update_service(self, zeroconf, service_type, name):
        print(f"Updated: {name}")


zeroconf = Zeroconf()

listener = MCPListener()

browser = ServiceBrowser(
    zeroconf,
    "_mcp._tcp.local.",
    listener
)

print("Listening for MCP servers...")
print("Press Ctrl+C to stop.\n")

try:
    while True:
        time.sleep(1)

except KeyboardInterrupt:
    zeroconf.close()