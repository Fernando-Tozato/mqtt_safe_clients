const readline = require('readline');

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

async function mainMenu() {
  console.log('Selecione uma opção:');
  console.log('[1] Enviar não criptografado');
  console.log('[2] Enviar criptografado');
  console.log('[3] Sair');
  const choice = await prompt('Opção: ');
  if (choice === '1') return 'unencrypted';
  if (choice === '2') return 'encrypted';
  if (choice === '3') return 'exit';
  console.log('Opção inválida, tente novamente.');
  return mainMenu();
}

async function getUserMessage() {
  const msg = await prompt('Digite a mensagem: ');
  if (!msg) {
    console.log('Mensagem vazia, tente novamente.');
    return getUserMessage();
  }
  return msg;
}

module.exports = { mainMenu, getUserMessage };
