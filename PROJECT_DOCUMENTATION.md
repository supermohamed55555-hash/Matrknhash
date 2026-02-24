# Matrknhash (متركنهاش) - Technical Documentation 🛠️

## 1. Project Overview
**Matrknhash** is a modern, multi-vendor e-commerce marketplace specializing in automotive spare parts. It features an integrated AI assistant ("Engineer Aboud") to provide expert fitting advice and technical support.

## 2. Tech Stack (The "Engine" 🏎️)

### Backend (The Brain)
- **Node.js**: The core runtime environment.
- **Express.js**: Our web framework. It handles all "Routes" (orders, products, login).
- **MongoDB & Mongoose**: Our database system. We use "Schemas" to structure data for Users, Products, and Orders.
- **Passport.js**: The security gatekeeper. It handles login via Email, Google, and Facebook.
- **Bcrypt.js**: High-level encryption for user passwords.
- **Dotenv**: Manage sensitive keys (API Keys, DB URIs) securely.

### Frontend (The Look)
- **HTML5**: Semantic structure with optimized Arabic (RTL) support.
- **Vanilla CSS3**: 100% custom styling. We use **Glassmorphism** (frosted glass effect) and **Neo-brutalism** elements for a premium feel.
- **Tailwind CSS**: Used for modern utility styling and rapid layout adjustments.
- **Vanilla JavaScript**: Handles all "Client Logic" (Cart manipulation, AI chat animations, real-time filtering).

### AI & Infrastructure
- **Groq API (Llama 3)**: Powers "Engineer Aboud". We use Llama-3-70B for fast, accurate Egyptian slang responses.
- **Railway**: Cloud hosting platform for our live deployment.

---

## 3. Core Features & Logic

### A. The "Engineer Aboud" Fitment Checker
When a user asks "Does this fit my Toyota?", the system:
1. Fetches the product's `compatibility` data (e.g., Toyota Corolla 2010-2015).
2. Sends this data + the user's question to **Groq AI**.
3. The AI responds in friendly Egyptian mechanics' slang ("صنايعية شاطرة"), checking the logic before answering.

### B. Multi-Payment System
We implemented a flexible checkout process:
- **Wallet**: Users can maintain a balance (stored in MongoDB) for 1-click buying.
- **Vodafone Cash**: Integrated manual confirmation flow.
- **COD**: Cash on Delivery.
- **Visa/Card**: Placeholder for Stripe/Paymob integration.

### C. Multi-Vendor Marketplace (Phase 2)
Originally a single shop, now every user has a `role` (user, vendor, admin).
- **Vendors**: Get a private Dashboard (`admin.html`) to manage *only their* products and orders.
- **Security**: Backend checks (`product.vendorId === req.user._id`) ensure no one can delete someone else's item.

### D. User Garage & Metadata
Users can save their cars in a "Virtual Garage".
- This data is used to automatically suggest compatible parts as they browse.

---

## 4. Security Measures 🛡️
- **File Blocking**: We use middleware in `server.js` to prevent users from ever seeing `.env`, `.json`, or `.js` source code in the browser.
- **Environment Variables**: All secret keys are stored on the server (Railway), never in the code.
- **Session Management**: Secure cookies handled by `express-session` and saved in the DB.

---

## 5. What's Missing? (Tech Debt & Gaps 🚩)
1. **Frontend Scalability**: Using Vanilla JS is fast but can become "Spaghetti Code" as the site grows. Moving to **React or Next.js** would be the professional next step.
2. **Super Admin Dashboard**: We have a Vendor dashboard, but we need a "Master Admin" to approve products, ban users, and see total platform revenue.
3. **Structured Logging**: We need a system like **Winston or Morgan** to record errors in a way that we can study them later.
4. **Input Validation**: Adding a library like **Joi or Zod** to ensure that data sent to the server is 100% correct before saving it to the DB.

## 6. Future Roadmap (The "Dream" List 🌟)
*   **Real-time Notifications**: Using **Socket.io** so the vendor gets an alert the second an order is placed.
*   **Search with Auto-Suggest**: A smart search bar that suggests parts as you type.
*   **Shipping Integration**: Connecting with **Bosta or Aramex** APIs to calculate shipping and print labels automatically.
*   **Loyalty Points**: A system where users earn points for every purchase to use as "Wallet Balance" later.
*   **Mobile App**: Building a **PWA (Progressive Web App)** so users can install "Matrknhash" on their phones like a real app.

## 7. Hosting Analysis: Is Railway Enough? ☁️
**Short Answer: YES, for now.**
- **Pros**: Dynamic scaling (it handles spikes in traffic), very easy to deploy, support for environment variables.
- **Cons**: Can get expensive if you have millions of users.
- **Recommendation**: Stay on Railway for the MVP and first 10,000 users. If you grow beyond that, we can migrate to a **VPS** (like DigitalOcean) or **AWS** for more control and lower cost at scale.
