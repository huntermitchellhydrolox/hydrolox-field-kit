# Regenerates Publisher.html from tools/publisher.src.html + app/hlxcrypto.js (developer use only)
import base64, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root/'tools/publisher.src.html').read_text(encoding='utf-8')
crypto = (root/'app/hlxcrypto.js').read_text(encoding='utf-8')
crypto = re.sub(r'^export ', '', crypto, flags=re.M)
logo = base64.b64encode((root/'app/logo.svg').read_bytes()).decode()
out = src.replace('/*HLXCRYPTO*/', crypto).replace('__LOGO__', logo)
(root/'Publisher.html').write_text(out, encoding='utf-8')
print('wrote Publisher.html', len(out))
