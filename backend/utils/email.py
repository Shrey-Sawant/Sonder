import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

# =========================
# BREVO CONFIG
# =========================
configuration = sib_api_v3_sdk.Configuration()
configuration.api_key["api-key"] = settings.BREVO_API_KEY

api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
    sib_api_v3_sdk.ApiClient(configuration)
)


# =========================
# CORE EMAIL SENDER
# =========================
def send_email(to_email: str, subject: str, html_content: str) -> bool:
    if not to_email:
        logger.error("Recipient email is missing")
        return False

    try:
        email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": to_email}],
            sender={
                "email": settings.SENDER_EMAIL,
                "name": settings.SENDER_NAME or "Auth System"
            },
            subject=subject,
            html_content=html_content
        )

        api_instance.send_transac_email(email)

        logger.info(f"Email sent successfully to {to_email}")
        return True

    except ApiException as e:
        logger.error(f"Brevo API error: {e}")
        return False

    except Exception as e:
        logger.exception(f"Unexpected email error: {e}")
        return False


# =========================
# OTP EMAIL WRAPPER
# =========================
def send_verification_email(to_email: str, otp: str) -> bool:
    subject = "Verify Your Account - OTP Code"

    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="padding: 20px;">
                <h2>Account Verification</h2>
                <p>Your OTP code is:</p>

                <h1 style="letter-spacing: 4px; color: #2d89ef;">
                    {otp}
                </h1>

                <p>This code is valid for <b>5 minutes</b>.</p>

                <hr>
                <p style="font-size: 12px; color: gray;">
                    If you did not request this, ignore this email.
                </p>
            </div>
        </body>
    </html>
    """

    return send_email(to_email, subject, html)