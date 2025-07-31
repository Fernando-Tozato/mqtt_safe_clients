import os
import urllib.parse
import paho.mqtt.client as mqtt
from crypto_utils import encrypt, decrypt
from dotenv import load_dotenv

load_dotenv()

BROKER_URL = os.getenv("MQTT_BROKER_URL", "mqtt://localhost:1883")
parsed = urllib.parse.urlparse(BROKER_URL)
HOST = parsed.hostname or "localhost"
PORT = parsed.port or 1883

PUBLISH_TOPIC = os.getenv("MQTT_PUB_TOPIC", "topico/enviar")
SUBSCRIBE_TOPIC = os.getenv("MQTT_SUB_TOPIC", "topico/receber")

client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    print(f"MQTT conectado em {BROKER_URL} com código {rc}")
    client.subscribe(SUBSCRIBE_TOPIC, qos=1)
    print(f"Inscrito em: {SUBSCRIBE_TOPIC}")

def on_message(client, userdata, msg):
    payload = msg.payload.decode("utf-8", errors="ignore")
    print(f"Recebido raw em '{msg.topic}': {payload}")
    try:
        decrypted = decrypt(payload)
        print(f"Mensagem descriptografada: {decrypted}")
    except Exception as e:
        print(f"Falha ao descriptografar, assumindo texto puro: {e}")
        print(f"Mensagem bruta: {payload}")

def connect_and_loop():
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(HOST, PORT)
    client.loop_start()

def send_message(text: str, encrypted: bool = True):
    payload = encrypt(text) if encrypted else text
    client.publish(PUBLISH_TOPIC, payload, qos=1)
    print(f"Mensagem enviada em '{PUBLISH_TOPIC}': {text}")