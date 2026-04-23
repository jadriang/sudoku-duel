let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
	if (!ctx) ctx = new AudioContext();
	return ctx;
}

function beep(freq: number, duration: number, gain = 0.25, type: OscillatorType = 'square') {
	const c = getCtx();
	const osc = c.createOscillator();
	const g = c.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, c.currentTime);
	g.gain.setValueAtTime(gain, c.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
	osc.connect(g);
	g.connect(c.destination);
	osc.start(c.currentTime);
	osc.stop(c.currentTime + duration);
}

export function playCorrect() {
	beep(523, 0.1);
	setTimeout(() => beep(659, 0.1), 80);
	setTimeout(() => beep(784, 0.2), 160);
}

export function playIncorrect() {
	beep(220, 0.08, 0.3);
	setTimeout(() => beep(180, 0.2, 0.2), 80);
}

export function playYourTurn() {
	beep(440, 0.08, 0.15);
	setTimeout(() => beep(880, 0.15, 0.15), 100);
}

export function playGameOver(won: boolean) {
	if (won) {
		[523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.15), i * 100));
	} else {
		[400, 320, 240].forEach((f, i) => setTimeout(() => beep(f, 0.2, 0.3), i * 120));
	}
}
