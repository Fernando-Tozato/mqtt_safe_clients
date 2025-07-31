def main_menu() -> str:
    print("Selecione uma opção:")
    print("[1] Enviar não criptografado")
    print("[2] Enviar criptografado")
    print("[3] Sair")
    choice = input("Opção: ").strip()
    if choice == "1":
        return "unencrypted"
    elif choice == "2":
        return "encrypted"
    elif choice == "3":
        return "exit"
    else:
        print("Opção inválida, tente novamente.")
        return main_menu()


def get_user_message() -> str:
    text = input("Digite a mensagem: ").strip()
    if not text:
        print("Mensagem vazia, tente novamente.")
        return get_user_message()
    return text