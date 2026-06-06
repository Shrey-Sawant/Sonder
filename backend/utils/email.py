import resend
from config.settings import settings
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def send_email(to_email: str, subject: str, body: str) -> bool:
    if not settings.RESEND_API_KEY:
        logger.error("=== RESEND_API_KEY is missing ===")
        return False

    if not to_email:
        logger.error("=== RECIPIENT EMAIL IS EMPTY ===")
        return False

    try:
        resend.api_key = settings.RESEND_API_KEY
        r = resend.Emails.send({
            "from": "onboarding@resend.dev",
            "to": to_email,
            "subject": subject or "No Subject",
            "html": body or ""
        })
        logger.info(f"=== EMAIL SENT SUCCESSFULLY TO {to_email}: {r} ===")
        return True
    except Exception as e:
        logger.exception(f"=== EMAIL FAILED: {e} ===")
        return False


def send_verification_email(to_email: str, otp: str) -> bool:
    if not otp:
        logger.error("OTP is None or empty. Cannot send verification email.")
        return False

    subject = "Verify your Sonder Account"
    body = f"""
    <html>
        <body>
            <h2>Welcome to Sonder!</h2>
            <p>Please use the following OTP to verify your account:</p>
            <h1>{otp}</h1>
            <p>If you did not request this, please ignore this email.</p>
        </body>
    </html>
    """
    return send_email(to_email, subject, body)