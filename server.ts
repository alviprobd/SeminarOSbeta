import express, { Request } from "express";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import * as admin from "firebase-admin";
import { initializeApp, getApps } from "firebase-admin/app";
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

try {
  // Initialize Firebase Admin
  if (!getApps().length) {
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountVar) {
      try {
        const serviceAccount = JSON.parse(serviceAccountVar);
        initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: firebaseConfig.projectId,
        });
        console.log("Firebase Admin initialized with Service Account from environment variable.");
      } catch (parseError) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:", parseError);
        // Fallback to default
        initializeApp({
          projectId: firebaseConfig.projectId,
        });
      }
    } else {
      // Standard initialization for Google Cloud environments
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log("Firebase Admin initialized with default project ID.");
    }
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

let firestore: any;
try {
  const app = getApps()[0];
  const dbId = firebaseConfig.firestoreDatabaseId;
  console.log(`Initializing Firestore with Database ID: ${dbId || "(default)"} on Project: ${firebaseConfig.projectId}`);
  
  firestore = dbId 
    ? getFirestore(app, dbId)
    : getFirestore(app);
    
  // Simple check to see if we can access the project
  console.log(`Firestore instance initialized for project: ${firestore.projectId}`);
} catch (error) {
  console.error("Failed to initialize Firestore:", error);
}

export const app = express();
app.use(express.json({ limit: '100mb' }));

  // Middleware to verify Firebase ID Token
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
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
      try {
        const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();
        
        if (userData && userData.role === 'admin') {
          return next();
        }
      } catch (fsError) {
        console.error('Firestore admin check failed with error:', fsError);
        // If we get PERMISSION_DENIED here, it confirms a server-wide issue
        if (fsError instanceof Error && fsError.message.includes('PERMISSION_DENIED')) {
          console.error('CRITICAL: Server identity lacks PERMISSION to read "users" collection.');
        }
      }

      res.status(403).json({ error: 'Forbidden: Admin access required' });
    } catch (error) {
      console.error('Error verifying token:', error);
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };

  // Cache for transporter to reuse connections
  let mailTransporter: any = null;
  let currentConfig: string = "";

  const getTransporter = (email: string, pass: string, options?: { host?: string, port?: number, secure?: boolean }) => {
    const configKey = `${email}:${pass}:${options?.host || ""}:${options?.port || ""}:${options?.secure}`;
    if (mailTransporter && currentConfig === configKey) {
      return mailTransporter;
    }
 
    const smtpHost = options?.host || process.env.SMTP_HOST; // e.g., smtp.gmail.com or mail.yourdomain.com
    const smtpPort = options?.port || parseInt(process.env.SMTP_PORT || "465");
    const smtpSecure = options?.secure !== undefined ? options.secure : (process.env.SMTP_SECURE !== "false"); // Default to true (SSL/TLS)
 
    const transportConfig: any = {
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: {
        user: email,
        pass: pass,
      },
    };

    if (smtpHost) {
      transportConfig.host = smtpHost;
      transportConfig.port = smtpPort;
      transportConfig.secure = smtpSecure;
    } else {
      transportConfig.service = "gmail";
    }

    mailTransporter = nodemailer.createTransport(transportConfig);
    currentConfig = configKey;
    return mailTransporter;
  };

  // Helper to log emails to Firestore
  const logEmail = async (emailData: {
    to: string;
    subject: string;
    status: 'sent' | 'failed';
    error?: string;
    type: 'certificate' | 'test' | 'bulk';
    sentBy: string;
  }) => {
    try {
      if (!firestore) {
         console.warn('Cannot log email: Firestore not initialized');
         return;
      }
      const logData = {
        ...emailData,
        timestamp: new Date().toISOString(),
      };
      
      console.log(`Attempting to log email in collection "emailLogs" with data:`, JSON.stringify(logData));
      
      const docRef = await firestore.collection('emailLogs').add(logData);
      console.log(`Email log search successful. Doc ID: ${docRef.id}`);
    } catch (err: any) {
      console.error('Failed to log email to Firestore:', err);
      if (err.message && err.message.includes('PERMISSION_DENIED')) {
          console.error(`PERMISSIONS DEBUG: dbId=${firebaseConfig.firestoreDatabaseId}, projectId=${firebaseConfig.projectId}`);
      }
    }
  };

  // API routes
  app.post("/api/send-test-email", authenticate, async (req, res) => {
    const { email, appPassword, testRecipient, smtpHost, smtpPort, smtpSecure } = req.body;
 
    if (!email || !appPassword || !testRecipient) {
      return res.status(400).json({ error: "Missing required fields" });
    }
 
    try {
      const transporter = getTransporter(email, appPassword, { host: smtpHost, port: smtpPort, secure: smtpSecure });

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
      gmailAppPassword: bodyPass,
      smtpHost: bodyHost,
      smtpPort: bodyPort,
      smtpSecure: bodySecure
    } = req.body;
 
    let gmailEmail = bodyEmail;
    let gmailAppPassword = bodyPass;
    let smtpHost = bodyHost;
    let smtpPort = bodyPort;
    let smtpSecure = bodySecure;
 
    try {
      // If not provided in body, try to fetch from Firestore
      if (!gmailEmail || !gmailAppPassword) {
        try {
          const settingsDoc = await firestore.collection('siteSettings').doc('general').get();
          const settings = settingsDoc.data();
          if (settings) {
            gmailEmail = gmailEmail || settings.gmailEmail;
            gmailAppPassword = gmailAppPassword || settings.gmailAppPassword;
            
            // Only use SMTP fields if mode is explicitly set to smtp in settings,
            // or if they were already provided in the request body
            if (settings.mailMode === 'smtp' || bodyHost) {
              smtpHost = bodyHost || settings.smtpHost;
              smtpPort = bodyPort || settings.smtpPort;
              smtpSecure = bodySecure !== undefined ? bodySecure : settings.smtpSecure;
            }
          }
        } catch (fsError) {
          console.error("Failed to fetch settings from Firestore:", fsError);
        }
      }
 
      if (!gmailEmail || !gmailAppPassword) {
        return res.status(500).json({ error: "Email credentials not configured" });
      }
 
      if (!to || !subject || !body) {
        return res.status(400).json({ error: "Missing required fields" });
      }
 
      const transporter = getTransporter(gmailEmail, gmailAppPassword, { host: smtpHost, port: smtpPort, secure: smtpSecure });
      
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
      
      // Attempt server-side log
      logEmail({
        to,
        subject,
        status: 'sent',
        type: 'certificate',
        sentBy: req.user.email
      }).catch(e => console.warn("Background logEmail failed:", e.message));

      res.json({ success: true, message: "Email sent successfully!", to });
    } catch (error: any) {
      console.error("Error sending email:", error);
      
      logEmail({
        to: to || 'unknown',
        subject: subject || 'No Subject',
        status: 'failed',
        error: error.message,
        type: 'certificate',
        sentBy: req.user.email
      }).catch(e => console.warn("Background logEmail failed:", e.message));

      res.status(500).json({ 
        error: "Failed to send email", 
        details: error.message,
        to: to || 'unknown'
      });
    }
  });

  app.post("/api/send-certificates-bulk", authenticate, async (req, res) => {
    const { 
      emails, // Array of { to, subject, body, attachmentBase64, fileName }
      gmailEmail: bodyEmail,
      gmailAppPassword: bodyPass,
      smtpHost: bodyHost,
      smtpPort: bodyPort,
      smtpSecure: bodySecure
    } = req.body;

    let gmailEmail = bodyEmail;
    let gmailAppPassword = bodyPass;
    let smtpHost = bodyHost;
    let smtpPort = bodyPort;
    let smtpSecure = bodySecure;
 
    try {
      // If not provided in body, try to fetch from Firestore
      if (!gmailEmail || !gmailAppPassword) {
        try {
          const settingsDoc = await firestore.collection('siteSettings').doc('general').get();
          const settings = settingsDoc.data();
          if (settings) {
            gmailEmail = gmailEmail || settings.gmailEmail;
            gmailAppPassword = gmailAppPassword || settings.gmailAppPassword;
            
            // Only use SMTP fields if mode is explicitly set to smtp in settings,
            // or if they were already provided in the request body
            if (settings.mailMode === 'smtp' || bodyHost) {
              smtpHost = bodyHost || settings.smtpHost;
              smtpPort = bodyPort || settings.smtpPort;
              smtpSecure = bodySecure !== undefined ? bodySecure : settings.smtpSecure;
            }
          }
        } catch (fsError) {
          console.error("Failed to fetch settings from Firestore:", fsError);
        }
      }
 
      if (!gmailEmail || !gmailAppPassword) {
        return res.status(500).json({ error: "Email credentials not configured" });
      }

      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const transporter = getTransporter(gmailEmail, gmailAppPassword, { host: smtpHost, port: smtpPort, secure: smtpSecure });
      
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
          // Attempt server-side log, but don't fail if it doesn't work
          logEmail({
            to: emailData.to,
            subject: emailData.subject,
            status: 'sent',
            type: 'bulk',
            sentBy: req.user.email
          }).catch(e => console.warn("Background logEmail failed:", e.message));

          return { success: true, to: emailData.to };
        } catch (err: any) {
          logEmail({
            to: emailData.to,
            subject: emailData.subject,
            status: 'failed',
            error: err.message,
            type: 'bulk',
            sentBy: req.user.email
          }).catch(e => console.warn("Background logEmail failed:", e.message));

          return { success: false, to: emailData.to, error: err.message };
        }
      }));

      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success)).length;

      if (emails.length > 0 && successful === 0) {
        return res.status(500).json({
          error: "All emails in this batch failed to send",
          successful,
          failed,
          results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: (r as PromiseRejectedResult).reason.message })
        });
      }

      res.json({ 
        success: true, 
        message: `Processed ${emails.length} emails. Success: ${successful}, Failed: ${failed}`,
        successful,
        failed,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: (r as PromiseRejectedResult).reason.message })
      });
    } catch (error: any) {
      console.error(`Error in bulk sending:`, error);
      res.status(500).json({ 
        error: `Failed to process bulk emails`, 
        details: error.message 
      });
    }
  });

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
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

  async function startServer() {
    console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);
    try {
      if (process.env.NODE_ENV !== "production") {
        const { createServer } = await import("vite");
        const vite = await createServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      }

      const PORT = 3000;
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    } catch (error) {
      console.error("Failed to start server:", error);
    }
  }

  if (!process.env.VERCEL) {
    startServer();
  }
