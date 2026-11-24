# Setting up your Food Diary

This takes about 15 minutes, and you only do it once. You'll need a computer (not your phone) and your Google account.

## Part A: Create a Google sign-in for the page

The page needs its own Google "OAuth client ID", so Google knows which page is asking to open your sheet. It's free.

1. **Create a project.** Go to <https://console.cloud.google.com/>, sign in, click the project picker at the top, then **New project**. Name it something like `Food Diary` and click **Create**. Make sure the new project is selected at the top.
2. **Turn on the two APIs.** Open **APIs & Services → Library**. Search for **Google Sheets API**, open it and click **Enable**. Go back, search for **Google Drive API**, and click **Enable**.
3. **Set up the consent screen.** Open **APIs & Services → OAuth consent screen**. In newer versions of the console this is called **Google Auth Platform → Branding / Audience**.
   - User type: **External**, then **Create**.
   - App name: `Food Diary`. User support email and developer contact: your own Gmail address.
   - Scopes: you can skip this page. The page asks for its access itself when you sign in.
   - Publishing status: leave it in **Testing**.
   - **Test users: add your own Gmail address.** While the app is in Testing mode, only the addresses listed here can sign in.
4. **Create the client ID.** Open **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**. Name: `Food Diary web`.
   - **Authorized JavaScript origins:** add `https://gt3c02.github.io`. Enter it exactly like this, with no path and no trailing slash.
   - Leave **Authorized redirect URIs** empty, because the page doesn't use redirects.
   - Click **Create** and copy the **Client ID**. It ends in `.apps.googleusercontent.com`. You don't need a client secret.

## Part B: Paste the client ID

Open `index.html`, find this line near the top:

```js
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```

and replace the placeholder with your Client ID. This is the only setting. The client ID is public (anyone who visits the page can see it), so it's fine to commit it. **Don't** put API keys, tokens, sheet IDs or any personal data in the repository.

The client ID for this repository is already set in `index.html`.

## Part C: Put the page online with GitHub Pages

Google sign-in only works on a page served over **https**. Opening `index.html` straight from your computer (`file://...`) won't work. The intended home is GitHub Pages on your account:

1. Create a repository called `food-diary` on <https://github.com/gt3c02>. Public is fine, because the repository holds code only.
2. Add these files: `index.html`, `README.md`, `SETUP.md`, `.gitignore`, and optionally `tests/`. Don't add screenshots or any data.
3. In the repository, go to **Settings → Pages**. Under **Build and deployment**, set **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**, then click **Save**.
4. After a minute or two, the page is live at **https://gt3c02.github.io/food-diary/**.

## Part D: First sign-in (on each device)

1. Open https://gt3c02.github.io/food-diary/ and tap **Sign in with Google**.
2. Choose your Google account. Google warns that the app "hasn't been verified". That's expected for a personal app in Testing mode, so tap **Continue**.
3. Allow access to **Google Sheets** and **Google Drive**. The page needs Drive access to read the photos your nutritionist bot saves and to save the photos you upload.
4. The page searches your Drive for a spreadsheet whose name contains **"Food & Weight Log"**. If it finds more than one, or none, it asks you to pick one or paste the sheet's URL. The choice is remembered only in that browser.

**On iPhone:** open the page in Safari, tap **Share → Add to Home Screen**, and it opens like an app. Sign in once inside the home-screen app as well, because it keeps its own storage separate from Safari. Each one stays signed in for about an hour, then needs one tap.

**Good to know**

- You stay signed in on this device for about an hour. A few minutes before that, if the page is open, it shows **Session ending, tap to stay signed in**. After the hour, tap **Continue as** your account. One tap, and Google usually skips the account picker. The page will not open a sign-in window unless you tap.
- In Testing mode, Google may ask you to approve access again about once a week. That's normal for unverified personal apps.
- To remove access at any time, go to <https://myaccount.google.com/permissions>.
