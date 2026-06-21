from pathlib import Path
p = Path('/opt/aos-pxe-src/server/render-config.sh')
data = p.read_bytes().replace(b'\r\n', b'\n').replace(b'\r', b'\n')
p.write_bytes(data)
