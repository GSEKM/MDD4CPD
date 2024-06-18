import { writable } from 'svelte/store';

// store.ts

const globalCode = writable('');

globalCode.subscribe((code) => {
    // Generate Arduino code based on selected modal nodes
    // Update the code variable with the generated code
});

export const updateGlobalCode = (code: string) => {
    globalCode.set(code);
    console.log('Code updated:', code)
};
export const getGlobalCode = () => globalCode;