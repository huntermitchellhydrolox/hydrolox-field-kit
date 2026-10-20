# Hydrolox Field Kit

An app you install to the home screen on iPads and Galaxy Tabs. It holds the team's customer-facing files, encrypted, and works with no internet.

- **Private:** files are encrypted on your PC before they go anywhere, using AES-256. The website only ever holds scrambled data, and even the file names are hidden.
- **No logins:** each person enters a team passcode once per tablet, and never again.
- **Works offline:** every file is saved on the tablet. It opens instantly from its own home-screen icon.
- **Easy to use:** big folder tiles, instant search, and starred and recently opened files on the home screen.
- **Free:** hosted on GitHub Pages, with no monthly fees.

---

## How it fits together

```
 Your OneDrive "iPad Files" folder        (you edit files here, as normal)
            │
            ▼  Publisher.html (opened in Edge) encrypts with the team passcode
 GitHub folder on your PC  ─ data/        (only scrambled files)
            │
            ▼  GitHub Desktop: Commit + Push
 GitHub Pages website                     (public, but unreadable without the passcode)
            │
            ▼  Tablets download and unlock once, then keep a local copy
 iPad / Galaxy Tab app                    (works offline)
```

| In this folder | What it is |
|---|---|
| `Publisher.html` | **Your publishing tool.** Double-click it to open in Edge. |
| `data/` | Encrypted files written by the Publisher. Don't edit by hand. |
| `app/` | The tablet app. Don't edit. |
| `tools/`, `.github/` | Build scripts GitHub runs for you. Don't edit. |

---

## One-time setup (about 20 minutes)

You need a free GitHub account, the free **GitHub Desktop** app, and **Microsoft Edge** (already on your PC).

### 1. Create the repository
1. Sign in at github.com and click **New repository**.
2. Name it `hydrolox-field-kit`.
3. Choose **Public**. That's fine here because everything in it is encrypted, and free GitHub Pages needs a public repository.
4. Click **Create repository**.

### 2. Turn on GitHub Pages
In the new repository go to **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.

### 3. Clone it and add these files
1. Install **GitHub Desktop** (desktop.github.com) and sign in.
2. **File → Clone repository**, pick `hydrolox-field-kit`, and choose a folder on your PC.
3. Open the zip's **hydrolox-field-kit** folder and copy **everything inside it** (including the `.github` folder) into the cloned folder. Copy the contents, not the folder itself: the cloned folder should end up with `app`, `data`, `tools`, `.github` and `Publisher.html` directly inside it.

### 4. Publish your files for the first time
1. Make sure your OneDrive **iPad Files** folder has your folders in it (Animations, Case Studies, Installation Videos). Tip: right-click the folder → **Always keep on this device**, so publishing is fast.
2. Double-click **Publisher.html**. It opens in Edge.
3. **Step 1:** choose your OneDrive **iPad Files** folder.
4. **Step 2:** choose the cloned **hydrolox-field-kit** folder.
5. **Step 3:** create the team passcode and type it twice. Make it at least 12 characters, for example `Intake-Screen-Harbor-42`.
6. Click **Encrypt & prepare**.
7. In **GitHub Desktop**: type a summary, click **Commit to main**, then **Push origin**.

### 5. Wait for it to go live
On github.com, the **Actions** tab shows a green check after 1–3 minutes. Your app is then at:

```
https://<your-github-username>.github.io/hydrolox-field-kit/
```

---

## Installing on tablets (once per person, on Wi-Fi)

Requires iPadOS 17.4 or newer, or a current version of Chrome on Android.

**iPad**
1. Open the link in **Safari**.
2. Tap **Share** (□↑), then **Add to Home Screen**, then **Add**.
3. Open **Hydrolox** from the Home Screen.
4. Enter the team passcode.
5. Keep the app open until the top-right shows **"All N files saved offline"**.

**Galaxy Tab**
1. Open the link in **Chrome**.
2. Tap **⋮**, then **Add to Home screen** (or **Install app**).
3. Open it from the icon, enter the passcode, and wait for **"All N files saved offline"**.

**Test it:** turn on airplane mode, open the app, then play a video and open a PDF.

Send the link and the passcode separately, for example the link by email and the passcode by phone or Teams.

---

## Updating files (every time)

1. Change files in your OneDrive **iPad Files** folder: add, replace, rename or delete.
2. Open **Publisher.html**. It remembers your folders, so you may just need to click **Allow**. Enter the passcode and click **Encrypt & prepare**. Only new or changed files are processed.
3. In GitHub Desktop: **Commit to main**, then **Push origin**.

Tablets pick up the changes the next time someone opens the app online. Their old copies stay usable until the new ones have finished downloading.

**Tips:**
- **New tile:** create a new folder inside **iPad Files**. Subfolders work too.
- **Control the order:** start names with numbers, like `01 - Site Preparation.mp4`. The number is hidden in the app.
- **Underscores** in names show as spaces.
- **Best formats:** **MP4 (H.264)** for video, **PDF** for documents, JPG or PNG for images. Export PowerPoints to PDF if you want them to open inside the app. Other file types open in their own app through the share button.

---

## Changing the passcode (for example, when someone leaves)

1. In Publisher.html, tick **Change the team passcode**, enter the new one twice, and click **Encrypt & prepare**. Every file is re-encrypted.
2. Commit and push in GitHub Desktop.
3. Tablets keep working with their saved files. When they're next online, they show **"New passcode needed"**, and tapping it asks for the new code.

Changing the passcode stops a former team member from getting **new or updated** files. Copies already saved on their tablet stay readable to whoever holds it, as with any offline solution. Use iPad screen passcodes or Intune, and use **Remove files & passcode from this device** (tap the status pill) when a tablet is handed back.

---

## Limits to know

| Limit | Value | What to do |
|---|---|---|
| Largest single file | **100 MB** (GitHub rule) | The Publisher skips bigger files and lists them. Shrink them with the free **HandBrake** app (preset "Fast 1080p30"). |
| Total library | about **1 GB** (GitHub Pages) | Usually plenty for PDFs plus compressed videos. |
| Tablet storage | the whole library is stored | Check the device's free space if a download stalls. |

---

## How secure is it?

- **Encryption:** files are encrypted with AES-256-GCM. The key is derived from the passcode with 600,000 rounds of PBKDF2-SHA256, which makes guessing slow.
- **Scrambled names:** file and folder names are encrypted too. The repository and website only contain random file names like `3fa9c2….bin`.
- **The passcode is the only lock.** Use a long one that can't be guessed. Anyone with both the link and the passcode can get the files.
- **Your PC:** plain files never leave it. The Publisher runs entirely inside Edge and uploads nothing itself; GitHub Desktop pushes only the encrypted `data` folder.
- **The tablet:** after unlocking, files are stored unencrypted inside the app's private storage, protected by the tablet's own passcode or Face ID. The key stays inside the app's storage on the tablet.
- **Policy:** check that this approach is acceptable under Intralox's policies for hosting company material.

---

## Using the app

- **Status pill** (top right): green means everything is saved. Tap it for storage details, **Check for updates**, or **Remove files & passcode from this device**.
- **Search:** type any part of a file or folder name.
- **Star** a file (☆ at the top of the viewer) to pin it to the home screen.
- **"Not saved" tag** on a file: it's still downloading. Open the app on Wi-Fi to finish.
- **Share button:** AirDrop or email the file, or open it in another app (PowerPoint, Files and so on).

## Troubleshooting

- **The iPad shows "Add Field Kit to your Home Screen":** the link was opened in a Safari tab. Add it to the Home Screen and use the icon.
- **"That passcode isn't right":** check capitals and spaces. Passcodes are case-sensitive.
- **Changes not showing:** check for a green check in GitHub's **Actions** tab. Then open the app online, tap the status pill, and choose **Check for updates**.
- **The Publisher says "open in Edge or Chrome":** right-click Publisher.html → **Open with → Microsoft Edge**. A backup copy is also at `https://<username>.github.io/hydrolox-field-kit/publish.html`.
- **Forgot the passcode:** it can't be recovered. Set a new one in the Publisher (tick **Change the team passcode**) and share it with the team.
