# Club Management System

This project is a web application built with Node.js, Express.js, PostgreSQL, and EJS for managing clubs, events, and user roles within a university or similar organization.

## Features

- **User Authentication**: Login and registration functionality with Passport.js.
- **Role-based Access Control**: Differentiates between students and coordinators.
- **Club Management**: Creation, deletion, and management of clubs.
- **Event Management**: Creation, registration, and approval/rejection of events.
- **Password Reset**: Allows users to reset passwords via email.
- **Flash Messaging**: Provides user-friendly messages for actions like login, registration, and errors.

## Installation

To run this project locally, follow these steps:

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd club-management-system

2. **Install dependencies:**

   ``` sh
   npm install

3. **Database setup:**
   
   - Ensure PostgreSQL is installed and running.
   - Create a new database and update the connection details in `config/db.js`.

4. **Environment variables:**

   Create a `.env` file in the root directory with the following:0

   ``` sh
   PORT=3000
   SESSION_SECRET=your_session_secret
   EMAIL_USERNAME=your_email_username
   EMAIL_PASSWORD=your_email_password
   ```

   Replace `your_session_secret`, `your_email_username`, and `your_email_password` with appropriate values.

5. **Run migrations:**

   Run the database migrations to create necessary tables:

   ``` sh
   npm run migrate

6. **Start the server:**

   ``` sh
   npm start

7. **Access the application:**
   Open your browser and navigate to http://localhost:3000 to access the Club Management System.

## Usage

- **Login:** Users can log in using their credentials.
- **Dashboard:** View and manage clubs, events, and user roles based on permissions.
- **Create Club:** Users with coordinator roles can create new clubs.
- **Create Event:** Coordinators can create new events associated with their clubs.
- **Manage Events:** Approve or reject event requests.
- **Password Reset:** Users can reset passwords using the password reset functionality.
