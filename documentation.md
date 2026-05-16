# Deployment & Production Setup Guide: Seminar OS

This guide provides a comprehensive, step-by-step walkthrough for setting up **Seminar OS** on a shared cPanel hosting environment. This ensures the frontend, backend (Firebase), and mailing system all work perfectly.

---

## 1. Firebase Project Setup (Critical)

Since you are moving to a production environment, your application needs a **Service Account Key** to communicate with Firebase from your hosting server.

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Select your project.
3.  Click the **Gear icon (Project Settings)** in the sidebar.
4.  Go to the **Service accounts** tab.
5.  Click **Generate new private key** and then click **Generate key**.
6.  A `.json` file will download. **Open this file in a text editor (like Notepad)**. You will need to copy the *entire content* later.
7.  **Deploy Security Rules**:
    *   In the sidebar, go to **Firestore Database** -> **Rules**.
    *   Copy the content of the `firestore.rules` file from your project and paste it here. Click **Publish**.
    *   Do the same for **Storage** -> **Rules** using your `storage.rules` file.

---

## 2. Gmail Mailing System Setup

To send certificates via Gmail, you **must Not** use your regular password. You need an **App Password**.

1.  Go to your [Google Account Settings](https://myaccount.google.com/).
2.  Go to **Security**.
3.  Ensure **2-Step Verification** is turned **On**.
4.  Search for "App Passwords" in the search bar at the top or find it under 2-Step Verification.
5.  Enter a name (e.g., "Seminar OS") and click **Create**.
6.  Copy the **16-character code** generated. This is your "App Password".

---

## 3. Preparing the Application for Upload

1.  Open your project in your local environment.
2.  Run the build command:
    ```bash
    npm run build
    ```
3.  This command creates a folder named `dist` which contains:
    *   `index.html` and assets (Frontend)
    *   `server.js` (The backend server)

---

## 4. cPanel Hosting Setup

### Step A: Upload Files
1.  Log in to your cPanel.
2.  Open **File Manager**.
3.  Create a new folder for your app (e.g., `seminar-os`) *outside* of `public_html` for better security, or inside it if required by your host.
4.  Upload the following items to this folder:
    *   The `dist` folder (upload the entire folder).
    *   `package.json`.
    *   `firebase-applet-config.json`.

### Step B: Create the Node.js Application
1.  In cPanel, search for **Setup Node.js App**.
2.  Click **Create Application**.
3.  **Node.js version**: Choose 18.x or 20.x.
4.  **Application mode**: Production.
5.  **Application root**: The name of the folder you created (e.g., `seminar-os`).
6.  **Application URL**: Select your domain and the path (leave blank for root).
7.  **Application startup file**: Enter `dist/server.js`.
8.  Click **Create**.

### Step C: Install Dependencies
1.  After creating, look for the **Run npm install** button in the Node.js App interface and click it.
2.  Wait for it to finish.

---

## 5. Environment Variables (The Final Step)

In the **Setup Node.js App** interface, scroll to **Environment variables** and add these:

| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `FIREBASE_SERVICE_ACCOUNT` | *Paste the entire content of the JSON file you downloaded in Step 1 here.* |
| `GEMINI_API_KEY` | *(Your Gemini API Key if using AI features)* |

**Optional (For Custom SMTP):**
If you prefer not to use Gmail and use your hosting's email (e.g., info@yourdomain.com):
*   `SMTP_HOST`: e.g., `mail.yourdomain.com`
*   `SMTP_PORT`: Usually `465`
*   `SMTP_SECURE`: `true`

**Click "Save" and then "Restart" the application.**

---

## 6. Post-Deployment Configuration (Mailing System)

Once your application is running at your domain, follow these steps to activate the mailing system:

1.  Open your website and log in as an **Admin**.
2.  Go to the **Admin Dashboard**.
3.  Click on the **Settings** tab.
4.  Find the **Email Configuration** section.
5.  Enter your **SMTP/Gmail Email** and the **16-character App Password** you created in Step 2.
6.  Click **Save Settings**.
7.  Click **Test SMTP Connection** to verify it's working. If you receive a test email, your system is fully operational.

---

## 7. How it All Works Together

*   **Frontend**: Served from the `dist` folder.
*   **Leaderboard**: The leaderboard is public. It allows anyone (even guest users) to see the top participants by checking attendance records where `attended` is true.
*   **Database**: Connects to Firebase Cloud Firestore.
*   **Verification**: The `/verify?code=XXX` link uses the backend server to automatically generate social media previews (SEO).
*   **Mailing**: Uses the credentials you saved in the Dashboard (Settings panel) with the App Password.

### Troubleshooting
*   **Leaderboard Errors**: If the leaderboard fails to load, ensure your Firestore rules allow public reading of attended records (this was fixed in the latest update).
*   **Page Not Found (404) on Refresh**: This app uses a "Single Page" design. The `server.js` handles routing, but if you have issues, ensure the Node.js app is properly pointed to `dist/server.js`.
*   **Emails Not Sending**: Double-check your **App Password**. Some hosts block port 465; if so, try port 587 with `SMTP_SECURE=false`.
