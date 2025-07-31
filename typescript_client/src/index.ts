import 'dotenv/config'; // Carrega variáveis de ambiente do arquivo .env, se existir
import { runAppController } from './app_controller';

/**
 * Ponto de entrada da aplicação.
 * Inicializa o fluxo principal e trata erros fatais.
 */
async function main() {
	console.log('Inicializando aplicação MQTT CLI...'); // Log de início
	
	try {
		await runAppController(); // Executa o controlador principal da aplicação (loop de menu/enviar)
	} catch (err) {
		// Se ocorrer qualquer erro não tratado dentro de runAppController, cai aqui
		console.error('Erro fatal na aplicação:', err); // Loga o erro
		process.exit(1); // Sai do processo com código de erro
	}
}

// Chama a função principal imediatamente
main();
