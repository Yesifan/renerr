import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getSecretKey } from '$lib/server/env';

export function encryptCredential(plain: string) {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', getSecretKey(), iv);
	const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptCredential(value: string) {
	const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64'));
	const decipher = createDecipheriv('aes-256-gcm', getSecretKey(), iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
