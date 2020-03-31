import nodemailer from 'nodemailer';
import Email from 'email-templates';

import { config } from './config';

// create an SMTP transporter to send Mails
const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpSecure,
  auth: {
    user: config.smtpUser,
    pass: config.smtpPass
  }
});

// Prepare Mailer default settings
export const email = new Email({
  message: {
    from: config.mailSender
  },
  transport: transporter,
  send: true,
  preview: false
});