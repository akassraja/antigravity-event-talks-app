"""
Google Drive File Upload Script
Based on official Google Developer Knowledge guidelines.

Prerequisites:
    pip install google-api-python-client google-auth google-auth-oauthlib google-auth-httplib2
"""

import os
import sys
import mimetypes
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def authenticate_google_drive():
    """Authenticates the user and returns the Drive API service object."""
    creds = None
    # The file token.json stores the user's access and refresh tokens.
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists('credentials.json'):
                print("Error: 'credentials.json' not found.")
                print("Please download your OAuth 2.0 Client Credentials from Google Cloud Console and place it as 'credentials.json' in this directory.")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
            
        # Save the credentials for the next run
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    return build('drive', 'v3', credentials=creds)

def upload_file_to_drive(file_path, folder_id=None, custom_name=None):
    """
    Uploads a local file to Google Drive using MediaFileUpload.
    
    Args:
        file_path (str): Path to the local file to upload.
        folder_id (str, optional): Google Drive Folder ID to place the file in.
        custom_name (str, optional): Alternative name for the file on Drive.
    """
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' does not exist.")
        return None

    service = authenticate_google_drive()

    # Determine MIME type automatically if not provided
    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type is None:
        mime_type = 'application/octet-stream'

    file_name = custom_name or os.path.basename(file_path)

    # Prepare file metadata
    file_metadata = {
        'name': file_name
    }
    
    if folder_id:
        file_metadata['parents'] = [folder_id]

    print(f"Uploading '{file_path}' ({mime_type}) to Google Drive...")

    try:
        # Create MediaFileUpload object (resumable=True recommended for large files)
        media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)

        # Call the Drive API files().create() method
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, webViewLink'
        ).execute()

        print("\nUpload Successful!")
        print(f"File Name: {file.get('name')}")
        print(f"File ID:   {file.get('id')}")
        print(f"View Link: {file.get('webViewLink')}")
        return file

    except HttpError as error:
        print(f"\nAn API error occurred: {error}")
        return None

if __name__ == '__main__':
    # Example Usage
    if len(sys.argv) > 1:
        local_file = sys.argv[1]
        target_folder = sys.argv[2] if len(sys.argv) > 2 else None
        upload_file_to_drive(local_file, folder_id=target_folder)
    else:
        print("Usage: python upload_to_drive.py <file_path> [folder_id]")
        print("Example: python upload_to_drive.py my_document.pdf 1A2b3C4d5E6f7G8h9I0j")
