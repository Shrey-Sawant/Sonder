import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config.settings import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, body: str):
    try:
        msg = MIMEMultipart()
        msg["From"] = settings.MAIL_FROM
        msg["To"] = to_email
        msg["Subject"] = subject

        msg.attach(MIMEText(body, "html"))

        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT)
        server.starttls()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(settings.MAIL_FROM, to_email, text)
        server.quit()
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


def send_verification_email(to_email: str, otp: str):
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
