// store.ts
import { writable } from 'svelte/store';

export const globalCode = writable('');

export const updateGlobalCode = (code: string) => {
    globalCode.set(code);
    console.log('Code updated: ' + code);
};

export const getGlobalCode = () => {
    return globalCode;
};
