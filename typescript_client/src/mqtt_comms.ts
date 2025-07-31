import mqtt from 'mqtt';
import { Cryptography_AES_CCM as Crypt } from './cryptography';

// -----------------------------------------------------------------------------
// VISÃO GERAL:
// Este módulo conecta a um broker MQTT, inscreve em tópico(s), recebe mensagens
// tentando descriptografar se estiverem em Base64/AES-CCM e expõe uma função para
// enviar mensagens (criptografadas por padrão) para um tópico configurado.
// -----------------------------------------------------------------------------

// Configurações vindas de variáveis de ambiente ou valores padrão
const BROKER_URL      = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883'; // URL do broker MQTT
const PUBLISH_TOPIC   = process.env.MQTT_PUB_TOPIC  || 'topico/enviar';         // Tópico para publicar mensagens
const SUBSCRIBE_TOPIC = process.env.MQTT_SUB_TOPIC || 'topico/receber';         // Tópico para receber mensagens

// Conecta ao broker MQTT usando a URL configurada e exporta o client
export const client = mqtt.connect(BROKER_URL);

// -----------------------------------------------------------------------------
// Evento: 'connect'
// Descrição: Disparado quando a conexão com o broker MQTT é estabelecida.
// Inscreve no(s) tópico(s) de interesse e loga o resultado.
// -----------------------------------------------------------------------------
client.on('connect', () => {
	console.log(`MQTT conectado em ${BROKER_URL}`); // Informa conexão bem-sucedida
	
	// Cria lista de tópicos únicos para inscrição (aqui apenas SUBSCRIBE_TOPIC)
	const topics = Array.from(new Set([SUBSCRIBE_TOPIC]));
	// Inscreve nos tópicos com QoS 1
	client.subscribe(topics, { qos: 1 }, (err, granted) => {
		if (err) {
			// Loga erro se falhar ao inscrever
			console.error('Erro ao inscrever em tópicos:', err);
		} else {
			// Garante que granted exista e monta lista de tópicos inscritos
			const topicList = granted?.map(g => g.topic).join(', ') ?? '';
			console.log(`Inscrito em: ${topicList}`); // Mostra os tópicos nos quais ficou inscrito
		}
	});
});

// -----------------------------------------------------------------------------
// Evento: 'message'
// Descrição: Disparado quando chega uma nova mensagem em um tópico inscrito.
// Tenta descriptografar o payload; se falhar assume texto plain.
// -----------------------------------------------------------------------------
client.on('message', (topic, payloadBuf) => {
	// Variável onde será armazenada a mensagem interpretada
	let message: string;
	// Converte o payload para string UTF-8 (possível Base64)
	const b64payload = payloadBuf.toString('utf8');
	
	try {
		// Tenta descriptografar assumindo que está em AES-CCM + Base64
		message = Crypt.decrypt(b64payload);
	} catch {
		// Se falhar (não era Base64 válido ou autenticação falhou), cai aqui
		// Assume que é texto simples e converte diretamente
		message = payloadBuf.toString('utf8');
	}
	
	// Imprime a mensagem final (decifrada ou original)
	console.log(message);
});

/**
 * Envia mensagem para o tópico de publicação.
 * Se `encrypted` for true (padrão), cifra antes de enviar.
 *
 * @param text Texto a ser enviado
 * @param encrypted Indica se deve criptografar antes de publicar (default: true)
 */
export function sendMessage(text: string, encrypted = true): void {
	// Decide payload: cifrado ou puro
	const payload = encrypted ? Crypt.encrypt(text) : text;
	// Publica no tópico com QoS 1
	client.publish(PUBLISH_TOPIC, payload, { qos: 1 }, (err) => {
		if (err) {
			// Exibe erro em caso de falha
			console.error('Erro ao publicar mensagem:', err);
		} else {
			// Confirmação de envio com o texto original (não cifrado) para clareza
			console.log(`Mensagem enviada em '${PUBLISH_TOPIC}':`, text);
		}
	});
}
