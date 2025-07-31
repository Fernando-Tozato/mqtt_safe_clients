require('dotenv').config();
const crypto = require('crypto');

function hexToBuffer(hex) {
  try {
    return Buffer.from(hex, 'hex');
  } catch (e) {
    throw new Error(`Erro ao converter chave hex para buffer: ${e.message}`);
  }
}

const KEY_HEX = process.env.AES_KEY_HEX;
if (!KEY_HEX) {
  throw new Error('Variável de ambiente AES_KEY_HEX não definida');
}
const KEY = hexToBuffer(KEY_HEX);
if (![16, 24, 32].includes(KEY.length)) {
  throw new Error(`Chave AES deve ter 16, 24 ou 32 bytes. Recebido ${KEY.length} bytes.`);
}

// AAD: se fornecido, converte para Buffer; senão vazio
let AAD = Buffer.alloc(0);
if (process.env.AES_AAD) {
  AAD = Buffer.from(process.env.AES_AAD, 'utf-8');
}

const NONCE_LENGTH = 12; // comum e compatível com o Python/Node padrão
const TAG_LENGTH = 16; // bytes

function encrypt(plaintext) {
  const nonce = crypto.randomBytes(NONCE_LENGTH);
  const cipher = crypto.createCipheriv('aes-128-ccm', KEY, nonce, {
    authTagLength: TAG_LENGTH
  });
  if (AAD.length > 0) {
    cipher.setAAD(AAD, { plaintextLength: Buffer.byteLength(plaintext, 'utf-8') });
  }
  let encrypted = cipher.update(plaintext, 'utf-8');
  cipher.final(); // necessário para autenticação
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([nonce, encrypted, tag]);
  const b64 = payload.toString('base64');
  console.log(`[crypto_utils] encrypt -> nonce(hex): ${nonce.toString('hex')}, plaintext: ${plaintext}, aad: ${AAD.toString()}, output(b64) len: ${b64.length}`);
  return b64;
}

function decrypt(b64_payload) {
  let data;
  try {
    data = Buffer.from(b64_payload, 'base64');
  } catch (e) {
    throw new Error(`Payload base64 inválido: ${e.message}`);
  }
  if (data.length < NONCE_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Payload muito curto para conter nonce + ciphertext + tag.');
  }
  const nonce = data.slice(0, NONCE_LENGTH);
  const tag = data.slice(data.length - TAG_LENGTH);
  const ciphertext = data.slice(NONCE_LENGTH, data.length - TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-128-ccm', KEY, nonce, {
    authTagLength: TAG_LENGTH
  });
  if (AAD.length > 0) {
    decipher.setAAD(AAD, { plaintextLength: ciphertext.length });
  }
  decipher.setAuthTag(tag);
  let decrypted;
  try {
    decrypted = decipher.update(ciphertext, undefined, 'utf-8');
    decipher.final(); // valida tag
  } catch (e) {
    throw new Error(`Erro na decriptação: ${e.message}`);
  }
  console.log(`[crypto_utils] decrypt -> nonce(hex): ${nonce.toString('hex')}, plaintext: ${decrypted}, aad: ${AAD.toString()}`);
  return decrypted;
}

// auto-teste se executado diretamente
if (require.main === module) {
  const test = 'mensagem de teste';
  console.log('=== Roundtrip de teste ===');
  const enc = encrypt(test);
  console.log('Encrypted:', enc);
  const dec = decrypt(enc);
  console.log('Decrypted:', dec);
  if (dec !== test) {
    console.error('Roundtrip falhou');
    process.exit(1);
  }
  console.log('Roundtrip OK.');
}

module.exports = { encrypt, decrypt };
