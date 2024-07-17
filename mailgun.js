import FormData from "form-data";
import Mailgun from "mailgun.js";

export async function sendEmailWithMailgun(to, subject, text) {
  const mailgun = new Mailgun(FormData);
  const from = process.env.MAILGUN_FROM;
  const client = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY,
  });
  return await client.messages.create(process.env.MAILGUN_DOMAIN, {
    from,
    to,
    subject,
    text,
  });
}
