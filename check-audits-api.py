import json
import urllib.request
base = 'http://127.0.0.1:8000/api'
login = json.dumps({'email': 'demo@forge.fr', 'password': 'Demo1234!'}).encode()
req = urllib.request.Request(base + '/auth/login', data=login, headers={'Content-Type': 'application/json'}, method='POST')
token = json.load(urllib.request.urlopen(req, timeout=10))['access_token']
req = urllib.request.Request(base + '/forge/pxe/audits', headers={'Authorization': 'Bearer ' + token})
print(json.dumps(json.load(urllib.request.urlopen(req, timeout=10)), indent=2, ensure_ascii=False))
