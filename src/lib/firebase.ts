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
    addDoc
} from 'firebase/firestore';

import { PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_AUTH_DOMAIN, PUBLIC_FIREBASE_PROJECT_ID, PUBLIC_FIREBASE_STORAGE_BUCKET, PUBLIC_FIREBASE_MESSAGING_SENDER_ID, PUBLIC_FIREBASE_APP_ID } from '$env/static/public';
import { getSudoku } from 'sudoku-gen';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface Player {
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
    players: { [nickname: string]: Player };
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

/**
 * Create a new room document with an auto-generated id.
 * Returns the new room id (document id).
 */
export async function createRoomInFirestore(hostNickname: string): Promise<string> {
    if (!hostNickname?.trim()) throw new Error('Invalid host nickname');

    const roomsCol = collection(db, 'rooms');
    const roomDoc = await addDoc(roomsCol, {
        host: hostNickname,
        status: 'waiting',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        players: {
            [hostNickname]: {
                nickname: hostNickname,
                lives: 3,
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

    // Store the room code (doc ID) in the document itself
    await updateDoc(roomDoc, {
        code: roomDoc.id
    });

    return roomDoc.id;
}

/**
 * Join an existing room (roomCode should be the doc id).
 * Adds the nickname to the players object and throws if room doesn't exist.
 */
export async function joinRoomInFirestore(roomCode: string, nickname: string): Promise<string> {
    if (!roomCode || !roomCode.trim()) throw new Error('Invalid room code');
    if (!nickname || !nickname.trim()) throw new Error('Invalid nickname');

    const roomRef = doc(db, 'rooms', roomCode);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) {
        throw new Error('Room not found');
    }

    const data = snap.data();
    if (data.players && data.players[nickname]) {
        throw new Error('Nickname already taken in this room');
    }

    await updateDoc(roomRef, {
        [`players.${nickname}`]: {
            nickname,
            lives: 3,
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
    const playerStates: { [nickname: string]: Player } = {};
    Object.keys(data.players).forEach(nickname => {
        playerStates[nickname] = {
            ...data.players[nickname],
            lives: 3,
            isCurrentPlayer: nickname === data.host
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
    nickname: string,
    position: number
): Promise<boolean> {
    const roomRef = doc(db, 'rooms', roomCode);
    const batch = writeBatch(db);

    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('Room not found');

    const data = snap.data();
    const game = data.game as GameState;

    if (!game?.started) throw new Error('Game not started');
    if (!game.players[nickname]?.isCurrentPlayer) throw new Error('Not your turn');
    if (game.board[position] !== '.') throw new Error('Cell already filled');

    const isCorrect = String(game.solution[position]) === String(game.currentNumber);
    const newBoard = game.board.split('');
    newBoard[position] = String(game.currentNumber);

    const updatedPlayers = { ...game.players };
    if (!isCorrect) {
        updatedPlayers[nickname].lives -= 1;
    }

    // Find next player
    const playerNicks = Object.keys(updatedPlayers);
    const currentIdx = playerNicks.indexOf(nickname);
    const nextPlayer = playerNicks[(currentIdx + 1) % playerNicks.length];

    Object.keys(updatedPlayers).forEach(nick => {
        updatedPlayers[nick].isCurrentPlayer = nick === nextPlayer;
    });

    // Random number for next player
    const nextNumber = Math.floor(Math.random() * 9) + 1;

    // Record move in subcollection
    const moveRef = doc(collection(db, 'rooms', roomCode, 'moves'));
    batch.set(moveRef, {
        moveNumber: (await getMoveCount(roomCode)) + 1,
        player: nickname,
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
            lastMoveBy: nickname,
            winner: updatedPlayers[nickname].lives <= 0 ? nextPlayer : null,
            status: updatedPlayers[nickname].lives <= 0 ? 'finished' : 'active'
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