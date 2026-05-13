# Installation Guide: Seminar OS on cPanel Shared Hosting

This guide provides detailed instructions on how to deploy the **Seminar OS** application to a cPanel-based shared hosting environment.

## Prerequisites

Before you begin, ensure your cPanel hosting meets the following requirements:
1.  **Node.js Support**: Your hosting provider must have the "Setup Node.js App" feature enabled in cPanel.
2.  **Node.js Version**: Version 18.x or 20.x is recommended.
3.  **Terminal Access (Optional but Recommended)**: Access to the "Terminal" feature in cPanel makes the process much faster.
4.  **Firebase Project**: You should have your Firebase configuration ready (already present in `firebase-applet-config.json`).

---

## Method 1: Full-Stack Deployment (Recommended)

This method ensures all features, including **Email Certificates** and **Reminders**, work correctly by running the Express backend.

### Step 1: Prepare the Build Locally

Since shared hosting environments often have limited resources, it is best to build the frontend on your local machine first.

1.  Open your terminal in the project root.
2.  Run the build command:
    ```bash
    npm run build
    ```
3.  This will create a `dist` folder containing your compiled frontend assets.

### Step 2: Upload Files to cPanel

1.  Log in to your cPanel.
2.  Open **File Manager** and navigate to your domain's root directory (usually `public_html` or a specific folder for your subdomain).
3.  Upload the following files and folders:
    *   `dist/` (The entire folder)
    *   `src/` (Optional, but some imports might reference it)
    *   `server.ts`
    *   `package.json`
    *   `package-lock.json`
    *   `firebase-applet-config.json`
    *   `tsconfig.json`
    *   `.env` (If you have one)

### Step 3: Create the Node.js Application

1.  In cPanel, search for and open **Setup Node.js App**.
2.  Click **Create Application**.
3.  Configure the following settings:
    *   **Node.js version**: Select 18.x or 20.x.
    *   **Application mode**: Set to `Production`.
    *   **Application root**: The folder where you uploaded the files (e.g., `seminar-os`).
    *   **Application URL**: Select your domain and the desired path.
    *   **Application startup file**: Set this to `server.ts` (Note: If your host doesn't support `.ts` directly, see the "Compiling Server" section below).
4.  Click **Create**.

### Step 4: Install Dependencies

1.  Once the app is created, you will see a section for "Run npm install".
2.  Click the **Run npm install** button.
3.  Alternatively, if you have Terminal access:
    ```bash
    cd /path/to/your/app
    npm install
    ```

### Step 5: Handling TypeScript on the Server

Most cPanel Node.js selectors expect a `.js` file. To run the TypeScript server:

**Option A: Using `tsx` (Easiest)**
In your `package.json`, ensure you have a start script:
```json
"scripts": {
  "start": "npx tsx server.ts"
}
```
Then, in the cPanel Node.js App settings, set the **Application startup file** to a small loader file named `app.js` that you create:
```javascript
// app.js
import('tsx/esm/api').then(() => {
  import('./server.ts');
});
```

**Option B: Compiling to JavaScript (Most Stable)**
1.  Locally, run the server build command:
    ```bash
    npm run build:server
    ```
2.  This will create `dist/server.js`.
3.  Upload `dist/server.js` to your server.
4.  Set the **Application startup file** in cPanel to `dist/server.js`.

### Step 6: Environment Variables

If your app requires environment variables (like `GEMINI_API_KEY`):
1.  In the **Setup Node.js App** interface, scroll down to **Environment variables**.
2.  Add your keys and values.
3.  Click **Save** and then **Restart** the application.

---

## Method 2: Static Hosting (Frontend Only)

If your hosting **does not** support Node.js, you can still host the frontend, but **API features (Emails/Certificates) will not work**.

1.  Run `npm run build` locally.
2.  Upload the **contents** of the `dist` folder directly to `public_html`.
3.  Create a `.htaccess` file in `public_html` to handle React Router navigation:
    ```apache
    <IfModule mod_rewrite.c>
      RewriteEngine On
      RewriteBase /
      RewriteRule ^index\.html$ - [L]
      RewriteCond %{REQUEST_FILENAME} !-f
      RewriteCond %{REQUEST_FILENAME} !-d
      RewriteRule . /index.html [L]
    </IfModule>
    ```

---

## Troubleshooting

*   **503 Service Unavailable**: This usually means the Node.js app crashed on startup. Check the "stderr" logs in the Node.js App interface.
*   **Firebase Errors**: Ensure `firebase-applet-config.json` is in the application root and contains valid credentials.
*   **Email Not Sending**: Ensure you are using a **Gmail App Password**, not your regular password. Some shared hosts block outgoing SMTP ports; you may need to ask your host to whitelist your Gmail connection.
*   **Port Issues**: The application is configured to listen on port 3000. cPanel's Node.js selector handles the proxying automatically, so you don't need to change the port in `server.ts`.

---

## Support

For further assistance, please refer to the official documentation of your hosting provider regarding "cPanel Node.js Selector" or "Passenger Node.js".
