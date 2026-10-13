import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.database import database
from app.security import normalize_username, passwords

router = APIRouter(prefix="/api/auth", tags=["authentication"])

COOKIE_NAME = "cs_session"

# Run password verification even when the username does not exist.
DUMMY_HASH = passwords.hash(secrets.token_urlsafe(32))


class LoginInput(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        return normalize_username(value)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def require_same_origin(request: Request):
    """Protect cookie-authenticated actions from cross-site requests."""
    if (
        request.headers.get("origin") != settings.frontend_origin
        or request.headers.get("x-csrf-protection") != "1"
    ):
        raise HTTPException(
            status_code=403,
            detail="Request not allowed",
        )


def current_operator(request: Request):
    token = request.cookies.get(COOKIE_NAME)

    if not token or len(token) > 128:
        raise HTTPException(
            status_code=401,
            detail="Sign in required",
        )

    with database() as connection:
        operator = connection.execute(
            """
            SELECT operators.id, operators.username
            FROM sessions
            JOIN operators ON operators.id = sessions.operator_id
            WHERE sessions.token_hash = ?
              AND operators.is_active = 1
            """,
            (token_hash(token),),
        ).fetchone()

    if operator is None:
        raise HTTPException(
            status_code=401,
            detail="Sign in required",
        )

    return dict(operator)


@router.post("/login", dependencies=[Depends(require_same_origin)])
def login(body: LoginInput, request: Request, response: Response):
    with database() as connection:
        operator = connection.execute(
            """
            SELECT id, username, password_hash, is_active
            FROM operators
            WHERE username = ?
            """,
            (body.username,),
        ).fetchone()

    stored_hash = operator["password_hash"] if operator else DUMMY_HASH
    valid = passwords.verify(body.password, stored_hash)

    if not valid or operator is None or not operator["is_active"]:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    token = secrets.token_urlsafe(32)

    with database() as connection:
        # Replace this browser's previous session.
        previous = request.cookies.get(COOKIE_NAME)

        if previous:
            connection.execute(
                "DELETE FROM sessions WHERE token_hash = ?",
                (token_hash(previous),),
            )

        connection.execute(
            """
            INSERT INTO sessions (token_hash, operator_id)
            VALUES (?, ?)
            """,
            (token_hash(token), operator["id"]),
        )

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/api",
    )
    response.headers["Cache-Control"] = "no-store"

    return {
        "id": operator["id"],
        "username": operator["username"],
    }


@router.get("/me")
def me(
    response: Response,
    operator: dict = Depends(current_operator),
):
    response.headers["Cache-Control"] = "no-store"
    return operator


@router.post("/logout", dependencies=[Depends(require_same_origin)])
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)

    if token:
        with database() as connection:
            connection.execute(
                "DELETE FROM sessions WHERE token_hash = ?",
                (token_hash(token),),
            )

    response.delete_cookie(
        key=COOKIE_NAME,
        path="/api",
        secure=settings.cookie_secure,
        httponly=True,
        samesite="strict",
    )
    response.headers["Cache-Control"] = "no-store"

    return {"ok": True}