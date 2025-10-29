// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    arrayUnion,
    serverTimestamp
} from 'firebase/firestore';

import { PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_AUTH_DOMAIN, PUBLIC_FIREBASE_PROJECT_ID, PUBLIC_FIREBASE_STORAGE_BUCKET, PUBLIC_FIREBASE_MESSAGING_SENDER_ID, PUBLIC_FIREBASE_APP_ID } from '$env/static/public';
import { getSudoku } from 'sudoku-gen';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

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

/**
 * Create a new room document with an auto-generated id.
 * Returns the new room id (document id).
 */
export async function createRoomInFirestore(hostNickname: string): Promise<string> {
    if (!hostNickname || !hostNickname.trim()) throw new Error('Invalid host nickname');

    const roomsCol = collection(db, 'rooms');
    // create a new doc ref with an auto id
    const roomRef = doc(roomsCol);
    const roomId = roomRef.id;

    await setDoc(roomRef, {
        code: roomId,
        host: hostNickname,
        players: [hostNickname],
        createdAt: serverTimestamp()
    });

    return roomId;
}

/**
 * Join an existing room (roomCode should be the doc id).
 * Adds the nickname to the players array and throws if room doesn't exist.
 */
export async function joinRoomInFirestore(roomCode: string, nickname: string): Promise<string> {
    if (!roomCode || !roomCode.trim()) throw new Error('Invalid room code');
    if (!nickname || !nickname.trim()) throw new Error('Invalid nickname');

    const roomRef = doc(db, 'rooms', roomCode);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) {
        throw new Error('Room not found');
    }

    await updateDoc(roomRef, {
        players: arrayUnion(nickname)
    });

    return roomCode;
}

/**
 * Start a sudoku game for the given room.
 * Uses the 'sudoku-gen' package (dynamically imported) to generate puzzle & solution.
 * Stores: game: { started, puzzle, solution, board, startedAt }
 */
export async function startGameInFirestore(roomCode: string, difficulty: Difficulty = 'easy'): Promise<void> {
     if (!roomCode || !roomCode.trim()) throw new Error('Invalid room code');

    const roomRef = doc(db, 'rooms', roomCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('Room not found');

    const data = snap.data();
    if (data?.game?.started) throw new Error('Game already started');

    let puzzleStr = '.'.repeat(81);
    let solutionStr = '.'.repeat(81);

    try {
        const s = getSudoku(difficulty);
        if (s && typeof s === 'object') {
            // sudoku-gen returns '-' for blanks in puzzle; convert to '.' used elsewhere
            if (typeof s.puzzle === 'string') puzzleStr = s.puzzle.replace(/-/g, '.');
            if (typeof s.solution === 'string') solutionStr = s.solution;
            // Ensure both strings are exactly 81 chars
            if (puzzleStr.length !== 81) puzzleStr = (puzzleStr + '.'.repeat(81)).slice(0, 81);
            if (solutionStr.length !== 81) solutionStr = (solutionStr + '.'.repeat(81)).slice(0, 81);
        }
    } catch (err) {
        console.error('sudoku-gen getSudoku failed, falling back to empty board', err);
    }

    await updateDoc(roomRef, {
        game: {
            started: true,
            puzzle: puzzleStr,
            solution: solutionStr,
            board: puzzleStr,
            startedAt: serverTimestamp()
        }
    });
}