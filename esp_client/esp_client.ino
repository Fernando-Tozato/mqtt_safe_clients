#include <WiFi.h>
#include <PubSubClient.h>
#include <Arduino.h>
#include "mbedtls/ccm.h"
#include "mbedtls/base64.h"

// -----------------------------------------------------------------------------
// VISÃO GERAL:
// Este firmware conecta o ESP32 a uma rede WiFi, conecta a um broker MQTT,
// recebe mensagens MQTT (esperando que sejam AES-CCM base64) e as
// descriptografa para exibição. Também criptografa entradas da serial e envia
// para um tópico MQTT. A criptografia é feita com AES-CCM + AAD e o payload é
// transportado em Base64 (nonce‖ciphertext‖tag).
// -----------------------------------------------------------------------------

// ========== WIFI ==========
// Configurações de WiFi
const char* wifi_ssid     = "Inac FabLab 2"; // SSID da rede WiFi
const char* wifi_password = "inac0025";      // Senha da rede WiFi
WiFiClient espClient;                         // Cliente TCP para uso com MQTT

// -----------------------------------------------------------------------------
// Função: setup_wifi
// Descrição: Conecta o ESP32 à rede WiFi configurada, aguarda até a conexão
// ser estabelecida e imprime estado e IP no serial.
// -----------------------------------------------------------------------------
void setup_wifi() {
    delay(10); // Pequena pausa para estabilidade

    Serial.println();                // Linha em branco para clareza no output
    Serial.print("Connecting to ");  // Informa início da conexão
    Serial.println(wifi_ssid);      // Mostra qual SSID está sendo usado

    WiFi.mode(WIFI_STA);                         // Define modo estação (client)
    WiFi.begin(wifi_ssid, wifi_password);         // Inicia conexão com SSID/senha

    // Espera até conectar ao WiFi
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);               // Espera 500ms entre tentativas
        Serial.print(".");        // Mostra progresso com ponto
    }

    randomSeed(micros()); // Inicializa o gerador de aleatórios com entropia de tempo

    Serial.println("");                // Quebra de linha para organização
    Serial.println("WiFi connected");  // Confirmação de conexão
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());    // Exibe o endereço IP obtido
}

// ========== MQTT ==========
// Configurações MQTT
const char* mqtt_server  = "broker.emqx.io";     // Endereço do broker MQTT
const char* mqtt_sub     = "inac/teste/ts";      // Tópico para inscrição (recebimento)
const char* mqtt_pub     = "inac/teste/esp";     // Tópico para publicação (envio)
const String mqtt_client = "ESP_Client_";        // Prefixo de client ID (fixo)
PubSubClient client(espClient);                  // Cliente MQTT que usa o WiFiClient

// -----------------------------------------------------------------------------
// Função: reconnect
// Descrição: Garante que o cliente MQTT esteja conectado. Caso esteja desconectado,
// tenta reconectar em loop e, ao conectar, se inscreve no tópico de recebimento.
// -----------------------------------------------------------------------------
void reconnect() {
    // Loop até conseguir conexão
    while (!client.connected()) {
        Serial.print("Attempting MQTT connection..."); // Indica tentativa

        // Tenta conectar usando o client ID configurado
        if (client.connect(mqtt_client.c_str())) {
            Serial.println("Connected!");         // Indicador de sucesso
            client.subscribe(mqtt_sub);           // Inscreve no tópico de entrada
        } else {
            Serial.print("Failed, rc=");          // Mostra que falhou
            Serial.print(client.state());         // Código de erro do MQTT
            Serial.println(". Trying again in 5 seconds..."); // Retry message
            delay(5000);                          // Aguarda antes de nova tentativa
        }
    }
}

// -----------------------------------------------------------------------------
// Função: callback
// Descrição: Recebe mensagens MQTT, monta a string recebida, tenta descriptografar
// via AES-CCM e imprime os valores (criptografado e descriptografado).
// -----------------------------------------------------------------------------
void callback(char* topic, byte* payload, unsigned int length) {
    String enc;                         // Armazena payload cifrado como string
    for (unsigned int i = 0; i < length; i++) {
        enc += (char)payload[i];        // Concatena cada caractere do payload
    }
    String dec = decryptCCM(enc);       // Descriptografa o conteúdo

    // Exibe no serial a versão recebida e a decodificada
    Serial.println("MQTT RECEBIDO (encrypted): " + enc);
    Serial.println("MQTT RECEBIDO (decrypted): " + dec);
}

// ========== AES CCM ==========
// Configurações da criptografia AES-CCM
const char* AES_KEY_HEX       = "4d3e96bd248ac01d4680e0af35784051"; // Chave AES em hex (16 bytes)
const char* AES_AAD           = "6d65746164617461";               // AAD (dados adicionais autenticados)
static const size_t NONCE_LEN = 12; // Tamanho do nonce (96 bits)
static const size_t TAG_LEN   = 16; // Tamanho da tag de autenticação (128 bits)

// -----------------------------------------------------------------------------
// Função: hexToBytes
// Descrição: Converte uma string hexadecimal para bytes brutos.
// -----------------------------------------------------------------------------
void hexToBytes(const char* hex, uint8_t* out, size_t outLen) {
    for (size_t i = 0; i < outLen; i++) {
        // Converte o nibble alto
        uint8_t hi = (hex[i*2]   <= '9' ? hex[i*2]   - '0' : tolower(hex[i*2])   - 'a' + 10);
        // Converte o nibble baixo
        uint8_t lo = (hex[i*2+1] <= '9' ? hex[i*2+1] - '0' : tolower(hex[i*2+1]) - 'a' + 10);
        out[i] = (hi << 4) | lo; // Junta os dois nibbles
    }
}

// -----------------------------------------------------------------------------
// Função: randomNonce
// Descrição: Gera um nonce aleatório de NONCE_LEN bytes usando esp_random().
// -----------------------------------------------------------------------------
void randomNonce(uint8_t* nonce) {
    for (size_t i = 0; i < NONCE_LEN; i += 4) {
        uint32_t r = esp_random(); // Gera 32 bits aleatórios
        // Copia até 4 bytes (ou menos se for a parte final) para o nonce
        memcpy(nonce + i, &r, min((size_t)4, NONCE_LEN - i));
    }
}

// -----------------------------------------------------------------------------
// Função: encryptCCM
// Descrição: Criptografa o plaintext usando AES-CCM com AAD, monta payload
// nonce‖ciphertext‖tag e retorna em Base64.
// -----------------------------------------------------------------------------
String encryptCCM(const String& plaintext) {
    // Configura chave e AAD
    uint8_t key[16];
    hexToBytes(AES_KEY_HEX, key, sizeof(key));          // Converte chave hex para bytes
    const uint8_t* aad = (const uint8_t*)AES_AAD;       // Ponteiro para AAD
    size_t aadLen      = strlen(AES_AAD);               // Tamanho do AAD

    // Gera nonce aleatório
    uint8_t nonce[NONCE_LEN];
    randomNonce(nonce);

    // Criptografa o plaintext
    size_t ptLen = plaintext.length();                  // Tamanho do texto plano
    uint8_t ct[ptLen];                                  // Buffer de ciphertext
    uint8_t tag[TAG_LEN];                               // Buffer da tag
    mbedtls_ccm_context ctx;                            // Contexto CCM
    mbedtls_ccm_init(&ctx);                             // Inicializa contexto
    mbedtls_ccm_setkey(&ctx, MBEDTLS_CIPHER_ID_AES, key, 128); // Define chave AES de 128 bits
    mbedtls_ccm_star_encrypt_and_tag(
        &ctx,
        ptLen,                  // Tamanho do plaintext
        nonce, NONCE_LEN,       // Nonce e seu tamanho
        aad, aadLen,            // AAD e seu tamanho
        (const uint8_t*)plaintext.c_str(), // Texto plano como bytes
        ct,                     // Saída: ciphertext
        tag, TAG_LEN            // Saída: tag de autenticação
    );
    mbedtls_ccm_free(&ctx); // Libera o contexto

    // Monta o payload completo: nonce || ciphertext || tag
    size_t payloadLen = NONCE_LEN + ptLen + TAG_LEN;
    uint8_t payload[payloadLen];
    memcpy(payload, nonce, NONCE_LEN);                       // Copia nonce
    memcpy(payload + NONCE_LEN, ct, ptLen);                 // Copia ciphertext
    memcpy(payload + NONCE_LEN + ptLen, tag, TAG_LEN);       // Copia tag

    // Codifica em Base64
    size_t b64Len;
    mbedtls_base64_encode(NULL, 0, &b64Len, payload, payloadLen); // Consulta tamanho
    uint8_t b64buf[b64Len + 1];                                   // Buffer com espaço extra
    mbedtls_base64_encode(b64buf, b64Len, &b64Len, payload, payloadLen); // Codifica
    b64buf[b64Len] = '\0'; // Termina string

    return String((char*)b64buf); // Retorna Base64 como String Arduino
}

// -----------------------------------------------------------------------------
// Função: decryptCCM
// Descrição: Decodifica Base64, separa nonce/ciphertext/tag, autentica e
// descriptografa. Retorna plaintext ou mensagem de erro.
// -----------------------------------------------------------------------------
String decryptCCM(const String& b64payload) {
    // Decodifica Base64 para raw bytes
    size_t rawLen    = 0;
    const char* b64  = b64payload.c_str();
    mbedtls_base64_decode(NULL, 0, &rawLen, (const uint8_t*)b64, b64payload.length()); // Tamanho esperado
    uint8_t raw[rawLen];
    mbedtls_base64_decode(raw, rawLen, &rawLen, (const uint8_t*)b64, b64payload.length()); // Decode efetivo

    // Verifica se o payload tem tamanho mínimo (nonce + tag)
    if (rawLen < NONCE_LEN + TAG_LEN) {
        return String("ERRO: payload muito curto");
    }

    // Separa nonce, ciphertext e tag
    uint8_t* nonce = raw;                                 // Início: nonce
    uint8_t* ct    = raw + NONCE_LEN;                    // Depois do nonce: ciphertext
    size_t   ctLen = rawLen - NONCE_LEN - TAG_LEN;        // Tamanho do ciphertext
    uint8_t* tag   = raw + NONCE_LEN + ctLen;             // Tag no final

    // Prepara chave e AAD novamente
    uint8_t key[16];
    hexToBytes(AES_KEY_HEX, key, sizeof(key));            // Converte chave hex para bytes
    const uint8_t* aad = (const uint8_t*)AES_AAD;         // AAD
    size_t aadLen      = strlen(AES_AAD);                 // Tamanho do AAD

    // Descriptografa e autentica
    uint8_t pt[ctLen];                                    // Buffer para plaintext
    mbedtls_ccm_context ctx;                              // Contexto CCM
    mbedtls_ccm_init(&ctx);                               // Inicializa
    mbedtls_ccm_setkey(&ctx, MBEDTLS_CIPHER_ID_AES, key, 128); // Define chave
    int ret = mbedtls_ccm_star_auth_decrypt(
        &ctx,
        ctLen,                   // Tamanho do ciphertext
        nonce, NONCE_LEN,        // Nonce
        aad, aadLen,             // AAD
        ct,                      // Ciphertext
        pt,                      // Saída: plaintext
        tag, TAG_LEN             // Tag
    );
    mbedtls_ccm_free(&ctx); // Libera contexto

    // Se falhou na autenticação, retorna erro
    if (ret != 0) {
        return String("ERRO: falha na autenticacao");
    }
    // Retorna o plaintext reconstruído
    return String((char*)pt, ctLen);
}

// ========== SETUP ==========

// -----------------------------------------------------------------------------
// Função: setup
// Descrição: Inicializa serial, WiFi, configuração MQTT, demonstra mensagem de
// inicialização criptografada e publica no broker.
// -----------------------------------------------------------------------------
void setup() {
    Serial.begin(115200);         // Inicializa porta serial
    while (!Serial);             // Aguarda serial estar pronta (útil em alguns ambientes)

    setup_wifi();                // Conecta à rede WiFi

    client.setServer(mqtt_server, 1883); // Configura broker MQTT
    client.setCallback(callback);         // Registra callback para mensagens

    delay(1000); // Pequena pausa

    Serial.println("ESP Client setup complete."); // Indica término do setup inicial

    // Mensagem de início
    String startMessage     = "ESP Client started";
    String encryptedMessage = encryptCCM(startMessage); // Criptografa a mensagem inicial
    Serial.printf("Sending Started Message: \"%s\"\n", startMessage.c_str());
    Serial.printf("Encrypted message: %s\n", encryptedMessage.c_str());

    reconnect(); // Garante conexão MQTT
    client.publish(mqtt_pub, encryptedMessage.c_str()); // Publica mensagem criptografada

    // Separador visual
    Serial.print("\n================================================================\n\n\n");
}

// -----------------------------------------------------------------------------
// Função: loop
// Descrição: Mantém conexão MQTT viva, lê da serial, criptografa entrada e publica.
// -----------------------------------------------------------------------------
void loop() {
    if (!client.connected()) reconnect(); // Reconnect se desconectado

    client.loop(); // Mantém o client MQTT rodando (ping, recebimento, etc.)

    // Se houver dados disponíveis na serial
    if (Serial.available()) {
        String input = Serial.readStringUntil('\n');        // Lê linha da serial
        Serial.printf("Received input: %s\n", input.c_str()); // Log da entrada bruta

        String encryptedInput = encryptCCM(input);          // Criptografa input
        Serial.printf("Encrypted input: %s\n", encryptedInput.c_str()); // Log cifrado

        client.publish(mqtt_pub, encryptedInput.c_str());  // Publica no tópico MQTT
    }
}
