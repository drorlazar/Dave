# Google Drive Integration Setup Guide

This guide will help you set up Google Drive integration for Dave - Digital Assets Viewer.

## Overview

The Google Drive integration allows users to:
1. Browse and load files from their own Google Drive
2. Access shared Google Drive folders using public links

## Prerequisites

- A Google Account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter a project name (e.g., "Dave Asset Viewer")
5. Click "Create"

### 2. Enable Google Drive API

1. In your project, go to "APIs & Services" > "Library"
2. Search for "Google Drive API"
3. Click on "Google Drive API"
4. Click "Enable"

### 3. Create OAuth 2.0 Client ID

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" for User Type
   - Fill in the required fields:
     - App name: "Dave Asset Viewer"
     - User support email: Your email
     - Developer contact email: Your email
   - Click "Save and Continue"
   - Skip adding scopes (click "Save and Continue")
   - Add test users if needed (your Google account email)
   - Click "Save and Continue"
4. Back at "Create OAuth client ID":
   - Choose "Web application" as Application type
   - Name: "Dave Web Client"
   - Add Authorized JavaScript origins:
     - `http://localhost:7777`
     - `http://127.0.0.1:7777`
     - Add your production URL if you have one
   - Add Authorized redirect URIs:
     - `http://localhost:7777`
     - `http://127.0.0.1:7777`
     - Add your production URL if you have one
   - Click "Create"
5. **Save your Client ID** - you'll need this in the next step

### 4. Create API Key

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API key"
3. Copy the API key
4. Click "Edit API key" (recommended)
5. Under "API restrictions":
   - Select "Restrict key"
   - Check "Google Drive API"
   - Click "Save"
6. **Save your API Key** - you'll need this in the next step

### 5. Configure the Application

1. Open `src/utils/googleDriveAPI.js` in your code editor
2. Find these lines near the top:
   ```javascript
   const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
   const API_KEY = 'YOUR_API_KEY';
   ```
3. Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your OAuth Client ID
4. Replace `YOUR_API_KEY` with your API Key
5. Save the file

### 6. Test the Integration

1. Start the Dave server:
   ```bash
   npm start
   ```
2. Open http://localhost:7777 in your browser
3. Click the "GDrive" button in the top toolbar
4. Try both methods:
   - **Shared Folder Link**: Paste a Google Drive folder link
   - **Sign in with Google**: Authorize and browse your own Google Drive

## Using Shared Folder Links

### Test Links

You can test with these shared folder links:
- https://drive.google.com/drive/folders/1NnpNp2wTFgZTtU-izbGPOXaZdHUSycvO
- https://drive.google.com/drive/folders/1WXi8RvdAg0xfC9x8Tr14tjBnTuJGLxj4

### Creating Shareable Links

To share your own Google Drive folder:
1. Right-click on a folder in Google Drive
2. Select "Share"
3. Click "Change to anyone with the link"
4. Set permissions to "Viewer"
5. Copy the link
6. Paste it in the Dave app

## Troubleshooting

### "Credentials not configured" Error

**Problem**: You see a warning about credentials not being configured.

**Solution**: Make sure you've replaced the placeholder values in `src/utils/googleDriveAPI.js` with your actual credentials.

### "Access blocked: This app's request is invalid"

**Problem**: OAuth screen shows an error when trying to sign in.

**Solution**:
- Check that your JavaScript origins and redirect URIs are correctly configured
- Make sure you're accessing the app from `http://localhost:7777` (not `127.0.0.1` unless that's what you configured)

### "Failed to load folder" Error

**Problem**: The folder link doesn't load.

**Solution**:
- Verify the folder is shared with "Anyone with the link"
- Check that the folder contains files (empty folders won't show content)
- Ensure the folder link is in the correct format

### Files Don't Display

**Problem**: Files load but don't show previews.

**Solution**:
- Check browser console for errors
- Verify the file types are supported by Dave
- Some Google Workspace files (Docs, Sheets) are automatically exported as PDFs

## Security Notes

- **API Key**: Can be restricted to specific APIs and domains in Google Cloud Console
- **OAuth Client ID**: Only works with configured domains
- **Scopes**: The app only requests read-only access to Google Drive (`drive.readonly` scope)
- **Data**: No data is stored on servers; all processing happens in your browser

## Supported File Types

The Google Drive integration supports all file types that Dave normally handles:
- **Images**: JPG, PNG, GIF, SVG, WebP, etc.
- **Videos**: MP4, WebM, MOV, etc.
- **Audio**: MP3, WAV, OGG, etc.
- **3D Models**: FBX, GLB, GLTF, OBJ, etc.
- **Documents**: PDF, TXT, etc.
- **Fonts**: TTF, OTF, WOFF, etc.

## Limitations

- Google Workspace files (Docs, Sheets, Slides) are exported as PDFs for viewing
- Very large files (>100MB) may take time to load
- Folder permissions must allow at least "Viewer" access
- OAuth consent screen may show "unverified app" warning for testing (normal for development)

## Production Deployment

For production deployment:

1. **Verify your OAuth consent screen**:
   - Submit for verification if you want to remove the "unverified app" warning
   - This requires Google's review process

2. **Update authorized domains**:
   - Add your production domain to JavaScript origins
   - Add your production domain to redirect URIs

3. **Consider API quotas**:
   - Free tier: 1,000 requests per 100 seconds per user
   - Consider implementing request caching if needed

## Additional Resources

- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/about-sdk)
- [OAuth 2.0 for Client-side Web Applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
- [Google Drive API JavaScript Quickstart](https://developers.google.com/drive/api/quickstart/js)

## Support

If you encounter issues:
1. Check the browser console for detailed error messages
2. Verify all setup steps were completed correctly
3. Review the [Google Drive API documentation](https://developers.google.com/drive/api)
4. Check that your credentials haven't expired or been revoked
