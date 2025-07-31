require('dotenv').config();
const mqtt = require('mqtt');
const { encrypt, decrypt } = require('./crypto_utils');
const url = require('url');

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const parsed = url.parse(BROKER_URL);
const HOST = parsed.hostname || 'localhost';
const PORT = parsed.port || 1883;

const PUBLISH_TOPIC = process.env.MQTT_PUB_TOPIC || 'topico/enviar';
const SUBSCRIBE_TOPIC = process.env.MQTT_SUB_TOPIC || 'topico/receber';

const connectString = BROKER_URL; // mqtt lib aceita URL direta
const client = mqtt.connect(connectString, { reconnectPeriod: 1000 });

client.on('connect', function (connack) {
  console.log(`MQTT conectado em ${BROKER_URL}`); // código de retorno está em connack, mas não é numérico igual ao Python
  client.subscribe(SUBSCRIBE_TOPIC, { qos: 1 }, (err) => {
    if (err) {
      console.error(`Erro ao inscrever em ${SUBSCRIBE_TOPIC}:`, err.message);
    } else {
      console.log(`Inscrito em: ${SUBSCRIBE_TOPIC}`);
    }
  });
});

client.on('message', (topic, message) => {
  const payload = message.toString('utf-8');
  console.log(`Recebido raw em '${topic}': ${payload}`);
  try {
    const decrypted = decrypt(payload);
    console.log(`Mensagem descriptografada: ${decrypted}`);
  } catch (e) {
    console.warn(`Falha ao descriptografar, assumindo texto puro: ${e.message}`);
    console.log(`Mensagem bruta: ${payload}`);
  }
});

function sendMessage(text, encrypted = true) {
  const payload = encrypted ? encrypt(text) : text;
  client.publish(PUBLISH_TOPIC, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error('Erro ao publicar:', err.message);
    } else {
      console.log(`Mensagem enviada em '${PUBLISH_TOPIC}': ${text}`);
    }
  });
}

module.exports = { sendMessage };
