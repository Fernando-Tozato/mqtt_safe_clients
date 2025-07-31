from console_ui import main_menu, get_user_message
from mqtt_comms import connect_and_loop, send_message


def run_app_controller():
    connect_and_loop()
    while True:
        choice = main_menu()
        if choice == "exit":
            print("Saindo...")
            break
        user_text = get_user_message()
        if choice == "unencrypted":
            send_message(user_text, encrypted=False)
        else:
            send_message(user_text, encrypted=True)