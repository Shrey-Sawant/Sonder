# EmailJS Template Setup Guide

This directory contains a professionally styled verification template you can use with EmailJS. Follow the instructions below to configure it in your EmailJS dashboard.

## Step-by-Step Setup

1. **Log in to EmailJS**: Go to the [EmailJS Dashboard](https://dashboard.emailjs.com/) and navigate to **Email Templates**.
2. **Create New Template**: Click **Create New Template**.
3. **Open HTML Source**: 
   - Click the **Source** button in the top/toolbar of the EmailJS Rich Text Editor to open the HTML raw code editor.
4. **Paste HTML**:
   - Open the [verification_template.html](file:///c:/Users/shrey/OneDrive/Desktop/Shrey/MERN/Sonder/backend/templates/verification_template.html) file, copy the entire contents, and paste it into the EmailJS HTML editor.
   - Click the **Source** button again to return to the rich text preview.
5. **Configure Email Header Fields** (on the right-hand side panel in EmailJS):
   - **To Email**: `{{to_email}}`
   - **To Name**: `{{to_name}}`
   - **Subject**: `{{subject}}`
6. **Save Changes**: Click **Save** in the top right.

## How It Maps to the Code
The backend script calls EmailJS with the following parameter mappings:
* `{{to_email}}`: Recipient's email address
* `{{otp}}`: The generated 6-digit OTP code
* `{{subject}}`: `"Verify Your Account - OTP Code"`
* `{{message}}`: Plaintext fallback text
* `{{to_name}}`: Recipient's display name
