"""
Encryption utilities for sensitive fields (journal entries, crisis signals,
peer messages, session notes).

Uses Fernet (symmetric, authenticated encryption) for transparent field-level
encryption.

Key management
--------------
Set ``ENCRYPTION_KEY`` in the environment to a urlsafe-base64 32-byte Fernet
key. If it is absent, a key is derived deterministically from ``SECRET_KEY`` so
local development keeps working. Because the derived key depends on
``SECRET_KEY``, rotating ``SECRET_KEY`` makes previously encrypted data
unreadable -- production deployments should set a dedicated, stable
``ENCRYPTION_KEY``.

The cipher is built once per process. Earlier versions generated a brand new
random key on every call, which silently made every ``decrypt_string`` fail.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
from functools import lru_cache
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from config.settings import settings

logger = logging.getLogger(__name__)

_DERIVATION_SALT = b"sonder.field-encryption.v1"


def _derive_key(secret: str) -> bytes:
    """Derive a stable Fernet key from a secret (used only as a dev fallback)."""
    digest = hashlib.sha256(_DERIVATION_SALT + secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


@lru_cache(maxsize=1)
def _build_cipher() -> Fernet:
    key = os.getenv("ENCRYPTION_KEY")

    if key:
        key_bytes = key.strip().encode("utf-8")
    else:
        if settings.ENVIRONMENT in {"prod", "production"}:
            logger.warning(
                "ENCRYPTION_KEY is not set; deriving the field-encryption key "
                "from SECRET_KEY. Configure a dedicated ENCRYPTION_KEY in "
                "production so that rotating SECRET_KEY does not make stored "
                "data unreadable."
            )
        key_bytes = _derive_key(settings.SECRET_KEY)

    try:
        return Fernet(key_bytes)
    except Exception:
        # Never include key material in the error message.
        raise ValueError(
            "Invalid ENCRYPTION_KEY. Expected a urlsafe-base64 32-byte Fernet "
            "key. Generate one with the Fernet.generate_key() helper from the "
            "cryptography package."
        ) from None


def get_cipher() -> Fernet:
    """Return the process-wide cached Fernet cipher."""
    return _build_cipher()


def encrypt_string(plaintext: Optional[str]) -> Optional[str]:
    """Encrypt a string value, returning a base64 Fernet token."""
    if not plaintext:
        return None
    return get_cipher().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_string(ciphertext: Optional[str]) -> Optional[str]:
    """Decrypt a Fernet token previously produced by :func:`encrypt_string`."""
    if not ciphertext:
        return None
    try:
        return get_cipher().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # Do not leak the underlying token or key material.
        raise ValueError("Decryption failed: invalid token or wrong encryption key")


class EncryptedString:
    """Thin helper kept for backwards compatibility with existing callers."""

    @staticmethod
    def encrypt(value: Optional[str]) -> Optional[str]:
        return encrypt_string(value)

    @staticmethod
    def decrypt(value: Optional[str]) -> Optional[str]:
        return decrypt_string(value)
