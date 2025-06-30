# Allergy Detection System

A comprehensive web application for detecting and managing food allergies using AI-powered ingredient analysis.

## 🚀 Features

- **AI-Powered Ingredient Analysis**: Uses Groq AI to analyze food ingredients and identify potential allergens
- **User Authentication**: Firebase-based sign-in/sign-up with Google integration
- **Reaction Logging**: Track and log allergic reactions to specific foods
- **History Management**: View and manage your allergy history
- **Barcode Scanning**: Scan product barcodes for quick ingredient lookup
- **Real-time Analysis**: Get instant allergen risk assessments

## 🏗️ Project Structure

```
allergy-project/
├── allergy-detector/     # React frontend application
├── server/              # Node.js backend server
├── ai-server/           # AI processing server
├── firebase.json        # Firebase configuration
├── firestore.rules      # Firestore security rules
├── firestore.indexes.json # Firestore indexes
├── barcode_lookup.py    # Barcode scanning functionality
├── barcode_server.py    # Barcode server
└── ocrspace_example.py  # OCR functionality
```

## 🛠️ Technology Stack

- **Frontend**: React, TypeScript, CSS
- **Backend**: Node.js, Express
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **AI**: Groq API
- **Deployment**: Firebase Hosting

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Python 3.8+ (for barcode scanning)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/kyungjinoh/allergy.git
   cd allergy
   ```

2. **Install frontend dependencies**
   ```bash
   cd allergy-detector
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd ../server
   npm install
   ```

4. **Install AI server dependencies**
   ```bash
   cd ../ai-server
   npm install
   ```

5. **Set up environment variables**
   Create a `.env` file in the server directory:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```

## 🚀 Running the Application

### Start the Backend Server
```bash
cd server
node index.js
```
Server will run on http://localhost:4242

### Start the Frontend
```bash
cd allergy-detector
npm start
```
Frontend will run on http://localhost:3000

### Start the AI Server (if needed)
```bash
cd ai-server
node index.js
```

## 🔧 Configuration

### Firebase Setup
1. Create a Firebase project
2. Enable Authentication and Firestore
3. Update `firebase.json` and `.firebaserc` with your project details
4. Deploy Firestore rules: `firebase deploy --only firestore:rules`

### Groq API Setup
1. Get your API key from [Groq Console](https://console.groq.com/)
2. Add it to your environment variables or server configuration

## 📱 Usage

1. **Sign up/Sign in** using email or Google account
2. **Upload food images** or **scan barcodes** for ingredient analysis
3. **View AI analysis** results with allergen risk assessment
4. **Log reactions** to track your allergy patterns
5. **Review history** to manage your allergy data

## 🔒 Security

- Firebase Authentication for user management
- Firestore security rules for data protection
- Environment variables for API keys
- CORS configuration for secure API access

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions, please open an issue on GitHub or contact the development team. 