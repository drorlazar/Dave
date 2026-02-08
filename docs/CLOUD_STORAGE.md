# Cloud Storage Setup Guide

DAVE can browse and display assets from **AWS S3** and **Google Drive** in addition to local folders. Everything runs in your browser - no server required.

---

## Quick Start

1. Open DAVE in your browser (locally or at the [live site](https://drorlazar-sett.github.io/Dave/))
2. Click the **gear icon** in the top bar to open Settings
3. Enter your credentials for S3 and/or Google Drive
4. Click **Source** in the toolbar and pick your cloud source

---

## AWS S3 Setup

### What You Need

- An AWS Access Key ID and Secret Access Key with read access to your S3 bucket
- CORS configured on your S3 bucket (see below)

### Step 1: Configure CORS on Your S3 Bucket

This is required so DAVE can access your bucket from the browser.

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Click your bucket name
3. Go to the **Permissions** tab
4. Scroll down to **Cross-origin resource sharing (CORS)** and click **Edit**
5. Paste the following configuration:

```json
[
  {
    "AllowedHeaders": ["Authorization", "x-amz-date", "x-amz-content-sha256", "content-type"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3600
  }
]
```

6. Click **Save changes**

> **Note**: For better security, replace `"*"` in `AllowedOrigins` with your specific URLs, e.g. `["https://drorlazar-sett.github.io", "http://localhost:7777"]`.

### Step 2: Add Your Credentials

1. Click the **gear icon** in DAVE's top bar
2. In the **AWS S3** section, fill in:
   - **Access Key ID** - starts with `AKIA...`
   - **Secret Access Key** - your secret key
   - **Region** - e.g. `eu-central-1` (default)
   - **Default Bucket** - the bucket name to browse
3. Click **Save**

Your credentials are stored in your browser's local storage (never sent to any server).

### Step 3: Browse

Click **Source > AWS S3** to browse your bucket.

### Other Ways to Load S3 Content

- **Paste a URL**: Copy an S3 console URL and paste it into the search bar
  - Example: `https://eu-central-1.console.aws.amazon.com/s3/buckets/my-bucket?prefix=my-folder/`
- **Drag and drop**: Drag an S3 URL from your browser address bar into the DAVE window
- **s3:// links**: Paste `s3://bucket-name/path/` into the search bar

### Getting AWS Credentials

If you don't have AWS credentials yet:

1. Go to the [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Navigate to **Users** and create a new user or select an existing one
3. Under **Security credentials**, click **Create access key**
4. Choose **Application running outside AWS**
5. Copy the Access Key ID and Secret Access Key

The user needs at minimum `s3:GetObject` and `s3:ListBucket` permissions on the target bucket.

---

## Google Drive Setup

### What You Need

A Google Cloud OAuth 2.0 Client ID (just the Client ID string, not a full JSON file).

### Step 1: Create Google Cloud OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Go to **APIs & Services > Library**
4. Search for **Google Drive API** and click **Enable**
5. Go to **APIs & Services > Credentials**
6. Click **Create Credentials > OAuth client ID**
7. If prompted, configure the **OAuth consent screen**:
   - Choose **External** user type
   - Fill in the app name (e.g. "DAVE Viewer")
   - Add your email as a test user
8. For Application type, choose **Web application**
9. Under **Authorized JavaScript origins**, add:
   - `https://drorlazar-sett.github.io` (for the live site)
   - `http://localhost:7777` (for local development)
10. Click **Create**
11. Copy the **Client ID** (it ends with `.apps.googleusercontent.com`)

### Step 2: Add Your Client ID

1. Click the **gear icon** in DAVE's top bar
2. In the **Google Drive** section, paste your Client ID
3. Click **Save**

### Step 3: Sign In

1. Click **Source > Google Drive** in the toolbar
2. A Google sign-in popup will appear
3. Grant DAVE permission to read your Drive files
4. The popup closes and you can now browse your Drive

> **Note**: Your Google session expires after 1 hour. Click Source > Google Drive again to re-authenticate when needed.

---

## Using Cloud Sources

### Browsing Folders

When you open a cloud source via **Source > AWS S3** or **Source > Google Drive**, a folder browser opens:

- Click any **folder** to navigate into it
- Use the **breadcrumb** at the top to go back
- The footer shows how many supported files are in the current folder
- Check **Subfolders** to include files from all nested folders
- Use the **depth dropdown** to limit subfolder depth (1, 2, 3 levels, or All)
- Click **Load Files** to display the files in the DAVE grid

### Subfolder Loading with Drag & Drop

When you paste or drag a cloud URL, DAVE respects the **subfolder toggle** setting in the top bar. If subfolders are set to "2", it will load files from 2 levels deep. If set to "off", it loads only the immediate folder.

### Supported File Types

Cloud sources support the same file types as local folders:
- 3D Models (FBX, GLB)
- Images (PNG, JPG, GIF, WebP, SVG, etc.)
- Videos (MP4, WebM, MOV, etc.)
- Audio (MP3, WAV, OGG, FLAC, etc.)
- Fonts (TTF, OTF, WOFF, WOFF2)
- Text files (TXT, JSON, XML, MD, etc.)

---

## Security Notes

- **Credentials are stored in your browser's local storage.** They are not sent to any server - DAVE connects directly to AWS/Google from your browser.
- Use scoped, **read-only** IAM credentials for S3 (not your root account keys).
- For Google Drive, only the Client ID is stored (no secrets). The OAuth token is kept in memory and expires after 1 hour.
- Anyone with access to your browser's DevTools can view stored credentials. This is standard for browser-based tools.

---

## Troubleshooting

### S3: "Cannot reach S3 bucket" / CORS error
- Your bucket needs CORS configured (see Step 1 above)
- Make sure the origin URL is in the `AllowedOrigins` list
- Try using `"*"` in AllowedOrigins to test, then restrict later

### S3: "Invalid AWS Access Key ID"
- Double-check your Access Key ID in Settings
- Make sure there are no extra spaces

### S3: "Access Denied"
- The IAM user needs `s3:ListBucket` and `s3:GetObject` permissions
- Check that the bucket name and region are correct

### Google Drive: Sign-in popup doesn't appear
- Make sure popups are not blocked for this site
- Check that the Google Identity Services library is not blocked by an ad blocker

### Google Drive: "Not configured" error
- Open Settings (gear icon) and verify your Client ID is saved
- It should end with `.apps.googleusercontent.com`

### Google Drive: "Session expired"
- Google Drive tokens expire after 1 hour
- Click Source > Google Drive again to re-authenticate

### Files not showing up
- DAVE only shows files with recognized extensions
- Check the filter settings (eye icon) to make sure the file type is enabled
