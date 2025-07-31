import * as readline from 'readline/promises';

// -----------------------------------------------------------------------------
// Descrição geral: Interface de usuário via console. Permite ao usuário escolher
// entre enviar uma mensagem criptografada ou não, e capturar a mensagem a ser enviada.
// -----------------------------------------------------------------------------

// Cria a interface de leitura do console ligada à entrada e saída padrão
const rl = readline.createInterface({
	input: process.stdin, // Entrada padrão (teclado)
	output: process.stdout // Saída padrão (terminal)
});

export const ConsoleUserInterface = {
	/**
	 * Mostra o menu principal no console e aguarda o usuário escolher entre enviar
	 * mensagem criptografada, não criptografada ou sair.
	 * @returns 'unencrypted' se escolher enviar sem criptografia, 'encrypted' se escolher com criptografia
	 */
	async MainMenu(): Promise<'unencrypted' | 'encrypted'> {
		// Texto do menu apresentado ao usuário
		const text: string = (
			'Bem-vindo ao menu principal!\n' +
			'Escolha uma opção:\n' +
			'1 - Enviar mensagem não criptografada\n' +
			'2 - Enviar mensagem criptografada\n' +
			'0 - Sair\n' +
			'\n' +
			'Digite o número da opção desejada: '
		);
		
		// Loop até o usuário fornecer uma opção válida
		while (true) {
			const answer: string = await rl.question(text); // Lê a resposta do usuário
			
			switch (answer.toLowerCase()) {
				case '1':
					console.log('Você escolheu enviar uma mensagem não criptografada.'); // Feedback
					return 'unencrypted'; // Retorna opção correspondente
				
				case '2':
					console.log('Você escolheu enviar uma mensagem criptografada.'); // Feedback
					return 'encrypted'; // Retorna opção correspondente
				
				case '0':
					console.log('Saindo do programa...'); // Informa saída
					return process.exit(0); // Encerra o processo e retorna (never, mas satisfaz o tipo)
				
				default:
					console.log('Opção inválida! Por favor, escolha uma opção válida.'); // Tratamento de entrada incorreta
			}
		}
	},
	
	/**
	 * Solicita ao usuário que digite a mensagem a ser enviada. Garante que a
	 * mensagem não seja vazia repetindo a pergunta se necessário.
	 * @returns string com a mensagem do usuário
	 */
	async GetUserMessage(): Promise<string> {
		const message: string = await rl.question('Digite a mensagem que deseja enviar: '); // Lê mensagem
		
		if (!message) {
			console.log('Mensagem não pode ser vazia. Tente novamente.'); // Validação
			return this.GetUserMessage(); // Recursão até obter algo não vazio
		}
		
		return message; // Retorna a mensagem válida
	}
};
