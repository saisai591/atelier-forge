#!/usr/bin/env python3
import argparse
import html
import socket
import struct
import uuid

MCAST = "239.255.255.250"
PORT = 3702


def message_id(payload):
    marker = "MessageID>"
    start = payload.find(marker)
    if start < 0:
        return ""
    start += len(marker)
    end = payload.find("<", start)
    return payload[start:end].strip() if end > start else ""


def local_ip():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def probe_match(hostname, workgroup, endpoint, relates_to):
    mid = f"urn:uuid:{uuid.uuid4()}"
    xaddr = f"http://{local_ip()}:5357/{endpoint}"
    scopes = (
        "ldap:///ou=Computers,ou={workgroup} "
        "http://schemas.xmlsoap.org/ws/2006/02/devprof/ThisDevice "
        "http://schemas.xmlsoap.org/ws/2006/02/devprof/ThisModel "
        "name:{hostname}"
    ).format(workgroup=html.escape(workgroup), hostname=html.escape(hostname))
    relates = f"<a:RelatesTo>{html.escape(relates_to)}</a:RelatesTo>" if relates_to else ""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
 xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"
 xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
 xmlns:wsdp="http://schemas.xmlsoap.org/ws/2006/02/devprof"
 xmlns:pub="http://schemas.microsoft.com/windows/pub/2005/07">
 <s:Header>
  <a:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</a:Action>
  <a:MessageID>{mid}</a:MessageID>
  <a:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</a:To>
  {relates}
 </s:Header>
 <s:Body>
  <d:ProbeMatches>
   <d:ProbeMatch>
    <a:EndpointReference><a:Address>urn:uuid:{endpoint}</a:Address></a:EndpointReference>
    <d:Types>wsdp:Device pub:Computer</d:Types>
    <d:Scopes>{scopes}</d:Scopes>
    <d:XAddrs>{xaddr}</d:XAddrs>
    <d:MetadataVersion>1</d:MetadataVersion>
   </d:ProbeMatch>
  </d:ProbeMatches>
 </s:Body>
</s:Envelope>""".encode("utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hostname", default="AOS-DEPLOY")
    parser.add_argument("--workgroup", default="WORKGROUP")
    args = parser.parse_args()
    endpoint = str(uuid.uuid5(uuid.NAMESPACE_DNS, args.hostname.lower()))

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("", PORT))
    sock.setsockopt(
        socket.IPPROTO_IP,
        socket.IP_ADD_MEMBERSHIP,
        struct.pack("=4sl", socket.inet_aton(MCAST), socket.INADDR_ANY),
    )

    print(f"[wsdd-lite] publishing {args.hostname} on udp/{PORT}", flush=True)
    while True:
        data, addr = sock.recvfrom(65535)
        payload = data.decode("utf-8", "ignore")
        if "Probe" not in payload:
            continue
        if "Computer" not in payload and "Device" not in payload:
            continue
        sock.sendto(probe_match(args.hostname, args.workgroup, endpoint, message_id(payload)), addr)


if __name__ == "__main__":
    main()
