import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config.settings import settings
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def send_email(to_email: str, subject: str, body: str) -> bool:
    if not all([settings.MAIL_FROM, settings.MAIL_SERVER, settings.MAIL_USERNAME, settings.MAIL_PASSWORD]):
        logger.error("=== MISSING MAIL SETTINGS — EMAIL NOT SENT ===")
        return False

    if not to_email:
        logger.error("=== RECIPIENT EMAIL IS EMPTY ===")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.MAIL_FROM
        msg["To"] = to_email
        msg["Subject"] = subject or "No Subject"
        msg.attach(MIMEText(body or "", "html"))

        logger.info(f"Connecting to SMTP SSL {settings.MAIL_SERVER}:465...")
        server = smtplib.SMTP_SSL(settings.MAIL_SERVER, 465)
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        logger.info("Login successful, sending email...")
        server.sendmail(settings.MAIL_FROM, to_email, msg.as_string())
        server.quit()
        logger.info(f"=== EMAIL SENT SUCCESSFULLY TO {to_email} ===")
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