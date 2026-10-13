import sqlite3
from getpass import getpass

from app.database import database, initialize_database
from app.security import normalize_username, passwords


def main():
    try:
        username = normalize_username(input("Username: "))
    except ValueError as error:
        raise SystemExit(str(error))

    password = getpass("Password: ")
    confirmation = getpass("Confirm password: ")

    if password != confirmation:
        raise SystemExit("Passwords do not match.")

    if not 8 <= len(password) <= 15:
        raise SystemExit(
            "Use a password between 8 and 15 characters."
        )

    initialize_database()
    hashed = passwords.hash(password)

    try:
        with database() as connection:
            connection.execute(
                """
                INSERT INTO operators (username, password_hash)
                VALUES (?, ?)
                """,
                (username, hashed),
            )
    except sqlite3.IntegrityError:
        raise SystemExit("That username already exists.")

    print(f"Operator '{username}' created.")


if __name__ == "__main__":
    main()