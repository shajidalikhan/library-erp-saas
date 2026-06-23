# 📚 Self-Study Library ERP SaaS

A production-grade, multi-tenant SaaS platform built to streamline the operations of **Self-Study Libraries**, reading rooms, and co-studying spaces. It features a robust TypeScript backend, a modern Next.js 14 App Router web interface, a React Native CLI mobile foundation, and granular permission-based Role-Based Access Control (RBAC).

---

## 🚀 Key Modules & Features

The platform is designed around **feature-based modules** to keep frontend and backend domains cleanly partitioned:

*   **Multi-tenant SaaS Architecture**: Seamlessly handles multiple libraries. Includes platform-level billing, tenant subscriptions, and centralized administrative controls.
*   **Seat & Space Management**: Scoped per branch. Enables floor/zone layouts, shift-based seat scheduling (`FULL_DAY`, `MORNING`, `EVENING`, `NIGHT`), real-time occupancy status tracking, and single/bulk seat allocation.
*   **Membership & Billing**: Flexible fee plans (custom amounts and durations), automated invoice generation, overpayment/underpayment tracking, refunds, and payment receipts.
*   **Attendance & Activity Logs**: Check-in and check-out logs for students, tracking branch-level attendance, and platform-wide action audits.
*   **Granular RBAC**: System-level and tenant-level roles (`SUPER_ADMIN`, `LIBRARY_OWNER`, `MANAGER`, `RECEPTIONIST`, `ACCOUNTANT`, `STUDENT`) with explicit permission mappings (e.g. `seat.assign`, `payment.refund`).
*   **Analytics & Reports**: Visualized dashboards for library owners showing revenue trends, occupancy rate metrics, and student logs with exportable data.

---

## 🛠️ Technology Stack

| Component | Stack Details |
| :--- | :--- |
| **Backend** | Node.js + Express.js • TypeScript • MongoDB (Mongoose) • Zod Validation • Vitest (Testing) |
| **Frontend (Web)** | Next.js 14 (App Router) • React 18 • TypeScript • Tailwind CSS • Zustand (State) • TanStack Query (Server Cache) • Vitest |
| **Mobile App** | React Native CLI (0.85) • TypeScript • NativeWind (Tailwind CSS) • React Navigation • Zustand • React Query |

---

## 📂 Project Structure

```text
library-erp-saas-main/
├── backend/          # Express API server + RBAC seed scripts + MongoDB schemas
├── frontend/         # Next.js web application (Dashboard & Marketing pages)
├── mobile/           # React Native CLI client application (boilerplate configured)
├── docs/             # Technical API specifications, auth flows, and setup guides
└── diagrams/         # System and architectural blueprints per module
```

---

## 🏁 Getting Started

Follow these steps to set up and run the platform locally in development mode:

### 1. Backend Setup

1.  Navigate to the `backend` folder and install dependencies:
    ```bash
    cd backend
    npm install
    ```
2.  Set up environment variables. Copy the example configuration:
    ```bash
    cp .env.example .env
    ```
    Configure your MongoDB URI and port details in `.env`.

3.  Seed the system roles & permissions (required for first login):
    ```bash
    npm run seed:rbac
    ```

4.  *(Optional)* Bootstrap a platform **Super Admin** user:
    ```bash
    npm run create:superadmin
    ```
    *Default credentials:* `admin@libraryerp.com` / `Admin123`

5.  Start the API server in development mode:
    ```bash
    npm run dev
    ```
    The API will be available at `http://localhost:5000/api/v1`.

---

### 2. Frontend Setup

1.  Navigate to the `frontend` folder and install dependencies:
    ```bash
    cd ../frontend
    npm install
    ```
2.  Set up environment variables:
    ```bash
    cp .env.example .env
    ```
    Ensure `NEXT_PUBLIC_API_BASE_URL` points to your backend instance (`http://localhost:5000/api/v1`).

3.  Start the Next.js development server:
    ```bash
    npm run dev
    ```
    The dashboard UI will be available at `http://localhost:3000`.

---

### 3. Mobile Setup

1.  Navigate to the `mobile` folder and install dependencies:
    ```bash
    cd ../mobile
    npm install
    ```
2.  *(For iOS development on macOS)* Install Cocoapods:
    ```bash
    cd ios
    bundle install && bundle exec pod install
    cd ..
    ```
3.  Start the Metro bundler:
    ```bash
    npm start
    ```
4.  Run on your emulator or connected device:
    ```bash
    npm run android   # Android emulator (uses 10.0.2.2 to resolve localhost)
    # OR
    npm run ios       # iOS simulator
    ```

---

## 📖 Documentation Reference

Detailed documentation for technical setups, layouts, and API endpoints is located under the [docs/](docs) directory:

### Architecture & Setup guides
*   [Frontend Architecture](docs/frontend-architecture.md) &bull; [Frontend Setup Details](docs/frontend-setup.md)
*   [Mobile Setup Guide](docs/mobile-setup.md)
*   [Super Admin Bootstrapping](docs/super-admin-bootstrap.md)
*   [Cloudinary Upload Setup](docs/cloudinary-upload-setup.md) &bull; [Email (Hostinger) Setup](docs/email-hostinger-setup.md)

### Module API Specifications
*   🔐 [Authentication & Flow](docs/auth-api.md) | [Frontend Auth Flow](docs/frontend-auth-flow.md)
*   💺 [Seats API](docs/seat-api.md) | [Seats Frontend](docs/seat-frontend.md)
*   💳 [Payments API](docs/payment-api.md) | [Payments Frontend](docs/payment-frontend.md)
*   🧑‍🎓 [Students API](docs/student-api.md) | [Students Frontend](docs/student-frontend.md)
*   📊 [Analytics API](docs/analytics-api.md) | [Analytics Frontend](docs/analytics-frontend.md)
*   🏫 [Library API](docs/library-api.md) | [Library Frontend](docs/library-frontend.md)

*For API endpoint verification, find the ready-to-import Postman collections under `docs/postman/`.*

---

## 🎨 System Blueprints (Diagrams)

You can explore high-resolution visual blueprints mapping the platform's module architectures in the [diagrams/](diagrams) directory:
*   [Self-Study Library ERP Blueprint](diagrams/Self-study%20library%20ERP%20system%20blueprint.png)
*   [Authentication & RBAC Design](diagrams/Authentication%20and%20RBAC%20module.png)
*   [Payments Module Architecture](diagrams/Blueprint%20of%20payments%20module%20architecture.png)
*   [Seat Management Blueprint](diagrams/Seat%20Management.png)
*   [Attendance Module Blueprint](diagrams/Attendance%20management%20module%20blueprint.png)
