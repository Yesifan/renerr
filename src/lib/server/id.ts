const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newId() {
	let time = Date.now();
	let value = '';
	for (let i = 0; i < 10; i += 1) {
		value = alphabet[time % 32] + value;
		time = Math.floor(time / 32);
	}
	for (let i = 0; i < 16; i += 1) {
		value += alphabet[Math.floor(Math.random() * 32)];
	}
	return value;
}
