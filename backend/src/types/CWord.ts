export default class CWord {
    private width: number;
    private height: number;
    private left: number;
    private top: number;
    private text: string;

    constructor(width: number, height: number, left: number, top: number, text: string) {
        this.width = width;
        this.height = height;
        this.left = left;
        this.top = top;
        this.text = text;
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
        return this.top;
    }

    getText() {
        return this.text;
    }

    setWidth(width: number) {
        this.width = width;
    }

    setHeight(height: number) {
        this.height = height;
    }

    setLeft(left: number) {
        this.left = left;
    }

    setTop(top: number) {
        this.top = top;
    }

    setText(text: string) {
        this.text = text;
    }

}