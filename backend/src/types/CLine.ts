import Word from "./CWord.js";

export default class CLine {
    private width: number;
    private height: number;
    private left: number;
    private top: number;
    private words: Word[];
    private ignoreLine: boolean = false;

    constructor(width: number, height: number, left: number, top: number) {
        this.width = width;
        this.height = height;
        this.left = left;
        this.top = top;
        this.words = [];
    }

    addWord(word: Word) {
        this.words.push(word);
    }

    getWidth() {
        return this.width;
    }

    getHeight() {
        return this.height;
    }

    getLeft() {
        return this.left;
    }

    getTop() {
        return this.top
    }
    
    getWords() {
        return this.words;
    }

    getIgnoreLine() {
        return this.ignoreLine;
    }

    setIgnoreLine(ignoreLine: boolean) {
        this.ignoreLine = ignoreLine;
    }
}