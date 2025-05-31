
Built by https://www.blackbox.ai

---

# GST Invoice Generator

## Project Overview
The GST Invoice Generator is a web application designed to help users generate and manage GST invoices effectively. The application features a user-friendly interface that allows for easy login, invoice creation, customer management, item management, and reporting functionalities. Built using modern web technologies, the application is responsive and visually appealing.

## Installation
To run this project on your local machine, follow the steps below:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/gst-invoice-generator.git
   cd gst-invoice-generator
   ```

2. **Run the server**:
   The project includes a simple Python HTTP server for local testing. You need Python installed on your machine.
   ```bash
   python server.py
   ```

3. **Open your browser**:
   Navigate to `http://localhost:8000/index.html` to view the dashboard.

## Usage
- **Login**: Navigate to `login.html` and enter your credentials to login.
- **Dashboard**: After logging in, you will see the dashboard where you can view important statistics.
- **Create Invoice**: Click on the "Create Invoice" link to start generating new invoices.
- **Manage Customers and Items**: Use the respective links in the navigation to manage customers and items.
- **View Reports**: Access the reports page to see detailed invoices.

## Features
- User authentication with email and password.
- Dynamic dashboard displaying totals of invoices, customers, and items.
- Recent invoices displayed in a table format.
- Responsive design using Tailwind CSS.
- Integration with Firebase for authentication and database storage.

## Dependencies
The project utilizes the following dependencies, which can be found in `package.json` if applicable:
- Firebase SDK for authentication and Firestore.
- Tailwind CSS for styling.
- Font Awesome for icons.

Please note that certain dependencies are included via CDN links in the HTML files instead of a package.json file since this project does not seem to have Node.js dependencies explicitly listed.

## Project Structure
Here's a brief overview of the directory structure of the project:
```
gst-invoice-generator/
├── index.html                # Main dashboard page
├── login.html                # Login page
├── server.py                 # Simple HTTP server script
└── js/
    ├── firebase.js           # Firebase configuration and initialization
    ├── login.js              # JavaScript for handling login
    └── main.js               # Main JavaScript functionality for the dashboard
```

## Contributing
Contributions to the project are welcome! Please feel free to open issues or submit pull requests.

## License
This project is open source and available under the [MIT License](LICENSE).