# Sudoku Duel

A real-time multiplayer Sudoku battle game built with SvelteKit and Firebase.

## Features

- 🎮 Real-time multiplayer gameplay
- 🔐 Email/password authentication
- 🎯 Turn-based Sudoku battles
- ❤️ Lives system (5 hearts)
- 📊 Move history tracking
- 🎨 Retro-styled UI

## Tech Stack

- **Frontend**: SvelteKit, TypeScript, Tailwind CSS
- **Backend**: Firebase (Authentication, Firestore)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore and Authentication enabled

### Installation

1. Clone the repository:
```bash
git clone https://github.com/jadriang/sudoku-duel.git
cd sudoku-duel
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Add your Firebase configuration to `.env`:
```
PUBLIC_FIREBASE_API_KEY=your_api_key_here
PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=your_project_id
PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

5. Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel --prod
```

4. Set environment variables in Vercel dashboard:
   - Go to your project settings
   - Add all `PUBLIC_FIREBASE_*` variables from your `.env` file

### Alternative: Deploy via GitHub

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables in project settings
5. Deploy

## Firebase Setup

### Firestore Rules

Add these security rules in Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Rooms collection
    match /rooms/{roomId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
                      (resource.data.host == request.auth.uid || 
                       resource.data.players[request.auth.uid] != null);
      
      // Moves subcollection
      match /moves/{moveId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null;
      }
    }
  }
}
```

### Authentication

Enable Email/Password authentication in Firebase Console:
1. Go to Authentication > Sign-in method
2. Enable Email/Password provider

## Game Rules

- 2 players per game
- Each player starts with 5 lives
- Players take turns placing numbers on the Sudoku board
- Only one specific number can be placed per turn
- Incorrect placements cost 1 life
- First player to lose all lives loses the game
- Only correct numbers are placed on the board

## Project Structure

```
src/
├── lib/
│   ├── config.ts          # Game configuration and colors
│   ├── firebase.ts         # Firebase initialization and functions
│   └── types.ts            # TypeScript type definitions
├── routes/
│   ├── +page.svelte       # Home page (create/join room)
│   ├── auth/
│   │   └── +page.svelte   # Login/signup page
│   └── room/
│       └── [code]/
│           ├── +page.svelte           # Lobby page
│           └── game/
│               └── +page.svelte       # Game page
└── app.html               # HTML template
```

## License

MIT

## Author

Adrian G.
