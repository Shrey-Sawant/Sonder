import resend
import logging

from config.settings import settings

logger = logging.getLogger(__name__)

resend.api_key = settings.RESEND_API_KEY


def send_email(
    to_email: str,
    subject: str,
    body: str,
) -> bool:
    try:
        params = {
            "from": "onboarding@resend.dev",
            "to": [to_email],
            "subject": subject,
            "html": body,
        }

        resend.Emails.send(params)

        logger.info(f"Email sent successfully to {to_email}")

        return True

    except Exception as e:
        logger.exception(f"Email sending failed: {e}")
        return False


def send_verification_email(
    to_email: str,
    otp: str,
) -> bool:
    subject = "Verify your Sonder Account"

    body = f"""
    <html>
        <body>
            <h2>Welcome to Sonder!</h2>

            <p>
                Please use the following OTP to verify your account:
            </p>

            <h1>{otp}</h1>

            <p>
                This OTP will expire in 5 minutes.
            </p>

            <p>
                If you did not request this email, please ignore it.
            </p>
        </body>
    </html>
    """

    return send_email(
        to_email=to_email,
        subject=subject,
        body=body,
    )