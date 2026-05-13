import express, { Request } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import firebaseConfig from "./firebase-applet-config.json";

import { getFirestore } from "firebase-admin/firestore";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Initialize Firebase Admin
let firestore: any;
let authAdmin: any;

function initializeFirebase() {
  try {
    if (!getApps().length) {
      console.log('Initializing Firebase Admin with project:', firebaseConfig.projectId);
      
      let credential = undefined;
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
          console.log('Using service account from environment variable');
        } catch (e) {
          console.error('Invalid FIREBASE_SERVICE_ACCOUNT format:', e);
        }
      }

      initializeApp({
        credential,
        projectId: firebaseConfig.projectId,
      });
    }
    const app = getApps()[0];
    firestore = firebaseConfig.firestoreDatabaseId 
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
    authAdmin = getAuth(app);
    console.log(`Firestore initialized for database: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);
    return true;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin/Firestore:", error);
    return false;
  }
}

initializeFirebase();

export async function setupApp() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '100mb' }));

  // Health check endpoint
  app.get("/api/ping", (req, res) => {
    res.json({ 
      status: "ok", 
      time: new Date().toISOString(),
      firestore: !!firestore,
      env: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL
    });
  });

  // Helper to log emails to Firestore
  const logEmail = async (emailData: {
    to: string;
    subject: string;
    status: 'sent' | 'failed';
    error?: string;
    type: 'certificate' | 'test' | 'bulk';
    sentBy: string;
  }) => {
    if (!firestore) {
      console.warn('Cannot log email: Firestore not initialized');
      return;
    }
    try {
      await firestore.collection('emailLogs').add({
        ...emailData,
        timestamp: new Date().toISOString(),
      });
      console.log(`Logged ${emailData.status} email to ${emailData.to}`);
    } catch (err) {
      console.error('Failed to log email to Firestore:', err);
    }
  };

  // Add a system log on startup to verify logging is working
  logEmail({
    to: 'System',
    subject: 'Seminar OS Email System Started',
    status: 'sent',
    type: 'test',
    sentBy: 'Internal'
  }).catch(e => console.error('Startup log failed', e));

  // Middleware to verify Firebase ID Token
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      if (!authAdmin) {
        console.log('Auth Admin not ready, attempting re-initialization');
        initializeFirebase();
      }
      
      if (!authAdmin) {
        return res.status(500).json({ error: 'Firebase Auth not initialized' });
      }

      const decodedToken = await authAdmin.verifyIdToken(idToken);
      req.user = decodedToken;
      
      // email_verified check for security
      if (!decodedToken.email_verified) {
        return res.status(403).json({ error: 'Forbidden: Email must be verified' });
      }

      // 1. Check if user is the hardcoded super-admin first
      const superAdmins = ["alvicourse@gmail.com", "cdc@creativealvi.com"];
      if (decodedToken.email && superAdmins.includes(decodedToken.email.toLowerCase())) {
        return next();
      }
      
      // 2. Otherwise, check Firestore for admin role
      if (firestore) {
        try {
          const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
          const userData = userDoc.data();
          
          if (userData && userData.role === 'admin') {
            return next();
          }
        } catch (fsError) {
          console.error('Firestore admin check failed:', fsError);
        }
      }

      res.status(403).json({ error: 'Forbidden: Admin access required' });
    } catch (error: any) {
      console.error('Error verifying token:', error);
      res.status(401).json({ error: 'Unauthorized: Invalid token', details: error.message });
    }
  };

  // Cache for transporter to reuse connections
  let mailTransporter: any = null;
  let currentConfig: string = "";

  const getTransporter = (email: string, pass: string) => {
    const configKey = `${email}:${pass}`;
    if (mailTransporter && currentConfig === configKey) {
      return mailTransporter;
    }

    mailTransporter = nodemailer.createTransport({
      service: "gmail",
      pool: true, // Use connection pooling
      maxConnections: 5,
      maxMessages: 100,
      auth: {
        user: email,
        pass: pass,
      },
    });
    currentConfig = configKey;
    return mailTransporter;
  };

  // API routes
  app.post("/api/send-test-email", authenticate, async (req, res) => {
    const { email, appPassword, testRecipient } = req.body;

    if (!email || !appPassword || !testRecipient) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const transporter = getTransporter(email, appPassword);

      await transporter.sendMail({
        from: email,
        to: testRecipient,
        subject: "Seminar OS - Test Email Connection",
        text: "This is a test email to verify your Gmail connection settings in Seminar OS. If you received this, your configuration is correct!",
        html: "<b>This is a test email to verify your Gmail connection settings in Seminar OS.</b><p>If you received this, your configuration is correct!</p>",
      });

      await logEmail({
        to: testRecipient,
        subject: "Seminar OS - Test Email Connection",
        status: 'sent',
        type: 'test',
        sentBy: req.user.email
      });

      res.json({ success: true, message: "Test email sent successfully!" });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      
      await logEmail({
        to: testRecipient,
        subject: "Seminar OS - Test Email Connection",
        status: 'failed',
        error: error.message,
        type: 'test',
        sentBy: req.user.email
      });

      res.status(500).json({ 
        error: "Failed to send test email", 
        details: error.message 
      });
    }
  });

  app.post("/api/send-certificate", authenticate, async (req, res) => {
    const { 
      to, 
      subject, 
      body, 
      attachmentBase64, 
      fileName,
      gmailEmail: bodyEmail,
      gmailAppPassword: bodyPass
    } = req.body;

    let gmailEmail = bodyEmail || process.env.GMAIL_EMAIL;
    let gmailAppPassword = bodyPass || process.env.GMAIL_APP_PASSWORD;

    try {
      // If not provided in body or env, try to fetch from Firestore
      if (!gmailEmail || !gmailAppPassword) {
        if (firestore) {
          try {
            const settingsDoc = await firestore.collection('siteSettings').doc('general').get();
            const settings = settingsDoc.data();
            if (settings) {
              gmailEmail = gmailEmail || settings.gmailEmail;
              gmailAppPassword = gmailAppPassword || settings.gmailAppPassword;
            }
          } catch (fsError) {
            console.error("Failed to fetch settings from Firestore:", fsError);
          }
        }
      }

      if (!gmailEmail || !gmailAppPassword) {
        return res.status(500).json({ error: "Gmail credentials not configured" });
      }

      if (!to || !subject || !body) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const transporter = getTransporter(gmailEmail, gmailAppPassword);
      
      const mailOptions: any = {
        from: gmailEmail,
        to,
        subject,
        text: body,
      };

      if (attachmentBase64) {
        mailOptions.attachments = [
          {
            filename: fileName || "certificate.pdf",
            content: attachmentBase64.includes("base64,") 
              ? attachmentBase64.split("base64,")[1] 
              : attachmentBase64,
            encoding: 'base64'
          }
        ];
      }

      await transporter.sendMail(mailOptions);
      
      await logEmail({
        to,
        subject,
        status: 'sent',
        type: 'certificate',
        sentBy: req.user.email
      });

      res.json({ success: true, message: "Email sent successfully!" });
    } catch (error: any) {
      console.error("Error sending email:", error);
      
      await logEmail({
        to: to || 'unknown',
        subject: subject || 'No Subject',
        status: 'failed',
        error: error.message,
        type: 'certificate',
        sentBy: req.user.email
      });

      res.status(500).json({ 
        error: "Failed to send email", 
        details: error.message 
      });
    }
  });

  app.post("/api/send-certificates-bulk", authenticate, async (req, res) => {
    const { 
      emails, // Array of { to, subject, body, attachmentBase64, fileName }
      gmailEmail: bodyEmail,
      gmailAppPassword: bodyPass
    } = req.body;

    let gmailEmail = bodyEmail || process.env.GMAIL_EMAIL;
    let gmailAppPassword = bodyPass || process.env.GMAIL_APP_PASSWORD;

    try {
      // If not provided in body or env, try to fetch from Firestore
      if (!gmailEmail || !gmailAppPassword) {
        if (firestore) {
          try {
            const settingsDoc = await firestore.collection('siteSettings').doc('general').get();
            const settings = settingsDoc.data();
            if (settings) {
              gmailEmail = gmailEmail || settings.gmailEmail;
              gmailAppPassword = gmailAppPassword || settings.gmailAppPassword;
            }
          } catch (fsError) {
            console.error("Failed to fetch settings from Firestore:", fsError);
          }
        }
      }

      if (!gmailEmail || !gmailAppPassword) {
        return res.status(500).json({ error: "Gmail credentials not configured" });
      }

      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const transporter = getTransporter(gmailEmail, gmailAppPassword);
      
      // Send all emails in the batch
      const results = await Promise.allSettled(emails.map(async (emailData) => {
        const mailOptions: any = {
          from: gmailEmail,
          to: emailData.to,
          subject: emailData.subject,
          text: emailData.body,
        };

        if (emailData.attachmentBase64) {
          mailOptions.attachments = [
            {
              filename: emailData.fileName || "certificate.pdf",
              content: emailData.attachmentBase64.includes("base64,") 
                ? emailData.attachmentBase64.split("base64,")[1] 
                : emailData.attachmentBase64,
              encoding: 'base64'
            }
          ];
        }

        try {
          await transporter.sendMail(mailOptions);
          await logEmail({
            to: emailData.to,
            subject: emailData.subject,
            status: 'sent',
            type: 'bulk',
            sentBy: req.user.email
          });
          return { success: true };
        } catch (err: any) {
          await logEmail({
            to: emailData.to,
            subject: emailData.subject,
            status: 'failed',
            error: err.message,
            type: 'bulk',
            sentBy: req.user.email
          });
          throw err;
        }
      }));

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      res.json({ 
        success: true, 
        message: `Processed ${emails.length} emails. Success: ${successful}, Failed: ${failed}`,
        results: results.map(r => r.status)
      });
    } catch (error: any) {
      console.error(`Error in bulk sending:`, error);
      res.status(500).json({ 
        error: `Failed to process bulk emails`, 
        details: error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.VERCEL) {
    // On Vercel, static files are served by the platform
    console.log('Running on Vercel, skipping static file serving from Express');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', async (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      const code = req.query.code as string;

      if (req.path === '/verify' && code) {
        try {
          const snapshot = await firestore.collection('certificates').where('verificationCode', '==', code.toUpperCase()).limit(1).get();
          if (!snapshot.empty) {
            const cert = snapshot.docs[0].data();
            let html = fs.readFileSync(indexPath, 'utf-8');
            
            const title = `Verified Certificate: ${cert.seminarTitle}`;
            const description = `${cert.studentName} has successfully completed ${cert.seminarTitle}. Verification Code: ${cert.verificationCode}`;
            
            const meta = `
              <title>${title}</title>
              <meta name="description" content="${description}">
              <meta property="og:title" content="${title}">
              <meta property="og:description" content="${description}">
              <meta property="og:type" content="website">
              <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}">
              <meta name="twitter:card" content="summary">
              <meta name="twitter:title" content="${title}">
              <meta name="twitter:description" content="${description}">
            `;
            html = html.replace('<title>My Google AI Studio App</title>', meta);
            return res.send(html);
          }
        } catch (e) {
          console.error('Metadata injection failed:', e);
        }
      }
      res.sendFile(indexPath);
    });
  }

  return { app, PORT };
}

// Global promise for the app instance to reuse in serverless environments
const appPromise = setupApp();

// Vercel entry point
export default async (req: any, res: any) => {
  try {
    const { app } = await appPromise;
    return app(req, res);
  } catch (error: any) {
    console.error("Vercel entry point error:", error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Internal Server Error", 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
};

// Local / Container start
if (!process.env.VERCEL) {
  appPromise.then(({ app, PORT }) => {
    console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }).catch(error => {
    console.error("Failed to start server:", error);
  });
}
