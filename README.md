# Inventra: Construction & Manufacturing Management Platform

Inventra is a comprehensive, multi-tenant application designed to streamline the management of construction sites and manufacturing units. It provides a centralized platform for tracking inventory, managing expenses, overseeing labor, and analyzing project performance, powered by modern web technologies and generative AI.

## Core Features

### 1. Authentication & User Management
- **Secure Sign-Up & Login**: Users can create accounts and log in using email/password or Google Sign-In. Includes email verification and password reset functionality.
- **Role-Based Access Control (RBAC)**:
  - **Super Admin**: Manages all companies, users, and subscriptions. Has access to a global dashboard.
  - **Admin**: Manages users, sites, and billing for their own company.
  - **Custom Roles**: Admins can create custom roles with granular permissions for tailored access control.
- **User Profiles**: Users can edit their personal information, and admins can manage user assignments.

### 2. Dashboard & Onboarding
- **Main Dashboard**: Provides a high-level overview of active construction sites, manufacturing units, total labor force, and overall inventory value with an animated mascot.
- **Onboarding Flow**: A guided, multi-step process for new admins, including a plan overview and an interactive tour of the application.

### 3. Site & Project Management
- **Dual Project Types**: Create and manage both **Construction Sites** and **Manufacturing Units**.
- **Site Details Dashboard**: Each site has a dedicated dashboard with multiple tabs for detailed management:
  - **Summary**: Key metrics, expense breakdowns, and budget tracking.
  - **Tasks**: Assign and track daily tasks for team members with due dates and statuses.
  - **Materials**: Log material usage (Bought, Used, Stored) and view a real-time inventory summary with low-stock alerts.
  - **Tools**: Track tools and small equipment, including quantity and condition.
  - **Labor**: Manage worker attendance, wages (Daily, Monthly, Contract), payments, and balances.
  - **Machine Costs**: Track expenses related to machines, including fuel, maintenance, and rental/EMI costs.
  - **Expenses**: Log miscellaneous site-specific expenses.
  - **Documents**: Upload and manage site-specific documents with AI-powered text extraction.
  - **Theft Log**: Record and monitor any incidents of theft.
  - **Payments**: Track departmental payments and security deposits.
  - **Sales & Transfers**: (Manufacturing Units only) Log sales of finished products and internal transfers to other sites.
  - **Order Materials**: (Feature-flagged) Request materials from a centralized inventory.

### 4. Global Management (Company-Wide)
- **Warehouse**: A central inventory for materials not assigned to any specific site. Stock can be transferred to and from the warehouse.
- **Global Machine Log**: A comprehensive registry of all company-owned and rented machines, with logs for maintenance, fuel, EMI payments, and rental history.
- **Global Labor Management**: A central database of all laborers, allowing admins to manage their details and assign them to different sites.

### 5. Financials & Analytics
- **Expense Tracking**: Detailed logging of expenses categorized by type (Materials, Labor, Fuel, Maintenance, Rental, etc.).
- **PDF Reports**: Generate detailed PDF reports for site summaries, including financial breakdowns.
- **Analysis Page**: An interactive dashboard to analyze data across all sites or for a specific project, with customizable date ranges. View KPIs like total expenses, sales, profit, and inventory value.
- **Sales & Transfers**: Track profitability for manufactured goods, manage payments from buyers, and handle internal material transfers between units and sites.

### 6. Advanced Tools & AI Features
- **AI Assistant**: A premium, chat-based AI assistant (powered by Google's Gemini model via Genkit) to answer questions about the application and project data.
- **AI Threat Modeler**: Analyzes project descriptions to identify potential internal, external, and malware-related security threats.
- **Bar Bending Schedule (BBS)**: A specialized tool to create, save, and export Bar Bending Schedules as PDFs.
- **Defect Liability & Warranty Tracking**:
  - **Defect Liability**: Monitor the liability period for completed projects, track retention amounts, and log maintenance expenses incurred during this period.
  - **Warranty Tracker**: Log and track warranties for products and equipment, with alerts for expiring warranties.

### 7. Settings & Customization
- **Profile Settings**: Users can edit their personal information.
- **Company Settings**: Admins can update the company name and upload a company logo.
- **Theme Customization**: Users can switch between different visual themes (e.g., Futuristic, Construction, Dark Mode).
- **Animation Control**: Users can enable or disable UI animations for a personalized experience.
- **Super Admin Tools**: Includes a "Danger Zone" for clearing all application data for testing and administrative purposes.

## Tech Stack

- **Frontend Framework**: [Next.js](https://nextjs.org/) (with App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI Library**: [React](https://react.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Component Library**: [ShadCN UI](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Forms**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/) for validation
- **PDF Generation**: [jsPDF](https://github.com/parallax/jsPDF) & [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable)

### Backend & AI
- **Backend Services**: [Firebase](https://firebase.google.com/) (Authentication, Firestore, Storage)
- **Generative AI**: [Google's Gemini Pro](https://deepmind.google/technologies/gemini/)
- **AI Orchestration**: [Genkit](https://firebase.google.com/docs/genkit)
"# inventra-web" 
