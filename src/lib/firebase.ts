// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import {
    getFirestore,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    getDocs,
    collection,
    writeBatch,
    addDoc,
    setDoc
} from 'firebase/firestore';

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User
} from 'firebase/auth';

import { PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_AUTH_DOMAIN, PUBLIC_FIREBASE_PROJECT_ID, PUBLIC_FIREBASE_STORAGE_BUCKET, PUBLIC_FIREBASE_MESSAGING_SENDER_ID, PUBLIC_FIREBASE_APP_ID } from '$env/static/public';
import { getSudoku } from 'sudoku-gen';
import { GAME_CONFIG } from './config';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface UserProfile {
    uid: string;
    email: string;
    nickname: string;
    createdAt: any;
    gamesPlayed: number;
    gamesWon: number;
}

export interface Player {
    uid: string;
    nickname: string;
    lives: number;
    isCurrentPlayer: boolean;
    joinedAt: any; // FirebaseTimestamp
}

export interface GameState {
    started: boolean;
    status: 'waiting' | 'active' | 'finished';
    puzzle: string;
    solution: string;
    board: string;
    startedAt: any; // FirebaseTimestamp
    players: { [uid: string]: Player };
    currentNumber?: number;
    lastMoveBy?: string;
    winner?: string | null;
    settings: {
        difficulty: 'easy' | 'medium' | 'hard' | 'expert';
        timeLimit: number | null;
        privateGame: boolean;
    }
}

export interface Move {
    moveNumber: number;
    player: string;
    position: number;
    numberPlaced: number;
    isValid: boolean;
    timestamp: any; // FirebaseTimestamp
    chosenNextNumber: number | null;
}


// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: PUBLIC_FIREBASE_API_KEY,
    authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// ====================================
// AUTH FUNCTIONS
// ====================================

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, nickname: string): Promise<User> {
    if (!email?.trim() || !password?.trim() || !nickname?.trim()) {
        throw new Error('Email, password, and nickname are required');
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create user profile in Firestore
    const userDoc = doc(db, 'users', user.uid);
    await setDoc(userDoc, {
        uid: user.uid,
        email: user.email,
        nickname: nickname.trim(),
        createdAt: serverTimestamp(),
        gamesPlayed: 0,
        gamesWon: 0
    } as UserProfile);

    // Wait a bit to ensure Firestore write is complete
    await new Promise(resolve => setTimeout(resolve, 500));

    return user;
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<User> {
    if (!email?.trim() || !password?.trim()) {
        throw new Error('Email and password are required');
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
    await firebaseSignOut(auth);
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
        return null;
    }
    
    return snap.data() as UserProfile;
}

/**
 * Listen to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
}

// ====================================
// ROOM FUNCTIONS
// ====================================

/**
 * Create a new room document with an auto-generated id.
 * Returns the new room id (document id).
 */
export async function createRoomInFirestore(hostUid: string, hostNickname: string): Promise<string> {
    if (!hostUid?.trim() || !hostNickname?.trim()) throw new Error('Invalid host data');

    const roomsCol = collection(db, 'rooms');
    const roomDoc = await addDoc(roomsCol, {
        host: hostUid,
        status: 'waiting',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        players: {
            [hostUid]: {
                uid: hostUid,
                nickname: hostNickname,
                lives: GAME_CONFIG.maxLives,
                isCurrentPlayer: true,
                joinedAt: serverTimestamp()
            }
        },
        settings: {
            difficulty: 'easy' as Difficulty,
            timeLimit: null,
            privateGame: false
        }
    });

    await updateDoc(roomDoc, {
        code: roomDoc.id
    });

    return roomDoc.id;
}

/**
 * Join an existing room (roomCode should be the doc id).
 * Adds the user to the players object and throws if room doesn't exist.
 */
export async function joinRoomInFirestore(roomCode: string, uid: string, nickname: string): Promise<string> {
    if (!roomCode || !roomCode.trim()) throw new Error('Invalid room code');
    if (!uid || !uid.trim()) throw new Error('Invalid user ID');
    if (!nickname || !nickname.trim()) throw new Error('Invalid nickname');

    const roomRef = doc(db, 'rooms', roomCode);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) {
        throw new Error('Room not found');
    }

    const data = snap.data();
    if (data.players && data.players[uid]) {
        throw new Error('You are already in this room');
    }

    await updateDoc(roomRef, {
        [`players.${uid}`]: {
            uid,
            nickname,
            lives: GAME_CONFIG.maxLives,
            isCurrentPlayer: false,
            joinedAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
    });

    return roomCode;
}

/**
 * Start a sudoku game for the given room.
 * Uses the 'sudoku-gen' package (dynamically imported) to generate puzzle & solution.
 * Stores: game: { started, puzzle, solution, board, startedAt }
 */
export async function startGameInFirestore(roomCode: string, difficulty: Difficulty = 'easy'): Promise<void> {
    if (!roomCode?.trim()) throw new Error('Invalid room code');

    const roomRef = doc(db, 'rooms', roomCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('Room not found');

    const data = snap.data();
    if (data?.game?.started) throw new Error('Game already started');

    const s = getSudoku(difficulty);
    const puzzleStr = s.puzzle.replace(/-/g, '.');
    const solutionStr = s.solution;

    // Initialize player states
     const playerStates: { [uid: string]: Player } = {};
    Object.keys(data.players).forEach(uid => {
        playerStates[uid] = {
            ...data.players[uid],
            lives: GAME_CONFIG.maxLives,
            isCurrentPlayer: uid === data.host
        };
    });

    await updateDoc(roomRef, {
        status: 'active',
        game: {
            started: true,
            puzzle: puzzleStr,
            solution: solutionStr,
            board: puzzleStr,
            startedAt: serverTimestamp(),
            players: playerStates,
            currentNumber: Math.floor(Math.random() * 9) + 1,
            lastMoveBy: null,
            winner: null
        },
        updatedAt: serverTimestamp()
    });
}

export async function makeMove(
    roomCode: string,
    uid: string,
    position: number
): Promise<boolean> {
    const roomRef = doc(db, 'rooms', roomCode);
    const batch = writeBatch(db);

    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('Room not found');

    const data = snap.data();
    const game = data.game as GameState;

    if (!game?.started) throw new Error('Game not started');
    if (!game.players[uid]?.isCurrentPlayer) throw new Error('Not your turn');
    if (game.board[position] !== '.') throw new Error('Cell already filled');

    const isCorrect = String(game.solution[position]) === String(game.currentNumber);
    const newBoard = game.board.split('');
    if (isCorrect) {
        newBoard[position] = String(game.currentNumber);
    }

    const updatedPlayers = { ...game.players };
    if (!isCorrect) {
        updatedPlayers[uid].lives -= 1;
    }

    // Find next player
    const playerUids = Object.keys(updatedPlayers);
    const currentIdx = playerUids.indexOf(uid);
    const nextPlayer = playerUids[(currentIdx + 1) % playerUids.length];

    Object.keys(updatedPlayers).forEach(playerUid => {
        updatedPlayers[playerUid].isCurrentPlayer = playerUid === nextPlayer;
    });

    // Random number for next player
    const nextNumber = Math.floor(Math.random() * 9) + 1;

    // Record move in subcollection
    const moveRef = doc(collection(db, 'rooms', roomCode, 'moves'));
    batch.set(moveRef, {
        moveNumber: (await getMoveCount(roomCode)) + 1,
        player: updatedPlayers[uid].nickname,
        position,
        numberPlaced: game.currentNumber,
        isValid: isCorrect,
        timestamp: serverTimestamp(),
        chosenNextNumber: nextNumber
    } as Move);

    // Update game state
    batch.update(roomRef, {
        game: {
            ...game,
            board: newBoard.join(''),
            players: updatedPlayers,
            currentNumber: nextNumber,
            lastMoveBy: updatedPlayers[uid].nickname,
            winner: updatedPlayers[uid].lives <= 0 ? updatedPlayers[nextPlayer].nickname : null,
            status: updatedPlayers[uid].lives <= 0 ? 'finished' : 'active'
        },
        updatedAt: serverTimestamp()
    });

    await batch.commit();
    return isCorrect;
}

// Helper to count moves
async function getMoveCount(roomCode: string): Promise<number> {
    const snap = await getDocs(collection(db, 'rooms', roomCode, 'moves'));
    return snap.size;
}


export function checkGameOver(game: GameState): string | null {
    // Returns nickname of winner, or null if game isn't over
    const eliminated = Object.values(game.players).find(p => p.lives <= 0);
    if (eliminated) {
        // Find player with most lives
        const winner = Object.values(game.players)
            .reduce((prev, curr) => prev.lives > curr.lives ? prev : curr);
        return winner.nickname;
    }
    return null;
}