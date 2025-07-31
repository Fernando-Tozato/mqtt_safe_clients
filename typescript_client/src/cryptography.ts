import 'dotenv/config'; // Carrega variáveis de ambiente de um .env automaticamente

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// -----------------------------------------------------------------------------
// VISÃO GERAL:
// Este módulo implementa criptografia e decriptação AES-128-CCM em Node.js.
// Ele usa uma chave e AAD vindos de variáveis de ambiente, gera um nonce
// aleatório, produz o payload no formato nonce‖ciphertext‖tag e codifica em Base64.
// A decriptação faz o processo inverso, validando autenticação.
// -----------------------------------------------------------------------------

// Constantes de configuração da criptografia
const ALGORITHM = 'aes-128-ccm'; // Modo AES-CCM com tag de autenticação
const KEY_HEX = process.env.AES_KEY_HEX; // Chave em hexadecimal vinda do .env

// Verifica se a chave está definida; se não, lança erro imediato
if (!KEY_HEX) {
	throw new Error('Variável de ambiente AES_KEY_HEX não definida');
}

const KEY = Buffer.from(KEY_HEX, 'hex'); // Converte chave hex para buffer binário
const NONCE_LENGTH = 12; // Tamanho do nonce: 96 bits (recomendado para AES-CCM)
const TAG_LENGTH = 16;   // Tamanho da tag de autenticação: 128 bits
const AAD = Buffer.from(process.env.AES_AAD || '', 'utf8'); // Dados adicionais autenticados (pode ser vazio)

// -----------------------------------------------------------------------------
// Objeto exportado: Cryptography_AES_CCM
// Descrição: Expõe métodos `encrypt` e `decrypt` para cifra/decifra em AES-CCM.
// -----------------------------------------------------------------------------
export const Cryptography_AES_CCM = {
	/**
	 * Criptografa uma string em texto plano com AES-128-CCM.
	 * Monta payload = nonce || ciphertext || authTag e retorna em Base64.
	 * @param plaintext Texto simples a ser criptografado
	 * @returns Payload Base64 contendo nonce, ciphertext e tag
	 */
	encrypt (plaintext: string) {
		// Gera nonce aleatório do tamanho definido
		const nonce = randomBytes(NONCE_LENGTH);
		// Cria cipher com algoritmo, chave e nonce, informando o tamanho da tag
		const cipher = createCipheriv(ALGORITHM, KEY, nonce, { authTagLength: TAG_LENGTH });
		
		// Converte o plaintext para buffer
		const buf = Buffer.from(plaintext, 'utf8');
		// Define AAD e comunica o tamanho esperado de plaintext para autenticação
		cipher.setAAD(AAD, { plaintextLength: buf.length });
		
		// Executa cifra: primeiro update, depois final
		const ciphertext = Buffer.concat([cipher.update(buf), cipher.final()]);
		// Recupera a tag de autenticação gerada
		const authTag = cipher.getAuthTag();
		
		// Monta payload concatenando nonce || ciphertext || authTag
		const payload = Buffer.concat([nonce, ciphertext, authTag]);
		// Retorna payload codificado em Base64 para transporte seguro
		return payload.toString('base64');
	},
	
	/**
	 * Descriptografa um payload em Base64 que segue o formato nonce || ciphertext || tag.
	 * Valida autenticação e retorna o texto plano. Lança erro se o payload for inválido.
	 * @param payloadB64 Payload codificado em Base64
	 * @returns Texto simples descriptografado
	 */
	decrypt (payloadB64: string) {
		// Decodifica Base64 para bytes brutos
		const data = Buffer.from(payloadB64, 'base64');
		
		// Verifica se o tamanho mínimo (nonce + tag) está presente
		if (data.length < NONCE_LENGTH + TAG_LENGTH) {
			throw new Error('Payload inválido: tamanho insuficiente');
		}
		
		// Separa as partes: nonce no início
		const nonce = data.subarray(0, NONCE_LENGTH);
		// Tag no final
		const tag = data.subarray(data.length - TAG_LENGTH);
		// Ciphertext entre nonce e tag
		const ciphertext = data.subarray(NONCE_LENGTH, data.length - TAG_LENGTH);
		
		// Cria decipher com os mesmos parâmetros (algoritmo, chave, nonce)
		const decipher = createDecipheriv(ALGORITHM, KEY, nonce, { authTagLength: TAG_LENGTH });
		// Define AAD e informa o tamanho do plaintext esperado
		decipher.setAAD(AAD, { plaintextLength: ciphertext.length });
		// Aplica a tag de autenticação para verificação
		decipher.setAuthTag(tag);
		
		// Descriptografa: update + final
		const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
		// Retorna o resultado convertido para string UTF-8
		return decrypted.toString('utf8');
	}
};
