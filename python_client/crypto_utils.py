import os
import base64
from dotenv import load_dotenv
from cryptography.hazmat.primitives.ciphers.aead import AESCCM

load_dotenv()

KEY_HEX = os.getenv("AES_KEY_HEX")
if not KEY_HEX:
    raise RuntimeError("Variável de ambiente AES_KEY_HEX não definida")

KEY = bytes.fromhex(KEY_HEX)
aesccm = AESCCM(KEY, tag_length=16)

NONCE_LENGTH = 12
AAD = os.getenv("AES_AAD", "").encode("utf-8")

def encrypt(plaintext: str) -> str:
    nonce = os.urandom(NONCE_LENGTH)
    ct = aesccm.encrypt(nonce, plaintext.encode("utf-8"), AAD)
    payload = nonce + ct
    return base64.b64encode(payload).decode("utf-8")

def decrypt(b64_payload: str) -> str:
    data = base64.b64decode(b64_payload)
    nonce = data[:NONCE_LENGTH]
    ct_and_tag = data[NONCE_LENGTH:]
    plaintext = aesccm.decrypt(nonce, ct_and_tag, AAD)
    return plaintext.decode("utf-8")