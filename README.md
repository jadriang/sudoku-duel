# Sudoku Duel

A real-time multiplayer Sudoku battle game built with SvelteKit and Firebase.

## Features

- 🎮 Real-time multiplayer gameplay (2-5 players)
- 🔐 Email/password authentication with email verification
- 🎯 Turn-based Sudoku battles
- ❤️ Lives system (5 hearts per player)
- 📊 Player statistics tracking (games played, games won)
- 🕐 2-hour game session TTL
- 🚫 Rate limiting: Maximum 5 active games per user
- 🎨 Retro-styled UI with Press Start 2P font

## Tech Stack

- **Frontend**: SvelteKit 2.43.2, TypeScript, Tailwind CSS v4
- **Backend**: Firebase (Authentication, Firestore)
- **Deployment**: Vercel
- **Sudoku Generation**: sudoku-gen package

## Game Rules

- 2-5 players per game (configurable in `src/lib/config.ts`)
- Each player starts with 5 lives
- Players take turns placing numbers on the Sudoku board
- The game assigns a specific number each turn that must be placed
- Incorrect placements cost 1 life
- Game ends when:
  - A player loses all lives (other player wins)
  - The board is completed (player with most lives wins)
- Only correct numbers remain on the board

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project with:
  - Firestore Database enabled
  - Authentication with Email/Password provider enabled
  - (Optional) Email verification configured

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

3. Create a `.env` file with your Firebase configuration:
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

## Firebase Setup

### 1. Authentication

Enable Email/Password authentication:
1. Go to Firebase Console > Authentication > Sign-in method
2. Enable Email/Password provider
3. (Optional) Enable email verification in Authentication settings

### 2. Firestore Security Rules

Deploy the production-ready security rules from `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

Or manually copy the rules from `firestore.rules` to Firebase Console > Firestore Database > Rules.

**Key security features:**
- Email verification required for all game actions
- Users can only modify their own profiles
- Players can only update rooms they're part of
- Moves are immutable once created
- Read access restricted to authenticated users

### 3. Firestore Indexes

Create composite indexes for optimal query performance:

1. **Rooms by host** (for active game limit check):
   - Collection: `rooms`
   - Fields: `host` (Ascending), `status` (Ascending), `expireAt` (Ascending)

Create via Firebase Console > Firestore Database > Indexes, or the console will prompt you when queries run.

### 4. TTL Policy (Optional but Recommended)

Enable automatic cleanup of expired documents:

1. Go to Firebase Console > Firestore Database
2. Create TTL policy:
   - Collection: `rooms`
   - Field: `expireAt`
3. Create another for moves:
   - Collection group: `moves`
   - Field: `expireAt`

This automatically deletes documents 2 hours after game completion.

## Deployment

### Deploy to Vercel

#### Option 1: Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

#### Option 2: GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables (see below)
5. Deploy

### Environment Variables in Vercel

Add these in Vercel Dashboard > Project Settings > Environment Variables:

```
PUBLIC_FIREBASE_API_KEY=your_api_key
PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=your_project_id
PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Project Structure

```
src/
├── lib/
│   ├── config.ts          # Game configuration (lives, player limits, colors)
│   ├── firebase.ts         # Firebase initialization and functions
│   └── types.ts            # TypeScript type definitions
├── routes/
│   ├── +page.svelte       # Home page (create/join room)
│   ├── auth/
│   │   └── +page.svelte   # Authentication (login/signup)
│   └── room/
│       └── [code]/
│           ├── +page.svelte           # Lobby page (waiting room)
│           └── game/
│               └── +page.svelte       # Game page (active game)
└── app.html               # HTML template
```

## Configuration

Edit `src/lib/config.ts` to customize game settings:

```typescript
export const GAME_CONFIG = {
    maxLives: 5,        // Lives per player
    minPlayers: 2,      // Minimum players to start
    maxPlayers: 5       // Maximum players per game
};

export const COLORS = {
    primary: '#3B7A57',    // Deep green
    secondary: '#FFD447'   // Yellow/gold
};
```

## Development

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Type Checking
```bash
npm run check
```

### Linting
```bash
npm run lint
```

## Security Considerations

### Current Implementation (Client-Side)

- ✅ Email verification enforced on all pages
- ✅ Firestore security rules validate user permissions
- ✅ Atomic stat updates using `increment()`
- ✅ Move validation (turn, position, board state)
- ⚠️ Game logic executed client-side (can be manipulated)
- ⚠️ TTL set from client (can be tampered with)

### Production Hardening (Recommended)

For a production deployment handling real stakes or competitive play, consider:

1. **Move to Cloud Functions**: Implement `makeMove`, `createRoom`, `joinRoom` as Firebase Cloud Functions to:
   - Validate all game logic server-side
   - Prevent client manipulation of game state
   - Ensure authoritative stat tracking

2. **Rate Limiting**: Add Firebase App Check or Cloud Armor to prevent abuse

3. **Monitoring**: Set up Firebase Performance Monitoring and Analytics

4. **Backup**: Enable Firestore automated backups

5. **Error Tracking**: Integrate Sentry or similar for error monitoring

## Troubleshooting

### Email Verification Not Working

- Check Firebase Console > Authentication > Templates
- Verify email sender is configured
- Check spam folder for verification emails

### Games Not Counting

- Ensure game finishes properly (player loses all lives or board completes)
- Check browser console for errors
- Verify Firestore security rules allow writes to users collection

### Room Creation Fails

- Check if user has 5 active games already
- Verify user email is verified
- Check Firebase quota limits

### Deployment Issues

- Ensure all environment variables are set in Vercel
- Check build logs for missing dependencies
- Verify adapter-vercel is installed

## License

MIT

## Author

Adrian G. (@jadriang)

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## Support

For issues and questions:
- Open a GitHub issue
- Check existing issues for solutions
