import { ConsoleUserInterface as CUI } from "./console_user_interface";
import { client, sendMessage } from './mqtt_comms';

/**
 * AppController: gerencia o fluxo da aplicação CLI MQTT.
 *
 * Descrição geral: Em loop infinito, exibe o menu principal para o usuário,
 * obtém a mensagem desejada e a envia seja como texto puro ou como texto
 * criptografado. As mensagens recebidas são tratadas e logadas pelo módulo
 * mqtt_comms (cliente MQTT) por fora.
 */
export async function runAppController(): Promise<void> {
	while (true) {
		// Exibe o menu principal e aguarda a escolha do usuário ('unencrypted' ou 'encrypted')
		const choice = await CUI.MainMenu();
		
		// Lê do usuário a mensagem que ele deseja enviar
		const userText = await CUI.GetUserMessage();
		
		if (choice === 'unencrypted') {
			// Envia como texto puro (não criptografado)
			client.publish(
				process.env.MQTT_PUB_TOPIC || 'topico/enviar', // Tópico de publicação (padrão se não definido)
				userText,                                       // Payload é o texto do usuário
				{ qos: 1 },                                     // Qualidade de serviço 1 (entrega ao menos uma vez)
				(err) => {                                      // Callback de resultado
					if (err) console.error('Erro ao enviar não criptografado:', err); // Log de erro
					else console.log(`Mensagem pura enviada: ${userText}`);          // Confirmação de envio
				}
			);
		} else {
			// Envia como texto criptografado (comportamento encapsulado em sendMessage)
			sendMessage(userText);
		}
		
		// Pequena pausa antes de reiniciar o loop para evitar flood no menu
		await new Promise((r) => setTimeout(r, 500));
	}
}
