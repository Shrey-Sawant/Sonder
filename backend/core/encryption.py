"""
Encryption utilities for sensitive fields (email, real_name, journal entries, crisis signals)
Uses Fernet (symmetric encryption) for transparent field-level encryption.
"""

from cryptography.fernet import Fernet
from config.settings import settings
import base64
import os


# Initialize cipher with the encryption key from environment
def get_cipher():
    """Get Fernet cipher instance"""
    key = os.getenv("ENCRYPTION_KEY")
    
    if not key:
        # Generate a new key if one doesn't exist (development only)
        key = Fernet.generate_key().decode()
        print(f"⚠️  No ENCRYPTION_KEY found. Generated: {key}")
        print("Add this to your .env file for production use.")
    
    if isinstance(key, str):
        key = key.encode()
    
    try:
        return Fernet(key)
    except Exception as e:
        raise ValueError(f"Invalid ENCRYPTION_KEY format: {e}")


def encrypt_string(plaintext: str) -> str:
    """
    Encrypt a string value
    
    Args:
        plaintext: String to encrypt
    
    Returns:
        Encrypted string (base64 encoded)
    """
    if not plaintext:
        return None
    
    cipher = get_cipher()
    encrypted = cipher.encrypt(plaintext.encode())
    return encrypted.decode()


def decrypt_string(ciphertext: str) -> str:
    """
    Decrypt a string value
    
    Args:
        ciphertext: Encrypted string (base64 encoded)
    
    Returns:
        Decrypted plaintext
    """
    if not ciphertext:
        return None
    
    cipher = get_cipher()
    try:
        decrypted = cipher.decrypt(ciphertext.encode())
        return decrypted.decode()
    except Exception as e:
        raise ValueError(f"Decryption failed: {e}")


class EncryptedString:
    """
    SQLAlchemy custom type for transparent field encryption.
    Use this for any sensitive string fields (email, real_name, journal content, etc.)
    """
    
    @staticmethod
    def encrypt(value: str) -> str:
        return encrypt_string(value) if value else None
    
    @staticmethod
    def decrypt(value: str) -> str:
        return decrypt_string(value) if value else None
