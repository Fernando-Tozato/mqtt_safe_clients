const { mainMenu, getUserMessage } = require('./console_ui');
const { sendMessage } = require('./mqtt_comms');

async function runAppController() {
  while (true) {
    const choice = await mainMenu();
    if (choice === 'exit') {
      console.log('Saindo...');
      process.exit(0);
    }
    const userText = await getUserMessage();
    if (choice === 'unencrypted') {
      sendMessage(userText, false);
    } else {
      sendMessage(userText, true);
    }
  }
}

module.exports = { runAppController };
