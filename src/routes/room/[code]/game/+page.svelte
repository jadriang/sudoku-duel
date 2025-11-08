<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		doc,
		onSnapshot,
		collection,
		query,
		orderBy,
		increment,
		type Timestamp,
		type FieldValue
	} from 'firebase/firestore';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		db,
		type GameState,
		type Move,
		onAuthChange,
		getUserProfile,
		type UserProfile
	} from '$lib/firebase';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { writeBatch, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
	import { COLORS, GAME_CONFIG } from '$lib/config';

	const code = $page.params.code;

	let user: { uid: string; emailVerified: boolean } | null = null;
	let userProfile: UserProfile | null = null;
	let room: {
		game?: GameState;
		host?: string;
		status?: 'waiting' | 'active' | 'finished';
	} | null = null;
	let moves: Move[] = [];
	let unsub: Array<() => void> = [];
	let loading = true;
	let authLoading = true;
	let error = '';
	let lastMoveResult: boolean | null = null;
	let flashingCell: number | null = null;

	let lastSeenMoveNumber = 0;
	let tempNumbers: Record<number, string> = {};

	// Helper function to get available numbers that can still be played
	function getAvailableNumbers(board: string, solution: string): number[] {
		const available = new SvelteSet<number>();

		// Check each empty cell to see what numbers can be played
		for (let i = 0; i < board.length; i++) {
			if (board[i] === '.') {
				const solutionNumber = parseInt(solution[i]);
				if (!isNaN(solutionNumber)) {
					available.add(solutionNumber);
				}
			}
		}

		return Array.from(available).sort();
	}

	async function makeMove(roomCode: string, uid: string, position: number): Promise<boolean> {
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

		const boardAfterMove = newBoard.join('');
		const availableNumbers = getAvailableNumbers(boardAfterMove, game.solution);

		let nextNumber: number;
		const ttlDate = new Date(Date.now() + 2 * 60 * 60 * 1000);

		if (availableNumbers.length === 0) {
			// Game is complete! Someone wins
			const otherPlayer = playerUids.find((id) => id !== uid);
			const winnerUid = otherPlayer ? otherPlayer : uid;
			const winnerNickname = winnerUid
				? updatedPlayers[winnerUid].nickname
				: updatedPlayers[uid].nickname;

			batch.update(roomRef, {
				game: {
					...game,
					board: boardAfterMove,
					players: updatedPlayers,
					lastMoveBy: updatedPlayers[uid].nickname,
					winner: winnerNickname,
					status: 'finished'
				},
				status: 'finished',
				expireAt: ttlDate,
				updatedAt: serverTimestamp()
			});

			const moveCount = (await getDocs(collection(db, 'rooms', roomCode, 'moves'))).size;
			const moveRef = doc(collection(db, 'rooms', roomCode, 'moves'));
			batch.set(moveRef, {
				moveNumber: moveCount + 1,
				player: updatedPlayers[uid].nickname,
				position,
				numberPlaced: game.currentNumber,
				isValid: isCorrect,
				timestamp: serverTimestamp(),
				chosenNextNumber: null,
				expireAt: ttlDate
			} as Move);

			for (const puid of playerUids) {
				const userRef = doc(db, 'users', puid);
				batch.set(userRef, { gamesPlayed: increment(1) }, { merge: true });
			}
			batch.set(doc(db, 'users', winnerUid), { gamesWon: increment(1) }, { merge: true });

			await batch.commit();
			return isCorrect;
		}

		// Select a random number from available numbers
		nextNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];

		Object.keys(updatedPlayers).forEach((playerUid) => {
			updatedPlayers[playerUid].isCurrentPlayer = playerUid === nextPlayer;
		});

		const moveCount = (await getDocs(collection(db, 'rooms', roomCode, 'moves'))).size;
		const moveRef = doc(collection(db, 'rooms', roomCode, 'moves'));
		batch.set(moveRef, {
			moveNumber: moveCount + 1,
			player: updatedPlayers[uid].nickname,
			position,
			numberPlaced: game.currentNumber,
			isValid: isCorrect,
			timestamp: serverTimestamp(),
			chosenNextNumber: nextNumber,
			expireAt: ttlDate
		} as Move);

		// Check if current player lost all lives
		const gameStatus = updatedPlayers[uid].lives <= 0 ? 'finished' : 'active';
		const winner = updatedPlayers[uid].lives <= 0 ? updatedPlayers[nextPlayer].nickname : null;

		batch.update(roomRef, {
			game: {
				...game,
				board: boardAfterMove,
				players: updatedPlayers,
				currentNumber: nextNumber,
				lastMoveBy: updatedPlayers[uid].nickname,
				winner: winner,
				status: gameStatus
			},
			status: gameStatus,
			updatedAt: serverTimestamp()
		});

		if (gameStatus === 'finished') {
			batch.update(roomRef, { expireAt: ttlDate });

			for (const puid of playerUids) {
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

	onMount(() => {
		const unsubAuth = onAuthChange(async (authUser) => {
			user = authUser;
			if (authUser) {
				// require email verification
				if (!authUser.emailVerified) {
					await goto(resolve('/auth'));
					return;
				}

				userProfile = await getUserProfile(authUser.uid);
				if (!userProfile) {
					await goto(resolve('/auth'));
					return;
				}
				authLoading = false;
			} else {
				await goto(resolve('/auth'));
				return;
			}
		});

		if (!code) {
			error = 'Missing room code';
			loading = false;
			return;
		}

		const roomRef = doc(db, 'rooms', code);
		const unsubRoom = onSnapshot(
			roomRef,
			(snap) => {
				if (!snap.exists()) {
					error = 'Room not found';
					loading = false;
					return;
				}
				const data = snap.data();
				room = data as {
					game?: GameState;
					host?: string;
					status?: 'waiting' | 'active' | 'finished';
				};
				loading = false;
			},
			(err) => {
				console.error(err);
				error = 'Failed to load game';
				loading = false;
			}
		);

		const movesRef = collection(db, 'rooms', code, 'moves');
		const movesQuery = query(movesRef, orderBy('moveNumber', 'desc'));
		const unsubMoves = onSnapshot(
			movesQuery,
			(snapshot) => {
				moves = snapshot.docs.map((doc) => doc.data() as Move);

				if (snapshot.docs.length > 0) {
					const latest = snapshot.docs[0].data() as Move;
					const mvNumber = latest.moveNumber || 0;

					if (mvNumber > lastSeenMoveNumber) {
						lastSeenMoveNumber = mvNumber;

						const myNickname = user?.uid && room?.game?.players?.[user.uid]?.nickname;
						if (!myNickname || latest.player !== myNickname) {
							flashingCell = latest.position;
							lastMoveResult = latest.isValid ?? null;
							if (latest.numberPlaced != null) {
								tempNumbers[latest.position] = String(latest.numberPlaced);
							}

							setTimeout(() => {
								delete tempNumbers[latest.position];
								flashingCell = null;
								lastMoveResult = null;
							}, 2000);
						}
					}
				}
			},
			(err) => console.error('Failed to load moves:', err)
		);

		unsub = [unsubRoom, unsubMoves, unsubAuth];
	});

	onDestroy(() => {
		unsub.forEach((fn) => fn());
	});

	const goBack = async () => await goto(resolve(`/room/${code}`));

	function borderClasses(r: number, c: number) {
		const borders = [];
		if (r % 3 === 0) borders.push('border-t-4');
		else borders.push('border-t');

		if (c % 3 === 0) borders.push('border-l-4');
		else borders.push('border-l');

		if (c === 8) borders.push('border-r-4');
		else borders.push('border-r');

		if (r === 8) borders.push('border-b-4');
		else borders.push('border-b');

		return borders.join(' ') + ' border-black';
	}

	async function handleCellClick(position: number) {
		if (!room?.game || !user) return;

		const game = room.game;
		const player = game.players[user.uid];

		if (!player?.isCurrentPlayer) return;
		if (game.board[position] !== '.') return;

		try {
			flashingCell = position;
			const result = await makeMove(code as string, user.uid, position);
			lastMoveResult = result;

			setTimeout(() => {
				flashingCell = null;
				setTimeout(() => (lastMoveResult = null), 1500);
			}, 500);
		} catch (err) {
			console.error(err);
			error = (err as Error)?.message ?? 'Failed to make move';
			flashingCell = null;
		}
	}

	function formatTimestamp(timestamp: Timestamp | FieldValue | Date | null | undefined): string {
		if (!timestamp) return '';
		if (timestamp instanceof Date) {
			return timestamp.toLocaleTimeString();
		}
		if (
			typeof timestamp === 'object' &&
			'toDate' in timestamp &&
			typeof timestamp.toDate === 'function'
		) {
			return timestamp.toDate().toLocaleTimeString();
		}
		return '';
	}

	$: isMyTurn = (user && room?.game?.players[user.uid]?.isCurrentPlayer) ?? false;
	$: currentNumber = room?.game?.currentNumber;
	$: myLives = (user && room?.game?.players[user.uid]?.lives) ?? GAME_CONFIG.maxLives;
	$: winner = room?.game?.winner;
	$: gameOver = room?.status === 'finished' || winner !== null;
	$: playersList = room?.game?.players ? Object.values(room.game.players) : [];
</script>

<div
	class="flex min-h-screen items-center justify-center p-2 sm:p-4"
	style="background-color: {COLORS.primary}"
>
	{#if authLoading}
		<!-- Loading state while checking authentication -->
		<div class="text-center">
			<h1
				class="retro-text mb-4 animate-pulse text-2xl sm:text-4xl md:text-5xl"
				style="color: {COLORS.secondary}"
			>
				🎮 SUDOKU DUEL
			</h1>
			<p class="retro-text animate-pulse text-xs sm:text-sm" style="color: {COLORS.secondary}">
				LOADING...
			</p>
		</div>
	{:else}
		<div
			class="retro-box w-full max-w-[98vw] p-3 sm:p-6"
			style="background-color: {COLORS.secondary}"
		>
			<!-- Header -->
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h2 class="retro-text text-[10px] sm:text-sm md:text-lg" style="color: {COLORS.primary}">
					🎮 GAME
				</h2>
				<button
					on:click={goBack}
					class="retro-button px-2 py-1 hover:opacity-90 sm:px-3 sm:py-2"
					style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
				>
					<span class="text-[10px] sm:text-xs">❌</span>
				</button>
			</div>

			{#if loading}
				<div class="py-12 text-center">
					<p class="retro-text animate-pulse text-xs sm:text-sm" style="color: {COLORS.primary}">
						LOADING...
					</p>
				</div>
			{:else if error}
				<div
					class="retro-box p-3 text-center sm:p-4"
					style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
				>
					<p class="retro-text text-[10px] sm:text-xs">⚠️ {error}</p>
				</div>
			{:else if room?.game?.started}
				<div class="flex flex-col gap-3 sm:gap-4 lg:grid lg:grid-cols-4">
					<!-- Top/Left: Status (Mobile First) -->
					<div class="space-y-3 sm:space-y-4 lg:col-span-1">
						<!-- Current Number or Game Over -->
						<div class="retro-box bg-white p-3 text-center sm:p-4">
							{#if gameOver}
								<div class="space-y-2">
									<div class="animate-bounce text-3xl sm:text-4xl">🏆</div>
									<p class="retro-text text-[10px] sm:text-xs" style="color: {COLORS.primary}">
										WINNER:
									</p>
									<p
										class="retro-text text-xs break-all sm:text-sm"
										style="color: {COLORS.primary}"
									>
										{winner}
									</p>
									<button
										on:click={goBack}
										class="retro-button mt-2 w-full px-3 py-2 hover:opacity-90"
										style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
									>
										<span class="text-[10px] sm:text-xs">LOBBY</span>
									</button>
								</div>
							{:else}
								<p class="retro-text mb-2 text-[10px] sm:text-xs" style="color: {COLORS.primary}">
									NUMBER:
								</p>
								<p class="retro-text text-4xl sm:text-5xl" style="color: {COLORS.primary}">
									{currentNumber}
								</p>
								{#if isMyTurn}
									<p
										class="retro-text mt-2 animate-pulse text-[10px] sm:text-xs"
										style="color: {COLORS.primary}"
									>
										YOUR TURN!
									</p>
								{/if}
							{/if}
						</div>

						<!-- Players -->
						<div class="retro-box bg-white p-3 sm:p-4">
							<h3
								class="retro-text mb-2 text-[10px] sm:mb-3 sm:text-xs"
								style="color: {COLORS.primary}"
							>
								👥 PLAYERS
							</h3>
							<div class="space-y-2">
								{#each playersList as player (player.nickname)}
									<div
										class="retro-box p-2"
										style="background-color: {COLORS.secondary}; {player.isCurrentPlayer
											? `ring-2 sm:ring-4; ring-color: ${COLORS.primary}`
											: ''}"
									>
										<div class="mb-1 flex items-center justify-between">
											<span
												class="retro-text text-[8px] break-all sm:text-[10px]"
												style="color: {COLORS.primary}"
											>
												{player.nickname}
											</span>
										</div>
										<div class="flex gap-1">
											{#each Array.from({ length: GAME_CONFIG.maxLives }, (_, i) => i) as i (i)}
												<span class="text-sm sm:text-lg">
													{i < player.lives ? '❤️' : '🖤'}
												</span>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Move Feedback -->
						{#if lastMoveResult !== null}
							<div
								class="retro-box shake p-2 text-center sm:p-3"
								style="background-color: {COLORS.primary}"
							>
								<p class="retro-text text-[10px] sm:text-xs" style="color: {COLORS.secondary}">
									{lastMoveResult ? '✓ CORRECT!' : `✗ WRONG! ${myLives}♥`}
								</p>
							</div>
						{/if}
					</div>

					<!-- Center: Game Board -->
					<div class="order-first flex items-center justify-center lg:order-none lg:col-span-2">
						<div class="retro-box inline-block bg-white p-1 sm:p-2">
							<div class="grid grid-cols-9 gap-0">
								{#each Array.from({ length: 9 }, (_, r) => r) as r (r)}
									{#each Array.from({ length: 9 }, (_, c) => c) as c (`${r}-${c}`)}
										{@const position = r * 9 + c}
										{@const value = room.game.board[position]}
										{@const isPuzzleNumber = room.game.puzzle[position] !== '.'}
										{@const isFlashing = flashingCell === position}
										<!-- svelte-ignore a11y-click-events-have-key-events -->
										<!-- svelte-ignore a11y-no-static-element-interactions -->
										<div
											class={`
                                            flex h-9 w-9 items-center justify-center sm:h-11 sm:w-11 md:h-14 md:w-14
                                            ${borderClasses(r, c)}
                                            ${isPuzzleNumber ? '' : 'bg-white'}
                                            ${isMyTurn && !isPuzzleNumber && !gameOver ? 'cursor-pointer hover:opacity-50 active:opacity-75' : 'cursor-not-allowed'}
                                            ${isFlashing && lastMoveResult !== null ? (lastMoveResult ? 'flash-correct' : 'flash-incorrect') : ''}
                                            transition-colors
                                        `}
											style="background-color: {isPuzzleNumber
												? COLORS.secondary
												: 'white'}; {isMyTurn && !isPuzzleNumber && !gameOver
												? `hover:background-color: ${COLORS.secondary}`
												: ''}"
											on:click={() => !isPuzzleNumber && !gameOver && handleCellClick(position)}
										>
											<span
												class="retro-text board-number text-sm sm:text-base md:text-xl"
												style="color: {COLORS.primary}"
											>
												<!-- {value !== '.' ? value : ''} -->
												{tempNumbers[position] ?? (value !== '.' ? value : '')}
											</span>
										</div>
									{/each}
								{/each}
							</div>
						</div>
					</div>

					<!-- Right/Bottom: Move History -->
					<div class="retro-box bg-white p-3 sm:p-4 lg:col-span-1">
						<h3
							class="retro-text mb-2 text-[10px] sm:mb-3 sm:text-xs"
							style="color: {COLORS.primary}"
						>
							📜 MOVES
						</h3>
						<div class="max-h-48 space-y-2 overflow-y-auto sm:max-h-64 lg:max-h-96">
							{#if moves.length === 0}
								<p class="retro-text py-4 text-center text-[8px] text-gray-500 sm:text-[10px]">
									NO MOVES
								</p>
							{:else}
								{#each moves as move (move.moveNumber)}
									<div class="retro-box p-2 text-xs" style="background-color: {COLORS.secondary}">
										<div class="mb-1 flex justify-between">
											<span class="retro-text text-[8px] sm:text-[10px]">#{move.moveNumber}</span>
											<span class="text-[8px] sm:text-[10px]"
												>{formatTimestamp(move.timestamp)}</span
											>
										</div>
										<div class="flex items-center justify-between">
											<span class="truncate text-[8px] sm:text-[10px]">{move.player}</span>
											<div class="flex items-center gap-1">
												<span class="retro-text text-xs sm:text-sm" style="color: {COLORS.primary}"
													>{move.numberPlaced}</span
												>
												<span class="text-sm sm:text-lg">{move.isValid ? '✓' : '✗'}</span>
											</div>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<div class="py-12 text-center">
					<p class="retro-text text-xs sm:text-sm" style="color: {COLORS.primary}">WAITING...</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

	.retro-text {
		font-family: 'Press Start 2P', cursive;
	}

	.retro-box {
		border: 3px solid #000;
		box-shadow: 6px 6px 0px rgba(0, 0, 0, 0.3);
	}

	.retro-button {
		font-family: 'Press Start 2P', cursive;
		border: 3px solid #000;
		box-shadow: 4px 4px 0px rgba(0, 0, 0, 0.3);
	}

	@keyframes flash-correct {
		0%,
		100% {
			background-color: white;
		}
		50% {
			background-color: #4ade80;
		}
	}

	@keyframes flash-incorrect {
		0%,
		100% {
			background-color: white;
		}
		50% {
			background-color: #ef4444;
		}
	}

	.flash-correct {
		animation: flash-correct 0.5s ease-in-out;
	}

	.flash-incorrect {
		animation: flash-incorrect 0.5s ease-in-out;
	}

	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		25% {
			transform: translateX(-5px);
		}
		75% {
			transform: translateX(5px);
		}
	}

	.shake {
		animation: shake 0.3s ease-in-out;
	}

	.board-number {
		font-family:
			Inter,
			system-ui,
			-apple-system,
			'Segoe UI',
			Roboto,
			'Helvetica Neue',
			Arial;
		font-weight: 700;
		letter-spacing: 0.8px;
		line-height: 1;
		/* remove retro text shadow for better legibility on numbers */
		text-shadow: none;
	}
</style>
