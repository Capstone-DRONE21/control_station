import re

from pwdlib import PasswordHash

passwords = PasswordHash.recommended()


def normalize_username(value: str) -> str:
    username = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9_.-]{3,32}", username):
        raise ValueError(
            "Username must be 3–32 characters using letters, numbers, dots, underscores, or hyphens."
        )
    return username
