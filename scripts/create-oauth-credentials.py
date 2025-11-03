#!/usr/bin/env python3
"""
Helper script to set up OAuth 2.0 credentials for Recipe Thing
Opens the necessary Google Cloud Console pages with pre-filled project ID
"""

import subprocess
import sys
import webbrowser

def get_project_id():
    """Get current gcloud project"""
    try:
        result = subprocess.run(
            ['gcloud', 'config', 'get-value', 'project'],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error getting project ID: {e}")
        sys.exit(1)

def open_url(url):
    """Open URL in default browser"""
    try:
        webbrowser.open(url)
        return True
    except Exception as e:
        print(f"Could not open browser: {e}")
        return False

def main():
    project_id = get_project_id()
    
    print("=" * 60)
    print("Recipe Thing - OAuth 2.0 Setup")
    print("=" * 60)
    print(f"\nProject ID: {project_id}\n")
    
    print("Step 1: Configure OAuth Consent Screen")
    consent_url = f"https://console.cloud.google.com/apis/credentials/consent/edit?project={project_id}"
    print(f"URL: {consent_url}")
    print("  - Application name: Recipe Thing")
    print("  - Support email: kvasdopil@gmail.com")
    print("  - User type: External")
    print("  - Scopes: email, profile, openid")
    print("\nOpening browser...")
    open_url(consent_url)
    
    input("\nPress Enter after configuring the consent screen to continue...")
    
    print("\nStep 2: Create OAuth Client ID")
    credentials_url = f"https://console.cloud.google.com/apis/credentials?project={project_id}"
    print(f"URL: {credentials_url}")
    print("  - Click 'Create Credentials' -> 'OAuth client ID'")
    print("  - Application type: Web application")
    print("  - Name: Recipe Thing Web Client")
    print("  - Authorized redirect URIs:")
    print("    * http://localhost:3000/auth/callback")
    print("    * https://recipe-thing-9wi8kpslr-alexey-guskovs-projects.vercel.app/auth/callback")
    print("    * https://food.guskov.dev/auth/callback")
    print("\nOpening browser...")
    open_url(credentials_url)
    
    print("\nStep 3: Copy credentials to Supabase")
    supabase_url = "https://supabase.com/dashboard/project/vsgeynrnczcqtkepitmj/auth/providers"
    print(f"URL: {supabase_url}")
    print("  - Navigate to Authentication -> Providers")
    print("  - Enable Google provider")
    print("  - Paste your Client ID and Client Secret")
    print("\nOpening browser...")
    open_url(supabase_url)
    
    print("\n" + "=" * 60)
    print("Setup complete! Your OAuth credentials should now be configured.")
    print("=" * 60)

if __name__ == '__main__':
    main()

