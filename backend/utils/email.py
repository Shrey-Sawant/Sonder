import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from config.settings import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, body: str) -> bool:
    try:
        msg = MIMEMultipart()
        msg["From"] = settings.MAIL_FROM
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html"))

        server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.sendmail(settings.MAIL_FROM, to_email, msg.as_string())
        server.quit()

        logger.info(f"Email sent to {to_email}")
        return True

    except Exception as e:
        logger.exception(f"Email failed: {e}")
        return False


def send_verification_email(to_email: str, otp: str) -> bool:
    subject = "Verify your account"

    body = f"""
    <h2>Your OTP</h2>
    <h1>{otp}</h1>
    <p>Valid for 5 minutes</p>
    """

    return send_email(to_email, subject, body)