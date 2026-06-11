# Inventra: Mobile Application Blueprint & Shared Backend Specification

This blueprint provides a comprehensive, developer-ready specification for building a mobile application companion for **Inventra: Construction & Manufacturing Management Platform**. It details the existing architecture, the exact database schema, core feature implementations, and a step-by-step roadmap to build the mobile app in a new folder while sharing the same Firebase database and generative AI backend.

---

## 1. System Architecture Overview

Inventra is a multi-tenant platform designed to manage construction sites and manufacturing units. The web and mobile applications share a common, serverless backend.

```mermaid
graph TD
    A[Web App (Next.js)] -->|Firebase SDK| C[(Firestore DB)]
    B[Mobile App (Expo / React Native)] -->|Firebase SDK| C
    A -->|Firebase Storage SDK| D[(Firebase Storage)]
    B -->|Firebase Storage SDK| D
    A -->|Firebase Auth SDK| E[Firebase Authentication]
    B -->|Firebase Auth SDK| E
    F[AI Services (Genkit / Gemini)] <-->|Serverless / HTTPS| A
    F <-->|HTTPS API / Functions| B
```

### Shared Backend Components
1. **Firebase Authentication**: Handles secure authentication, email verification, password reset, and role mapping.
2. **Cloud Firestore (NoSQL)**: A hierarchical, real-time database containing multi-tenant structures (`companyId` isolation).
3. **Firebase Storage**: Handles static assets, user profile images, document uploads, and labor ID verification documents.
4. **Genkit & Gemini Pro (AI Backend)**: Power AI Chat, Document OCR extraction, Expense Summaries, and Maintenance suggestions.

---

## 2. Multi-Tenant Database Schema (Firestore)

To keep the database identical, your mobile app must query the exact same collection structures and respect multi-tenant rules where queries are filtered by `companyId` (and optionally `siteId`).

Below is the complete database model mapped directly from the current production types:

### Core Hierarchy & Collection Rules
* **Root-level Collections**: `users`, `companies`, `sites`, `machines`, `labors`, `attendances`, `labor_transactions`, `work_logs`, `expenses`, `purchases`, `maintenance_logs`, `emi_payments`, `machine_attendances`, `thefts`, `orders`, `bbss`, `rented_materials`, `rented_material_attendances`, `defect_liabilities`, `sales`, `site_payments`, `warranties`, `tools`
* **Soft Deletes**: Almost all documents implement soft delete via `isDeleted: boolean`. The mobile app **must** ignore any documents where `isDeleted == true`.

---

### Collection Reference & Fields

#### A. Users & Organizations
##### 1. `users` (Collection)
Stores user profiles and roles. Document ID should match the Firebase Auth `uid`.
| Field | Type | Description |
| :--- | :--- | :--- |
| `uid` | `string` | Unique identifier (matches Auth UID) |
| `email` | `string \| null` | User email address |
| `name` | `string \| null` | User full name |
| `role` | `string` | User role (`'Admin'`, `'User'`, `'Site Manager'`, `'Project Manager'`, etc.) |
| `companyId` | `string` | ID of associated company |
| `assignedSites` | `string[]` | Array of site IDs assigned to this user |
| `hasCompletedOnboarding`| `boolean` | Onboarding progress flag |
| `mobileNumber` | `string` | User contact number |
| `photoURL` | `string` | URL to profile picture in Firebase Storage |

##### 2. `companies` (Collection)
Defines the tenant subscription parameters.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `name` | `string` | Company name |
| `ownerId` | `string` | UID of the owner user |
| `createdAt` | `string` | ISO 8601 date string |
| `planId` | `string` | Subscription plan, e.g. `premium-annually` |
| `billingCycle` | `string` | `monthly` or `annually` |
| `subscriptionStatus` | `string` | `Trial`, `Active`, `Past Due`, `Canceled` |
| `subscriptionEndDate` | `string` | ISO 8601 date |
| `enableOrderMaterials` | `boolean` | Feature flag |
| `logoUrl` | `string` | Logo storage download link |
| `logoPath` | `string` | Logo path in Firebase Storage |
| `isLocked` | `boolean` | Lock flag if subscription expires |

---

#### B. Projects & Resources
##### 3. `sites` (Collection)
Represents a physical site or factory unit.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `companyId` | `string` | Tenant isolation key |
| `name` | `string` | Site name |
| `location` | `string` | Physical address or coordinates |
| `status` | `string` | `Active`, `Planning`, `Completed`, `On Hold`, `Warranty Pending` |
| `type` | `string` | `Construction` or `Manufacturing` |
| `budget` | `number` | Total budget |
| `isDeleted` | `boolean` | Soft delete flag |

##### 4. `tools` (Collection)
Small tools/equipment associated with a specific site.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `companyId` | `string` | Tenant isolation key |
| `siteId` | `string` | Owner site ID |
| `name` | `string` | Tool name |
| `quantity` | `number` | Quantity at site |
| `status` | `string` | `Good`, `Needs Repair`, `Broken` |
| `price` | `number` | Optional tool cost |
| `isDeleted` | `boolean` | Soft delete flag |

##### 5. `inventory_items` (Collection name: `inventory` or `inventory_items`)
Tracks bulk material movements at a site.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `companyId` | `string` | Tenant isolation key |
| `siteId` | `string` | Site ID |
| `name` | `string` | Material name (e.g., Cement, Sand, Steel) |
| `subType` | `string` | Subcategory |
| `type` | `string` | `Material`, `Machine`, `Tool` |
| `status` | `string` | `Bought`, `Used`, `Stored` |
| `quantity` | `number` | Value amount |
| `unit` | `string` | e.g. `bags`, `tons`, `meters` |
| `pricePerUnit` | `number` | Purchasing rate |
| `vendor` | `string` | Vendor name |
| `vendorNumber` | `string` | Vendor phone number |
| `date` | `string` | Logging date (YYYY-MM-DD) |
| `description` | `string` | General notes |
| `lowStockThreshold` | `number` | Stock alert trigger |
| `isDeleted` | `boolean` | Soft delete flag |

---

#### C. Machine Logs & Financing
##### 6. `machines` (Collection)
Registry of major machinery assets.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `companyId` | `string` | Tenant ID |
| `name` | `string` | Machine name (e.g., Excavator JCB) |
| `vehicleNumber` | `string` | Registration number |
| `acquisition` | `string` | `Company-Owned` or `Rented` |
| `date` | `string` | Acquisition date |
| `assignedSiteId` | `string \| null` | Currently assigned site ID |
| `assignmentDate` | `string` | Date assigned to site |
| `purchaseType` | `string` | (Company-Owned) `Cash` or `Loan` |
| `purchasePrice` | `number` | Purchase cost |
| `interestRate` | `number` | Loan interest rate (annual percentage) |
| `loanTenureYears` | `number` | Loan term in years |
| `dailyRentalPrice` | `number` | (Rented) cost per day |
| `isDeleted` | `boolean` | Soft delete flag |

##### 7. `emi_payments` (Collection)
EMI payment calendar for machine financing. Generated automatically when buying a machine via a loan.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `companyId` | `string` | Tenant ID |
| `machineId` | `string` | Parent machine ID |
| `dueDate` | `string` | YYYY-MM-DD |
| `amount` | `number` | Installment amount |
| `status` | `string` | `Upcoming`, `Paid`, `Overdue` |
| `paymentDate` | `string` | Actual payment date (YYYY-MM-DD) |
| `isDeleted` | `boolean` | Soft delete |

##### 8. `machine_attendances` (Collection)
Records logs of machine operations per day.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `companyId` | `string` | Tenant ID |
| `machineId` | `string` | Target machine |
| `date` | `string` | YYYY-MM-DD |
| `status` | `string` | `Present`, `Absent`, `Half-day`, `Unmarked` |
| `isDeleted` | `boolean` | Soft delete |

---

#### D. Labor Management & Payroll
##### 9. `labors` (Collection)
Global laborer database.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `companyId` | `string` | Tenant ID |
| `siteId` | `string` | Current assigned Site ID |
| `name` | `string` | Laborer name |
| `role` | `string` | Worker trade (Mason, Plumber, Helper, etc.) |
| `wageType` | `string` | `Daily`, `Monthly`, `Contract` |
| `wage` | `number` | Wage rate |
| `idNumber` | `string` | Government ID |
| `dateOfJoining` | `string` | Hire date |
| `idProofUrl` | `string` | URL to uploaded ID card image in Storage |
| `idProofFilePath` | `string` | Storage file path |
| `contractType` | `string` | Special contract tags |
| `pricePerUnit` | `number` | Rate per unit work (for Piece-rate/Contractors) |
| `unit` | `string` | Unit of work measured (e.g. sq ft) |
| `employmentStatus` | `string` | `On Roll` or `Off Roll` |
| `isDeleted` | `boolean` | Soft delete flag |

##### 10. `attendances` (Collection)
Daily attendance logs for workers.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `companyId` | `string` | Tenant ID |
| `siteId` | `string` | Active site during shift |
| `laborId` | `string` | Parent laborer ID |
| `date` | `string` | YYYY-MM-DD |
| `status` | `string` | `Present`, `Absent`, `Half-day`, `Unmarked` |
| `isDeleted` | `boolean` | Soft delete |

##### 11. `labor_transactions` (Collection)
Financial logs for worker payouts, advances, and food distribution deductions.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `companyId` | `string` | Tenant ID |
| `siteId` | `string` | Associated site |
| `laborId` | `string` | Parent laborer ID |
| `type` | `string` | `Payment` (Advance/Wages paid) or `Work` (Wages earned) or `Food` |
| `amount` | `number` | Currency value |
| `date` | `string` | Transaction date |
| `paymentMethod` | `string` | `UPI`, `Cash`, `Bank Transfer` |
| `isDeleted` | `boolean` | Soft delete |

##### 12. `work_logs` (Collection)
Piece-rate contract logs (quantity of work completed vs rate per unit).
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `laborerId` | `string` | Worker reference |
| `companyId` | `string` | Tenant ID |
| `siteId` | `string` | Site ID |
| `date` | `string` | YYYY-MM-DD |
| `quantity` | `number` | Physical units of work done |
| `unit` | `string` | Unit identifier |
| `pricePerUnit` | `number` | Rate paid per unit |
| `wageEarned` | `number` | Total wage calculated (`quantity * pricePerUnit`) |
| `isDeleted` | `boolean` | Soft delete |

---

#### E. Expenses, Theft & Finance
##### 13. `expenses` (Collection)
Tracks all site and general costs.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `companyId` | `string` | Tenant ID |
| `siteId` | `string` | Site ID |
| `description` | `string` | Expense details |
| `category` | `string` | `Materials`, `Labor`, `Transport`, `Fuel`, `Rental`, `EMI`, `Maintenance`, `Tools`, `Food`, `Other` |
| `amount` | `number` | Payout sum |
| `date` | `string` | YYYY-MM-DD |
| `machineId` | `string` | (Optional) Related machine asset |
| `rentedMaterialId` | `string` | (Optional) Related rented material |
| `isDeleted` | `boolean` | Soft delete |

##### 14. `thefts` (Collection)
Tracks losses or theft logs per site.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `companyId` | `string` | Tenant ID |
| `siteId` | `string` | Site ID |
| `item` | `string` | Lost item name |
| `value` | `number` | Calculated loss |
| `date` | `string` | YYYY-MM-DD |
| `details` | `string` | Detailed report |
| `isDeleted` | `boolean` | Soft delete |

---

#### F. Production & Sales (Manufacturing Units)
##### 15. `sales` (Collection)
Logs sales of manufactured items or internal stock transfers to construction projects.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Auto-generated ID |
| `companyId` | `string` | Tenant ID |
| `siteId` | `string` | Source manufacturing site ID |
| `date` | `string` | YYYY-MM-DD |
| `gradeName` | `string` | Product quality/description |
| `quantity` | `number` | Count of units |
| `salePrice` | `number` | Sales revenue amount |
| `productionCost` | `number` | Cost to manufacture |
| `transportCost` | `number` | Shipping cost |
| `buyerInfo` | `string` | Client details |
| `destinationSiteId` | `string` | (Internal transfers) target construction site |
| `materialsUsed` | `map` | `{ materialName: { quantity: number, unit: string } }` (tracks consumed raw materials) |
| `amountPaid` | `number` | Current amount paid |
| `paymentStatus` | `string` | `Unpaid`, `Partially Paid`, `Paid` |
| `paymentHistory` | `array` | Array of objects: `{ amount: number, date: string, method: string, notes: string }` |
| `totalQuantityUnit` | `string` | Unit label |
| `isDeleted` | `boolean` | Soft delete |

---

## 3. Core Features Implementation logic

To match the existing features on your mobile build, implement the following key processes exactly as designed in the web codebase:

### 1. Attendance & Work Logging
* **Manual mark**: Saves worker status (`Present`, `Absent`, `Half-day`).
* **Wage Calculation**:
  * **Daily Wages**: Paid based on attendance status (`Present` = Full, `Half-day` = `0.5 * wage`, `Absent` = `0`).
  * **Monthly Wages**: Fixed, prorated by attendance if deduction policies are active.
  * **Piece-Rate (Contract)**: Does not rely on attendance status directly. Instead, logs units of work daily in `work_logs` where total wage is `quantity * pricePerUnit`.
* **Food Cost Distribution**: A dashboard tool allows admins to input a total bill (e.g., site lunch) and select workers. The mobile app should perform a Firestore batch operation creating `labor_transactions` with `type: 'Food'` and the calculated proration (`totalCost / selectedLaborers.length`) for each worker.

### 2. Machine & EMI Schedules
* **Loan Calculations**: When a machine is registered as `Company-Owned` under a `Loan` purchase type, trigger the auto-generation of an EMI schedule.
  * *Formula*: Create a batch write to the `emi_payments` collection. Loop through `tenureYears * 12` periods. Add 1 month to `startDate` on each step.
* **EMI Paid Flow**: Marking an EMI installment as Paid updates the document `status` to `Paid`, and automatically creates an `expenses` document under the site currently assigned to the machine, categorized as `'EMI'`.

### 3. Rented Materials Attendance & Cost
* **Usage logging**: Similar to worker attendance. Allows marking items as `Used` or `Not Used` per day.
* **Active Rent**: Calculations for rented inventory must aggregate active periods (`startDate` to `returnDate` or `today`) to evaluate cumulative rental expenses.

### 4. Bar Bending Schedule (BBS) Generator
* Specialized engineering tool. The mobile interface needs forms to enter drawing numbers, project names, and a dynamic list of steel items:
  ```typescript
  interface BbsItem {
    description: string;
    diameter: number; // in mm
    barCount?: number;
    length?: number; // in meters
    shape?: string; // Shape bending guide reference
  }
  ```
* Calculate the total weight of reinforcement steel based on bar dimensions:
  $$\text{Weight} = \frac{\text{Diameter}^2}{162} \times \text{Length} \times \text{Bar Count} \text{ (kg)}$$

---

## 4. Mobile Stack Recommendation: React Native + Expo

For the absolute best developer experience, code reuse, and rapid delivery, we highly recommend building the mobile app using **React Native with Expo** in your new folder.

### Why React Native & Expo?
1. **Direct Code Sharing**: You can copy the exact TypeScript data definitions (`src/lib/types.ts`) directly into your mobile app.
2. **Identical State Patterns**: Both libraries rely on React. You can reuse the context state architecture (`AuthContext`, `SiteContext`) to manage global updates.
3. **Tailwind Styling**: Using `nativewind`, you can write identical Tailwind classes (`className="flex flex-row p-4 bg-white rounded-lg shadow"`) on native widgets.
4. **Firebase Direct Integration**: Expo has first-class support for `firebase/app`, `firebase/auth`, and `firebase/firestore` JS SDKs, meaning you don't have to rewrite any database queries.

---

## 5. Porting Checklist (Step-by-Step)

Follow these structured steps to construct your mobile companion application:

### Phase 1: Local Environment Setup
- [ ] Create a new sibling directory alongside this project, e.g. `../inventra-mobile`.
- [ ] Initialize an Expo app using the modern TypeScript template:
  ```bash
  npx create-expo-app@latest ./ --template expo-template-blank-typescript
  ```
- [ ] Install critical dependencies:
  ```bash
  npx expo install firebase @react-native-async-storage/async-storage lucide-react-native expo-image expo-file-system nativewind tailwindcss react-native-svg
  ```
- [ ] Initialize Tailwind config:
  ```bash
  npx tailwindcss init
  ```
  Configure it to use your screen paths and `nativewind/babel` as a babel preset.

### Phase 2: Security & Configuration Reuse
- [ ] Create `src/lib/firebase.ts` in your new mobile folder.
- [ ] Copy the exact same configuration from the web app's `firebaseConfig`:
  ```typescript
  const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "duplicatemanagmne.firebaseapp.com",
    projectId: "duplicatemanagmne",
    storageBucket: "duplicatemanagmne.appspot.com",
    messagingSenderId: "1026096148735",
    appId: "1:1026096148735:web:10e6bbd8295bcf4b585cca"
  };
  ```
- [ ] Configure standard Firebase web SDK initialization inside Expo.
- [ ] Configure Google Sign-In via Expo's AuthSession or standard Firebase Social Auth.

### Phase 3: Core Logic Porting
- [ ] **Data Models**: Copy `src/lib/types.ts` into `src/types/index.ts` in the mobile codebase.
- [ ] **Authentication State**: Build a `useAuth` hook and context provider that wraps the app layout. Use React Native's state to mirror the state parameters (`user`, `userProfile`, `isAdmin`, `isSuperAdmin`).
- [ ] **Site Data State**: Build a corresponding `SiteProvider` utilizing standard real-time listeners (`onSnapshot`) filtered by `companyId` matching the currently authenticated user's profile.

### Phase 4: UI Design Translation (Web to Mobile)
| Web Page / Feature | Mobile Translation Strategy |
| :--- | :--- |
| **Main Dashboard & Mascot** | Render a native dashboard layout with cards. Use React Native Lottie components (`lottie-react-native`) to render the animated assistant mascot. |
| **Site Tabs (Materials, Labor, tools)** | Replace heavy web-based horizontal menus with a native bottom tab bar or swipeable screen carousel using `react-native-pager-view` or standard React Navigation. |
| **Attendance Sheet Grid** | Use a highly optimized `<FlatList>` component to render worker lists, with absolute touch targets to toggle status controls (`P`, `A`, `H`). |
| **PDF Export Reports** | Use `expo-print` to render HTML templates to a PDF file on the fly and open the native system sharing drawer using `expo-sharing`. |
| **AI Assistant (Gemini Chat)** | Build a classic chat bubbles layout using a `<FlatList>`. Securely connect to your Gemini endpoints via a serverless function, or invoke the Gemini API using HTTP requests passing system context. |

---

### Phase 5: Verification & Testing
- [ ] Verify that registering a laborer on the mobile app instantly triggers an update on the web dashboard (real-time listeners).
- [ ] Verify that uploading an ID proof file from the phone camera saves correctly to storage and processes without errors.
- [ ] Verify that marking a transaction (payment/EMI/food) correctly recalculates finances across both web and mobile client views.
