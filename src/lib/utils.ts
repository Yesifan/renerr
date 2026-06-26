import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type WithElementRef<T> = T & {
	ref?: HTMLElement | SVGElement | null;
};

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
