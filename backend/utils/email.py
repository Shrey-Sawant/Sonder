import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config.settings import settings
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send an email using SMTP. Returns True if successful, False otherwise."""
    if not all([settings.MAIL_FROM, settings.MAIL_SERVER, settings.MAIL_PORT, settings.MAIL_USERNAME, settings.MAIL_PASSWORD]):
        logger.error([settings.MAIL_FROM, settings.MAIL_SERVER, settings.MAIL_PORT, settings.MAIL_USERNAME, settings.MAIL_PASSWORD])
        return False

    if not to_email:
        logger.error("Recipient email is None or empty.")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.MAIL_FROM
        msg["To"] = to_email
        msg["Subject"] = subject or "No Subject"

        msg.attach(MIMEText(body or "", "html"))

        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT)
        server.starttls()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.sendmail(settings.MAIL_FROM, to_email, msg.as_string())
        server.quit()
        logger.info(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.exception(f"Failed to send email to {to_email}: {e}")
        return False


def send_verification_email(to_email: str, otp: str) -> bool:
    """Send an OTP verification email to the user."""
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
