import requests
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

# =========================
# CORE EMAIL SENDER (EMAILJS)
# =========================
def send_email(to_email: str, subject: str, template_params: dict) -> bool:
    if not to_email:
        logger.error("Recipient email is missing")
        return False

    service_id = settings.EMAILJS_SERVICE_ID
    template_id = settings.EMAILJS_TEMPLATE_ID
    public_key = settings.EMAILJS_PUBLIC_KEY
    private_key = settings.EMAILJS_PRIVATE_KEY

    # Check if configurations are present
    if not service_id or service_id == "your_service_id_here":
        logger.error("EmailJS Service ID is not configured.")
        return False
    if not template_id or template_id == "your_template_id_here":
        logger.error("EmailJS Template ID is not configured.")
        return False
    if not public_key or public_key == "your_public_key_here":
        logger.error("EmailJS Public Key is not configured.")
        return False

    payload = {
        "service_id": service_id,
        "template_id": template_id,
        "user_id": public_key,
        "template_params": template_params
    }

    # Add private key / access token if set and valid
    if private_key and private_key != "your_private_key_here":
        payload["accessToken"] = private_key

    try:
        response = requests.post(
            "https://api.emailjs.com/api/v1.0/email/send",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info(f"Email sent successfully via EmailJS to {to_email}")
            return True
        else:
            error_msg = response.text
            if response.status_code == 422 and "recipients address is empty" in error_msg.lower():
                logger.error(
                    f"EmailJS API error: {response.status_code} - {error_msg}. "
                    "TIP: Make sure the 'To Email' field in your EmailJS template settings "
                    "contains a variable that matches one of the passed keys, e.g. {{to_email}} or {{reply_to}}."
                )
            else:
                logger.error(f"EmailJS API error: {response.status_code} - {error_msg}")
            return False

    except Exception as e:
        logger.exception(f"Unexpected email error during EmailJS send: {e}")
        return False


def send_verification_email(to_email: str, otp: str) -> bool:
    subject = "Verify Your Account - OTP Code"
    
    # Setup template parameters to support both the custom Sonder template
    # and default EmailJS templates. We include multiple synonyms for the
    # recipient address, the OTP code, the company name, and expiration times.
    template_params = {
        # Recipient email fallbacks
        "to_email": to_email,
        "reply_to": to_email,  # EmailJS default recipient variable name
        "email": to_email,
        "to": to_email,
        
        # OTP / verification code fallbacks
        "otp": otp,
        "otp_code": otp,
        "code": otp,
        "passcode": otp,
        
        # Company name fallbacks
        "company_name": "Sonder",
        "company": "Sonder",
        "app_name": "Sonder",
        
        # Expiry fallbacks
        "expiry": "5 minutes",
        "expires": "5 minutes",
        "valid_till": "5 minutes",
        
        # Standard text parameters
        "subject": subject,
        "message": f"Your OTP code is: {otp}. This code is valid for 5 minutes.",
        "to_name": to_email.split('@')[0]
    }

    return send_email(to_email, subject, template_params)