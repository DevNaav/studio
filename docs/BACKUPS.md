# Backups

Inventra has two kinds of backup.

## 1. Company backup (any company admin)
Settings → **Backup** → **Download backup** saves every record of your company in one
`.json` file. Keep it somewhere safe (Google Drive, email it to yourself). Uploaded files
(PDFs, photos) stay in Vercel Blob; the backup keeps their links.

## 2. Nightly backup (whole database, automatic)
The **Nightly backup** GitHub Action (`.github/workflows/backup.yml`) runs every night at
03:00 India time, encrypts the whole database with your passphrase and keeps 30 days of
copies under the repository's **Actions → Nightly backup → (a run) → Artifacts**.

One-time setup:
1. Google Cloud console → IAM & Admin → Service Accounts (project `duplicatemanagmne`) →
   create `inventra-backup` with the role **Cloud Datastore Viewer** (read-only) →
   Keys → Add key → JSON. Download the file.
2. GitHub → repository → Settings → Secrets and variables → Actions → New secret:
   - `FIREBASE_SERVICE_ACCOUNT` = the whole contents of that JSON file
   - `BACKUP_PASSPHRASE` = a long passphrase you will not lose (without it backups can't be opened)
3. Delete the downloaded JSON key from your computer.
4. Actions → Nightly backup → **Run workflow** once to check it.

## Restoring
Decrypt a nightly backup (any computer with OpenSSL, e.g. Git Bash):

    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in inventra-backup-DATE.json.gz.enc -out backup.json.gz
    gunzip backup.json.gz

Then, with credentials that can write to Firestore (e.g. `gcloud auth application-default login`):

    node scripts/restore-backup.mjs backup.json            # shows what it would do
    node scripts/restore-backup.mjs backup.json --yes      # puts back missing records only
    node scripts/restore-backup.mjs backup.json --yes --overwrite   # also replaces changed records

The same script restores a company backup file from Settings.
Backup and restore are tested on every change against the Firebase emulator (`npm run test:emulator`).
