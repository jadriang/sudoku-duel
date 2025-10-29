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
export interface Player {
    nickname: string;
    lives: number;
    isCurrentPlayer: boolean;
}

export interface GameState {
    started: boolean;
    puzzle: string;
    solution: string;
    board: string;
    startedAt: any; // FirebaseTimestamp
    players: { [nickname: string]: Player };
    currentNumber?: number; // the number that must be placed
    lastMoveBy?: string; // nickname of last player who made a move
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

    // Initialize game with puzzle
    const s = getSudoku(difficulty);
    const puzzleStr = s.puzzle.replace(/-/g, '.');
    const solutionStr = s.solution;

    // Initialize player states
    const playerStates: { [nickname: string]: Player } = {};
    data.players.forEach((nickname: string) => {
        playerStates[nickname] = {
            nickname,
            lives: 3,
            isCurrentPlayer: nickname === data.host // host plays first
        };
    });

    // Pick random first number (1-9)
    const firstNumber = Math.floor(Math.random() * 9) + 1;

    await updateDoc(roomRef, {
        game: {
            started: true,
            puzzle: puzzleStr,
            solution: solutionStr,
            board: puzzleStr,
            startedAt: serverTimestamp(),
            players: playerStates,
            currentNumber: firstNumber,
            lastMoveBy: null
        }
    });
}

export async function makeMove(
    roomCode: string, 
    nickname: string, 
    position: number, // 0-80 index in the board
): Promise<boolean> {
    const roomRef = doc(db, 'rooms', roomCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('Room not found');

    const data = snap.data();
    const game = data.game as GameState;
    
    // Validate move
    if (!game?.started) throw new Error('Game not started');
    if (!game.players[nickname]?.isCurrentPlayer) throw new Error('Not your turn');
    if (game.board[position] !== '.') throw new Error('Cell already filled');
    if (!game.currentNumber) throw new Error('No number selected');

    const isCorrect = String(game.solution[position]) === String(game.currentNumber);
    
    // Update board and player states
    const newBoard = game.board.split('');
    newBoard[position] = String(game.currentNumber);
    
    const updatedPlayers = { ...game.players };
    
    // Update current player's lives if move was incorrect
    if (!isCorrect) {
        updatedPlayers[nickname].lives -= 1;
    }

    // Find next player
    const playerNicknames = Object.keys(game.players);
    const currentIdx = playerNicknames.indexOf(nickname);
    const nextPlayer = playerNicknames[(currentIdx + 1) % playerNicknames.length];
    
    // Pick random number for next player (1-9)
    const nextNumber = Math.floor(Math.random() * 9) + 1;

    // Update player turns
    Object.keys(updatedPlayers).forEach(nick => {
        updatedPlayers[nick].isCurrentPlayer = nick === nextPlayer;
    });

    await updateDoc(roomRef, {
        game: {
            ...game,
            board: newBoard.join(''),
            players: updatedPlayers,
            currentNumber: nextNumber,
            lastMoveBy: nickname
        }
    });

    return isCorrect;
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