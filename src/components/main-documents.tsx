
'use client';

import { DocumentsTab } from "./tabs/documents-tab";

export function MainDocuments() {
  return (
    <DocumentsTab siteId="main" isMain={true} />
  );
}
