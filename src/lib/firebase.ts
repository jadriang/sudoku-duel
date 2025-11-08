import { initializeApp } from 'firebase/app';
import {
	getFirestore,
	doc,
	getDoc,
	updateDoc,
	serverTimestamp,
	getDocs,
	collection,
	query,
	where,
	orderBy,
	limit,
	increment,
	writeBatch,
	addDoc,
	type Timestamp,
	type FieldValue
} from 'firebase/firestore';

import {
	getAuth,
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signOut as firebaseSignOut,
	sendEmailVerification,
	onAuthStateChanged,
	type User
} from 'firebase/auth';

import { env } from '$env/dynamic/public';
import { getSudoku } from 'sudoku-gen';
import { GAME_CONFIG } from './config';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface UserProfile {
	uid: string;
	email: string;
	nickname: string;
	createdAt: Timestamp | null;
	gamesPlayed: number;
	gamesWon: number;
}

export interface Player {
	uid: string;
	nickname: string;
	lives: number;
	isCurrentPlayer: boolean;
	joinedAt: Timestamp | null;
}

export interface GameState {
	started: boolean;
	status: 'waiting' | 'active' | 'finished';
	puzzle: string;
	solution: string;
	board: string;
	startedAt: Timestamp | null;
	players: { [uid: string]: Player };
	currentNumber?: number;
	lastMoveBy?: string;
	winner?: string | null;
	settings: {
		difficulty: 'easy' | 'medium' | 'hard' | 'expert';
		timeLimit: number | null;
		privateGame: boolean;
	};
}
export interface Move {
	moveNumber: number;
	player: string;
	position: number;
	numberPlaced: number;
	isValid: boolean;
	timestamp: Timestamp | FieldValue | null;
	chosenNextNumber: number | null;
}

const firebaseConfig = {
	apiKey: env.PUBLIC_FIREBASE_API_KEY,
	authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: env.PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: env.PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ====================================
// AUTH FUNCTIONS
// ====================================

// Helper function to check if nickname is available
export async function isNicknameAvailable(nickname: string): Promise<boolean> {
	const nicknameDoc = doc(db, 'usernames', nickname.toLowerCase());
	const snap = await getDoc(nicknameDoc);
	return !snap.exists();
}

// Generate a random unique username
export async function generateRandomUsername(): Promise<string> {
	const adjectives = [
		'Swift',
		'Clever',
		'Bright',
		'Quick',
		'Smart',
		'Sharp',
		'Wise',
		'Bold',
		'Brave',
		'Cool',
		'Epic',
		'Fast',
		'Strong',
		'Lucky',
		'Magic',
		'Super'
	];
	const nouns = [
		'Panda',
		'Tiger',
		'Eagle',
		'Dragon',
		'Phoenix',
		'Wolf',
		'Falcon',
		'Lion',
		'Bear',
		'Fox',
		'Hawk',
		'Ninja',
		'Wizard',
		'Knight',
		'Samurai',
		'Warrior'
	];

	let attempts = 0;
	const maxAttempts = 50;

	while (attempts < maxAttempts) {
		const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
		const noun = nouns[Math.floor(Math.random() * nouns.length)];
		const number = Math.floor(Math.random() * 1000);
		const username = `${adjective}${noun}${number}`;

		if (await isNicknameAvailable(username)) {
			return username;
		}
		attempts++;
	}

	// Fallback to timestamp-based username
	return `Player${Date.now()}`;
}

export async function signUp(email: string, password: string, nickname: string): Promise<User> {
	if (!email?.trim() || !password?.trim() || !nickname?.trim()) {
		throw new Error('Email, password, and nickname are required');
	}

	// Check if nickname is already taken
	const nicknameLower = nickname.trim().toLowerCase();
	const isAvailable = await isNicknameAvailable(nicknameLower);
	if (!isAvailable) {
		throw new Error('This username is already taken. Please choose another one.');
	}

	const userCredential = await createUserWithEmailAndPassword(auth, email, password);
	const user = userCredential.user;

	// Use a batch to ensure atomicity
	const batch = writeBatch(db);

	// Create user profile
	const userDoc = doc(db, 'users', user.uid);
	batch.set(userDoc, {
		uid: user.uid,
		email: user.email,
		nickname: nickname.trim(),
		createdAt: serverTimestamp(),
		gamesPlayed: 0,
		gamesWon: 0
	} as UserProfile);

	// Reserve the nickname
	const nicknameDoc = doc(db, 'usernames', nicknameLower);
	batch.set(nicknameDoc, {
		uid: user.uid,
		nickname: nickname.trim(),
		createdAt: serverTimestamp()
	});

	await batch.commit();

	try {
		await sendEmailVerification(user);
	} catch {
		// Silently fail - verification email is optional
	}

	await new Promise((resolve) => setTimeout(resolve, 500));

	return user;
}

export async function signIn(email: string, password: string): Promise<User> {
	if (!email?.trim() || !password?.trim()) {
		throw new Error('Email and password are required');
	}

	const userCredential = await signInWithEmailAndPassword(auth, email, password);
	return userCredential.user;
}

export async function signOut(): Promise<void> {
	await firebaseSignOut(auth);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
	const userRef = doc(db, 'users', uid);
	const snap = await getDoc(userRef);

	if (!snap.exists()) {
		return null;
	}

	return snap.data() as UserProfile;
}

export function onAuthChange(callback: (user: User | null) => void) {
	return onAuthStateChanged(auth, callback);
}

// Get top players for leaderboard
export async function getLeaderboard(limitCount: number = 10): Promise<UserProfile[]> {
	const usersCol = collection(db, 'users');
	const q = query(
		usersCol,
		where('gamesWon', '>', 0),
		orderBy('gamesWon', 'desc'),
		limit(limitCount)
	);
	const snapshot = await getDocs(q);
	return snapshot.docs.map((doc) => doc.data() as UserProfile);
}

// ====================================
// ROOM FUNCTIONS
// ====================================

export async function createRoomInFirestore(
	hostUid: string,
	hostNickname: string
): Promise<string> {
	if (!hostUid?.trim() || !hostNickname?.trim()) throw new Error('Invalid host data');

	const roomsCol = collection(db, 'rooms');
	const q = query(roomsCol, where('host', '==', hostUid));
	const existing = await getDocs(q);
	const now = new Date();
	const activeCount = existing.docs.filter((d) => {
		const data = d.data();
		const status = data.status;
		const expireAt = data.expireAt;
		const notFinished = status !== 'finished';
		let notExpired = true;
		if (expireAt) {
			try {
				notExpired = expireAt.toDate ? expireAt.toDate() > now : new Date(expireAt) > now;
			} catch {
				notExpired = true;
			}
		}
		return notFinished && notExpired;
	}).length;

	if (activeCount >= 5) {
		throw new Error(
			'You already have 5 active games. Close or wait for one to expire before creating another.'
		);
	}

	const ttlDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
	const roomDoc = await addDoc(roomsCol, {
		host: hostUid,
		status: 'waiting',
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
		expireAt: ttlDate,
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

export async function joinRoomInFirestore(
	roomCode: string,
	uid: string,
	nickname: string
): Promise<string> {
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

	const currentPlayers = data.players ? Object.keys(data.players).length : 0;
	if (currentPlayers >= GAME_CONFIG.maxPlayers) {
		throw new Error('Room is full');
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

export async function startGameInFirestore(
	roomCode: string,
	difficulty: Difficulty = 'easy'
): Promise<void> {
	if (!roomCode?.trim()) throw new Error('Invalid room code');

	const roomRef = doc(db, 'rooms', roomCode);
	const snap = await getDoc(roomRef);
	if (!snap.exists()) throw new Error('Room not found');

	const data = snap.data();
	if (data?.game?.started) throw new Error('Game already started');

	const s = getSudoku(difficulty);
	const puzzleStr = s.puzzle.replace(/-/g, '.');
	const solutionStr = s.solution;

	const playerStates: { [uid: string]: Player } = {};
	const playerUids = Object.keys(data.players || {});
	if (playerUids.length < GAME_CONFIG.minPlayers)
		throw new Error(`Need at least ${GAME_CONFIG.minPlayers} players to start`);
	if (playerUids.length > GAME_CONFIG.maxPlayers)
		throw new Error(`Too many players (max ${GAME_CONFIG.maxPlayers})`);

	Object.keys(data.players).forEach((uid) => {
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

export async function makeMove(roomCode: string, uid: string, position: number): Promise<boolean> {
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

	const playerUids = Object.keys(updatedPlayers);
	const currentIdx = playerUids.indexOf(uid);
	const nextPlayer = playerUids[(currentIdx + 1) % playerUids.length];

	Object.keys(updatedPlayers).forEach((playerUid) => {
		updatedPlayers[playerUid].isCurrentPlayer = playerUid === nextPlayer;
	});

	const nextNumber = Math.floor(Math.random() * 9) + 1;
	const ttlDate = new Date(Date.now() + 2 * 60 * 60 * 1000);

	const moveRef = doc(collection(db, 'rooms', roomCode, 'moves'));
	batch.set(moveRef, {
		moveNumber: (await getMoveCount(roomCode)) + 1,
		player: updatedPlayers[uid].nickname,
		position,
		numberPlaced: game.currentNumber,
		isValid: isCorrect,
		timestamp: serverTimestamp(),
		chosenNextNumber: nextNumber,
		expireAt: ttlDate
	} as Move);

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

	const gameFinished = updatedPlayers[uid].lives <= 0;
	if (gameFinished) {
		batch.update(roomRef, { expireAt: ttlDate });

		for (const puid of Object.keys(updatedPlayers)) {
			const userRef = doc(db, 'users', puid);
			batch.set(userRef, { gamesPlayed: increment(1) }, { merge: true });
		}
		const winnerUid = nextPlayer;
		if (winnerUid) {
			const winnerRef = doc(db, 'users', winnerUid);
			batch.set(winnerRef, { gamesWon: increment(1) }, { merge: true });
		}
	}

	await batch.commit();
	return isCorrect;
}

async function getMoveCount(roomCode: string): Promise<number> {
	const snap = await getDocs(collection(db, 'rooms', roomCode, 'moves'));
	return snap.size;
}

export function checkGameOver(game: GameState): string | null {
	const eliminated = Object.values(game.players).find((p) => p.lives <= 0);
	if (eliminated) {
		const winner = Object.values(game.players).reduce((prev, curr) =>
			prev.lives > curr.lives ? prev : curr
		);
		return winner.nickname;
	}
	return null;
}
