"""Read-only subnet validation. Run while holding the deployment lock."""
import ipaddress
import json
import subprocess


def output(*args):
    return subprocess.check_output(args, text=True)


desired = ipaddress.ip_network("172.30.240.0/24")
names = output("docker", "network", "ls", "--format", "{{.Name}}").split()
networks = json.loads(output("docker", "network", "inspect", *names))
owned_bridge = None
for network in networks:
    owned = network["Name"] == "minintapp-platform"
    if owned:
        assert network.get("Labels", {}).get("io.minintapp.owner") == "minintapp", "Network ownership mismatch"
        assert network["Driver"] == "bridge", "Unexpected network driver"
        assert [c.get("Subnet") for c in network["IPAM"]["Config"]] == [str(desired)], "Unexpected subnet"
        owned_bridge = network.get("Options", {}).get("com.docker.network.bridge.name") or "br-" + network["Id"][:12]
    for config in network["IPAM"].get("Config") or []:
        subnet = config.get("Subnet")
        if subnet:
            existing = ipaddress.ip_network(subnet)
            assert owned or not desired.overlaps(existing), f"Subnet conflict: {network['Name']} {existing}"

routes = json.loads(output("ip", "-j", "-4", "route", "show", "table", "all"))
for route in routes:
    destination = route.get("dst", "default")
    if destination == "default" or route.get("dev") == owned_bridge:
        continue
    existing = ipaddress.ip_network(destination, strict=False)
    assert not desired.overlaps(existing), f"Route conflict: {destination} on {route.get('dev')}"
print(f"Subnet validated: {desired}")
